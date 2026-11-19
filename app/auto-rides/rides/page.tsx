"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import AutoRickshawIcon from "@/components/icons/AutoRickshawIcon";
import {
  Button,
  Card,
  Chip,
  Input,
  Select,
  SelectItem,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import { ListCardsSkeleton } from "@/components/Skeletons";
import {
  Car,
  Search,
  PlusCircle,
  Plus,
  Minus,
  Eye,
  Calendar,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  DollarSign,
  ArrowUpDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import { type AutoRide, type AutoDriver, type Customer, getRideCount } from "@/lib/types";
import BackButton from "@/components/BackButton";
import RideDetailModal from "@/components/autorides/RideDetailModal";
import QuickAddRideModal from "@/components/autorides/QuickAddRideModal";

export default function AutoRidesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldOpenCreate = searchParams.get("create") === "true";

  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.role === "owner";
  const isDriver = user?.role === "driver" || user?.role === "staff";

  const [rides, setRides] = useState<AutoRide[]>([]);
  const [drivers, setDrivers] = useState<AutoDriver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Modals
  const [selectedRide, setSelectedRide] = useState<AutoRide | null>(null);
  const {
    isOpen: isDetailOpen,
    onOpen: openDetail,
    onOpenChange: onDetailOpenChange,
  } = useDisclosure();

  // Quick Add / Reduce Ride Modal (+ / - buttons on card)
  const [quickAddBaseRide, setQuickAddBaseRide] = useState<AutoRide | null>(null);
  const [quickAddTargetCount, setQuickAddTargetCount] = useState<number>(2);
  const [quickAddMode, setQuickAddMode] = useState<"add" | "reduce">("add");
  const [pendingRideCounts, setPendingRideCounts] = useState<Record<string, number>>({});
  const {
    isOpen: isQuickAddOpen,
    onOpen: openQuickAdd,
    onOpenChange: onQuickAddOpenChange,
  } = useDisclosure();

  function handleQuickAddRide(ride: AutoRide) {
    const current = pendingRideCounts[ride.id] ?? getRideCount(ride);
    const nextCount = current + 1;
    setPendingRideCounts((prev) => ({ ...prev, [ride.id]: nextCount }));
    setQuickAddBaseRide(ride);
    setQuickAddTargetCount(nextCount);
    setQuickAddMode("add");
    openQuickAdd();
  }

  function handleReduceRide(ride: AutoRide) {
    const current = pendingRideCounts[ride.id] ?? getRideCount(ride);
    if (current <= 1) return;
    const nextCount = current - 1;
    setPendingRideCounts((prev) => ({ ...prev, [ride.id]: nextCount }));
    setQuickAddBaseRide(ride);
    setQuickAddTargetCount(nextCount);
    setQuickAddMode("reduce");
    openQuickAdd();
  }

  function handleQuickAddCancel() {
    if (quickAddBaseRide) {
      setPendingRideCounts((prev) => {
        const next = { ...prev };
        delete next[quickAddBaseRide.id];
        return next;
      });
    }
  }

  function handleQuickAddSuccess() {
    if (quickAddBaseRide) {
      setPendingRideCounts((prev) => {
        const next = { ...prev };
        delete next[quickAddBaseRide.id];
        return next;
      });
    }
    loadRides();
  }

  async function loadRides() {
    setLoading(true);
    setError("");
    try {
      const [ridesRes, driversRes, custRes] = await Promise.all([
        apiFetch("/api/auto-rides"),
        apiFetch("/api/auto-drivers"),
        isOwner ? apiFetch("/api/customers") : Promise.resolve(null),
      ]);

      if (!ridesRes.ok) throw new Error("Could not fetch rides");

      const [ridesData, driversData, custData] = await Promise.all([
        ridesRes.json() as Promise<AutoRide[]>,
        driversRes.ok ? (driversRes.json() as Promise<AutoDriver[]>) : Promise.resolve([]),
        custRes && custRes.ok ? (custRes.json() as Promise<Customer[]>) : Promise.resolve([]),
      ]);

      setRides(ridesData);
      setDrivers(driversData);
      setCustomers(custData);
    } catch {
      setError("Could not load rides directory. Check connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRides();
  }, []);

  useEffect(() => {
    if (shouldOpenCreate && isOwner && !loading) {
      router.replace("/auto-rides/new");
    }
  }, [shouldOpenCreate, isOwner, loading, router]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const filteredRides = useMemo(() => {
    const myName = (user?.name || "").trim().toLowerCase();
    const hasMyTrips = isDriver && myName && rides.some((r) => (r.driverAssigned || "").trim().toLowerCase() === myName);

    return rides.filter((r) => {
      // For pilot/staff role, if they have assigned trips show those
      if (isDriver && hasMyTrips) {
        const assignedName = (r.driverAssigned || "").trim().toLowerCase();
        if (assignedName !== myName) return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          r.customerName?.toLowerCase().includes(q) ||
          r.customerPhone?.includes(q) ||
          r.reason?.toLowerCase().includes(q) ||
          r.pickupLocation?.toLowerCase().includes(q) ||
          r.dropLocation?.toLowerCase().includes(q) ||
          r.driverAssigned?.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Status
      if (statusFilter !== "all") {
        const isFully =
          r.status === "completed" &&
          (r.paymentStatus === "paid" || (parseFloat(r.dueAmount || "0") || 0) <= 0);

        if (statusFilter === "completed" && !isFully) return false;
        if (statusFilter === "pending" && (isFully || r.status === "cancelled")) return false;
        if (statusFilter === "cancelled" && r.status !== "cancelled") return false;
      }

      // Payment
      if (paymentFilter !== "all" && r.paymentStatus !== paymentFilter) return false;

      // Driver
      if (driverFilter !== "all" && r.driverAssigned !== driverFilter) return false;

      // Date
      if (dateFilter === "today" && r.date !== todayStr) return false;
      if (dateFilter === "month") {
        const thisMonth = todayStr.slice(0, 7);
        if (!r.date?.startsWith(thisMonth)) return false;
      }

      return true;
    });
  }, [rides, search, statusFilter, paymentFilter, driverFilter, dateFilter, todayStr, isDriver, user?.name]);

  function handleRideClick(ride: AutoRide) {
    router.push(`/auto-rides/rides/detail?id=${encodeURIComponent(ride.id)}`);
  }

  function handleEditRide(ride: AutoRide) {
    router.push(`/auto-rides/edit?id=${encodeURIComponent(ride.id)}`);
  }

  if (authLoading || loading) {
    return <ListCardsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton href={isDriver ? undefined : "/auto-rides"} />
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-[#D9A427] shadow-sm bg-[#241129] shrink-0">
            <Image src="/vkm-auto-rides-logo.jpg" alt="VKM Auto Rides" fill className="object-cover" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
              {isDriver ? "My Assigned Rides · VKM Auto Rides" : "VKM Auto Rides Directory"}
            </h1>
            <p className="text-xs text-[#F8F4E6]/70 font-mono mt-0.5">
              {filteredRides.length} of {rides.length} rides found
            </p>
          </div>
        </div>

        {(isOwner || isDriver) && (
          <Button
            as={Link}
            href="/auto-rides/new"
            color="primary"
            radius="sm"
            className="font-bold text-[#241129] bg-primary shadow-sm hover:bg-primary/90"
            startContent={<PlusCircle size={18} />}
          >
            Create Ride
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-content1 border border-primary/30 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="sm:col-span-2">
            <Input
              label="Search Passenger or Route"
              value={search}
              onValueChange={setSearch}
              size="sm"
              variant="bordered"
              radius="sm"
              startContent={<Search size={15} className="text-primary" />}
              isClearable
              onClear={() => setSearch("")}
            />
          </div>

          <div>
            <Select
              label="Trip Status"
              variant="bordered"
              radius="sm"
              size="sm"
              selectedKeys={[statusFilter]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                if (val) setStatusFilter(val);
              }}
            >
              <SelectItem key="all" textValue="All Statuses">All Statuses</SelectItem>
              <SelectItem key="completed" textValue="Fully Completed">Fully Completed</SelectItem>
              <SelectItem key="pending" textValue="Pending">Pending</SelectItem>
              <SelectItem key="cancelled" textValue="Cancelled">Cancelled</SelectItem>
            </Select>
          </div>

          {isOwner && (
            <div>
              <Select
                label="Payment Status"
                variant="bordered"
                radius="sm"
                size="sm"
                selectedKeys={[paymentFilter]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  if (val) setPaymentFilter(val);
                }}
              >
                <SelectItem key="all" textValue="All Payments">All Payments</SelectItem>
                <SelectItem key="paid" textValue="Paid in Full">Paid in Full</SelectItem>
                <SelectItem key="due" textValue="Payment Due">Payment Due</SelectItem>
              </Select>
            </div>
          )}

          {isOwner && (
            <div>
              <Select
                label="Pilot"
                variant="bordered"
                radius="sm"
                size="sm"
                selectedKeys={[driverFilter]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  if (val) setDriverFilter(val);
                }}
              >
                {[
                  <SelectItem key="all" textValue="All Pilots">All Pilots</SelectItem>,
                  ...drivers.map((d) => (
                    <SelectItem key={d.name} textValue={d.name}>
                      {d.name}
                    </SelectItem>
                  )),
                ]}
              </Select>
            </div>
          )}

          <div>
            <Select
              label="Date Range"
              variant="bordered"
              radius="sm"
              size="sm"
              selectedKeys={[dateFilter]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                if (val) setDateFilter(val);
              }}
            >
              <SelectItem key="all" textValue="All Dates">All Dates</SelectItem>
              <SelectItem key="today" textValue="Today's Rides">Today's Rides</SelectItem>
              <SelectItem key="month" textValue="This Month">This Month</SelectItem>
            </Select>
          </div>
        </div>
      </div>

      {/* Rides List */}
      {filteredRides.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#D9A427]/30 text-gray-500 space-y-3">
          <AutoRickshawIcon size={44} className="mx-auto text-primary/60" />
          <p className="text-base font-medium">No rides found.</p>
          <p className="text-xs text-gray-400">Try adjusting your search query or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredRides.map((ride) => {
            const fare = parseFloat(ride.totalAmount || "0") || 0;
            const due = parseFloat(ride.dueAmount || "0") || 0;
            const driverWage = parseFloat(ride.driverPay || "0") || 0;
            const baseCount = getRideCount(ride);
            const rideCount = pendingRideCounts[ride.id] ?? baseCount;

            return (
              <Card
                key={ride.id}
                className="p-4 bg-white/95 border border-[#D9A427]/30 shadow-sm hover:shadow-md transition-all text-left block rounded-xl"
              >
                {/* Header: ID, [ - {rideCount} + ] Interactive Counter (Photo 2), Eye Icon, Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-primary font-mono tracking-wide px-1.5 py-0.5 rounded bg-primary/10 border border-primary/25">
                      {ride.id}
                    </span>

                    {/* [ - {rideCount} + ] Interactive Ride Counter (Photo 2 & user request) */}
                    <div className="flex items-center rounded-lg bg-[#5B2674]/10 border border-[#5B2674]/25 p-0.5">
                      <button
                        type="button"
                        title={rideCount > 1 ? "Reduce ride count" : "Minimum 1 ride"}
                        disabled={rideCount <= 1}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleReduceRide(ride);
                        }}
                        className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs transition ${
                          rideCount <= 1
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-[#5B2674] hover:bg-[#5B2674]/20 active:scale-90"
                        }`}
                      >
                        -
                      </button>
                      <span className="px-1.5 font-mono text-[11px] font-bold text-[#5B2674]">
                        {rideCount} {rideCount === 1 ? "Ride" : "Rides"}
                      </span>
                      <button
                        type="button"
                        title={`Add ride to ${ride.id} (increases amount)`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleQuickAddRide(ride);
                        }}
                        className="w-5 h-5 rounded bg-[#D9A427] hover:bg-[#D9A427]/80 text-[#241129] flex items-center justify-center font-bold text-xs shadow-xs transition active:scale-90"
                      >
                        +
                      </button>
                    </div>

                    {/* Eye Icon to view total details of that ride (Photo 2) */}
                    <button
                      type="button"
                      title="View total details of this ride"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedRide(ride);
                        openDetail();
                      }}
                      className="w-6 h-6 rounded-md text-gray-500 hover:text-primary hover:bg-gray-100 flex items-center justify-center transition"
                    >
                      <Eye size={13} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
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
                            className="font-bold text-[11px] capitalize h-5"
                          >
                            Completed
                          </Chip>
                        );
                      }

                      if (ride.status === "cancelled") {
                        return (
                          <Chip
                            size="sm"
                            variant="flat"
                            color="danger"
                            className="font-bold text-[11px] capitalize h-5"
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
                          className="font-bold text-[11px] capitalize h-5"
                        >
                          Pending
                        </Chip>
                      );
                    })()}
                  </div>
                </div>

                {/* Customer Name, Phone & Purpose/Reason (Photo 1 & 2) */}
                <div className="mt-2.5 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/auto-rides/rides/detail?id=${encodeURIComponent(ride.id)}`}
                      className="text-base font-bold text-[#241129] truncate hover:text-[#5B2674] hover:underline"
                    >
                      {ride.customerName}
                    </Link>
                    <span className="font-mono text-xs text-gray-500 shrink-0">
                      {ride.date}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {ride.reason && (
                      <span className="px-2 py-0.5 rounded-full bg-[#F3ECD8] text-[#8B4A15] font-semibold text-[11px] border border-[#D9A427]/30">
                        {ride.reason}
                      </span>
                    )}
                    {ride.customerPhone && (
                      <span className="text-gray-500 font-mono text-[11px]">
                        {ride.customerPhone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Route Location From -> To (Clean address, same as Anjaneya Decorations) */}
                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                    <MapPin size={13} className="text-[#3F6B1F] shrink-0" />
                    {ride.pickupLocation && ride.dropLocation ? (
                      <span className="font-medium text-gray-800 truncate">
                        {ride.pickupLocation} → {ride.dropLocation}
                      </span>
                    ) : ride.pickupLocation ? (
                      <span className="font-medium text-gray-800 truncate">
                        {ride.pickupLocation}
                      </span>
                    ) : ride.dropLocation ? (
                      <span className="font-medium text-gray-800 truncate">
                        {ride.dropLocation}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Location not specified</span>
                    )}
                  </div>
                  {ride.driverAssigned && ride.driverAssigned !== "Unassigned" && (
                    <span className="text-[11px] font-mono text-gray-400 shrink-0">
                      Pilot: {ride.driverAssigned}
                    </span>
                  )}
                </div>

                {/* Amount, Payment Status (Due/Paid) & Quick Add Ride button */}
                <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
                  {isOwner ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold text-[#241129]">
                          ₹{fare.toLocaleString("en-IN")}
                        </span>
                        <Chip
                          size="sm"
                          variant="dot"
                          color={ride.paymentStatus === "paid" || due === 0 ? "success" : "warning"}
                          className="font-mono text-[11px] h-5"
                        >
                          {ride.paymentStatus === "paid" || due === 0 ? "Paid" : `Due: ₹${due}`}
                        </Chip>
                      </div>

                      <div className="flex items-center gap-2">
                        {driverWage > 0 && (
                          <div className="text-right hidden sm:block">
                            <span className="text-[10px] uppercase font-mono text-gray-400 block">Pilot Wage</span>
                            <span className="text-xs font-bold text-[#5B2674]">
                              ₹{driverWage.toLocaleString("en-IN")}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQuickAddRide(ride);
                          }}
                          className="px-2 py-0.5 rounded-md text-[11px] font-bold text-[#241129] bg-[#D9A427] hover:bg-[#D9A427]/80 flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <Plus size={11} strokeWidth={3} />
                          Add Ride
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between bg-primary/15 p-2 rounded-lg">
                      <span className="text-xs font-bold text-[#241129]">Your Pilot Pay:</span>
                      <span className="text-base font-bold text-success">
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

      {/* Floating Action Button for Add Ride */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          as={Link}
          href="/auto-rides/new"
          color="primary"
          radius="full"
          size="md"
          className="font-bold text-[#241129] bg-primary shadow-2xl flex items-center gap-1.5 px-4 h-12 border border-[#241129] hover:scale-105 transition-transform"
          startContent={<Plus size={18} strokeWidth={2.5} />}
        >
          Add Ride
        </Button>
      </div>


      {/* Ride Detail Modal */}
      <RideDetailModal
        ride={selectedRide}
        isOpen={isDetailOpen}
        onOpenChange={onDetailOpenChange}
        isOwner={isOwner}
        drivers={drivers}
        onEdit={(ride) => handleEditRide(ride)}
        onDeleted={() => loadRides()}
        onUpdated={() => loadRides()}
      />

      {/* Quick Add Ride Modal (Triggered by + on customer ride card) */}
      <QuickAddRideModal
        isOpen={isQuickAddOpen}
        onOpenChange={onQuickAddOpenChange}
        baseRide={quickAddBaseRide}
        targetCount={quickAddTargetCount}
        mode={quickAddMode}
        onCancel={handleQuickAddCancel}
        onSuccess={handleQuickAddSuccess}
      />
    </div>
  );
}
