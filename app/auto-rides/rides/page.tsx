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
import type { AutoRide, AutoDriver, Customer } from "@/lib/types";
import BackButton from "@/components/BackButton";
import RideDetailModal from "@/components/autorides/RideDetailModal";

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
                  <div className="flex items-center gap-1 truncate max-w-[180px]">
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
                  {/* If Owner: show Total Fare and Driver Wage */}
                  {isOwner ? (
                    <>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-gray-400 block">Total Fare</span>
                        <span className="text-base font-bold text-[#241129]">
                          ₹{fare.toLocaleString("en-IN")}
                        </span>
                        {due > 0 && (
                          <span className="text-[10px] font-mono text-warning-600 block">
                            Due: ₹{due.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-mono text-primary font-bold block">Pilot ({ride.driverAssigned})</span>
                        <span className="text-sm font-bold text-[#241129]">
                          ₹{driverWage.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </>
                  ) : (
                    /* If Driver: ONLY driver and amount appear! (same as staff) */
                    <div className="w-full flex items-center justify-between bg-primary/15 p-2 rounded-lg">
                      <span className="text-xs font-bold text-[#241129]">Your Pilot Pay:</span>
                      <span className="text-lg font-bold text-success">
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
    </div>
  );
}
