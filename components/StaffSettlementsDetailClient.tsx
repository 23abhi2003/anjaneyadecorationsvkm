"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  useDisclosure,
} from "@heroui/react";
import {
  Receipt,
  Trash2,
  Calendar,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  ListTodo,
  Wallet,
  Layers,
  ArrowLeft,
  User,
} from "lucide-react";
import type { StaffAssignmentRecord, StaffBorrow, StaffMember } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import {
  groupAssignmentsBySettlement,
  inr,
  parseAmt,
  type StaffSettlementSummary,
} from "@/lib/staffPay";
import BackButton from "@/components/BackButton";
import StaffSettlementModal from "@/components/StaffSettlementModal";

function formatDate(d?: string): string {
  if (!d) return "—";
  const p = d.split("-");
  if (p.length === 3) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[parseInt(p[1], 10) - 1] || p[1];
    return `${p[2]} ${month} ${p[0]}`;
  }
  return d;
}

interface StaffSettlementsDetailClientProps {
  staff: StaffMember;
  onRefresh?: () => void;
}

export default function StaffSettlementsDetailClient({
  staff,
  onRefresh,
}: StaffSettlementsDetailClientProps) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const isSelf = staff.id === user?.staffId;

  const { settlements, totalSettledAmount, totalSettledOrders } = useMemo(
    () => groupAssignmentsBySettlement(staff.assignments, staff.borrows),
    [staff.assignments, staff.borrows]
  );

  // All settled borrows for this staff member (cleared in settlement batches)
  const allSettledBorrows = useMemo(() => {
    return (staff.borrows || [])
      .filter((b) => b.paymentStatus === "settled" || (b.settlementNumber != null && Number(b.settlementNumber) > 0))
      .sort(
        (a, b) =>
          (b.date || "").localeCompare(a.date || "") ||
          (b.settledAt || "").localeCompare(a.settledAt || "") ||
          (b.createdAt || "").localeCompare(a.createdAt || "")
      );
  }, [staff.borrows]);

  const totalSettledBorrowsAmount = useMemo(
    () => allSettledBorrows.reduce((sum, b) => sum + parseAmt(b.amount), 0),
    [allSettledBorrows]
  );

  const netSettledPayout = totalSettledAmount - totalSettledBorrowsAmount;

  // Active view tab: "orders", "borrows", or "all"
  const [activeTab, setActiveTab] = useState<"orders" | "borrows" | "all">(() => {
    if (settlements.length === 0 && allSettledBorrows.length > 0) return "borrows";
    return "orders";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Expanded settlements set: each batch toggles independently
  const [expandedSettlements, setExpandedSettlements] = useState<Set<number>>(() => {
    if (settlements.length > 0) {
      return new Set([settlements[0].settlementNumber]);
    }
    return new Set();
  });

  // Delete confirmation state for settlement batch
  const [deletingNum, setDeletingNum] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  // Unsettle borrow state
  const [unsettlingId, setUnsettlingId] = useState<string | null>(null);
  const [unsettling, setUnsettling] = useState(false);

  // Create settlement modal state
  const { isOpen: isCreateOpen, onOpen: openCreate, onOpenChange: onCreateOpenChange } = useDisclosure();

  // Filtered settlements by order ID, program, customer or borrow reason
  const filteredSettlements = useMemo(() => {
    let list = [...settlements];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((s) => {
        if (`#${s.settlementNumber}`.includes(q) || String(s.settlementNumber) === q) return true;
        const matchesOrders = s.assignments.some(
          (a) =>
            a.orderId.toLowerCase().includes(q) ||
            (a.customerName || "").toLowerCase().includes(q) ||
            (a.program || "").toLowerCase().includes(q)
        );
        const matchesBorrows = s.borrows.some(
          (b) => (b.reason || "").toLowerCase().includes(q) || (b.date || "").includes(q)
        );
        return matchesOrders || matchesBorrows;
      });
    }

    if (sortOrder === "oldest") {
      list.sort((a, b) => a.settlementNumber - b.settlementNumber);
    } else {
      list.sort((a, b) => b.settlementNumber - a.settlementNumber);
    }

    return list;
  }, [settlements, searchQuery, sortOrder]);

  function toggleExpand(num: number): void {
    setExpandedSettlements((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  }

  async function handleDeleteSettlement(settlementNum: number): Promise<void> {
    if (!isOwner) return;
    setDeleting(true);
    setDeleteError("");
    setDeleteSuccess("");

    try {
      const res = await apiFetch(
        `/api/staff/${encodeURIComponent(staff.id)}/settlements/${encodeURIComponent(settlementNum)}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to delete settlement.");
      }

      setDeleteSuccess(`Settlement #${settlementNum} deleted. All orders and borrows returned to active.`);
      setDeletingNum(null);
      onRefresh?.();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete settlement.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleUnsettleBorrow(borrowId: string): Promise<void> {
    if (!isOwner) return;
    setUnsettling(true);
    setDeleteError("");
    setDeleteSuccess("");

    try {
      const res = await apiFetch(
        `/api/staff/${encodeURIComponent(staff.id)}/borrows/${encodeURIComponent(borrowId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentStatus: "due" }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to un-settle borrow.");
      }

      setDeleteSuccess("Borrow un-settled and returned to active borrows.");
      setUnsettlingId(null);
      onRefresh?.();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to un-settle borrow.");
    } finally {
      setUnsettling(false);
    }
  }

  if (!isOwner && !isSelf) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-[#F8F4E6]/70">You don&apos;t have permission to view this staff member&apos;s settlements.</p>
        <BackButton href="/settlements" label="Back to All Staff Settlements" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Mobile-Friendly Navigation Bar */}
      <div className="no-print flex items-center justify-between gap-2.5 flex-wrap">
        <BackButton href="/settlements" label="Back to Staff Settlements" />

        <Button
          as={Link}
          href={`/staff/assignments?id=${encodeURIComponent(staff.id)}`}
          variant="flat"
          radius="sm"
          size="sm"
          startContent={<ListTodo size={15} className="text-primary shrink-0" />}
          className="font-medium text-[#F8F4E6]/90 hover:text-primary bg-[#F8F4E6]/10 hover:bg-primary/20 border border-primary/40 hover:border-primary/70 transition-all shadow-sm"
        >
          View Active Assignments
        </Button>
      </div>

      {/* Staff Profile & Financial Summary Card */}
      <Card className="bg-content1 shadow-md border border-divider">
        <CardBody className="p-4 sm:p-6 space-y-5">
          {/* Top Line: Avatar, Staff Name, Phone, and + Create Settlement Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-divider">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-display text-2xl font-bold shadow-sm p-3 shrink-0">
                {staff.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1
                    className="text-2xl sm:text-3xl font-bold text-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {staff.name} — Settlements
                  </h1>
                  <Chip color="primary" variant="flat" size="sm" className="font-semibold text-xs">
                    {settlements.length} {settlements.length === 1 ? "Batch" : "Batches"}
                  </Chip>
                </div>
                <p className="text-xs text-foreground/60 mt-1 flex items-center gap-2 font-mono flex-wrap">
                  <span>Phone: <strong className="text-foreground">{staff.phone || "Not set"}</strong></span>
                  <span>&middot;</span>
                  <span>ID: <strong className="text-foreground">{staff.id}</strong></span>
                </p>
              </div>
            </div>

            {/* Owner Create Settlement Button */}
            {isOwner && (
              <div className="sm:self-center shrink-0">
                <Button
                  color="primary"
                  variant="solid"
                  radius="sm"
                  onPress={openCreate}
                  className="w-full sm:w-auto font-semibold shadow-sm h-10 px-4 text-xs sm:text-sm"
                  startContent={<Receipt size={16} />}
                >
                  + Create Settlement
                </Button>
              </div>
            )}
          </div>

          {/* 3 Metric Summary KPI Cards (Compact 3-columns for mobile & desktop) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            {/* Orders Settled */}
            <div className="bg-content2/50 rounded-xl p-3 sm:p-4 border border-divider flex flex-col justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-foreground/50 uppercase tracking-wider truncate">
                  Orders Settled
                </p>
                <p className="text-lg sm:text-2xl font-bold text-success font-display mt-0.5 truncate">
                  {inr(totalSettledAmount)}
                </p>
              </div>
              <p className="text-[10px] sm:text-xs text-foreground/60 mt-1 font-mono truncate">
                {totalSettledOrders} orders cleared
              </p>
            </div>

            {/* Borrows Deducted */}
            <div className="bg-content2/50 rounded-xl p-3 sm:p-4 border border-divider flex flex-col justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-foreground/50 uppercase tracking-wider truncate">
                  Borrows Deducted
                </p>
                <p className="text-lg sm:text-2xl font-bold text-warning font-display mt-0.5 truncate">
                  {totalSettledBorrowsAmount > 0 ? `-${inr(totalSettledBorrowsAmount)}` : inr(0)}
                </p>
              </div>
              <p className="text-[10px] sm:text-xs text-foreground/60 mt-1 font-mono truncate">
                {allSettledBorrows.length} borrows cleared
              </p>
            </div>

            {/* Net Settled Payout */}
            <div className="bg-primary/10 rounded-xl p-3 sm:p-4 border border-primary/30 flex flex-col justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider truncate">
                  Net Payout
                </p>
                <p className="text-lg sm:text-2xl font-bold text-foreground font-display mt-0.5 truncate">
                  {inr(netSettledPayout)}
                </p>
              </div>
              <p className="text-[10px] sm:text-xs text-foreground/60 mt-1 font-mono truncate">
                orders − borrows
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Notifications / Feedback */}
      {deleteError && (
        <div className="flex items-center gap-2 bg-danger/10 text-danger border border-danger/30 rounded-xl p-3 text-xs sm:text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {deleteSuccess && (
        <div className="flex items-center gap-2 bg-success/10 text-success border border-success/30 rounded-xl p-3 text-xs sm:text-sm">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{deleteSuccess}</span>
        </div>
      )}

      {/* Segmented Control Navigation Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Full-width segmented buttons on mobile */}
        <div className="grid grid-cols-3 p-1 bg-content1 rounded-xl border border-divider shadow-sm w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "orders"
                ? "bg-primary text-[#241129] font-bold shadow-sm"
                : "text-foreground/70 hover:text-foreground hover:bg-content2/60"
            }`}
          >
            <Receipt size={14} className="shrink-0" />
            <span className="truncate">Orders ({settlements.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("borrows")}
            className={`flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "borrows"
                ? "bg-primary text-[#241129] font-bold shadow-sm"
                : "text-foreground/70 hover:text-foreground hover:bg-content2/60"
            }`}
          >
            <Wallet size={14} className="shrink-0" />
            <span className="truncate">Borrows ({allSettledBorrows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "all"
                ? "bg-primary text-[#241129] font-bold shadow-sm"
                : "text-foreground/70 hover:text-foreground hover:bg-content2/60"
            }`}
          >
            <Layers size={14} className="shrink-0" />
            <span>All</span>
          </button>
        </div>

        {/* Search input for order/borrow records */}
        {(activeTab === "orders" || activeTab === "all") && (
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search order no, customer, date..."
              variant="bordered"
              size="sm"
              value={searchQuery}
              onValueChange={setSearchQuery}
              isClearable
              onClear={() => setSearchQuery("")}
              startContent={<Search size={15} className="text-foreground/50" />}
              className="bg-content1 rounded-lg"
            />
          </div>
        )}
      </div>

      {/* SECTION 1: ORDERS SETTLEMENTS */}
      {(activeTab === "orders" || activeTab === "all") && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2
                className="text-lg sm:text-xl font-bold text-[#F8F4E6] flex items-center gap-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <Receipt className="text-primary" size={20} />
                Orders Settlements ({filteredSettlements.length} Batches)
              </h2>
              <p className="text-xs text-[#F8F4E6]/60 mt-0.5">
                Settled orders history grouped by settlement batch
              </p>
            </div>

            <Select
              aria-label="Sort order"
              variant="bordered"
              size="sm"
              selectedKeys={[sortOrder]}
              onSelectionChange={(keys) => {
                const k = Array.from(keys)[0] as "newest" | "oldest" | undefined;
                if (k) setSortOrder(k);
              }}
              disallowEmptySelection
              className="w-32 sm:w-36 bg-content1 rounded-lg"
            >
              <SelectItem key="newest" className="text-xs">Newest first</SelectItem>
              <SelectItem key="oldest" className="text-xs">Oldest first</SelectItem>
            </Select>
          </div>

          {filteredSettlements.length === 0 ? (
            <Card className="bg-content1 border border-divider">
              <CardBody className="text-center py-12 px-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                  <Receipt size={24} />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {settlements.length === 0
                    ? `No order settlements created for ${staff.name} yet.`
                    : "No settlements match your search query."}
                </h3>
                <p className="text-xs text-foreground/50 max-w-sm mx-auto">
                  {settlements.length === 0
                    ? "Go to Active Assignments to select orders with checkboxes and create a settlement batch."
                    : "Try clearing your search query to see all settlements."}
                </p>
                {settlements.length === 0 && (
                  <Button
                    as={Link}
                    href={`/staff/assignments?id=${encodeURIComponent(staff.id)}`}
                    color="primary"
                    radius="sm"
                    size="sm"
                    className="font-semibold"
                  >
                    Go to Active Assignments
                  </Button>
                )}
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSettlements.map((s: StaffSettlementSummary) => {
                const isExpanded = expandedSettlements.has(s.settlementNumber);
                const isConfirmingDelete = deletingNum === s.settlementNumber;

                return (
                  <Card
                    key={s.settlementNumber}
                    className="bg-content1 border border-divider hover:border-primary/40 transition-all shadow-sm rounded-2xl"
                  >
                    <CardBody className="p-3.5 sm:p-5 space-y-3.5">
                      {/* Batch Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div
                          onClick={() => toggleExpand(s.settlementNumber)}
                          className="cursor-pointer flex items-start gap-3 flex-1 select-none"
                        >
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-mono font-bold text-sm flex items-center justify-center border border-primary/25 shrink-0">
                            #{s.settlementNumber}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <h3 className="text-sm sm:text-base font-bold text-foreground">
                                Settlement #{s.settlementNumber}
                              </h3>
                              <Chip color="success" variant="flat" size="sm" className="font-bold text-xs">
                                {inr(s.total)}
                              </Chip>
                              {s.borrowsTotal > 0 && (
                                <Chip color="warning" variant="flat" size="sm" className="font-semibold text-xs">
                                  -{inr(s.borrowsTotal)} borrow
                                </Chip>
                              )}
                              {s.borrowsTotal > 0 && (
                                <span className="text-xs font-mono font-semibold text-foreground/80">
                                  Net: <strong className="text-primary">{inr(s.netTotal)}</strong>
                                </span>
                              )}
                            </div>

                            {/* Date and Count Badges */}
                            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-foreground/60 mt-1 flex-wrap font-mono">
                              <span className="inline-flex items-center gap-1 bg-content2/80 px-2 py-0.5 rounded text-foreground/80">
                                <Calendar size={11} className="text-primary" />
                                {s.startDate === s.endDate ? formatDate(s.startDate) : `${formatDate(s.startDate)} – ${formatDate(s.endDate)}`}
                              </span>
                              {s.settledAt && (
                                <span className="hidden sm:inline">&middot; Settled on {formatDate(s.settledAt)}</span>
                              )}
                              <span>&middot;</span>
                              <span className="text-foreground font-medium">{s.orderCount} orders</span>
                              {s.borrowCount > 0 && (
                                <>
                                  <span>&middot;</span>
                                  <span className="text-warning font-medium">{s.borrowCount} borrows</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons on right (Delete & Toggle view) */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {isOwner && (
                            isConfirmingDelete ? (
                              <div className="flex items-center gap-1.5 bg-danger/10 px-2 py-1 rounded-lg border border-danger/30 text-xs">
                                <span className="text-danger font-medium">Delete #{s.settlementNumber}?</span>
                                <Button
                                  size="sm"
                                  color="danger"
                                  radius="sm"
                                  isLoading={deleting}
                                  onPress={() => handleDeleteSettlement(s.settlementNumber)}
                                  className="h-6 text-xs px-2.5 min-w-0 font-bold"
                                >
                                  Yes, Delete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="light"
                                  radius="sm"
                                  isDisabled={deleting}
                                  onPress={() => setDeletingNum(null)}
                                  className="h-6 text-xs px-1.5 min-w-0"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="light"
                                color="danger"
                                radius="sm"
                                onPress={() => setDeletingNum(s.settlementNumber)}
                                className="h-8 text-xs font-medium"
                                startContent={<Trash2 size={13} />}
                                title="Delete this settlement batch"
                              >
                                <span className="hidden sm:inline">Delete Settlement</span>
                                <span className="sm:hidden">Delete</span>
                              </Button>
                            )
                          )}

                          <Button
                            size="sm"
                            variant={isExpanded ? "bordered" : "flat"}
                            color="primary"
                            radius="sm"
                            onPress={() => toggleExpand(s.settlementNumber)}
                            className="h-8 text-xs font-semibold"
                            endContent={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          >
                            {isExpanded ? "Hide Orders" : `View Orders (${s.orderCount})`}
                          </Button>
                        </div>
                      </div>

                      {/* EXPANDED CONTENT: Mobile Cards + Desktop Table */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-divider/60 space-y-3">
                          <div className="flex items-center justify-between text-xs text-foreground/60 font-semibold px-1">
                            <span>SETTLED ORDERS ({s.assignments.length})</span>
                            <span className="font-mono text-success">Total: {inr(s.total)}</span>
                          </div>

                          {/* MOBILE VIEW (< md): Responsive Stacked Order Cards (NO horizontal scroll) */}
                          <div className="block md:hidden space-y-2">
                            {s.assignments.map((a: StaffAssignmentRecord) => (
                              <div
                                key={a.orderId}
                                className="bg-content2/40 rounded-xl p-3 border border-divider/60 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <Link
                                    href={`/orders/${encodeURIComponent(a.orderId)}`}
                                    className="font-mono text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                  >
                                    {a.orderId}
                                    <ExternalLink size={11} className="opacity-70" />
                                  </Link>
                                  <span className="font-mono font-bold text-sm text-success">
                                    {inr(parseAmt(a.amount))}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-foreground font-medium truncate">
                                    {a.customerName || "—"}
                                  </span>
                                  <span className="text-foreground/70 truncate text-right">
                                    {a.program || "—"}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 text-[11px] text-foreground/60 font-mono pt-1 border-t border-divider/40">
                                  <span>{formatDate(a.date)}</span>
                                  <Chip color="success" variant="flat" size="sm" className="h-5 text-[10px]">
                                    Paid &amp; Settled
                                  </Chip>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* DESKTOP VIEW (>= md): Clean Data Table */}
                          <div className="hidden md:block overflow-x-auto rounded-xl border border-divider/60">
                            <Table
                              aria-label={`Orders in settlement #${s.settlementNumber}`}
                              removeWrapper
                              className="min-w-full"
                            >
                              <TableHeader>
                                <TableColumn className="bg-content2/60 text-xs font-semibold">ORDER NO.</TableColumn>
                                <TableColumn className="bg-content2/60 text-xs font-semibold">DATE</TableColumn>
                                <TableColumn className="bg-content2/60 text-xs font-semibold">CUSTOMER</TableColumn>
                                <TableColumn className="bg-content2/60 text-xs font-semibold">PROGRAM</TableColumn>
                                <TableColumn className="bg-content2/60 text-xs font-semibold text-right">AMOUNT</TableColumn>
                                <TableColumn className="bg-content2/60 text-xs font-semibold text-center">STATUS</TableColumn>
                              </TableHeader>
                              <TableBody emptyContent="No orders in this settlement">
                                {s.assignments.map((a: StaffAssignmentRecord) => (
                                  <TableRow key={a.orderId} className="border-b border-divider/30 hover:bg-content2/40">
                                    <TableCell>
                                      <Link
                                        href={`/orders/${encodeURIComponent(a.orderId)}`}
                                        className="font-mono text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                                      >
                                        {a.orderId}
                                        <ExternalLink size={12} className="opacity-60" />
                                      </Link>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-foreground/80">
                                      {formatDate(a.date)}
                                    </TableCell>
                                    <TableCell className="text-xs text-foreground font-medium">
                                      {a.customerName || "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-foreground/80">
                                      {a.program || "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-xs text-success">
                                      {inr(parseAmt(a.amount))}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Chip color="success" variant="flat" size="sm" className="font-medium text-[11px]">
                                        Paid &amp; Settled
                                      </Chip>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: BORROW SETTLEMENTS */}
      {(activeTab === "borrows" || activeTab === "all") && (
        <div className="space-y-3 sm:space-y-4 pt-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2
                className="text-lg sm:text-xl font-bold text-[#F8F4E6] flex items-center gap-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <Wallet className="text-warning" size={20} />
                Borrow Settlements ({allSettledBorrows.length})
              </h2>
              <p className="text-xs text-[#F8F4E6]/60 mt-0.5">
                Staff borrowings deducted and cleared in settlement batches
              </p>
            </div>

            <Chip color="warning" variant="flat" size="md" className="font-bold text-xs sm:text-sm font-mono">
              Total Settled Borrows: -{inr(totalSettledBorrowsAmount)}
            </Chip>
          </div>

          <Card className="bg-content1 border border-divider shadow-sm rounded-2xl">
            <CardBody className="p-3.5 sm:p-5">
              {allSettledBorrows.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto text-warning">
                    <Wallet size={24} />
                  </div>
                  <p className="text-foreground font-semibold text-sm sm:text-base">
                    No borrows have been settled for {staff.name} yet.
                  </p>
                  <p className="text-xs text-foreground/50 max-w-sm mx-auto">
                    When staff borrows are included in a settlement batch, they are cleared here and removed from active assignments.
                  </p>
                  <Button
                    as={Link}
                    href={`/staff/assignments?id=${encodeURIComponent(staff.id)}`}
                    variant="flat"
                    color="warning"
                    radius="sm"
                    size="sm"
                    className="font-medium"
                  >
                    View Active Borrows &rarr;
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* MOBILE VIEW (< md): Responsive Stacked Cards (NO horizontal scroll) */}
                  <div className="block md:hidden space-y-2">
                    {allSettledBorrows.map((b: StaffBorrow) => {
                      const isUnsettlingThis = unsettlingId === b.id;
                      return (
                        <div
                          key={b.id}
                          className="bg-content2/40 rounded-xl p-3 border border-divider/60 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                              Batch #{b.settlementNumber || 1}
                            </span>
                            <span className="font-mono font-bold text-sm text-warning">
                              -{inr(parseAmt(b.amount))}
                            </span>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-foreground capitalize">
                              {b.reason || "Staff advance / borrow"}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[11px] text-foreground/60 font-mono pt-1.5 border-t border-divider/40">
                            <span>
                              Date: {formatDate(b.date)}
                              {b.settledAt && ` · Settled: ${formatDate(b.settledAt)}`}
                            </span>

                            {isOwner && (
                              isUnsettlingThis ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    color="warning"
                                    radius="sm"
                                    isLoading={unsettling}
                                    onPress={() => handleUnsettleBorrow(b.id)}
                                    className="h-6 text-[11px] px-2 min-w-0 font-bold"
                                  >
                                    Confirm
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="light"
                                    radius="sm"
                                    isDisabled={unsettling}
                                    onPress={() => setUnsettlingId(null)}
                                    className="h-6 text-[11px] px-1.5 min-w-0"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setUnsettlingId(b.id)}
                                  className="text-xs text-warning hover:underline font-semibold"
                                >
                                  Un-settle
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP VIEW (>= md): Clean Data Table */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-divider/60">
                    <Table aria-label="Settled borrows table" removeWrapper className="min-w-full">
                      <TableHeader>
                        <TableColumn className="bg-content2/60 text-xs font-semibold">SETTLEMENT BATCH</TableColumn>
                        <TableColumn className="bg-content2/60 text-xs font-semibold">BORROW DATE</TableColumn>
                        <TableColumn className="bg-content2/60 text-xs font-semibold">PURPOSE / REASON</TableColumn>
                        <TableColumn className="bg-content2/60 text-xs font-semibold text-right">DEDUCTED AMOUNT</TableColumn>
                        <TableColumn className="bg-content2/60 text-xs font-semibold text-center">SETTLED DATE</TableColumn>
                        <TableColumn className="bg-content2/60 text-xs font-semibold text-center">STATUS</TableColumn>
                        <TableColumn className="bg-content2/60 text-xs font-semibold text-center">{isOwner ? "ACTIONS" : ""}</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {allSettledBorrows.map((b: StaffBorrow) => {
                          const isUnsettlingThis = unsettlingId === b.id;
                          return (
                            <TableRow key={b.id} className="border-b border-divider/30 hover:bg-content2/40">
                              <TableCell>
                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                  Batch #{b.settlementNumber || 1}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-foreground/80">
                                {formatDate(b.date)}
                              </TableCell>
                              <TableCell className="text-xs text-foreground font-medium">
                                <span className="capitalize">{b.reason || "Staff advance / borrow"}</span>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-xs text-warning">
                                -{inr(parseAmt(b.amount))}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs text-foreground/70">
                                {formatDate(b.settledAt || b.date)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Chip color="primary" variant="flat" size="sm" className="font-medium text-[11px]">
                                  Settled in #{b.settlementNumber || 1}
                                </Chip>
                              </TableCell>
                              <TableCell className="text-center">
                                {isOwner ? (
                                  isUnsettlingThis ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <Button
                                        size="sm"
                                        color="warning"
                                        radius="sm"
                                        isLoading={unsettling}
                                        onPress={() => handleUnsettleBorrow(b.id)}
                                        className="h-6 text-xs px-2 min-w-0 font-medium"
                                      >
                                        Confirm
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="light"
                                        radius="sm"
                                        isDisabled={unsettling}
                                        onPress={() => setUnsettlingId(null)}
                                        className="h-6 text-xs px-1.5 min-w-0"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="bordered"
                                      color="warning"
                                      radius="sm"
                                      onPress={() => setUnsettlingId(b.id)}
                                      className="h-7 text-xs font-medium"
                                      title="Un-settle this borrow and move it back to active assignments"
                                    >
                                      Un-settle
                                    </Button>
                                  )
                                ) : (
                                  <span className="text-xs text-foreground/40 font-mono">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Create settlement modal */}
      <StaffSettlementModal
        isOpen={isCreateOpen}
        onOpenChange={onCreateOpenChange}
        staff={staff}
        selectedOrderIds={new Set()}
        onClearSelection={() => {}}
        onSettlementCreated={() => onRefresh?.()}
        isOwner={isOwner}
      />
    </div>
  );
}
