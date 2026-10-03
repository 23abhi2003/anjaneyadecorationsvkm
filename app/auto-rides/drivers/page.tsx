"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Spinner,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import {
  HardHat,
  User,
  Phone,
  DollarSign,
  PlusCircle,
  Calendar,
  Wallet,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  Lock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import type { AutoDriver, AutoRide, AutoDriverPayout, AutoDriverBorrow } from "@/lib/types";
import BackButton from "@/components/BackButton";
import AddDriverModal from "@/components/autorides/AddDriverModal";
import DriverPayoutModal from "@/components/autorides/DriverPayoutModal";
import DriverBorrowModal from "@/components/autorides/DriverBorrowModal";

export default function AutoDriversPage() {
  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.role === "owner";
  const isDriver = user?.role === "driver";

  const [drivers, setDrivers] = useState<AutoDriver[]>([]);
  const [rides, setRides] = useState<AutoRide[]>([]);
  const [payouts, setPayouts] = useState<AutoDriverPayout[]>([]);
  const [borrows, setBorrows] = useState<AutoDriverBorrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const {
    isOpen: isAddDriverOpen,
    onOpen: openAddDriver,
    onOpenChange: onAddDriverOpenChange,
  } = useDisclosure();
  const [editingDriver, setEditingDriver] = useState<AutoDriver | null>(null);

  const {
    isOpen: isPayoutOpen,
    onOpen: openPayout,
    onOpenChange: onPayoutOpenChange,
  } = useDisclosure();
  const [targetDriverName, setTargetDriverName] = useState("");

  const {
    isOpen: isBorrowOpen,
    onOpen: openBorrow,
    onOpenChange: onBorrowOpenChange,
  } = useDisclosure();

  // Ledger details modal
  const [selectedDriver, setSelectedDriver] = useState<AutoDriver | null>(null);
  const {
    isOpen: isLedgerOpen,
    onOpen: openLedger,
    onOpenChange: onLedgerOpenChange,
  } = useDisclosure();

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [driversRes, ridesRes, payoutsRes, borrowsRes] = await Promise.all([
        apiFetch("/api/auto-drivers"),
        apiFetch("/api/auto-rides"),
        apiFetch("/api/auto-payouts"),
        apiFetch("/api/auto-borrows"),
      ]);

      if (!driversRes.ok) throw new Error("Failed to load pilots");

      const [driversData, ridesData, payoutsData, borrowsData] = await Promise.all([
        driversRes.json() as Promise<AutoDriver[]>,
        ridesRes.ok ? (ridesRes.json() as Promise<AutoRide[]>) : Promise.resolve([]),
        payoutsRes.ok ? (payoutsRes.json() as Promise<AutoDriverPayout[]>) : Promise.resolve([]),
        borrowsRes.ok ? (borrowsRes.json() as Promise<AutoDriverBorrow[]>) : Promise.resolve([]),
      ]);

      setDrivers(driversData);
      setRides(ridesData);
      setPayouts(payoutsData);
      setBorrows(borrowsData);
    } catch {
      setError("Could not load pilots data. Check backend connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filter drivers for driver role (driver only sees themselves, owner sees all)
  const visibleDrivers = useMemo(() => {
    if (isOwner) return drivers;
    if (isDriver) {
      const myId = user?.driverId || "";
      const myPhone = user?.phone ? user.phone.replace(/\D/g, "") : "";
      const myName = (user?.name || "").trim().toLowerCase();

      const matched = drivers.filter((d) => {
        if (myId && d.id === myId) return true;
        if (myPhone && d.phone && d.phone.replace(/\D/g, "") === myPhone) return true;
        if (myName && d.name.trim().toLowerCase() === myName) return true;
        return false;
      });

      if (matched.length > 0) return matched;

      if (user) {
        return [
          {
            id: myId || "driver-me",
            name: user.name || "Pilot",
            phone: user.phone || "",
          },
        ];
      }
    }
    return [];
  }, [drivers, isOwner, isDriver, user]);

  // Compute ledger for each driver
  const driverSummaries = useMemo(() => {
    return visibleDrivers.map((d) => {
      const driverNameNorm = d.name.trim().toLowerCase();

      // Assigned rides
      const driverRides = rides.filter((r) => {
        const dAssigned = (r.driverAssigned || "").trim().toLowerCase();
        return (
          dAssigned === driverNameNorm ||
          (user?.name && dAssigned === user.name.trim().toLowerCase())
        );
      });

      // Total wage earned from rides
      const totalWages = driverRides.reduce(
        (sum, r) => sum + (parseFloat(r.driverPay || "0") || 0),
        0
      );

      // Total payouts paid to driver
      const driverPayouts = payouts.filter((p) => {
        const pName = (p.driverName || "").trim().toLowerCase();
        return pName === driverNameNorm || (user?.name && pName === user.name.trim().toLowerCase());
      });
      const totalPayouts = driverPayouts.reduce(
        (sum, p) => sum + (parseFloat(p.amount || "0") || 0),
        0
      );

      // Total borrows taken by driver
      const driverBorrows = borrows.filter((b) => {
        const bName = (b.driverName || "").trim().toLowerCase();
        return bName === driverNameNorm || (user?.name && bName === user.name.trim().toLowerCase());
      });
      const totalBorrows = driverBorrows.reduce(
        (sum, b) => sum + (parseFloat(b.amount || "0") || 0),
        0
      );

      // Remaining Balance = Total Wages - Payouts - Borrows
      const balance = totalWages - totalPayouts - totalBorrows;

      return {
        driver: d,
        rides: driverRides,
        payouts: driverPayouts,
        borrows: driverBorrows,
        totalWages,
        totalPayouts,
        totalBorrows,
        balance,
      };
    });
  }, [visibleDrivers, rides, payouts, borrows, user?.name]);

  function handleRecordPayout(driverName: string) {
    setTargetDriverName(driverName);
    openPayout();
  }

  function handleRecordBorrow(driverName: string) {
    setTargetDriverName(driverName);
    openBorrow();
  }

  function handleViewLedger(driver: AutoDriver) {
    setSelectedDriver(driver);
    openLedger();
  }

  async function handleDeleteDriver(id: string) {
    if (!window.confirm("Are you sure you want to delete this pilot?")) return;
    try {
      const res = await apiFetch(`/api/auto-drivers/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      }
    } catch {
      alert("Failed to delete pilot.");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading pilots..." color="warning" />
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
              {isDriver ? "My Pilot Profile & Earnings" : "Auto Pilots & Wages"}
            </h1>
            <p className="text-xs text-[#F8F4E6]/70 font-mono mt-0.5">
              {isDriver
                ? "Track your trip earnings, payouts received, and khata balance"
                : `${visibleDrivers.length} pilot${visibleDrivers.length === 1 ? "" : "s"} registered · settlements & ledger`}
            </p>
          </div>
        </div>

        {isOwner && (
          <Button
            color="primary"
            radius="sm"
            onPress={() => {
              setEditingDriver(null);
              openAddDriver();
            }}
            className="font-bold text-[#241129] bg-primary shadow-sm hover:bg-primary/90"
            startContent={<PlusCircle size={18} />}
          >
            Add Pilot
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Driver View (Same like Staff View) */}
      {isDriver && driverSummaries.length > 0 ? (
        <div className="space-y-6">
          {/* Driver Profile & Financial Cards */}
          <div className="p-6 bg-content1 rounded-2xl border border-[#D9A427]/35 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D9A427]/25 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/20 text-[#241129] border border-primary/40 flex items-center justify-center font-bold text-2xl font-mono shadow-sm">
                  {driverSummaries[0].driver.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
                      {driverSummaries[0].driver.name}
                    </h2>
                    <Chip size="sm" variant="flat" color="success" className="font-mono text-[10px] font-bold">
                      Active Pilot
                    </Chip>
                  </div>
                  <p className="text-xs text-gray-500 font-mono flex items-center gap-1.5 mt-0.5">
                    <Phone size={13} className="text-primary" /> {driverSummaries[0].driver.phone || "No phone registered"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  as={Link}
                  href="/auto-rides/rides"
                  color="primary"
                  size="sm"
                  radius="sm"
                  className="font-bold text-[#241129] bg-primary shadow-sm"
                >
                  View All Trips
                </Button>
              </div>
            </div>

            {/* Financial Overview Grid (Same as Staff) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-4 rounded-xl bg-white border border-[#D9A427]/30 shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-mono text-gray-400 block">Total Wages Earned</span>
                <span className="text-xl sm:text-2xl font-bold text-[#241129] mt-1 block" style={{ fontFamily: "var(--font-display)" }}>
                  ₹{driverSummaries[0].totalWages.toLocaleString("en-IN")}
                </span>
                <span className="text-[11px] text-gray-500 font-mono mt-0.5 block">
                  {driverSummaries[0].rides.length} trips completed
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#D9A427]/30 shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-mono text-gray-400 block">Settled Payouts</span>
                <span className="text-xl sm:text-2xl font-bold text-success-700 mt-1 block" style={{ fontFamily: "var(--font-display)" }}>
                  ₹{driverSummaries[0].totalPayouts.toLocaleString("en-IN")}
                </span>
                <span className="text-[11px] text-gray-500 font-mono mt-0.5 block">
                  Handed over
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#D9A427]/30 shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-mono text-gray-400 block">Borrows / Khata</span>
                <span className="text-xl sm:text-2xl font-bold text-danger-700 mt-1 block" style={{ fontFamily: "var(--font-display)" }}>
                  ₹{driverSummaries[0].totalBorrows.toLocaleString("en-IN")}
                </span>
                <span className="text-[11px] text-gray-500 font-mono mt-0.5 block">
                  Advance taken
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F4E6] border border-[#D9A427]/40 shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-mono text-gray-500 block">Net Balance Due</span>
                <span className="text-xl sm:text-2xl font-bold text-primary-800 mt-1 block" style={{ fontFamily: "var(--font-display)" }}>
                  ₹{driverSummaries[0].balance.toLocaleString("en-IN")}
                </span>
                <span className="text-[11px] text-[#3F6B1F] font-mono mt-0.5 block font-semibold">
                  Payable to you
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Rides Table / List */}
          <Card className="bg-content1 border border-[#D9A427]/30 shadow-sm rounded-2xl">
            <CardBody className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#D9A427]/20 pb-3">
                <h3 className="text-lg font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
                  My Assigned Trips ({driverSummaries[0].rides.length})
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                  Wage earned per trip
                </span>
              </div>

              {driverSummaries[0].rides.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-mono text-xs">
                  No trips assigned to your profile yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {driverSummaries[0].rides.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-xl bg-white border border-[#D9A427]/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#241129] font-mono text-sm">{r.id}</span>
                          <span className="text-gray-400 font-mono">· {r.date}</span>
                          <Chip size="sm" variant="flat" color={r.status === "completed" ? "success" : "warning"}>
                            {r.status}
                          </Chip>
                        </div>
                        <p className="font-medium text-[#241129]">
                          <span className="text-primary font-semibold">{r.pickupLocation || "Pickup"}</span> &rarr;{" "}
                          <span className="text-danger-700 font-semibold">{r.dropLocation || "Destination"}</span>
                        </p>
                        <p className="text-gray-500 font-mono text-[11px]">
                          Passenger: {r.customerName} {r.customerPhone ? `(${r.customerPhone})` : ""}
                        </p>
                      </div>

                      <div className="text-right sm:border-l sm:border-gray-100 sm:pl-4">
                        <span className="text-[10px] uppercase font-mono text-gray-400 block">Your Wage</span>
                        <span className="text-lg font-bold text-[#241129] block" style={{ fontFamily: "var(--font-display)" }}>
                          ₹{parseFloat(r.driverPay || "0").toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        /* Owner Fleet Grid View */
        <>
          {driverSummaries.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-primary/30 text-gray-500 space-y-3">
              <HardHat size={40} className="mx-auto text-gray-300" />
              <p className="text-base font-medium">No pilots found.</p>
              {isOwner && (
                <Button
                  color="primary"
                  size="sm"
                  radius="sm"
                  onPress={() => {
                    setEditingDriver(null);
                    openAddDriver();
                  }}
                  className="font-bold text-[#241129] bg-primary"
                >
                  + Add First Pilot
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {driverSummaries.map((item) => {
                const { driver, totalWages, totalPayouts, totalBorrows, balance, rides: dRides } = item;
                const cleanPhone = driver.phone?.replace(/\D/g, "");

                return (
                  <Card
                    key={driver.id}
                    className="p-5 bg-white/95 border border-[#D9A427]/30 shadow-sm hover:shadow-md transition-all text-left space-y-4"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 text-[#241129] flex items-center justify-center font-bold text-lg font-mono">
                          {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-[#241129]">{driver.name}</h3>
                          <p className="text-xs text-gray-500 font-mono flex items-center gap-1">
                            <Phone size={11} /> {driver.phone || "No phone"}
                          </p>
                        </div>
                      </div>

                      {isOwner && (
                        <div className="flex items-center gap-1">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            radius="full"
                            aria-label="Edit pilot"
                            onPress={() => {
                              setEditingDriver(driver);
                              openAddDriver();
                            }}
                          >
                            <Edit2 size={15} className="text-gray-500" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            radius="full"
                            aria-label="Delete pilot"
                            onPress={() => handleDeleteDriver(driver.id)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Financial Summary Grid */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#F8F4E6]/80 border border-[#D9A427]/25 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-mono block">Total Earned</span>
                        <span className="text-sm font-bold text-[#241129]">
                          ₹{totalWages.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-gray-400 block font-mono mt-0.5">
                          {dRides.length} trip{dRides.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-mono block">Payouts Paid</span>
                        <span className="text-sm font-bold text-success-700">
                          ₹{totalPayouts.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-gray-400 block font-mono mt-0.5">
                          settled
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[#D9A427]/20">
                        <span className="text-[10px] text-gray-500 uppercase font-mono block">Borrows / Khata</span>
                        <span className="text-sm font-bold text-danger-700">
                          ₹{totalBorrows.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[#D9A427]/20">
                        <span className="text-[10px] text-gray-500 uppercase font-mono block">Balance Due</span>
                        <span
                          className={`text-sm font-bold ${
                            balance > 0 ? "text-primary-800" : "text-gray-600"
                          }`}
                        >
                          ₹{balance.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="bordered"
                        radius="sm"
                        className="flex-1 text-xs font-semibold border-primary/60 text-[#241129]"
                        onPress={() => handleViewLedger(driver)}
                      >
                        View Ledger &amp; Trips
                      </Button>
                      {isOwner && (
                        <>
                          <Button
                            size="sm"
                            color="success"
                            variant="flat"
                            radius="sm"
                            className="text-xs font-medium"
                            onPress={() => handleRecordPayout(driver.name)}
                          >
                            + Payout
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            radius="sm"
                            className="text-xs font-medium"
                            onPress={() => handleRecordBorrow(driver.name)}
                          >
                            + Borrow
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add / Edit Driver Modal */}
      <AddDriverModal
        isOpen={isAddDriverOpen}
        onOpenChange={onAddDriverOpenChange}
        onSuccess={() => loadData()}
        editDriver={editingDriver}
      />

      {/* Driver Payout Modal */}
      <DriverPayoutModal
        isOpen={isPayoutOpen}
        onOpenChange={onPayoutOpenChange}
        onSuccess={() => loadData()}
        defaultDriverName={targetDriverName}
        drivers={drivers}
      />

      {/* Driver Borrow Modal */}
      <DriverBorrowModal
        isOpen={isBorrowOpen}
        onOpenChange={onBorrowOpenChange}
        onSuccess={() => loadData()}
        defaultDriverName={targetDriverName}
        drivers={drivers}
      />

      {/* Detailed Driver Ledger Modal */}
      <Modal
        isOpen={isLedgerOpen}
        onOpenChange={onLedgerOpenChange}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-[#F8F4E6] border border-[#D9A427]/40 text-[#241129]",
          header: "border-b border-[#D9A427]/30 pb-3",
          footer: "border-t border-[#D9A427]/30 pt-3",
        }}
      >
        <ModalContent>
          {(onClose) => {
            const summary = driverSummaries.find((s) => s.driver.id === selectedDriver?.id);
            if (!summary) return null;

            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded bg-primary/20 text-[#241129]">
                      <HardHat size={20} />
                    </span>
                    <span className="text-xl font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
                      {summary.driver.name} · Pilot Ledger
                    </span>
                  </div>
                  <p className="text-xs text-[#241129]/60 font-mono">
                    Phone: {summary.driver.phone || "N/A"} · Balance Due: ₹
                    {summary.balance.toLocaleString("en-IN")}
                  </p>
                </ModalHeader>

                <ModalBody className="py-4 space-y-5">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-white border border-[#D9A427]/30">
                    <div>
                      <span className="text-[10px] text-gray-400 font-mono uppercase block">Total Wages</span>
                      <span className="text-sm font-bold text-[#241129]">
                        ₹{summary.totalWages.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-mono uppercase block">Payouts</span>
                      <span className="text-sm font-bold text-success-700">
                        ₹{summary.totalPayouts.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-mono uppercase block">Borrows</span>
                      <span className="text-sm font-bold text-danger-700">
                        ₹{summary.totalBorrows.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-mono uppercase block">Net Balance</span>
                      <span className="text-sm font-bold text-[#241129]">
                        ₹{summary.balance.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Trips Section */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono mb-2">
                      Assigned Rides ({summary.rides.length})
                    </h4>
                    {summary.rides.length === 0 ? (
                      <p className="text-xs text-gray-500 italic bg-white p-3 rounded-lg border border-gray-100">
                        No rides assigned yet.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {summary.rides.map((r) => (
                          <div
                            key={r.id}
                            className="p-2.5 rounded-lg bg-white border border-[#D9A427]/30 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-[#241129]">{r.id}</span> ·{" "}
                              <span className="text-gray-500 font-mono">{r.date}</span>
                              <p className="text-gray-600 mt-0.5">
                                {r.pickupLocation || "VKM"} → {r.dropLocation || "Drop"} ({r.customerName})
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-[#241129] block">
                                Wage: ₹{parseFloat(r.driverPay || "0").toLocaleString("en-IN")}
                              </span>
                              <Chip size="sm" variant="flat" color={r.status === "completed" ? "success" : "warning"}>
                                {r.status}
                              </Chip>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payouts Section */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-success-800 font-mono mb-2">
                      Payouts Given ({summary.payouts.length})
                    </h4>
                    {summary.payouts.length === 0 ? (
                      <p className="text-xs text-gray-500 italic bg-white p-3 rounded-lg border border-gray-100">
                        No payouts recorded.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {summary.payouts.map((p) => (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-lg bg-white border border-success-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-mono text-gray-500">{p.date}</span> ·{" "}
                              <span className="font-medium text-gray-700">{p.mode || "Cash"}</span>
                              {p.note && <p className="text-gray-500 italic mt-0.5">{p.note}</p>}
                            </div>
                            <span className="text-sm font-bold text-success-700">
                              +₹{parseFloat(p.amount || "0").toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Borrows Section */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-danger-800 font-mono mb-2">
                      Khata / Borrows Taken ({summary.borrows.length})
                    </h4>
                    {summary.borrows.length === 0 ? (
                      <p className="text-xs text-gray-500 italic bg-white p-3 rounded-lg border border-gray-100">
                        No borrows recorded.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {summary.borrows.map((b) => (
                          <div
                            key={b.id}
                            className="p-2.5 rounded-lg bg-white border border-danger-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-mono text-gray-500">{b.date}</span>
                              {b.reason && <p className="text-gray-500 italic mt-0.5">{b.reason}</p>}
                            </div>
                            <span className="text-sm font-bold text-danger-700">
                              -₹{parseFloat(b.amount || "0").toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ModalBody>

                <ModalFooter>
                  <Button variant="light" size="sm" radius="sm" onPress={onClose}>
                    Close
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
