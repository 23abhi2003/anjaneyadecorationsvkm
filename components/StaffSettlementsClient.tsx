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

export default function StaffSettlementsClient({
  staff,
  onChanged,
}: {
  staff: StaffMember;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const isSelf = staff.id === user?.staffId;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [expandedSettlements, setExpandedSettlements] = useState<Set<number>>(new Set());

  // Delete confirmation state
  const [deletingNum, setDeletingNum] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  const { settlements, totalSettledAmount, totalSettledOrders } = useMemo(
    () => groupAssignmentsBySettlement(staff.assignments, staff.borrows),
    [staff.assignments, staff.borrows]
  );

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

  async function handleDelete(settlementNum: number): Promise<void> {
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
      onChanged?.();
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

  if (!isOwner && !isSelf) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-[#F8F4E6]/70">You don&apos;t have permission to view this staff member&apos;s settlements.</p>
        <BackButton href="/staff" label="Back to Staff" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <BackButton href={`/staff/assignments?id=${encodeURIComponent(staff.id)}`} label="Back to Assignments" />
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

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
            {staff.name} — Settlements
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            Settlement payouts and settled orders history
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <Button
              as={Link}
              href={`/staff/assignments?id=${encodeURIComponent(staff.id)}`}
              color="primary"
              variant="solid"
              radius="sm"
              size="sm"
              className="font-semibold"
            >
              + Create New Settlement
            </Button>
          </div>
        )}
      </div>

      {/* Top summary metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-content1 border border-divider">
          <CardBody className="p-4 space-y-1">
            <p className="text-xs text-foreground/50 font-medium">TOTAL AMOUNT SETTLED</p>
            <p className="text-2xl font-bold text-success font-display">
              {inr(totalSettledAmount)}
            </p>
            <p className="text-xs text-foreground/40">Across all completed settlements</p>
          </CardBody>
        </Card>

        <Card className="bg-content1 border border-divider">
          <CardBody className="p-4 space-y-1">
            <p className="text-xs text-foreground/50 font-medium">TOTAL ORDERS SETTLED</p>
            <p className="text-2xl font-bold text-primary font-mono">
              {totalSettledOrders}
            </p>
            <p className="text-xs text-foreground/40">Orders fully settled and cleared</p>
          </CardBody>
        </Card>

        <Card className="bg-content1 border border-divider">
          <CardBody className="p-4 space-y-1">
            <p className="text-xs text-foreground/50 font-medium">SETTLEMENT BATCHES</p>
            <p className="text-2xl font-bold text-secondary font-mono">
              {settlements.length}
            </p>
            <p className="text-xs text-foreground/40">
              Latest batch: {settlements.length > 0 ? `#${settlements[0].settlementNumber}` : "None"}
            </p>
          </CardBody>
        </Card>
      </div>

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

      {/* Settlements List Card */}
      <Card className="bg-content1">
        <CardBody className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Settlement Batches ({settlements.length})
            </h2>

            <div className="flex items-center gap-3 flex-wrap">
              <Input
                placeholder="Search order no. or customer..."
                variant="bordered"
                size="sm"
                value={searchQuery}
                onValueChange={setSearchQuery}
                isClearable
                onClear={() => setSearchQuery("")}
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
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                <Receipt size={24} />
              </div>
              <p className="text-foreground/70 font-medium">
                {settlements.length === 0
                  ? `No settlements have been created for ${staff.name} yet.`
                  : "No settlements match your search."}
              </p>
              <p className="text-xs text-foreground/50 max-w-md mx-auto">
                {settlements.length === 0
                  ? "Go to the assignments page to select orders with checkboxes and create a settlement batch."
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
            <div className="space-y-4">
              {filteredSettlements.map((s: StaffSettlementSummary) => {
                const isExpanded = expandedSettlements.has(s.settlementNumber);
                const isConfirmingDelete = deletingNum === s.settlementNumber;

                return (
                  <Card key={s.settlementNumber} className="bg-content2/40 border border-divider">
                    <CardBody className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-primary font-mono">
                            #{s.settlementNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-semibold text-foreground">
                                Settlement #{s.settlementNumber}
                              </h3>
                              <Chip color="success" variant="flat" size="sm" className="font-semibold">
                                {inr(s.total)}
                              </Chip>
                              {s.borrowsTotal > 0 && (
                                <Chip color="warning" variant="flat" size="sm" className="font-semibold text-xs">
                                  -{inr(s.borrowsTotal)} borrow
                                </Chip>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 text-xs text-foreground/70 mt-1 flex-wrap">
                              {(s.startDate || s.endDate) && (
                                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded font-mono font-medium">
                                  <Calendar size={13} />
                                  <span>Date Range:</span>
                                  {s.startDate === s.endDate ? (
                                    <span>{s.startDate}</span>
                                  ) : (
                                    <span>{s.startDate || "—"} &rarr; {s.endDate || "—"}</span>
                                  )}
                                </span>
                              )}
                              {s.settledAt && (
                                <span className="flex items-center gap-1 text-foreground/50">
                                  <span>Settled: {s.settledAt}</span>
                                </span>
                              )}
                              <span className="text-foreground/30">&middot;</span>
                              <span className="text-foreground/60">{s.orderCount} order{s.orderCount === 1 ? "" : "s"} settled</span>
                              {s.borrowCount > 0 && (
                                <>
                                  <span className="text-foreground/30">&middot;</span>
                                  <span className="text-warning font-medium">{s.borrowCount} borrow{s.borrowCount === 1 ? "" : "s"} settled</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* DELETE SETTLEMENT OPTION (OWNER ONLY) */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {isOwner && (
                            <>
                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5 bg-danger/10 px-2.5 py-1 rounded border border-danger/30 text-xs">
                                  <span className="text-danger font-medium">Delete batch #{s.settlementNumber}?</span>
                                  <Button
                                    size="sm"
                                    color="danger"
                                    radius="sm"
                                    isLoading={deleting}
                                    onPress={() => handleDelete(s.settlementNumber)}
                                    className="h-6 text-xs px-2.5 min-w-0 font-semibold"
                                  >
                                    Yes, delete
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

                      {/* Expanded Orders & Borrows Table */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-divider/60 space-y-3">
                          {s.assignments.length > 0 && (
                            <div className="overflow-x-auto">
                              <Table aria-label={`Settlement #${s.settlementNumber} orders`} removeWrapper className="min-w-140">
                                <TableHeader>
                                  <TableColumn>ORDER NO.</TableColumn>
                                  <TableColumn>CUSTOMER</TableColumn>
                                  <TableColumn>PROGRAM / EVENT</TableColumn>
                                  <TableColumn>DATE</TableColumn>
                                  <TableColumn className="text-right">AMOUNT</TableColumn>
                                </TableHeader>
                                <TableBody>
                                  {s.assignments.map((a: StaffAssignmentRecord) => (
                                    <TableRow key={a.orderId}>
                                      <TableCell>
                                        <Link
                                          href={`/orders/${encodeURIComponent(a.orderId)}`}
                                          className="text-primary hover:underline font-mono text-xs font-semibold flex items-center gap-1"
                                        >
                                          {a.orderId}
                                          <ExternalLink size={12} className="opacity-60" />
                                        </Link>
                                      </TableCell>
                                      <TableCell className="text-xs font-medium">{a.customerName || "—"}</TableCell>
                                      <TableCell className="text-xs text-foreground/80">{a.program || "—"}</TableCell>
                                      <TableCell className="text-xs text-foreground/60 font-mono">{a.date || "—"}</TableCell>
                                      <TableCell className="text-xs font-mono font-bold text-success text-right">
                                        {inr(parseAmt(a.amount))}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          {s.borrows.length > 0 && (
                            <div className="pt-2 border-t border-divider/30 space-y-1">
                              <p className="text-xs font-semibold text-warning flex items-center gap-1">
                                <Wallet size={13} />
                                Deducted Borrows:
                              </p>
                              <div className="overflow-x-auto">
                                <Table aria-label={`Settlement #${s.settlementNumber} borrows`} removeWrapper className="min-w-140">
                                  <TableHeader>
                                    <TableColumn>REASON</TableColumn>
                                    <TableColumn>DATE</TableColumn>
                                    <TableColumn className="text-right">DEDUCTED AMOUNT</TableColumn>
                                  </TableHeader>
                                  <TableBody>
                                    {s.borrows.map((b: StaffBorrow) => (
                                      <TableRow key={b.id}>
                                        <TableCell className="text-xs font-medium">{b.reason || "Staff Borrow"}</TableCell>
                                        <TableCell className="text-xs text-foreground/60 font-mono">{b.date || "—"}</TableCell>
                                        <TableCell className="text-xs font-mono font-bold text-warning text-right">
                                          -{inr(parseAmt(b.amount))}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
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
  );
}
