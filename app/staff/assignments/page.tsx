"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Spinner, Button } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import StaffAssignmentsClient from "@/components/StaffAssignmentsClient";
import type { StaffMember } from "@/lib/types";

function StaffAssignmentsInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [staffMember, setStaffMember] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await apiFetch(`/api/staff/${encodeURIComponent(id)}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("failed");
      setStaffMember((await res.json()) as StaffMember);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading assignments…" color="primary" />
      </div>
    );
  }

  if (notFound || !staffMember) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-[#F8F4E6]/70">Staff member not found.</p>
        <Button as={Link} href="/staff" color="primary" radius="sm">
          Back to staff
        </Button>
      </div>
    );
  }

  return <StaffAssignmentsClient staff={staffMember} onChanged={load} />;
}

export default function StaffAssignmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner label="Loading assignments…" color="primary" />
        </div>
      }
    >
      <StaffAssignmentsInner />
    </Suspense>
  );
}