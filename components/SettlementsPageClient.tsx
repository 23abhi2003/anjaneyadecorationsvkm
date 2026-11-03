"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
} from "@heroui/react";
import {
  HardHat,
  Calendar,
  ChevronDown,
  ChevronUp,
  Trash2,
  Receipt,
  Search,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ListTodo,
  User,
  ArrowRight,
  Wallet,
} from "lucide-react";
import type { StaffMember, StaffAssignmentRecord, StaffBorrow } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import {
  groupAssignmentsBySettlement,
  inr,
  parseAmt,
  type StaffSettlementSummary,
} from "@/lib/staffPay";
import BackButton from "@/components/BackButton";

interface SettlementsPageClientProps {
  initialStaff: StaffMember[];
  onRefresh?: () => void;
}

export default function SettlementsPageClient({
  initialStaff,
  onRefresh,
}: SettlementsPageClientProps) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);
  const [staffSearch, setStaffSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [expandedSettlements, setExpandedSettlements] = useState<Set<number>>(new Set());

  // Delete settlement state
  const [deletingNum, setDeletingNum] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  // Sync state if initialStaff updates
  useEffect(() => {
    setStaffList(initialStaff);
  }, [initialStaff]);

  // Role filtering: staff accounts can only see their own record
  const visibleStaff = useMemo(() => {
    if (isOwner) return staffList;
    return staffList.filter((s) => s.id === user?.staffId);
  }, [isOwner, staffList, user?.staffId]);

  // Read URL query parameter for active staff member
  const paramStaffId = searchParams.get("id") || searchParams.get("staffId");

  // Determine initial selected staff id
  const [selectedStaffId, setSelectedStaffId] = useState<string>(() => {
    if (paramStaffId && visibleStaff.some((s) => s.id === paramStaffId)) {
      return paramStaffId;
    }
    // Prefer the first staff member that has settlements
    const staffWithSettlements = visibleStaff.find((s) => {
      const { settlements } = groupAssignmentsBySettlement(s.assignments, s.borrows);
      return settlements.length > 0;
    });
    return staffWithSettlements?.id || visibleStaff[0]?.id || "";
  });

  // Keep selectedStaffId valid when visibleStaff changes
  useEffect(() => {
    if (paramStaffId && visibleStaff.some((s) => s.id === paramStaffId)) {
      setSelectedStaffId(paramStaffId);
    } else if (!visibleStaff.some((s) => s.id === selectedStaffId)) {
      const fallback = visibleStaff.find((s) => {
        const { settlements } = groupAssignmentsBySettlement(s.assignments, s.borrows);
        return settlements.length > 0;
      });
      setSelectedStaffId(fallback?.id || visibleStaff[0]?.id || "");
    }
  }, [visibleStaff, paramStaffId, selectedStaffId]);

  function handleSelectStaff(id: string): void {
    setSelectedStaffId(id);
    setExpandedSettlements(new Set());
    setDeleteError("");
    setDeleteSuccess("");
    // Update URL query string without a hard navigation
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Filtered staff list based on search
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return visibleStaff;
    const q = staffSearch.trim().toLowerCase();
    return visibleStaff.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))
    );
  }, [visibleStaff, staffSearch]);

  // Currently selected staff object
  const activeStaff = useMemo(
    () => visibleStaff.find((s) => s.id === selectedStaffId),
    [visibleStaff, selectedStaffId]
  );

  // Grouped settlements for the active staff member (including both orders and borrows)
  const {
    settlements: activeSettlements,
    totalSettledAmount: activeStaffTotalSettled,
    totalSettledOrders: activeStaffTotalOrders,
  } = useMemo(
    () => groupAssignmentsBySettlement(activeStaff?.assignments, activeStaff?.borrows),
    [activeStaff?.assignments, activeStaff?.borrows]
  );

  // Aggregate stats across all visible staff members
  const overallStats = useMemo(() => {
    let grandSettledAmount = 0;
    let grandSettledOrders = 0;
    let grandBatchesCount = 0;
    let staffWithSettlementsCount = 0;

    for (const member of visibleStaff) {
      const { settlements, totalSettledAmount, totalSettledOrders } = groupAssignmentsBySettlement(
        member.assignments,
        member.borrows
      );
      if (settlements.length > 0) {
        staffWithSettlementsCount++;
        grandBatchesCount += settlements.length;
        grandSettledAmount += totalSettledAmount;
        grandSettledOrders += totalSettledOrders;
      }
    }

    return {
      grandSettledAmount,
      grandSettledOrders,
      grandBatchesCount,
      staffWithSettlementsCount,
      totalStaffCount: visibleStaff.length,
    };
  }, [visibleStaff]);

  // Filtered settlements for active staff
  const filteredSettlements = useMemo(() => {
    let list = [...activeSettlements];

    if (orderSearch.trim()) {
      const q = orderSearch.trim().toLowerCase();
      list = list.filter((s) => {
        if (`#${s.settlementNumber}`.includes(q) || String(s.settlementNumber) === q) return true;
        if (s.startDate && s.startDate.toLowerCase().includes(q)) return true;
        if (s.endDate && s.endDate.toLowerCase().includes(q)) return true;
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
  }, [activeSettlements, orderSearch, sortOrder]);

  async function handleDeleteSettlement(settlementNum: number): Promise<void> {
    if (!activeStaff || !isOwner) return;
    setDeleting(true);
    setDeleteError("");
    setDeleteSuccess("");

    try {
      const res = await apiFetch(
        `/api/staff/${encodeURIComponent(activeStaff.id)}/settlements/${encodeURIComponent(settlementNum)}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to delete settlement.");
      }

      const updated = (await res.json()) as StaffMember;
      setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setDeletingNum(null);
      setDeleteSuccess(`Settlement #${settlementNum} deleted successfully. All orders and borrows returned to active.`);
      onRefresh?.();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete settlement.");
    } finally {
      setDeleting(false);
    }
  }

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

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <BackButton href="/" label="Back to Dashboard" />
        <div className="flex items-center gap-2">
          <Button
            as={Link}
            href="/staff"
            variant="flat"
            radius="sm"
            size="sm"
            startContent={<HardHat size={16} className="text-primary shrink-0 transition-transform group-hover:scale-110" />}
            className="group font-medium text-[#F8F4E6]/90 hover:text-[#D9A427] bg-[#F8F4E6]/10 hover:bg-[#D9A427]/20 border border-[#D9A427]/40 hover:border-[#D9A427]/70 transition-all shadow-sm"
          >
            Staff Overview
          </Button>
          {activeStaff && (
            <Button
              as={Link}
              href={`/staff/assignments?id=${encodeURIComponent(activeStaff.id)}`}
              color="primary"
              variant="solid"
              radius="sm"
              size="sm"
              className="font-semibold"
              startContent={<ListTodo size={16} />}
            >
              Active Assignments
            </Button>
          )}
        </div>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
            Staff Settlements
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            Settlement batches, date ranges, and cleared payouts for all staff members
          </p>
        </div>

        {activeStaff && isOwner && (
          <Button
            as={Link}
            href={`/staff/assignments?id=${encodeURIComponent(activeStaff.id)}`}
            color="primary"
            variant="flat"
            radius="sm"
            size="sm"
            className="font-semibold"
          >
            + Create New Settlement
          </Button>
        )}
      </div>

      {/* Aggregate KPI summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-content1 border border-divider">
          <CardBody className="p-4 space-y-1">
            <p className="text-xs text-foreground/50 font-medium">TOTAL SETTLED AMOUNT</p>
            <p className="text-2xl font-bold text-success font-display">
              {inr(overallStats.grandSettledAmount)}
            </p>
            <p className="text-xs text-foreground/40">Paid out across all staff batches</p>
          </CardBody>
        </Card>

        <Card className="bg-content1 border border-divider">
          <CardBody className="p-4 space-y-1">
            <p className="text-xs text-foreground/50 font-medium">TOTAL ORDERS SETTLED</p>
            <p className="text-2xl font-bold text-primary font-mono">
              {overallStats.grandSettledOrders}
            </p>
            <p className="text-xs text-foreground/40">Orders cleared in settlements</p>
          </CardBody>
        </Card>

        <Card className="bg-content1 border border-divider">
          <CardBody className="p-4 space-y-1">
            <p className="text-xs text-foreground/50 font-medium">SETTLEMENT BATCHES</p>
            <p className="text-2xl font-bold text-secondary font-mono">
              {overallStats.grandBatchesCount}
            </p>
            <p className="text-xs text-foreground/40">Total batches created</p>
          </CardBody>
        </Card>

        <Card className="bg-content1 border border-divider">
          <CardBody className="p-4 space-y-1">
            <p className="text-xs text-foreground/50 font-medium">STAFF WITH SETTLEMENTS</p>
            <p className="text-2xl font-bold text-foreground font-mono">
              {overallStats.staffWithSettlementsCount} / {overallStats.totalStaffCount}
            </p>
            <p className="text-xs text-foreground/40">Staff members with cleared batches</p>
          </CardBody>
        </Card>
      </div>

      {/* Section 1: Staff Members Grid (Same like Staff page) */}
      <Card className="bg-content1">
        <CardBody className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
                Staff Members ({visibleStaff.length})
              </h2>
              <p className="text-xs text-foreground/50">
                Click any staff member to inspect their settlement batches, total amount, and date ranges.
              </p>
            </div>

            <div className="max-w-xs w-full">
              <Input
                placeholder="Search staff by name or phone..."
                variant="bordered"
                size="sm"
                value={staffSearch}
                onValueChange={setStaffSearch}
                isClearable
                onClear={() => setStaffSearch("")}
                startContent={<Search size={15} className="text-foreground/50" />}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filteredStaff.map((member) => {
              const isSelected = member.id === selectedStaffId;
              const { settlements, totalSettledAmount, totalSettledOrders } = groupAssignmentsBySettlement(
                member.assignments,
                member.borrows
              );
              const batchCount = settlements.length;
              const unsettledCount = (member.assignments || []).filter(
                (a) => !a.settlementNumber || Number(a.settlementNumber) <= 0
              ).length;

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelectStaff(member.id)}
                  className={`text-left rounded-lg p-4 transition-all border ${
                    isSelected
                      ? "bg-primary/10 border-primary shadow-md ring-2 ring-primary/40"
                      : "bg-content2/30 border-divider hover:bg-content2/60 hover:border-foreground/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base text-foreground truncate flex items-center gap-1.5">
                        <User size={15} className={isSelected ? "text-primary" : "text-foreground/60"} />
                        <span>{member.name}</span>
                      </h3>
                      {member.phone && (
                        <p className="text-xs text-foreground/50 font-mono mt-0.5">
                          {member.phone}
                        </p>
                      )}
                    </div>
                    {batchCount > 0 ? (
                      <Chip color="success" variant="flat" size="sm" className="font-semibold shrink-0">
                        {batchCount} {batchCount === 1 ? "Batch" : "Batches"}
                      </Chip>
                    ) : (
                      <Chip color="default" variant="flat" size="sm" className="shrink-0 text-foreground/50">
                        0 Batches
                      </Chip>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-divider/60 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/50">Total Settled:</span>
                      <span className="font-bold text-success font-mono text-sm">
                        {inr(totalSettledAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-foreground/50">Orders Cleared:</span>
                      <span className="font-semibold text-foreground/80 font-mono">
                        {totalSettledOrders} orders
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-foreground/50">Active Orders:</span>
                      <span className="text-foreground/60 font-mono">
                        {unsettledCount} pending
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-divider/40 flex items-center justify-between text-xs">
                    <span className="text-primary font-medium flex items-center gap-1">
                      {isSelected ? "Viewing Settlements" : "Click to View"}
                      <ArrowRight size={12} />
                    </span>
                    {member.lastSettlement ? (
                      <span className="text-foreground/40 font-mono text-[11px]">
                        Last: #{member.lastSettlement}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Section 2: Selected Staff Member's Settlements Detail View */}
      {activeStaff && (
        <div className="space-y-4">
          {/* Active staff banner */}
          <Card className="bg-content1 border border-[#D9A427]/30">
            <CardBody className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-display text-xl font-bold">
                    {activeStaff.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                        {activeStaff.name}
                      </h2>
                      <Chip color="primary" variant="flat" size="sm">
                        {activeSettlements.length} {activeSettlements.length === 1 ? "Settlement" : "Settlements"}
                      </Chip>
                    </div>
                    <p className="text-xs text-foreground/60 mt-0.5">
                      Phone: <span className="font-mono text-foreground/80">{activeStaff.phone || "Not set"}</span> &middot; ID: <span className="font-mono text-foreground/80">{activeStaff.id}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-right">
                    <p className="text-xs text-foreground/50">TOTAL SETTLED</p>
                    <p className="text-xl font-bold text-success font-display">
                      {inr(activeStaffTotalSettled)}
                    </p>
                    <p className="text-[11px] text-foreground/40 font-mono">
                      {activeStaffTotalOrders} orders cleared
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      as={Link}
                      href={`/staff/assignments?id=${encodeURIComponent(activeStaff.id)}`}
                      color="primary"
                      variant="solid"
                      radius="sm"
                      size="sm"
                      className="font-semibold"
                    >
                      Active Assignments
                    </Button>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

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

          {/* Settlements list container */}
          <Card className="bg-content1">
            <CardBody className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    Settlement Batches for {activeStaff.name} ({activeSettlements.length})
                  </h3>
                  <p className="text-xs text-foreground/50">
                    Each settlement displays total amount, date start and end, and full order/borrow breakdown.
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Input
                    placeholder="Search order no, customer, date..."
                    variant="bordered"
                    size="sm"
                    value={orderSearch}
                    onValueChange={setOrderSearch}
                    isClearable
                    onClear={() => setOrderSearch("")}
                    startContent={<Search size={15} className="text-foreground/50" />}
                    className="max-w-xs"
                  />
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
                    className="w-40"
                  >
                    <SelectItem key="newest">Newest first</SelectItem>
                    <SelectItem key="oldest">Oldest first</SelectItem>
                  </Select>
                </div>
              </div>

              {filteredSettlements.length === 0 ? (
                <div className="text-center py-14 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                    <Receipt size={26} />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground">
                    {activeSettlements.length === 0
                      ? `No settlements created for ${activeStaff.name} yet.`
                      : "No settlements match your search."}
                  </h4>
                  <p className="text-sm text-foreground/50 max-w-md mx-auto">
                    {activeSettlements.length === 0
                      ? "To create a settlement, go to Active Assignments, select the orders using checkboxes, and click 'Create Settlement'."
                      : "Try clearing your search query to see all settlements for this staff member."}
                  </p>
                  {activeSettlements.length === 0 && (
                    <Button
                      as={Link}
                      href={`/staff/assignments?id=${encodeURIComponent(activeStaff.id)}`}
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
                <div className="space-y-4">
                  {filteredSettlements.map((s: StaffSettlementSummary) => {
                    const isExpanded = expandedSettlements.has(s.settlementNumber);
                    const isConfirmingDelete = deletingNum === s.settlementNumber;

                    return (
                      <Card key={s.settlementNumber} className="bg-content2/40 border border-divider hover:border-primary/40 transition-colors">
                        <CardBody className="p-4 sm:p-5 space-y-4">
                          {/* Batch Header Bar */}
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-start sm:items-center gap-3.5">
                              <span className="text-2xl font-bold text-primary font-mono shrink-0">
                                #{s.settlementNumber}
                              </span>
                              <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h4 className="text-lg font-semibold text-foreground">
                                    Settlement #{s.settlementNumber}
                                  </h4>
                                  <Chip color="success" variant="flat" size="md" className="font-bold text-sm">
                                    {inr(s.total)}
                                  </Chip>
                                  {s.borrowsTotal > 0 && (
                                    <Chip color="warning" variant="flat" size="sm" className="font-semibold text-xs">
                                      -{inr(s.borrowsTotal)} borrow
                                    </Chip>
                                  )}
                                </div>

                                {/* Prominent Date Start and End Display */}
                                <div className="flex items-center gap-2.5 text-xs text-foreground/70 mt-1.5 flex-wrap">
                                  {(s.startDate || s.endDate) && (
                                    <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md font-mono font-medium">
                                      <Calendar size={13} />
                                      <span className="font-semibold">Date:</span>
                                      {s.startDate === s.endDate ? (
                                        <span>{s.startDate}</span>
                                      ) : (
                                        <span>{s.startDate || "—"} &rarr; {s.endDate || "—"}</span>
                                      )}
                                    </span>
                                  )}
                                  {s.settledAt && (
                                    <span className="flex items-center gap-1 text-foreground/60 bg-content3/60 px-2 py-0.5 rounded font-mono">
                                      <span>Settled on {s.settledAt}</span>
                                    </span>
                                  )}
                                  <span className="text-foreground/30">&middot;</span>
                                  <span className="text-foreground/80 font-medium">
                                    {s.orderCount} {s.orderCount === 1 ? "order" : "orders"} settled
                                  </span>
                                  {s.borrowCount > 0 && (
                                    <>
                                      <span className="text-foreground/30">&middot;</span>
                                      <span className="text-warning font-medium">
                                        {s.borrowCount} {s.borrowCount === 1 ? "borrow" : "borrows"} settled
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Batch Actions: DELETE SETTLEMENT (OWNER ONLY) */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {isOwner && (
                                <>
                                  {isConfirmingDelete ? (
                                    <div className="flex items-center gap-1.5 bg-danger/10 px-2.5 py-1 rounded border border-danger/30 text-xs">
                                      <span className="text-danger font-medium">Delete settlement #{s.settlementNumber}?</span>
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
                                  )}
                                </>
                              )}

                              <Button
                                size="sm"
                                variant="flat"
                                radius="sm"
                                onPress={() => toggleExpand(s.settlementNumber)}
                                className="h-8 text-xs font-medium"
                                endContent={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              >
                                {isExpanded
                                  ? (s.borrowCount > 0 ? "Hide Orders & Borrows" : "Hide Orders")
                                  : (s.borrowCount > 0
                                      ? `View Orders & Borrows (${s.orderCount + s.borrowCount})`
                                      : `View Orders (${s.orderCount})`)}
                              </Button>
                            </div>
                          </div>

                          {/* Expanded items breakdown */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-divider/60 space-y-4">
                              {/* Orders Table */}
                              {s.assignments.length > 0 && (
                                <div className="space-y-1.5">
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
                                              {a.date || "—"}
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
                                              <Chip color="success" variant="dot" size="sm" className="font-medium text-[11px]">
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

                              {/* Settled Borrows Table (if any in this settlement) */}
                              {s.borrows.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-divider/30">
                                  <div className="text-xs text-warning font-semibold flex items-center gap-1.5 px-1">
                                    <Wallet size={14} />
                                    DEDUCTED / SETTLED BORROWS ({s.borrows.length})
                                  </div>
                                  <div className="overflow-x-auto">
                                    <Table
                                      aria-label={`Borrows in settlement #${s.settlementNumber}`}
                                      removeWrapper
                                      className="min-w-full"
                                    >
                                      <TableHeader>
                                        <TableColumn className="text-xs font-semibold">BORROW REASON</TableColumn>
                                        <TableColumn className="text-xs font-semibold">DATE</TableColumn>
                                        <TableColumn className="text-xs font-semibold text-right">DEDUCTED AMOUNT</TableColumn>
                                        <TableColumn className="text-xs font-semibold text-center">STATUS</TableColumn>
                                      </TableHeader>
                                      <TableBody emptyContent="No borrows in this settlement">
                                        {s.borrows.map((b: StaffBorrow) => (
                                          <TableRow key={b.id} className="border-b border-divider/20 hover:bg-content3/40">
                                            <TableCell className="text-xs text-foreground font-medium">
                                              {b.reason || "Staff Borrow"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-foreground/80">
                                              {b.date || "—"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold text-xs text-warning">
                                              -{inr(parseAmt(b.amount))}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              <Chip color="primary" variant="flat" size="sm" className="font-medium text-[11px]">
                                                Settled in #{s.settlementNumber}
                                              </Chip>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}

                              {/* Settlement Totals summary */}
                              <div className="flex items-center justify-between pt-2 text-xs text-foreground/70 px-1 border-t border-divider/40 flex-wrap gap-2">
                                <span>
                                  Date span: <strong className="font-mono text-foreground">{s.startDate || "—"}</strong> to <strong className="font-mono text-foreground">{s.endDate || "—"}</strong>
                                </span>
                                <div className="flex items-center gap-3">
                                  {s.borrowsTotal > 0 && (
                                    <span>
                                      Gross: <strong className="font-mono text-foreground">{inr(s.total)}</strong> &middot; Borrows: <strong className="font-mono text-warning">-{inr(s.borrowsTotal)}</strong>
                                    </span>
                                  )}
                                  <span>
                                    Net Settlement: <strong className="font-mono text-success text-sm">{inr(s.netTotal)}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
