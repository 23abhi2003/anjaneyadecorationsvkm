"use client";

import { Card, CardBody, Skeleton } from "@heroui/react";

/**
 * Skeleton loader for Dashboard pages (both Decorations and VKM Auto Rides)
 */
export function DashboardSkeleton({ isAutoRides = false }: { isAutoRides?: boolean }) {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Brand Header Skeleton */}
      <div className="flex flex-col items-center py-6 space-y-3">
        {isAutoRides ? (
          <Skeleton className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl bg-[#D9A427]/20" />
        ) : (
          <Skeleton className="w-16 h-20 rounded-md bg-[#D9A427]/20" />
        )}
        <Skeleton className="h-8 w-64 rounded-lg bg-foreground/15" />
        <Skeleton className="h-4 w-48 rounded-md bg-foreground/10" />
        <Skeleton className="h-12 w-full max-w-xl rounded-full bg-content1 mt-4" />
        <Skeleton className="h-10 w-36 rounded-full bg-primary/30 mt-2" />
      </div>

      {/* Top Nav Cards Skeleton */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="bg-content1 p-5 space-y-2 border border-divider/40">
            <Skeleton className="h-7 w-12 rounded-md bg-foreground/20" />
            <Skeleton className="h-5 w-24 rounded-md bg-foreground/25" />
            <Skeleton className="h-3 w-32 rounded-md bg-foreground/10" />
          </Card>
        ))}
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="bg-content1 p-4 sm:p-5 space-y-2 border border-divider/30">
            <Skeleton className="h-3 w-20 rounded bg-foreground/15" />
            <Skeleton className="h-8 w-28 rounded-md bg-primary/20" />
            <Skeleton className="h-3 w-24 rounded bg-foreground/10" />
          </Card>
        ))}
      </div>

      {/* List Section Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-44 rounded-md bg-foreground/20" />
          <Skeleton className="h-8 w-28 rounded-md bg-primary/20" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 bg-content1 border border-divider/40 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-16 rounded bg-primary/25" />
                  <Skeleton className="h-5 w-36 rounded-md bg-foreground/25" />
                  <Skeleton className="h-3 w-24 rounded bg-foreground/15" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full bg-success/20" />
              </div>
              <Skeleton className="h-4 w-full rounded bg-foreground/10" />
              <div className="pt-2 border-t border-divider/30 flex items-center justify-between">
                <Skeleton className="h-5 w-20 rounded bg-foreground/20" />
                <Skeleton className="h-5 w-20 rounded bg-foreground/20" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for List pages (Orders, Auto Rides)
 */
export function ListCardsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-md bg-content1" />
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-48 rounded-lg bg-foreground/20" />
            <Skeleton className="h-3 w-32 rounded bg-foreground/10" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-md bg-primary/30" />
      </div>

      {/* Filter Bar Skeleton */}
      <Card className="p-4 bg-content1 border border-divider/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <Skeleton className="h-9 sm:col-span-2 rounded-md bg-foreground/10" />
          <Skeleton className="h-9 rounded-md bg-foreground/10" />
          <Skeleton className="h-9 rounded-md bg-foreground/10" />
          <Skeleton className="h-9 rounded-md bg-foreground/10" />
        </div>
      </Card>

      {/* Grid of Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-4 bg-content1 border border-divider/40 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-16 rounded bg-primary/25" />
                <Skeleton className="h-5 w-40 rounded-md bg-foreground/25" />
                <Skeleton className="h-3 w-28 rounded bg-foreground/15" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-6 w-24 rounded-full bg-success/20" />
                <Skeleton className="h-4 w-12 rounded-full bg-warning/20" />
              </div>
            </div>
            <Skeleton className="h-4 w-full rounded bg-foreground/10" />
            <div className="pt-2 border-t border-divider/30 flex items-center justify-between">
              <Skeleton className="h-5 w-20 rounded bg-foreground/20" />
              <Skeleton className="h-5 w-24 rounded bg-foreground/20" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for Detail pages (Order Detail, Ride Detail)
 */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
      {/* Top back button */}
      <Skeleton className="h-9 w-28 rounded-md bg-content1" />

      {/* Main Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl bg-content1" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16 rounded bg-primary/30" />
              <Skeleton className="h-6 w-28 rounded-full bg-success/25" />
              <Skeleton className="h-6 w-20 rounded-full bg-warning/25" />
            </div>
            <Skeleton className="h-8 w-56 rounded-lg bg-foreground/25" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md bg-content1" />
          <Skeleton className="h-9 w-28 rounded-md bg-primary/30" />
        </div>
      </div>

      {/* Status Controls Card Skeleton */}
      <Card className="bg-content1 border border-divider/40 p-4">
        <CardBody className="p-0 grid sm:grid-cols-3 gap-4">
          <Skeleton className="h-10 rounded-md bg-foreground/10" />
          <Skeleton className="h-10 rounded-md bg-foreground/10" />
          <Skeleton className="h-10 rounded-md bg-primary/20" />
        </CardBody>
      </Card>

      {/* Content Grid Skeleton */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-content1 border border-divider/40 p-5 space-y-3">
          <Skeleton className="h-5 w-32 rounded bg-foreground/20" />
          <Skeleton className="h-4 w-full rounded bg-foreground/10" />
          <Skeleton className="h-4 w-3/4 rounded bg-foreground/10" />
          <Skeleton className="h-10 w-full rounded-md bg-primary/15 mt-2" />
        </Card>
        <Card className="bg-content1 border border-divider/40 p-5 space-y-3">
          <Skeleton className="h-5 w-36 rounded bg-foreground/20" />
          <Skeleton className="h-4 w-full rounded bg-foreground/10" />
          <Skeleton className="h-4 w-2/3 rounded bg-foreground/10" />
          <Skeleton className="h-10 w-full rounded-md bg-success/15 mt-2" />
        </Card>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for Customers page
 */
export function CustomersSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top back button */}
      <Skeleton className="h-9 w-36 rounded-md bg-content1" />

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <Skeleton className="h-9 w-48 rounded-lg bg-foreground/20" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-28 rounded bg-foreground/10" />
          <Skeleton className="h-8 w-20 rounded-md bg-content1" />
        </div>
      </div>

      {/* Add Customer Card */}
      <Card className="bg-content1 border border-divider/30 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Skeleton className="h-12 w-64 max-w-xs rounded-lg bg-foreground/10" />
          <Skeleton className="h-12 w-64 max-w-xs rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-36 rounded-md bg-primary/25" />
        </div>
      </Card>

      {/* Filter / View Count Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Skeleton className="h-4 w-28 rounded bg-foreground/15" />
        <Skeleton className="h-8 w-18 rounded-md bg-content2" />
      </div>

      {/* Filters bar */}
      <Card className="bg-content1 border border-divider/30 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Skeleton className="h-10 w-60 max-w-xs rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-36 rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-36 rounded-lg bg-foreground/10" />
        </div>
      </Card>

      {/* Customers Table / List */}
      <Card className="bg-content1 border border-divider/40 p-2 overflow-x-auto">
        <div className="min-w-[640px] space-y-3 p-3">
          {/* Table Header */}
          <div className="grid grid-cols-5 gap-4 pb-2 border-b border-divider/30 text-xs">
            <Skeleton className="h-4 w-20 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-16 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-24 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-16 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-16 ml-auto rounded bg-foreground/15" />
          </div>

          {/* Table Rows */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="grid grid-cols-5 items-center gap-4 py-3 border-b border-divider/20">
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-8 h-8 rounded-full bg-primary/20 shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28 rounded bg-foreground/25" />
                  <Skeleton className="h-3 w-16 rounded bg-foreground/10" />
                </div>
              </div>
              <Skeleton className="h-4 w-24 rounded bg-foreground/20" />
              <Skeleton className="h-4 w-20 rounded bg-foreground/15" />
              <Skeleton className="h-6 w-16 rounded-full bg-secondary/20" />
              <div className="flex items-center gap-2 justify-end">
                <Skeleton className="h-7 w-12 rounded-md bg-foreground/15" />
                <Skeleton className="h-7 w-12 rounded-md bg-danger/20" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/**
 * Skeleton loader for Invoices page
 */
export function InvoicesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button */}
      <Skeleton className="h-9 w-36 rounded-md bg-content1" />

      {/* Header */}
      <Skeleton className="h-9 w-40 rounded-lg bg-foreground/20" />

      {/* Top Controls Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Skeleton className="h-4 w-24 rounded bg-foreground/15" />
        <Skeleton className="h-8 w-18 rounded-md bg-content2" />
      </div>

      {/* Filter Bar */}
      <Card className="bg-content1 border border-divider/30 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Skeleton className="h-10 w-48 max-w-xs rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-36 rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-32 rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-36 rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-56 rounded-lg bg-foreground/10" />
        </div>
      </Card>

      {/* Invoices Table */}
      <Card className="bg-content1 border border-divider/40 p-2 overflow-x-auto">
        <div className="min-w-[720px] space-y-3 p-3">
          <div className="grid grid-cols-8 gap-3 pb-2 border-b border-divider/30">
            <Skeleton className="h-4 w-14 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-20 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-14 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-14 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-14 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-12 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-16 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-14 rounded bg-foreground/15" />
          </div>

          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="grid grid-cols-8 items-center gap-3 py-3 border-b border-divider/20">
              <Skeleton className="h-4 w-16 rounded bg-secondary/30" />
              <Skeleton className="h-4 w-24 rounded bg-foreground/25" />
              <Skeleton className="h-4 w-20 rounded bg-foreground/15" />
              <Skeleton className="h-4 w-16 rounded bg-foreground/20" />
              <Skeleton className="h-4 w-14 rounded bg-foreground/20" />
              <Skeleton className="h-4 w-14 rounded bg-warning/25" />
              <Skeleton className="h-4 w-16 rounded bg-foreground/15" />
              <Skeleton className="h-6 w-20 rounded-full bg-success/20" />
            </div>
          ))}
        </div>
      </Card>

      {/* Bottom 5 KPI Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="bg-content1 p-5 shadow-lg border border-divider/30 space-y-2">
            <Skeleton className="h-3 w-24 rounded bg-foreground/15" />
            <Skeleton className="h-7 w-28 rounded-md bg-primary/20" />
            <Skeleton className="h-3 w-32 rounded bg-foreground/10" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for Staff page
 */
export function StaffSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button */}
      <Skeleton className="h-9 w-36 rounded-md bg-content1" />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-32 rounded-lg bg-foreground/20" />
        <Skeleton className="h-9 w-32 rounded-md bg-primary/20" />
      </div>

      {/* Add Staff Card */}
      <Card className="bg-content1 border border-divider/30 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Skeleton className="h-12 w-48 rounded-lg bg-foreground/10" />
          <Skeleton className="h-12 w-48 rounded-lg bg-foreground/10" />
          <Skeleton className="h-12 w-32 rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-28 rounded-md bg-primary/25" />
        </div>
      </Card>

      {/* Staff Cards Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="bg-content1 border border-divider/40 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-6 w-36 rounded-md bg-foreground/25" />
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-6 w-20 rounded-full bg-warning/20" />
                <Skeleton className="h-5 w-16 rounded-full bg-success/20" />
              </div>
            </div>
            <Skeleton className="h-4 w-44 rounded bg-foreground/15" />
            <Skeleton className="h-3 w-56 rounded bg-foreground/10" />
            <div className="flex flex-wrap gap-2 pt-2 border-t border-divider/25">
              <Skeleton className="h-8 w-32 rounded-md bg-foreground/15" />
              <Skeleton className="h-8 w-16 rounded-md bg-foreground/10" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for Investments page
 */
export function InvestmentsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button */}
      <Skeleton className="h-9 w-36 rounded-md bg-content1" />

      {/* Header */}
      <Skeleton className="h-9 w-44 rounded-lg bg-foreground/20" />

      {/* Add Investment Card */}
      <Card className="bg-content1 border border-divider/30 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Skeleton className="h-12 w-56 max-w-xs rounded-lg bg-foreground/10" />
          <Skeleton className="h-12 w-36 rounded-lg bg-foreground/10" />
          <Skeleton className="h-12 w-32 rounded-lg bg-foreground/10" />
          <Skeleton className="h-12 w-36 rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-36 rounded-md bg-primary/25" />
        </div>
      </Card>

      {/* Filters */}
      <Card className="bg-content1 border border-divider/30 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Skeleton className="h-10 w-56 max-w-xs rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-40 rounded-lg bg-foreground/10" />
          <Skeleton className="h-10 w-56 rounded-lg bg-foreground/10" />
        </div>
      </Card>

      {/* Investments Table */}
      <Card className="bg-content1 border border-divider/40 p-2 overflow-x-auto">
        <div className="min-w-[640px] space-y-3 p-3">
          <div className="grid grid-cols-5 gap-4 pb-2 border-b border-divider/30">
            <Skeleton className="h-4 w-28 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-20 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-16 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-20 rounded bg-foreground/15" />
            <Skeleton className="h-4 w-16 ml-auto rounded bg-foreground/15" />
          </div>

          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="grid grid-cols-5 items-center gap-4 py-3 border-b border-divider/20">
              <Skeleton className="h-4 w-36 rounded bg-foreground/25" />
              <Skeleton className="h-6 w-24 rounded-full bg-secondary/20" />
              <Skeleton className="h-4 w-20 rounded bg-foreground/15" />
              <Skeleton className="h-4 w-20 rounded bg-primary/20" />
              <div className="flex items-center gap-2 justify-end">
                <Skeleton className="h-7 w-12 rounded-md bg-foreground/15" />
                <Skeleton className="h-7 w-12 rounded-md bg-danger/20" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/**
 * Skeleton loader for General Analytics page
 */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button */}
      <Skeleton className="h-9 w-36 rounded-md bg-content1" />

      {/* Header */}
      <Skeleton className="h-9 w-36 rounded-lg bg-foreground/20" />

      {/* Date Range Picker Bar */}
      <Card className="bg-content1 border border-divider/30 p-4">
        <Skeleton className="h-10 w-64 rounded-lg bg-foreground/10" />
      </Card>

      {/* 4 KPI Summary Cards */}
      <div className="grid sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-content1 p-5 shadow-lg border border-divider/30 space-y-2">
            <Skeleton className="h-3 w-24 rounded bg-foreground/15" />
            <Skeleton className="h-8 w-28 rounded-md bg-primary/20" />
          </Card>
        ))}
      </div>

      {/* Primary Chart Skeleton */}
      <Card className="bg-content1 border border-divider/30 p-5 space-y-4">
        <Skeleton className="h-6 w-48 rounded bg-foreground/20" />
        <div className="h-64 sm:h-72 w-full rounded-xl bg-foreground/5 p-6 flex items-end justify-between gap-3 border border-divider/20">
          {[40, 70, 55, 90, 65, 80, 50, 85, 95, 60, 75, 88].map((h, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton
                className="w-full rounded-t-md bg-primary/25"
                style={{ height: `${h}%` }}
              />
              <Skeleton className="h-2 w-6 rounded bg-foreground/10" />
            </div>
          ))}
        </div>
      </Card>

      {/* Secondary Charts Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-content1 border border-divider/30 p-5 space-y-4">
          <Skeleton className="h-5 w-40 rounded bg-foreground/20" />
          <div className="h-52 w-full rounded-xl bg-foreground/5 p-4 flex items-center justify-center border border-divider/20">
            <Skeleton className="w-36 h-36 rounded-full bg-secondary/20" />
          </div>
        </Card>
        <Card className="bg-content1 border border-divider/30 p-5 space-y-4">
          <Skeleton className="h-5 w-44 rounded bg-foreground/20" />
          <div className="h-52 w-full rounded-xl bg-foreground/5 p-4 flex items-center justify-center border border-divider/20">
            <Skeleton className="w-36 h-36 rounded-full bg-primary/20" />
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for Staff Analytics page
 */
export function StaffAnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button */}
      <Skeleton className="h-9 w-32 rounded-md bg-content1" />

      {/* Header */}
      <Skeleton className="h-9 w-48 rounded-lg bg-foreground/20" />

      {/* 4 Summary Stat Cards */}
      <div className="grid sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-content1 p-5 shadow-lg border border-divider/30 space-y-2">
            <Skeleton className="h-3 w-28 rounded bg-foreground/15" />
            <Skeleton className="h-8 w-24 rounded-md bg-primary/20" />
          </Card>
        ))}
      </div>

      {/* Area Chart Comparison Skeleton */}
      <Card className="bg-content1 border border-divider/30 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-56 rounded bg-foreground/20" />
          <Skeleton className="h-4 w-32 rounded bg-foreground/10" />
        </div>
        <div className="h-64 sm:h-72 w-full rounded-xl bg-foreground/5 p-6 flex items-end justify-between gap-3 border border-divider/20">
          {[35, 60, 45, 80, 50, 75, 40, 90].map((h, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton
                className="w-full rounded-t-md bg-secondary/25"
                style={{ height: `${h}%` }}
              />
              <Skeleton className="h-2 w-8 rounded bg-foreground/10" />
            </div>
          ))}
        </div>
      </Card>

      {/* Detailed Table Skeleton */}
      <Card className="bg-content1 border border-divider/30 p-5 space-y-3">
        <Skeleton className="h-5 w-48 rounded bg-foreground/20" />
        <div className="overflow-x-auto">
          <div className="min-w-[600px] space-y-3 pt-2">
            <div className="grid grid-cols-6 gap-3 pb-2 border-b border-divider/30">
              <Skeleton className="h-4 w-20 rounded bg-foreground/15" />
              <Skeleton className="h-4 w-16 rounded bg-foreground/15" />
              <Skeleton className="h-4 w-20 rounded bg-foreground/15" />
              <Skeleton className="h-4 w-16 rounded bg-foreground/15" />
              <Skeleton className="h-4 w-16 rounded bg-foreground/15" />
              <Skeleton className="h-4 w-20 ml-auto rounded bg-foreground/15" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid grid-cols-6 items-center gap-3 py-2.5 border-b border-divider/20">
                <Skeleton className="h-4 w-28 rounded bg-foreground/25" />
                <Skeleton className="h-4 w-12 rounded bg-foreground/15" />
                <Skeleton className="h-4 w-16 rounded bg-foreground/20" />
                <Skeleton className="h-4 w-14 rounded bg-success/20" />
                <Skeleton className="h-4 w-14 rounded bg-danger/20" />
                <Skeleton className="h-4 w-16 ml-auto rounded bg-primary/25" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Skeleton loader for Auto Customers (rides.customers)
 */
export function AutoCustomersSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-md bg-content1" />
          <div className="space-y-1">
            <Skeleton className="h-8 w-56 rounded-lg bg-foreground/20" />
            <Skeleton className="h-3 w-36 rounded bg-foreground/10" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="max-w-md">
        <Skeleton className="h-10 w-full rounded-md bg-foreground/10" />
      </div>

      {/* Grid of Passenger Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-4 bg-white/95 rounded-xl border border-[#D9A427]/30 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <Skeleton className="h-5 w-32 rounded bg-gray-300" />
                <Skeleton className="h-3 w-24 rounded bg-gray-200" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full bg-warning/20" />
            </div>

            <div className="pt-2.5 border-t border-gray-100 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16 rounded bg-gray-200" />
                <Skeleton className="h-5 w-20 rounded bg-gray-300" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16 rounded bg-gray-200" />
                <Skeleton className="h-5 w-20 rounded bg-gray-300" />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <Skeleton className="h-3 w-24 rounded bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="w-7 h-7 rounded-full bg-primary/20" />
                <Skeleton className="w-7 h-7 rounded-full bg-success/20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for Auto Drivers (Pilots)
 */
export function AutoDriversSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-md bg-content1" />
          <div className="space-y-1">
            <Skeleton className="h-8 w-52 rounded-lg bg-foreground/20" />
            <Skeleton className="h-3 w-40 rounded bg-foreground/10" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-md bg-primary/30" />
      </div>

      {/* Grid of Pilot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-5 bg-white/95 rounded-xl border border-[#D9A427]/30 shadow-sm space-y-4"
          >
            {/* Pilot Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full bg-primary/20" />
                <div className="space-y-1">
                  <Skeleton className="h-5 w-28 rounded bg-gray-300" />
                  <Skeleton className="h-3 w-20 rounded bg-gray-200" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Skeleton className="w-7 h-7 rounded-full bg-gray-200" />
                <Skeleton className="w-7 h-7 rounded-full bg-danger/20" />
              </div>
            </div>

            {/* Financial Summary Grid */}
            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#F8F4E6]/80 border border-[#D9A427]/25">
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16 rounded bg-gray-300" />
                <Skeleton className="h-4 w-16 rounded bg-gray-400" />
                <Skeleton className="h-2 w-12 rounded bg-gray-200" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-16 rounded bg-gray-300" />
                <Skeleton className="h-4 w-16 rounded bg-success/30" />
                <Skeleton className="h-2 w-10 rounded bg-gray-200" />
              </div>
              <div className="pt-2 border-t border-[#D9A427]/20 space-y-1">
                <Skeleton className="h-2.5 w-16 rounded bg-gray-300" />
                <Skeleton className="h-4 w-16 rounded bg-danger/30" />
              </div>
              <div className="pt-2 border-t border-[#D9A427]/20 space-y-1">
                <Skeleton className="h-2.5 w-16 rounded bg-gray-300" />
                <Skeleton className="h-4 w-16 rounded bg-primary/30" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-8 flex-1 rounded-md bg-gray-200" />
              <Skeleton className="h-8 w-18 rounded-md bg-success/20" />
              <Skeleton className="h-8 w-18 rounded-md bg-danger/20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for Diesel & Repair Expenses
 */
export function AutoDieselRepairSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-md bg-content1" />
          <div className="space-y-1">
            <Skeleton className="h-8 w-64 rounded-lg bg-foreground/20" />
            <Skeleton className="h-3 w-48 rounded bg-foreground/10" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-md bg-primary/30" />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 bg-white/95 rounded-xl border border-primary/30 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28 rounded bg-gray-300" />
              <Skeleton className="w-5 h-5 rounded bg-primary/20" />
            </div>
            <Skeleton className="h-8 w-32 rounded bg-gray-400" />
            <Skeleton className="h-3 w-36 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-primary/30 pb-2">
        <Skeleton className="h-7 w-28 rounded-md bg-primary/30" />
        <Skeleton className="h-7 w-24 rounded-md bg-foreground/10" />
        <Skeleton className="h-7 w-24 rounded-md bg-foreground/10" />
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-primary/30 shadow-sm overflow-hidden p-4 space-y-3">
        <div className="grid grid-cols-6 gap-3 pb-2 border-b border-primary/20">
          <Skeleton className="h-4 w-14 rounded bg-gray-300" />
          <Skeleton className="h-4 w-16 rounded bg-gray-300" />
          <Skeleton className="h-4 w-28 rounded bg-gray-300" />
          <Skeleton className="h-4 w-16 rounded bg-gray-300" />
          <Skeleton className="h-4 w-20 ml-auto rounded bg-gray-300" />
          <Skeleton className="h-4 w-14 mx-auto rounded bg-gray-300" />
        </div>

        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="grid grid-cols-6 items-center gap-3 py-3 border-b border-gray-100">
            <Skeleton className="h-6 w-18 rounded-full bg-primary/20" />
            <Skeleton className="h-4 w-20 rounded bg-gray-300" />
            <Skeleton className="h-4 w-32 rounded bg-gray-400" />
            <Skeleton className="h-4 w-24 rounded bg-gray-300" />
            <Skeleton className="h-5 w-20 ml-auto rounded bg-gray-400" />
            <div className="flex items-center justify-center gap-1">
              <Skeleton className="w-6 h-6 rounded-full bg-gray-200" />
              <Skeleton className="w-6 h-6 rounded-full bg-danger/20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for Auto Rides Analytics
 */
export function AutoRidesAnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-md bg-content1" />
          <div className="space-y-1">
            <Skeleton className="h-8 w-60 rounded-lg bg-foreground/20" />
            <Skeleton className="h-3 w-52 rounded bg-foreground/10" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md bg-content1" />
          <Skeleton className="h-8 w-28 rounded-md bg-primary/30" />
        </div>
      </div>

      {/* Main Interactive Analytics Card Skeleton */}
      <Card className="bg-content1 border border-[#D9A427]/35 shadow-md p-6 space-y-6">
        {/* Metric selection row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D9A427]/25 pb-4">
          <div className="space-y-1">
            <Skeleton className="h-6 w-48 rounded bg-foreground/20" />
            <Skeleton className="h-3 w-56 rounded bg-foreground/10" />
          </div>
          <Skeleton className="h-10 w-44 rounded-lg bg-foreground/10" />
        </div>

        {/* 4 Financial KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-content2/50 border border-[#D9A427]/20 space-y-2 text-center"
            >
              <Skeleton className="h-3 w-20 mx-auto rounded bg-foreground/15" />
              <Skeleton className="h-7 w-24 mx-auto rounded bg-primary/20" />
              <Skeleton className="h-2.5 w-16 mx-auto rounded bg-foreground/10" />
            </div>
          ))}
        </div>

        {/* Big Chart Skeleton */}
        <div className="h-72 sm:h-80 w-full rounded-xl bg-foreground/5 p-6 flex items-end justify-between gap-2 border border-[#D9A427]/20">
          {[30, 65, 45, 85, 55, 95, 40, 75, 60, 80, 50, 70, 90, 60].map((h, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton
                className="w-full rounded-t-md bg-[#D9A427]/25"
                style={{ height: `${h}%` }}
              />
              <Skeleton className="h-2 w-5 rounded bg-foreground/10" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

