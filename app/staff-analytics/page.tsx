"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import AllStaffAnalyticsTab from "@/components/AllStaffAnalyticsTab";
import type { StaffMember } from "@/lib/types";

export default function StaffAnalyticsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    apiFetch("/api/staff")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<StaffMember[]>;
      })
      .then((data) => {
        if (!cancelled) setStaff(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load staff analytics. Is the API reachable?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  return (
    <div>
      <h1 className="text-3xl font-semibold text-[#F8F4E6] mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Staff Analytics
      </h1>

      {!isOwner && <p className="text-center text-[#F8F4E6]/60 py-16">Staff analytics are only visible to owner logins.</p>}

      {isOwner && loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading staff analytics…" color="primary" />
        </div>
      )}

      {isOwner && !loading && error && <p className="text-center text-danger py-10">{error}</p>}

      {isOwner && !loading && !error && <AllStaffAnalyticsTab staff={staff} />}
    </div>
  );
}