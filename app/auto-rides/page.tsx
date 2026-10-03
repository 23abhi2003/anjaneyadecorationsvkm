"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, Spinner, useDisclosure } from "@heroui/react";
import { DashboardSkeleton } from "@/components/Skeletons";
import AutoRickshawIcon from "@/components/icons/AutoRickshawIcon";
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
  const isDriver = user?.role === "driver" || user?.role === "staff";

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
    loadData();
  }, []);

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

  const myName = (user?.name || "").trim().toLowerCase();
  const pilotTrips = useMemo(() => {
    if (isOwner) return rides;
    if (isDriver && myName) {
      const my = rides.filter(
        (r) => (r.driverAssigned || "").trim().toLowerCase() === myName
      );
      return my.length > 0 ? my : rides;
    }
    return rides;
  }, [rides, isOwner, isDriver, myName]);

  const pilotStats = useMemo(() => {
    const totalRides = pilotTrips.length;
    const completedRides = pilotTrips.filter((r) => r.status === "completed").length;
    const pendingRides = pilotTrips.filter(
      (r) => r.status !== "completed" && r.status !== "cancelled"
    ).length;
    const totalEarnings = pilotTrips.reduce(
      (sum, r) => sum + (parseFloat(r.driverPay || "0") || 0),
      0
    );
    return { totalRides, completedRides, pendingRides, totalEarnings };
  }, [pilotTrips]);

  // Filtered rides
  const displayedRides = useMemo(() => {
    let result = [...pilotTrips];

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

    if (isOwner) {
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
    }

    return searchQuery ? result : result.slice(0, 6);
  }, [pilotTrips, searchQuery, filter, isOwner]);

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
    return <DashboardSkeleton isAutoRides={true} />;
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

  const duesCount = rides.filter(
    (r) => (parseFloat(r.dueAmount || "0") || 0) > 0 || r.paymentStatus === "due"
  ).length;

  return (
    <div className="space-y-8">
      {/* Brand Header & Quick Actions */}
      <section className="text-center py-6 flex flex-col items-center">
        {/* Logo on top of title - Large & Square */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-2xl overflow-hidden border-3 border-[#D9A427] shadow-2xl bg-[#241129] mb-4 shrink-0">
          <Image
            src="/vkm-auto-rides-logo.jpg"
            alt="VKM Auto Rides Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        <h1
          className="text-2xl sm:text-4xl font-extrabold tracking-widest text-[#D9A427] uppercase"
          style={{ fontFamily: "var(--font-display)" }}
        >
          VKM AUTO RIDES
        </h1>
        <p
          className="text-xs uppercase tracking-widest text-[#3F6B1F] mt-1 font-semibold"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Passenger Transport &amp; Rental Fleet · V.K.M
        </p>

        {/* Global Search Bar */}
        <div className="w-full max-w-xl mx-auto mt-6 px-4">
          <Input
            aria-label="Search by passenger, phone, route, or pilot"
            placeholder="Search passenger, phone, route, or pilot…"
            value={searchQuery}
            onValueChange={setSearchQuery}
            variant="flat"
            radius="full"
            size="lg"
            startContent={<Search className="text-[#8B4A15] shrink-0 ml-1" size={20} />}
            isClearable
            onClear={() => setSearchQuery("")}
            classNames={{
              base: "w-full",
              mainWrapper: "h-12",
              input: "text-sm sm:text-base text-[#241129] placeholder:text-gray-400 pl-1",
              inputWrapper:
                "h-12 bg-white border-2 border-[#D9A427]/70 shadow-lg hover:border-[#D9A427] focus-within:!border-[#D9A427] focus-within:!ring-2 focus-within:!ring-[#D9A427]/30 transition-all",
            }}
          />
        </div>

        {/* Create Ride Button */}
        <Button
          as={Link}
          href="/auto-rides/new"
          color="primary"
          size="lg"
          radius="full"
          className="mt-5 font-bold text-[#241129] bg-primary shadow-md hover:bg-primary/90 px-8"
          style={{ fontFamily: "var(--font-display)" }}
          startContent={<PlusCircle size={20} />}
        >
          Create Ride
        </Button>
      </section>

      {/* Top Navigation Cards (Owner Only) */}
      {isOwner && (
        <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <NavCard
            href="/auto-rides/rides"
            title="Rides"
            count={rides.length}
            sub="View & manage bookings"
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
            sub="Pilots, earnings & payouts"
          />
          <NavCard
            href="/auto-rides/diesel-repair"
            title="Diesel & Repair"
            count={dieselEntries.length}
            sub="Fuel & maintenance costs"
          />
          <NavCard
            href="/auto-rides/analytics"
            title="Analytics"
            count={rides.length > 0 ? "Live" : "0"}
            sub="Charts & performance"
          />
        </section>
      )}

      {/* Overview Cards: Financials for Owner / Trip & Earnings for Pilot */}
      {isOwner ? (
        /* Owner Financial Overview Cards (Clickable Filters) */
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
      ) : (
        /* Pilot Dashboard Overview (No Amount, No Profit: Just Trips Done & His Wage Earned) */
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Card className="bg-content1 p-5 text-left shadow-md border border-[#D9A427]/30">
            <p className="text-xs uppercase tracking-wider text-foreground/60 font-mono font-bold">No. of Rides</p>
            <p className="text-3xl text-[#241129] mt-1.5 font-bold font-mono">
              {pilotStats.totalRides}
            </p>
            <p className="text-xs text-foreground/50 mt-1 font-mono">
              Total auto rides assigned to you
            </p>
          </Card>

          <Card className="bg-content1 p-5 text-left shadow-md border border-[#D9A427]/30">
            <p className="text-xs uppercase tracking-wider text-foreground/60 font-mono font-bold">Rides Completed</p>
            <p className="text-3xl text-success mt-1.5 font-bold font-mono">
              {pilotStats.completedRides}
            </p>
            <p className="text-xs text-foreground/50 mt-1 font-mono">
              Auto rides you successfully completed
            </p>
          </Card>

          <Card className="bg-content1 p-5 text-left shadow-md border border-[#D9A427]/30">
            <p className="text-xs uppercase tracking-wider text-[#8B4A15] font-mono font-bold">Overall Amount Earned</p>
            <p className="text-3xl text-[#8B4A15] mt-1.5 font-bold font-mono">
              ₹{pilotStats.totalEarnings.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-foreground/50 mt-1 font-mono">
              Total pilot wage earned overall
            </p>
          </Card>
        </section>
      )}

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
            <AutoRickshawIcon size={44} className="mx-auto text-primary/60" />
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
                      {(() => {
                        const isFullyCompleted =
                          ride.status === "completed" &&
                          (ride.paymentStatus === "paid" ||
                            (parseFloat(ride.dueAmount || "0") || 0) <= 0);

                        if (isFullyCompleted) {
                          return (
                            <Chip
                              size="sm"
                              variant="flat"
                              color="success"
                              className="font-bold text-xs capitalize"
                            >
                              Fully Completed
                            </Chip>
                          );
                        }

                        if (ride.status === "cancelled") {
                          return (
                            <Chip
                              size="sm"
                              variant="flat"
                              color="danger"
                              className="font-bold text-xs capitalize"
                            >
                              Cancelled
                            </Chip>
                          );
                        }

                        return (
                          <Chip
                            size="sm"
                            variant="flat"
                            color="warning"
                            className="font-bold text-xs capitalize"
                          >
                            Pending
                          </Chip>
                        );
                      })()}
                      {isOwner && (
                        <Chip
                          size="sm"
                          variant="dot"
                          color={ride.paymentStatus === "paid" ? "success" : "warning"}
                          className="font-mono text-[11px]"
                        >
                          {ride.paymentStatus === "paid" ? "Paid" : "Due"}
                        </Chip>
                      )}
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
                    {isOwner ? (
                      <>
                        <div>
                          <span className="text-[10px] uppercase font-mono text-gray-400 block">Total Fare</span>
                          <span className="text-base font-bold text-[#241129]">₹{fare.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-mono text-primary font-bold block">Pilot Wage</span>
                          <span className="text-sm font-bold text-[#241129]">₹{driverWage.toLocaleString("en-IN")}</span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full flex items-center justify-between bg-primary/10 px-3 py-2 rounded-lg">
                        <span className="text-xs font-bold text-[#241129] font-mono">Your Pilot Wage:</span>
                        <span className="text-sm font-bold text-success font-mono">
                          ₹{driverWage.toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
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
