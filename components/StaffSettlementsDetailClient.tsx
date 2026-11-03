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

  // Active view tab: "orders", "borrows", or "all"
  const [activeTab, setActiveTab] = useState<"orders" | "borrows" | "all">(() => {
    if (settlements.length === 0 && allSettledBorrows.length > 0) return "borrows";
    return "orders";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Expanded settlements set: each batch toggles independently and reliably
  const [expandedSettlements, setExpandedSettlements] = useState<Set<number>>(new Set());

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

      setDeleteSuccess(`Settlement #${settlementNum} deleted successfully. All items returned to active.`);
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

      setDeleteSuccess("Borrow un-settled successfully and returned to active borrows.");
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
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <BackButton href="/settlements" label="Back to All Staff Settlements" />
        <Button
          as={Link}
          href={`/staff/assignments?id=${encodeURIComponent(staff.id)}`}
          variant="flat"
          radius="sm"
          size="sm"
          startContent={<ListTodo size={16} className="text-primary shrink-0 transition-transform group-hover:scale-110" />}
          className="group font-medium text-[#F8F4E6]/90 hover:text-[#D9A427] bg-[#F8F4E6]/10 hover:bg-[#D9A427]/20 border border-[#D9A427]/40 hover:border-[#D9A427]/70 transition-all shadow-sm"
        >
          View Active Assignments
        </Button>
      </div>

      {/* Staff profile & Financial Overview Card */}
      <div className="bg-content1 rounded-2xl p-5 sm:p-6 border border-[#D9A427]/30 shadow-sm space-y-5">
        {/* Top line: Avatar, name, phone, create button */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-divider/60">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 text-primary flex items-center justify-center font-display text-2xl font-bold shadow-sm p-3">
              {staff.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                  {staff.name} — Settlements
                </h1>
                <Chip color="primary" variant="flat" size="sm" className="font-semibold">
                  {settlements.length} {settlements.length === 1 ? "Batch" : "Batches"}
                </Chip>
              </div>
              <p className="text-xs text-foreground/70 mt-1 flex items-center gap-2 font-mono flex-wrap">
                <span>Phone: <strong className="text-foreground">{staff.phone || "Not set"}</strong></span>
                <span>&middot;</span>
                <span>ID: <strong className="text-foreground">{staff.id}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isOwner && (
              <Button
                color="primary"
                variant="solid"
                radius="sm"
                onPress={openCreate}
                className="font-semibold shadow-sm h-9 px-4 text-xs sm:text-sm"
                startContent={<Receipt size={16} />}
              >
                + Create Settlement
              </Button>
            )}
          </div>
        </div>

        {/* 3 Metric Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Orders Settled */}
          <div className="bg-content2/40 rounded-xl p-4 border border-divider/60 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">Orders Settled</p>
              <p className="text-2xl font-bold text-success font-display mt-0.5">
                {inr(totalSettledAmount)}
              </p>
              <p className="text-xs text-foreground/60 mt-0.5 font-mono">
                {totalSettledOrders} orders cleared
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <Receipt size={20} />
            </div>
          </div>

          {/* Borrows Deducted */}
          <div className="bg-content2/40 rounded-xl p-4 border border-divider/60 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">Borrows Deducted</p>
              <p className="text-2xl font-bold text-warning font-display mt-0.5">
                {totalSettledBorrowsAmount > 0 ? `-${inr(totalSettledBorrowsAmount)}` : inr(0)}
              </p>
              <p className="text-xs text-foreground/60 mt-0.5 font-mono">
                {allSettledBorrows.length} borrows cleared
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
              <Wallet size={20} />
            </div>
          </div>

          {/* Net Settled Payout */}
          <div className="bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl p-4 border border-primary/30 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">Net Payout</p>
              <p className="text-2xl font-bold text-foreground font-display mt-0.5">
                {inr(totalSettledAmount - totalSettledBorrowsAmount)}
              </p>
              <p className="text-xs text-foreground/60 mt-0.5 font-mono">
                orders minus borrows
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {deleteError && (
        <div className="flex items-center gap-2 bg-danger/10 text-danger border border-danger/30 rounded-lg p-3 text-sm">
          <AlertCircle size={16} />
          <span>{deleteError}</span>
        </div>
      )}

      {deleteSuccess && (
        <div className="flex items-center gap-2 bg-success/10 text-success border border-success/30 rounded-lg p-3 text-sm">
          <CheckCircle2 size={16} />
          <span>{deleteSuccess}</span>
        </div>
      )}

      {/* Clean Tabbed Navigation Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-content1 rounded-xl border border-[#D9A427]/30 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "orders"
                ? "bg-primary text-[#241129] shadow-sm font-bold"
                : "text-foreground/70 hover:text-primary hover:bg-content2/60"
            }`}
          >
            <Receipt size={14} />
            Orders Settlements ({settlements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("borrows")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "borrows"
                ? "bg-primary text-[#241129] shadow-sm font-bold"
                : "text-foreground/70 hover:text-primary hover:bg-content2/60"
            }`}
          >
            <Wallet size={14} />
            Borrow Settlements ({allSettledBorrows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "all"
                ? "bg-primary text-[#241129] shadow-sm font-bold"
                : "text-foreground/70 hover:text-primary hover:bg-content2/60"
            }`}
          >
            <Layers size={14} />
            View Both
          </button>
        </div>

        {/* Search box for orders */}
        {(activeTab === "orders" || activeTab === "all") && (
          <div className="flex items-center gap-2 max-w-xs w-full">
            <Input
              placeholder="Search order no, customer, date..."
              variant="bordered"
              size="sm"
              value={searchQuery}
              onValueChange={setSearchQuery}
              isClearable
              onClear={() => setSearchQuery("")}
              startContent={<Search size={15} className="text-foreground/50" />}
              className="w-full bg-content1 rounded-lg"
            />
          </div>
        )}
      </div>

      {/* SECTION 1: ORDERS SETTLEMENTS */}
      {(activeTab === "orders" || activeTab === "all") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-[#F8F4E6] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                <Receipt className="text-primary" size={20} />
                Orders Settlements ({filteredSettlements.length} Batches)
              </h2>
              <p className="text-xs text-[#F8F4E6]/60 mt-0.5">
                Settled orders history grouped by settlement batch with dates and cleared payouts
              </p>
            </div>

            <div className="flex items-center gap-2">
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
                className="w-36 bg-content1 rounded-lg"
              >
                <SelectItem key="newest">Newest first</SelectItem>
                <SelectItem key="oldest">Oldest first</SelectItem>
              </Select>
            </div>
          </div>

          {filteredSettlements.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-content1 rounded-2xl border border-divider p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                <Receipt size={24} />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {settlements.length === 0
                  ? `No order settlements created for ${staff.name} yet.`
                  : "No settlements match your search query."}
              </h3>
              <p className="text-xs text-foreground/50 max-w-md mx-auto">
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
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSettlements.map((s: StaffSettlementSummary) => {
                const isExpanded = expandedSettlements.has(s.settlementNumber);
                const isConfirmingDelete = deletingNum === s.settlementNumber;

                return (
                  <div
                    key={s.settlementNumber}
                    className="bg-content1 rounded-2xl border border-divider/80 hover:border-primary/50 transition-all p-4 sm:p-5 shadow-sm space-y-4"
                  >
                    {/* Batch Top Header */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-mono font-bold text-base flex items-center justify-center border border-primary/25 shrink-0">
                          #{s.settlementNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-foreground">
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

                          {/* Date and order count line */}
                          <div className="flex items-center gap-2 text-xs text-foreground/60 mt-1 flex-wrap font-mono">
                            <span className="inline-flex items-center gap-1 bg-content2/80 px-2 py-0.5 rounded text-foreground/80">
                              <Calendar size={12} className="text-primary" />
                              {s.startDate === s.endDate ? formatDate(s.startDate) : `${formatDate(s.startDate)} – ${formatDate(s.endDate)}`}
                            </span>
                            {s.settledAt && (
                              <span>&middot; Settled on {formatDate(s.settledAt)}</span>
                            )}
                            <span>&middot;</span>
                            <span className="text-foreground font-medium">{s.orderCount} {s.orderCount === 1 ? "order" : "orders"}</span>
                            {s.borrowCount > 0 && (
                              <>
                                <span>&middot;</span>
                                <span className="text-warning font-medium">{s.borrowCount} {s.borrowCount === 1 ? "borrow" : "borrows"} deducted</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isOwner && (
                          isConfirmingDelete ? (
                            <div className="flex items-center gap-1.5 bg-danger/10 px-2.5 py-1 rounded-lg border border-danger/30 text-xs">
                              <span className="text-danger font-medium">Delete batch #{s.settlementNumber}?</span>
                              <Button
                                size="sm"
                                color="danger"
                                radius="sm"
                                isLoading={deleting}
                                onPress={() => handleDeleteSettlement(s.settlementNumber)}
                                className="h-6 text-xs px-2.5 min-w-0 font-semibold"
                              >
                                Yes, Delete
                              </Button>
                              <Button
                                size="sm"
                                variant="light"
                                radius="sm"
                                isDisabled={deleting}
                                onPress={() => setDeletingNum(null)}
                                className="h-6 text-xs px-2 min-w-0"
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
                              title="Delete this settlement batch and move items back to active/due"
                            >
                              Delete Settlement
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

                    {/* Collapsible Orders Table */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-divider/60 space-y-3">
                        <div className="text-xs text-foreground/60 font-semibold px-1">
                          SETTLED ORDERS ({s.assignments.length})
                        </div>
                        <div className="overflow-x-auto">
                          <Table
                            aria-label={`Orders in settlement #${s.settlementNumber}`}
                            removeWrapper
                            className="min-w-full"
                          >
                            <TableHeader>
                              <TableColumn className="text-xs font-semibold">ORDER NO.</TableColumn>
                              <TableColumn className="text-xs font-semibold">DATE</TableColumn>
                              <TableColumn className="text-xs font-semibold">CUSTOMER</TableColumn>
                              <TableColumn className="text-xs font-semibold">PROGRAM</TableColumn>
                              <TableColumn className="text-xs font-semibold text-right">AMOUNT</TableColumn>
                              <TableColumn className="text-xs font-semibold text-center">STATUS</TableColumn>
                            </TableHeader>
                            <TableBody emptyContent="No orders in this settlement">
                              {s.assignments.map((a: StaffAssignmentRecord) => (
                                <TableRow key={a.orderId} className="border-b border-divider/20 hover:bg-content3/40">
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: BORROW SETTLEMENTS */}
      {(activeTab === "borrows" || activeTab === "all") && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-[#F8F4E6] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                <Wallet className="text-warning" size={20} />
                Borrow Settlements ({allSettledBorrows.length})
              </h2>
              <p className="text-xs text-[#F8F4E6]/60 mt-0.5">
                Staff advances and borrowings deducted and cleared in settlements
              </p>
            </div>

            <Chip color="warning" variant="flat" size="md" className="font-bold text-sm">
              Total Settled Borrows: -{inr(totalSettledBorrowsAmount)}
            </Chip>
          </div>

          <div className="bg-content1 rounded-2xl border border-divider/80 p-5 shadow-sm">
            {allSettledBorrows.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto text-warning">
                  <Wallet size={24} />
                </div>
                <p className="text-foreground/70 font-medium">
                  No borrows have been settled for {staff.name} yet.
                </p>
                <p className="text-xs text-foreground/50 max-w-md mx-auto">
                  When staff borrows are marked as settled or included in a settlement batch, they are removed from active assignments and displayed here.
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
              <div className="overflow-x-auto">
                <Table aria-label="Settled borrows table" removeWrapper className="min-w-full">
                  <TableHeader>
                    <TableColumn className="text-xs font-semibold">SETTLEMENT BATCH</TableColumn>
                    <TableColumn className="text-xs font-semibold">BORROW DATE</TableColumn>
                    <TableColumn className="text-xs font-semibold">PURPOSE / REASON</TableColumn>
                    <TableColumn className="text-xs font-semibold text-right">DEDUCTED AMOUNT</TableColumn>
                    <TableColumn className="text-xs font-semibold text-center">SETTLED DATE</TableColumn>
                    <TableColumn className="text-xs font-semibold text-center">STATUS</TableColumn>
                    <TableColumn className="text-xs font-semibold text-center">{isOwner ? "ACTIONS" : ""}</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {allSettledBorrows.map((b: StaffBorrow) => {
                      const isUnsettlingThis = unsettlingId === b.id;
                      return (
                        <TableRow key={b.id} className="border-b border-divider/20 hover:bg-content3/40">
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
            )}
          </div>
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
