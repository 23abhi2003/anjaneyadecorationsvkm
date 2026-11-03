"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import SettlementsOverviewClient from "@/components/SettlementsOverviewClient";
import { StaffSkeleton } from "@/components/Skeletons";
import type { StaffMember } from "@/lib/types";

function SettlementsOverviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffId = searchParams.get("id") || searchParams.get("staffId");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // If a specific staff query param is passed to /settlements, navigate directly to the detail page
  useEffect(() => {
    if (staffId) {
      router.replace(`/settlements/detail?id=${encodeURIComponent(staffId)}`);
    }
  }, [staffId, router]);

  const load = useCallback(async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/staff");
      if (!res.ok) throw new Error("Failed to load staff settlements.");
      setStaff((await res.json()) as StaffMember[]);
    } catch {
      setError("Could not load staff settlements. Is the API reachable?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || staffId) {
    return <StaffSkeleton />;
  }

  if (error) {
    return <p className="text-center text-danger py-24">{error}</p>;
  }

  return (
    <SettlementsOverviewClient
      staffList={staff}
      onRefresh={() => load(true)}
    />
  );
}

export default function SettlementsPage() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <SettlementsOverviewInner />
    </Suspense>
  );
}
