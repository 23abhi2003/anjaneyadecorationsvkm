"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import RideWizard from "@/components/autorides/RideWizard";
import BackButton from "@/components/BackButton";
import type { AutoDriver } from "@/lib/types";

export default function NewRidePage() {
  const [drivers, setDrivers] = useState<AutoDriver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/auto-drivers")
      .then((res) => (res.ok ? (res.json() as Promise<AutoDriver[]>) : Promise.resolve([])))
      .then((data) => {
        if (!cancelled) setDrivers(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <BackButton href="/auto-rides/rides" label="Back to Rides" />
      <div>
        <p
          className="text-xs uppercase tracking-[0.25em] text-[#D9A427] font-bold"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          New Booking · Auto Rides
        </p>
        <h1
          className="text-3xl font-bold text-[#F8F4E6] mt-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Book an Auto Ride
        </h1>
      </div>
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading pilots…" color="warning" />
        </div>
      ) : (
        <RideWizard drivers={drivers} />
      )}
      <div className="pt-4 border-t border-[#D9A427]/20 flex items-center justify-between">
        <BackButton href="/auto-rides/rides" label="Back to Rides" />
      </div>
    </div>
  );
}
