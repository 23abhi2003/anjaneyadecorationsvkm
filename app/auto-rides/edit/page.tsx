"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Spinner, Button } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import RideWizard from "@/components/autorides/RideWizard";
import BackButton from "@/components/BackButton";
import type { AutoRide, AutoDriver } from "@/lib/types";

function EditRideInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [ride, setRide] = useState<AutoRide | null>(null);
  const [drivers, setDrivers] = useState<AutoDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    Promise.all([
      apiFetch(`/api/auto-rides/${encodeURIComponent(id)}`).then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<AutoRide>;
      }),
      apiFetch("/api/auto-drivers")
        .then((res) => (res.ok ? (res.json() as Promise<AutoDriver[]>) : Promise.resolve([])))
        .catch(() => [] as AutoDriver[]),
    ])
      .then(([rideData, driverData]) => {
        if (cancelled) return;
        if (!rideData) {
          setNotFound(true);
          return;
        }
        setRide(rideData);
        setDrivers(driverData);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading ride booking…" color="warning" />
      </div>
    );
  }

  if (notFound || !ride) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-[#F8F4E6]/70">Ride booking not found.</p>
        <Button as={Link} href="/auto-rides/rides" color="warning" radius="sm">
          Back to rides
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton href="/auto-rides/rides" label="Back to Rides" />
      <div>
        <p
          className="text-xs uppercase tracking-[0.25em] text-[#D9A427] font-bold"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {ride.id} · Edit Booking
        </p>
        <h1
          className="text-3xl font-bold text-[#F8F4E6] mt-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Edit Auto Ride Booking
        </h1>
      </div>
      <RideWizard drivers={drivers} initialRide={ride} />
      <div className="pt-4 border-t border-[#D9A427]/20 flex items-center justify-between">
        <BackButton href="/auto-rides/rides" label="Back to Rides" />
      </div>
    </div>
  );
}

export default function EditRidePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner label="Loading ride booking…" color="warning" />
        </div>
      }
    >
      <EditRideInner />
    </Suspense>
  );
}
