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
