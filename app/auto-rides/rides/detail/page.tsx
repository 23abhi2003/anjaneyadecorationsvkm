"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@heroui/react";
import { apiFetch } from "@/lib/api";
import RideDetailClient from "@/components/autorides/RideDetailClient";
import BackButton from "@/components/BackButton";
import type { AutoRide, AutoDriver } from "@/lib/types";

function RideDetailInner() {
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
      (async () => {
        try {
          const res = await apiFetch(`/api/auto-rides/${encodeURIComponent(id)}`);
          if (res.ok) {
            return (await res.json()) as AutoRide;
          }
        } catch {
          // fallback below
        }

        try {
          const listRes = await apiFetch("/api/auto-rides");
          if (listRes.ok) {
            const list = (await listRes.json()) as AutoRide[];
            const found = list.find(
              (r) => r.id?.trim().toLowerCase() === id.trim().toLowerCase()
            );
            return found || null;
          }
        } catch {
          // fallback failed
        }
        return null;
      })(),
      apiFetch("/api/auto-drivers")
        .then((res) => (res.ok ? (res.json() as Promise<AutoDriver[]>) : []))
        .catch(() => [] as AutoDriver[]),
    ])
      .then(([rideData, driversData]) => {
        if (cancelled) return;
        if (!rideData) {
          setNotFound(true);
          return;
        }
        setRide(rideData);
        setDrivers(driversData);
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
        <Spinner label="Loading ride details…" color="warning" />
      </div>
    );
  }

  if (notFound || !ride) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-[#F8F4E6]/70 text-lg">Ride not found.</p>
        <BackButton href="/auto-rides/rides" label="Back to Rides" />
      </div>
    );
  }

  return <RideDetailClient ride={ride} drivers={drivers} />;
}

export default function RideDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner label="Loading ride details…" color="warning" />
        </div>
      }
    >
      <RideDetailInner />
    </Suspense>
  );
}
