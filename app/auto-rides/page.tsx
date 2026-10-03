"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, Spinner, useDisclosure } from "@heroui/react";
import {
  Car,
  Search,
  PlusCircle,
  Calendar,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  Navigation,
  Fuel,
  Users,
  HardHat,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import type { AutoRide, AutoDriver, AutoDieselEntry, Customer } from "@/lib/types";
import NavCard from "@/components/NavCard";
import RideDetailModal from "@/components/autorides/RideDetailModal";

type DashboardFilter = "amount" | "dues" | "drivers" | "diesel" | "profit" | null;

export default function AutoRidesDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.role === "owner";
  const isDriver = user?.role === "driver";

  const [rides, setRides] = useState<AutoRide[]>([]);
  const [drivers, setDrivers] = useState<AutoDriver[]>([]);
  const [dieselEntries, setDieselEntries] = useState<AutoDieselEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>(null);

  // Modals
  const [selectedRide, setSelectedRide] = useState<AutoRide | null>(null);
  const {
    isOpen: isDetailOpen,
    onOpen: openDetail,
    onOpenChange: onDetailOpenChange,
  } = useDisclosure();

  // Redirect drivers to /auto-rides/rides immediately
  useEffect(() => {
    if (!authLoading && isDriver) {
      router.replace("/auto-rides/rides");
    }
  }, [authLoading, isDriver, router]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [ridesRes, driversRes, dieselRes, custRes] = await Promise.all([
        apiFetch("/api/auto-rides"),
        apiFetch("/api/auto-drivers"),
        apiFetch("/api/auto-diesel"),
        apiFetch("/api/customers"),
      ]);

      if (!ridesRes.ok) throw new Error("Failed to load rides");

      const [ridesData, driversData, dieselData, custData] = await Promise.all([
        ridesRes.json() as Promise<AutoRide[]>,
        driversRes.ok ? (driversRes.json() as Promise<AutoDriver[]>) : Promise.resolve([]),
        dieselRes.ok ? (dieselRes.json() as Promise<AutoDieselEntry[]>) : Promise.resolve([]),
        custRes.ok ? (custRes.json() as Promise<Customer[]>) : Promise.resolve([]),
      ]);

      setRides(ridesData);
      setDrivers(driversData);
      setDieselEntries(dieselData);
      setCustomers(custData);
    } catch {
      setError("Could not load Auto Rides data. Is the backend reachable?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isDriver) {
      loadData();
    }
  }, [isDriver]);

  // Financial calculations
  const totals = useMemo(() => {
    let amount = 0;
    let dues = 0;
    let driverWages = 0;

    for (const r of rides) {
      const tot = parseFloat(r.totalAmount || "0") || 0;
      const adv = parseFloat(r.advancePaid || "0") || 0;
      const due = r.status === "completed" && r.paymentStatus === "paid" ? 0 : Math.max(tot - adv, 0);
      const wage = parseFloat(r.driverPay || "0") || 0;

      amount += tot;
      dues += due;
      driverWages += wage;
    }

    const totalDieselSpend = dieselEntries.reduce(
      (sum, d) => sum + (parseFloat(d.totalAmount || "0") || 0),
      0
    );

    const netProfit = amount - driverWages - totalDieselSpend;

    return {
      amount,
      dues,
      driverWages,
      dieselSpend: totalDieselSpend,
      profit: netProfit,
    };
  }, [rides, dieselEntries]);

  // Unique customers from rides
  const uniqueCustomerPhones = useMemo(() => {
    const set = new Set<string>();
    rides.forEach((r) => {
      if (r.customerPhone) set.add(r.customerPhone.trim());
      else if (r.customerName) set.add(r.customerName.trim());
    });
    return set.size;
  }, [rides]);

  // Filtered rides
  const displayedRides = useMemo(() => {
    let result = [...rides];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.customerName?.toLowerCase().includes(q) ||
          r.customerPhone?.includes(q) ||
          r.pickupLocation?.toLowerCase().includes(q) ||
          r.dropLocation?.toLowerCase().includes(q) ||
          r.driverAssigned?.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      );
    }

    if (filter === "amount") {
      return result.sort((a, b) => (parseFloat(b.totalAmount || "0") || 0) - (parseFloat(a.totalAmount || "0") || 0));
    }
    if (filter === "dues") {
      return result
        .filter((r) => (parseFloat(r.dueAmount || "0") || 0) > 0 || r.paymentStatus === "due")
        .sort((a, b) => (parseFloat(b.dueAmount || "0") || 0) - (parseFloat(a.dueAmount || "0") || 0));
    }
    if (filter === "drivers") {
      return result.sort((a, b) => (parseFloat(b.driverPay || "0") || 0) - (parseFloat(a.driverPay || "0") || 0));
    }
    if (filter === "profit") {
      return result.sort((a, b) => {
        const profitB = (parseFloat(b.totalAmount || "0") || 0) - (parseFloat(b.driverPay || "0") || 0);
        const profitA = (parseFloat(a.totalAmount || "0") || 0) - (parseFloat(a.driverPay || "0") || 0);
        return profitB - profitA;
      });
    }

    return searchQuery ? result : result.slice(0, 6);
  }, [rides, searchQuery, filter]);

  function toggleFilter(next: Exclude<DashboardFilter, null>): void {
    setFilter((cur) => (cur === next ? null : next));
  }

  function handleRideClick(ride: AutoRide) {
    router.push(`/auto-rides/rides/detail?id=${encodeURIComponent(ride.id)}`);
  }

  function handleEditRide(ride: AutoRide) {
    router.push(`/auto-rides/edit?id=${encodeURIComponent(ride.id)}`);
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading Auto Rides Dashboard..." color="warning" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-danger font-semibold">{error}</p>
        <Button size="sm" color="warning" variant="flat" onPress={() => loadData()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="text-center py-24 space-y-3">
        <p className="text-xl font-bold text-[#F8F4E6]">Owner Access Only</p>
        <p className="text-sm text-[#F8F4E6]/70">Only the owner can view full auto rides financials and settings.</p>
        <Button as={Link} href="/" color="primary" radius="sm">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const duesCount = rides.filter(
    (r) => (parseFloat(r.dueAmount || "0") || 0) > 0 || r.paymentStatus === "due"
  ).length;

  return (
    <div className="space-y-8">
      {/* Brand Header & Quick Actions */}
      <section className="text-center py-6">
        <p className="text-xl uppercase tracking-[0.9em] text-[#D9A427]" style={{ fontFamily: "var(--font-mono)" }}>
          Anjaneya Auto Rentals · V.K.M
        </p>
        <p className="text-xs uppercase tracking-widest text-[#3F6B1F] mt-1 font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
          Passenger Transport &amp; Rental Fleet
        </p>

        {/* Global Search Bar */}
        <div className="max-w-xl mx-auto mt-6">
          <Input
            label="Search by passenger, phone, route, or pilot"
            value={searchQuery}
            onValueChange={setSearchQuery}
            variant="bordered"
            radius="sm"
            size="md"
            startContent={<Search className="text-primary" size={18} />}
            isClearable
            onClear={() => setSearchQuery("")}
            className="w-full bg-white shadow-sm rounded-xl"
          />
        </div>

        {/* Create Ride Button */}
        <Button
          as={Link}
          href="/auto-rides/new"
          color="primary"
          size="lg"
          radius="sm"
          className="mt-5 font-bold text-[#241129] bg-primary shadow-md hover:bg-primary/90"
          style={{ fontFamily: "var(--font-display)" }}
          startContent={<PlusCircle size={20} />}
        >
          + Create Ride
        </Button>
      </section>

      {/* Top Navigation Cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <NavCard
          href="/auto-rides/rides"
          title="Rides"
          count={rides.length}
          sub="View &amp; manage bookings"
        />
        <NavCard
          href="/auto-rides/customers"
          title="Customers"
          count={uniqueCustomerPhones}
          sub="Passenger directory"
        />
        <NavCard
          href="/auto-rides/drivers"
          title="Pilots"
          count={drivers.length}
          sub="Pilots, earnings &amp; payouts"
        />
        <NavCard
          href="/auto-rides/diesel-repair"
          title="Diesel &amp; Repair"
          count={dieselEntries.length}
          sub="Fuel &amp; maintenance costs"
        />
        <NavCard
          href="/auto-rides/analytics"
          title="Analytics"
          count={rides.length > 0 ? "Live" : "0"}
          sub="Charts &amp; performance"
        />
      </section>

      {/* Financial Overview Cards (Clickable Filters) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card
          isPressable
          isHoverable
          onPress={() => toggleFilter("amount")}
          className={`bg-content1 p-4 sm:p-5 text-left shadow-md transition-all ${
            filter === "amount" ? "ring-2 ring-secondary" : ""
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">Total Amount</p>
          <p className="text-xl sm:text-2xl text-secondary mt-1 font-bold" style={{ fontFamily: "var(--font-display)" }}>
            ₹{totals.amount.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-foreground/40 mt-1 font-mono">
            {rides.length} trip{rides.length === 1 ? "" : "s"} · tap to view
          </p>
        </Card>

        <Card
          isPressable
          isHoverable
          onPress={() => toggleFilter("dues")}
          className={`bg-content1 p-4 sm:p-5 text-left shadow-md transition-all ${
            filter === "dues" ? "ring-2 ring-warning" : ""
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">Total Dues</p>
          <p className="text-xl sm:text-2xl text-warning mt-1 font-bold" style={{ fontFamily: "var(--font-display)" }}>
            ₹{totals.dues.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-foreground/40 mt-1 font-mono">
            {duesCount} pending · tap to view
          </p>
        </Card>

        <Card
          isPressable
          isHoverable
          onPress={() => toggleFilter("drivers")}
          className={`bg-content1 p-4 sm:p-5 text-left shadow-md transition-all ${
            filter === "drivers" ? "ring-2 ring-primary" : ""
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">Pilot Wages</p>
          <p className="text-xl sm:text-2xl text-secondary mt-1 font-bold" style={{ fontFamily: "var(--font-display)" }}>
            ₹{totals.driverWages.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-foreground/40 mt-1 font-mono">
            Across all rides · tap to view
          </p>
        </Card>

        <Card
          isPressable
          isHoverable
          onPress={() => router.push("/auto-rides/diesel-repair")}
          className="bg-content1 p-4 sm:p-5 text-left shadow-md transition-all"
        >
          <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">Diesel &amp; Repair</p>
          <p className="text-xl sm:text-2xl text-primary mt-1 font-bold" style={{ fontFamily: "var(--font-display)" }}>
            ₹{totals.dieselSpend.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-foreground/40 mt-1 font-mono">
            Auto investments · view all
          </p>
        </Card>

        <Card
          isPressable
          isHoverable
          onPress={() => toggleFilter("profit")}
          className={`bg-content1 p-4 sm:p-5 text-left shadow-md transition-all col-span-2 sm:col-span-1 ${
            filter === "profit" ? "ring-2 ring-success" : ""
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-foreground/50 font-mono">Net Profit</p>
          <p
            className={`text-xl sm:text-2xl mt-1 font-bold ${
              totals.profit >= 0 ? "text-success" : "text-danger"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            ₹{totals.profit.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-foreground/40 mt-1 font-mono">
            Revenue − wages − fuel
          </p>
        </Card>
      </section>

      {/* Rides List Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
              {filter === "amount"
                ? "Highest Fare Rides"
                : filter === "dues"
                  ? "Rides with Pending Dues"
                  : filter === "drivers"
                    ? "Rides by Pilot Wage"
                    : filter === "profit"
                      ? "Most Profitable Rides"
                      : "Recent Auto Rides"}
            </h2>
            <p className="text-xs text-foreground/50 font-mono">
              {displayedRides.length} ride{displayedRides.length === 1 ? "" : "s"} shown
              {filter && " (filtered)"}
            </p>
          </div>
          <Button
            as={Link}
            href="/auto-rides/rides"
            size="sm"
            variant="flat"
            color="primary"
            radius="sm"
            className="text-xs font-bold text-[#241129]"
          >
            View All Rides →
          </Button>
        </div>

        {displayedRides.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-primary/30 text-gray-500 space-y-3">
            <Car size={36} className="mx-auto text-gray-300" />
            <p className="text-sm font-medium">No rides found matching this criteria.</p>
            <Button
              as={Link}
              href="/auto-rides/new"
              color="primary"
              size="sm"
              radius="sm"
              className="font-bold text-[#241129] bg-primary"
            >
              + Create First Ride
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedRides.map((ride) => {
              const fare = parseFloat(ride.totalAmount || "0") || 0;
              const due = parseFloat(ride.dueAmount || "0") || 0;
              const driverWage = parseFloat(ride.driverPay || "0") || 0;

              return (
                <Card
                  key={ride.id}
                  as={Link}
                  href={`/auto-rides/rides/detail?id=${encodeURIComponent(ride.id)}`}
                  isPressable
                  className="p-4 bg-white/95 border border-[#D9A427]/30 shadow-sm hover:shadow-md transition-all text-left block"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-primary font-mono">{ride.id}</span>
                      <h3 className="text-base font-semibold text-[#241129]">{ride.customerName}</h3>
                      <p className="text-xs text-gray-500 font-mono">{ride.customerPhone || "No phone"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={
                          ride.status === "completed"
                            ? "success"
                            : ride.status === "scheduled"
                              ? "primary"
                              : "danger"
                        }
                      >
                        {ride.status}
                      </Chip>
                      <Chip
                        size="sm"
                        variant="dot"
                        color={ride.paymentStatus === "paid" ? "success" : "warning"}
                      >
                        {ride.paymentStatus === "paid" ? "Paid" : "Due"}
                      </Chip>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                    <div className="flex items-center gap-1 truncate max-w-[170px]">
                      <MapPin size={13} className="text-[#3F6B1F] shrink-0" />
                      <span className="truncate">{ride.pickupLocation || "VKM"}</span>
                      <span>→</span>
                      <span className="truncate">{ride.dropLocation || "Drop"}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px] shrink-0">
                      <Calendar size={12} /> {ride.date}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-gray-400 block">Total Fare</span>
                      <span className="text-base font-bold text-[#241129]">₹{fare.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-primary font-bold block">Pilot Wage</span>
                      <span className="text-sm font-bold text-[#241129]">₹{driverWage.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>


      {/* Ride Detail Modal */}
      <RideDetailModal
        ride={selectedRide}
        isOpen={isDetailOpen}
        onOpenChange={onDetailOpenChange}
        isOwner={isOwner}
        drivers={drivers}
        onEdit={(ride) => handleEditRide(ride)}
        onDeleted={() => loadData()}
        onUpdated={() => loadData()}
      />
    </div>
  );
}
