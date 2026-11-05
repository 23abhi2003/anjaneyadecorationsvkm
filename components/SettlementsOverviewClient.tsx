"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
} from "@heroui/react";
import {
  HardHat,
  Search,
  User,
  ArrowRight,
  Receipt,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import type { StaffMember } from "@/lib/types";
import { useAuth } from "@/lib/Auth";
import {
  groupAssignmentsBySettlement,
  inr,
} from "@/lib/staffPay";
import BackButton from "@/components/BackButton";

interface SettlementsOverviewClientProps {
  staffList: StaffMember[];
  onRefresh?: () => void;
}

export default function SettlementsOverviewClient({
  staffList,
}: SettlementsOverviewClientProps) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const router = useRouter();

  const [staffSearch, setStaffSearch] = useState("");

  // Role filtering: staff accounts can only see their own record
  const visibleStaff = useMemo(() => {
    if (isOwner) return staffList;
    return staffList.filter((s) => s.id === user?.staffId);
  }, [isOwner, staffList, user?.staffId]);

  // Filtered staff list based on search
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return visibleStaff;
    const q = staffSearch.trim().toLowerCase();
    return visibleStaff.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))
    );
  }, [visibleStaff, staffSearch]);

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

  function handleOpenStaffSettlements(staffId: string): void {
    router.push(`/settlements/detail?id=${encodeURIComponent(staffId)}`);
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <BackButton href="/" label="Back to Dashboard" />
        <Button
          as={Link}
          href="/staff"
          variant="flat"
          radius="sm"
          size="sm"
          startContent={<HardHat size={16} className="text-primary shrink-0 transition-transform group-hover:scale-110" />}
          className="group font-medium text-[#F8F4E6]/90 hover:text-primary bg-[#F8F4E6]/10 hover:bg-primary/20 border border-primary/40 hover:border-primary/70 transition-all shadow-sm"
        >
          Staff Overview
        </Button>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
          Staff Settlements
        </h1>
        <p className="text-sm text-[#F8F4E6]/60 mt-1">
          Overview of all staff settlement payouts, cleared batches, and balances
        </p>
      </div>

      {/* Aggregate KPI Summary Cards (2x2 on mobile, 4 columns on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-content1 border border-divider shadow-sm">
          <CardBody className="p-3.5 sm:p-4 space-y-1">
            <p className="text-[10px] sm:text-xs text-foreground/50 font-medium uppercase tracking-wider truncate">
              Total Settled
            </p>
            <p className="text-lg sm:text-2xl font-bold text-success font-display truncate">
              {inr(overallStats.grandSettledAmount)}
            </p>
            <p className="text-[10px] sm:text-xs text-foreground/40 truncate">Across all staff batches</p>
          </CardBody>
        </Card>

        <Card className="bg-content1 border border-divider shadow-sm">
          <CardBody className="p-3.5 sm:p-4 space-y-1">
            <p className="text-[10px] sm:text-xs text-foreground/50 font-medium uppercase tracking-wider truncate">
              Orders Settled
            </p>
            <p className="text-lg sm:text-2xl font-bold text-primary font-mono truncate">
              {overallStats.grandSettledOrders}
            </p>
            <p className="text-[10px] sm:text-xs text-foreground/40 truncate">Orders cleared in batches</p>
          </CardBody>
        </Card>

        <Card className="bg-content1 border border-divider shadow-sm">
          <CardBody className="p-3.5 sm:p-4 space-y-1">
            <p className="text-[10px] sm:text-xs text-foreground/50 font-medium uppercase tracking-wider truncate">
              Settlement Batches
            </p>
            <p className="text-lg sm:text-2xl font-bold text-foreground font-mono truncate">
              {overallStats.grandBatchesCount}
            </p>
            <p className="text-[10px] sm:text-xs text-foreground/40 truncate">Total batches created</p>
          </CardBody>
        </Card>

        <Card className="bg-content1 border border-divider shadow-sm">
          <CardBody className="p-3.5 sm:p-4 space-y-1">
            <p className="text-[10px] sm:text-xs text-foreground/50 font-medium uppercase tracking-wider truncate">
              Staff With Batches
            </p>
            <p className="text-lg sm:text-2xl font-bold text-foreground font-mono truncate">
              {overallStats.staffWithSettlementsCount} / {overallStats.totalStaffCount}
            </p>
            <p className="text-[10px] sm:text-xs text-foreground/40 truncate">Members with payouts</p>
          </CardBody>
        </Card>
      </div>

      {/* Staff Members Grid */}
      <Card className="bg-content1 border border-divider shadow-sm">
        <CardBody className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                Staff Members ({visibleStaff.length})
              </h2>
              <p className="text-xs text-foreground/50 mt-0.5">
                Click any staff member to view their complete settlement history and cleared batches.
              </p>
            </div>

            <div className="w-full sm:max-w-xs">
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
              const { settlements, totalSettledAmount, totalSettledOrders } = groupAssignmentsBySettlement(
                member.assignments,
                member.borrows
              );
              const batchCount = settlements.length;
              const unsettledCount = (member.assignments || []).filter(
                (a) => !a.settlementNumber || Number(a.settlementNumber) <= 0
              ).length;
              const settledBorrowsCount = (member.borrows || []).filter(
                (b) => b.paymentStatus === "settled" || (b.settlementNumber != null && Number(b.settlementNumber) > 0)
              ).length;

              return (
                <div
                  key={member.id}
                  onClick={() => handleOpenStaffSettlements(member.id)}
                  className="rounded-xl p-4 transition-all border bg-content2/30 border-divider hover:bg-content2/60 hover:border-primary/50 cursor-pointer flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base text-foreground truncate flex items-center gap-1.5">
                          <User size={15} className="text-primary" />
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

                    <div className="space-y-1.5 pt-2.5 border-t border-divider/60 text-xs">
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

                      {settledBorrowsCount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-foreground/50">Borrows Settled:</span>
                          <span className="font-semibold text-warning font-mono">
                            {settledBorrowsCount} {settledBorrowsCount === 1 ? "borrow" : "borrows"}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-foreground/50">Active Orders:</span>
                        <span className="text-foreground/60 font-mono">
                          {unsettledCount} pending
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-divider/40 flex items-center justify-between text-xs">
                    <span className="text-primary font-semibold flex items-center gap-1 hover:underline">
                      View Settlements
                      <ArrowRight size={13} />
                    </span>
                    {member.lastSettlement ? (
                      <span className="text-foreground/40 font-mono text-[11px]">
                        Last: #{member.lastSettlement}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
