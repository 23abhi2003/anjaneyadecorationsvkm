"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import StaffSettlementsDetailClient from "@/components/StaffSettlementsDetailClient";
import { StaffSkeleton } from "@/components/Skeletons";
import BackButton from "@/components/BackButton";
import type { StaffMember } from "@/lib/types";

function StaffSettlementsDetailInner() {
  const searchParams = useSearchParams();
  const staffId = searchParams.get("id") || searchParams.get("staffId");

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/staff");
      if (!res.ok) throw new Error("Failed to load staff list.");
      setStaffList((await res.json()) as StaffMember[]);
    } catch {
      setError("Could not load staff data. Is the API reachable?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <StaffSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-danger font-medium">{error}</p>
        <BackButton href="/settlements" label="Back to All Staff Settlements" />
      </div>
    );
  }

  if (!staffId) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-foreground/70">No staff member specified in URL query parameter.</p>
        <BackButton href="/settlements" label="Back to All Staff Settlements" />
      </div>
    );
  }

  const staffMember = staffList.find((s) => s.id === staffId);

  if (!staffMember) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-foreground/70">
          Staff member not found (ID: <span className="font-mono text-primary">{staffId}</span>).
        </p>
        <BackButton href="/settlements" label="Back to All Staff Settlements" />
      </div>
    );
  }

  return (
    <StaffSettlementsDetailClient
      staff={staffMember}
      onRefresh={() => load(true)}
    />
  );
}

export default function StaffSettlementsDetailPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <StaffSettlementsDetailInner />
    </Suspense>
  );
}

