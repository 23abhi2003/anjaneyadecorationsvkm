"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { BarChart3, TrendingUp, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import type { AutoRide, AutoDriver, AutoDieselEntry } from "@/lib/types";
import BackButton from "@/components/BackButton";
import AutoRidesAnalyticsCard from "@/components/autorides/AutoRidesAnalyticsCard";
import { AutoRidesAnalyticsSkeleton } from "@/components/Skeletons";

export default function AutoRidesAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.role === "owner";

  const [rides, setRides] = useState<AutoRide[]>([]);
  const [drivers, setDrivers] = useState<AutoDriver[]>([]);
  const [dieselEntries, setDieselEntries] = useState<AutoDieselEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [ridesRes, driversRes, dieselRes] = await Promise.all([
        apiFetch("/api/auto-rides"),
        apiFetch("/api/auto-drivers"),
        apiFetch("/api/auto-diesel"),
      ]);

      if (!ridesRes.ok) throw new Error("Failed to load rides");

      const [ridesData, driversData, dieselData] = await Promise.all([
        ridesRes.json() as Promise<AutoRide[]>,
        driversRes.ok ? (driversRes.json() as Promise<AutoDriver[]>) : Promise.resolve([]),
        dieselRes.ok ? (dieselRes.json() as Promise<AutoDieselEntry[]>) : Promise.resolve([]),
      ]);

      setRides(ridesData);
      setDrivers(driversData);
      setDieselEntries(dieselData);
    } catch {
      setError("Could not load Auto Rides analytics data. Is the backend reachable?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (authLoading || loading) {
    return <AutoRidesAnalyticsSkeleton />;
  }

  if (!isOwner) {
    return (
      <div className="text-center py-24 space-y-3">
        <p className="text-xl font-bold text-[#F8F4E6]">Owner Access Only</p>
        <p className="text-sm text-[#F8F4E6]/70">
          Only the owner can view full auto rides analytics, fuel investments, and financial reports.
        </p>
        <Button as={Link} href="/" color="primary" radius="sm">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton href="/auto-rides" />
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-[#F8F4E6] flex items-center gap-2.5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <BarChart3 size={26} className="text-primary" />
              Auto Rides Analytics
            </h1>
            <p className="text-xs text-[#F8F4E6]/70 font-mono mt-0.5">
              Interactive multi-metric charts, fleet performance, and total financial calculations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            radius="sm"
            onPress={() => loadData()}
            className="font-medium text-[#F8F4E6]/90 hover:text-[#D9A427] bg-[#F8F4E6]/5 hover:bg-[#D9A427]/15 border border-[#D9A427]/40 hover:border-[#D9A427]/70 transition-all"
            startContent={<RefreshCw size={14} className="text-[#D9A427]" />}
          >
            Refresh Data
          </Button>
          <Button
            as={Link}
            href="/auto-rides/new"
            color="primary"
            size="sm"
            radius="sm"
            className="font-bold text-[#241129] bg-primary hover:bg-primary/90 shadow-sm"
          >
            + Create Ride
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Dedicated Interactive Analytics Graph with Dropdown & Total Calculations */}
      <section>
        <AutoRidesAnalyticsCard
          rides={rides}
          dieselEntries={dieselEntries}
          drivers={drivers}
        />
      </section>
    </div>
  );
}
