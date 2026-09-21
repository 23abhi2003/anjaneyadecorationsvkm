"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import StaffClient from "@/components/StaffClient";
import type { StaffMember } from "@/lib/types";

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // `silent` refreshes keep the page mounted (no spinner), so an open borrows modal survives a save.
  const load = useCallback(async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/staff");
      if (!res.ok) throw new Error("failed");
      setStaff((await res.json()) as StaffMember[]);
    } catch {
      setError("Could not load staff. Is the API reachable?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading staff…" color="primary" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-danger py-24">{error}</p>;
  }

  return <StaffClient staff={staff} onAdded={() => load()} onRefresh={() => load(true)} />;
}
