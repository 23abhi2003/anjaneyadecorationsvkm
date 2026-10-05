"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Chip,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import {
  Users,
  Search,
  Phone,
  MessageCircle,
  Calendar,
  Car,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import type { AutoRide } from "@/lib/types";
import BackButton from "@/components/BackButton";

import { AutoCustomersSkeleton } from "@/components/Skeletons";

interface AggregatedCustomer {
  key: string;
  name: string;
  phone: string;
  totalRides: number;
  totalSpent: number;
  totalDue: number;
  lastRideDate: string;
  rides: AutoRide[];
}

export default function AutoCustomersPage() {
  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.role === "owner";
  const isDriver = user?.role === "driver";

  const [rides, setRides] = useState<AutoRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [selectedCust, setSelectedCust] = useState<AggregatedCustomer | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/auto-rides");
      if (!res.ok) throw new Error("Failed to load rides");
      const data = (await res.json()) as AutoRide[];
      setRides(data);
    } catch {
      setError("Could not load auto customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOwner) {
      loadData();
    }
  }, [isOwner]);

  const customerList = useMemo(() => {
    const map = new Map<string, AggregatedCustomer>();

    for (const r of rides) {
      const key = (r.customerPhone?.trim() || r.customerName?.trim() || "unknown").toLowerCase();
      const fare = parseFloat(r.totalAmount || "0") || 0;
      const adv = parseFloat(r.advancePaid || "0") || 0;
      const due = r.status === "completed" && r.paymentStatus === "paid" ? 0 : Math.max(fare - adv, 0);

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          name: r.customerName || "Customer",
          phone: r.customerPhone || "",
          totalRides: 1,
          totalSpent: fare,
          totalDue: due,
          lastRideDate: r.date || "",
          rides: [r],
        });
      } else {
        existing.totalRides += 1;
        existing.totalSpent += fare;
        existing.totalDue += due;
        existing.rides.push(r);
        if (r.date && (!existing.lastRideDate || r.date > existing.lastRideDate)) {
          existing.lastRideDate = r.date;
        }
      }
    }

    let arr = Array.from(map.values());

    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }

    return arr.sort((a, b) => b.totalRides - a.totalRides);
  }, [rides, search]);

  if (authLoading || loading) {
    return <AutoCustomersSkeleton />;
  }

  if (!isOwner && !isDriver) {
    return (
      <div className="text-center py-24 space-y-3">
        <p className="text-xl font-bold text-[#F8F4E6]">Access Denied</p>
        <p className="text-sm text-[#F8F4E6]/70">You do not have permission to view auto customer contacts.</p>
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
          <BackButton href={isDriver ? undefined : "/auto-rides"} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
              Auto Ride Customers
            </h1>
            <p className="text-xs text-[#F8F4E6]/70 font-mono mt-0.5">
              {customerList.length} passenger{customerList.length === 1 ? "" : "s"} directory
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="max-w-md">
        <Input
          label="Search passenger name or phone"
          value={search}
          onValueChange={setSearch}
          size="sm"
          variant="bordered"
          radius="sm"
          startContent={<Search size={16} className="text-primary" />}
          isClearable
          onClear={() => setSearch("")}
        />
      </div>

      {/* Customer Directory */}
      {customerList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#D9A427]/30 text-gray-500 space-y-2">
          <Users size={36} className="mx-auto text-gray-300" />
          <p className="text-base font-medium">No customers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {customerList.map((cust) => {
            const cleanPhone = cust.phone.replace(/\D/g, "");

            return (
              <Card
                key={cust.key}
                isPressable
                onPress={() => {
                  setSelectedCust(cust);
                  onOpen();
                }}
                className="p-4 bg-white/95 border border-[#D9A427]/30 shadow-sm hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[#241129]">{cust.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{cust.phone || "No phone"}</p>
                  </div>
                  <Chip size="sm" variant="flat" color="warning" className="font-mono text-xs">
                    {cust.totalRides} ride{cust.totalRides === 1 ? "" : "s"}
                  </Chip>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-gray-400 block">Total Spent</span>
                    <span className="text-sm font-bold text-[#241129]">
                      ₹{cust.totalSpent.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-gray-400 block">Due Balance</span>
                    <span
                      className={`text-sm font-bold ${
                        cust.totalDue > 0 ? "text-warning-600" : "text-success-600"
                      }`}
                    >
                      ₹{cust.totalDue.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-mono text-[11px]">
                    Last trip: {cust.lastRideDate || "N/A"}
                  </span>
                  {cleanPhone && (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        as="a"
                        href={`tel:${cleanPhone}`}
                        size="sm"
                        isIconOnly
                        variant="flat"
                        color="primary"
                        radius="full"
                        aria-label="Call passenger"
                        className="w-7 h-7 min-w-7"
                      >
                        <Phone size={13} />
                      </Button>
                      <Button
                        as="a"
                        href={`https://wa.me/91${cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        isIconOnly
                        variant="flat"
                        color="success"
                        radius="full"
                        aria-label="WhatsApp passenger"
                        className="w-7 h-7 min-w-7"
                      >
                        <MessageCircle size={13} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Customer Rides History Modal */}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="lg"
        scrollBehavior="inside"
        classNames={{
          base: "bg-[#F8F4E6] border border-[#D9A427]/40 text-[#241129]",
          header: "border-b border-[#D9A427]/30 pb-3",
          footer: "border-t border-[#D9A427]/30 pt-3",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-xl font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedCust?.name}
                </span>
                <p className="text-xs text-[#241129]/60 font-mono">
                  {selectedCust?.phone} &middot; {selectedCust?.totalRides} trips taken &middot; Total ₹
                  {selectedCust?.totalSpent.toLocaleString("en-IN")}
                </p>
              </ModalHeader>

              <ModalBody className="py-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono">
                  Trip History
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedCust?.rides.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-lg bg-white border border-[#D9A427]/30 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#241129]">{r.id}</span>
                          <span className="text-gray-400 font-mono">{r.date}</span>
                        </div>
                        <p className="text-gray-600 mt-1">
                          {r.pickupLocation || "VKM"} → {r.dropLocation || "Drop"}
                        </p>
                        <p className="text-gray-400 text-[11px]">Pilot: {r.driverAssigned}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-[#241129] block">
                          ₹{parseFloat(r.totalAmount || "0").toLocaleString("en-IN")}
                        </span>
                        <Chip
                          size="sm"
                          variant="dot"
                          color={r.paymentStatus === "paid" ? "success" : "warning"}
                        >
                          {r.paymentStatus === "paid" ? "Paid" : "Due"}
                        </Chip>
                      </div>
                    </div>
                  ))}
                </div>
              </ModalBody>

              <ModalFooter>
                <Button variant="light" size="sm" radius="sm" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
