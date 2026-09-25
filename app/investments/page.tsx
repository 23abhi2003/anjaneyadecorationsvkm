"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import InvestmentsClient from "@/components/InvestmentsClient";
import BackButton from "@/components/BackButton";
import type { Investment } from "@/lib/types";

export default function InvestmentsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/investments");
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as Investment[];
      setInvestments(data);
    } catch {
      setError("Could not load investments. Is the API reachable?");
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-4">
        <BackButton href="/" label="Back to Dashboard" />
      </div>

      <h1 className="text-3xl font-semibold text-[#F8F4E6] mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Investments
      </h1>

      {!isOwner && <p className="text-center text-[#F8F4E6]/60 py-16">Investments are only visible to owner logins.</p>}

      {isOwner && loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading investments…" color="primary" />
        </div>
      )}

      {isOwner && !loading && error && <p className="text-center text-danger py-10">{error}</p>}

      {isOwner && !loading && !error && <InvestmentsClient investments={investments} onChanged={load} />}

      <div className="mt-8 pt-4 border-t border-[#D9A427]/20 flex items-center justify-between">
        <BackButton href="/" label="Back to Dashboard" />
      </div>
    </div>
  );
}
