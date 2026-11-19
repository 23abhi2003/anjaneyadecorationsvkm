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
  Checkbox,
  useDisclosure,
} from "@heroui/react";
import {
  Fuel,
  Wrench,
  PlusCircle,
  Calendar,
  Trash2,
  Edit2,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Link as LinkIcon,
  Search,
  Check,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import type { AutoDieselEntry, AutoDriver, AutoRide } from "@/lib/types";
import BackButton from "@/components/BackButton";
import AutoDieselModal from "@/components/autorides/AutoDieselModal";
import { AutoDieselRepairSkeleton } from "@/components/Skeletons";

export default function AutoDieselRepairPage() {
  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.role === "owner";

  const [entries, setEntries] = useState<AutoDieselEntry[]>([]);
  const [drivers, setDrivers] = useState<AutoDriver[]>([]);
  const [rides, setRides] = useState<AutoRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<"all" | "diesel" | "repair">("all");

  // Quick "Add to repairs" form states (Photo 4)
  const [repairReason, setRepairReason] = useState("");
  const [repairAmount, setRepairAmount] = useState("");
  const [repairDate, setRepairDate] = useState(new Date().toISOString().slice(0, 10));
  const [submittingRepair, setSubmittingRepair] = useState(false);
  const [repairSuccessMsg, setRepairSuccessMsg] = useState("");

  // Edit Expense modal
  const {
    isOpen: isModalOpen,
    onOpen: openModal,
    onOpenChange: onModalOpenChange,
  } = useDisclosure();
  const [editingEntry, setEditingEntry] = useState<AutoDieselEntry | null>(null);

  // Link Rides to Diesel Modal (Photo 3: x, y, z to be added by clicking on checkbox and Add to 1st diesel)
  const {
    isOpen: isLinkModalOpen,
    onOpen: openLinkModal,
    onOpenChange: onLinkModalOpenChange,
  } = useDisclosure();
  const [targetDiesel, setTargetDiesel] = useState<AutoDieselEntry | null>(null);
  const [selectedRideIds, setSelectedRideIds] = useState<string[]>([]);
  const [linkingRides, setLinkingRides] = useState(false);
  const [rideSearch, setRideSearch] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [dieselRes, driversRes, ridesRes] = await Promise.all([
        apiFetch("/api/auto-diesel"),
        apiFetch("/api/auto-drivers"),
        apiFetch("/api/auto-rides"),
      ]);

      if (!dieselRes.ok) throw new Error("Failed to load diesel & repair expenses");

      const [dieselData, driversData, ridesData] = await Promise.all([
        dieselRes.json() as Promise<AutoDieselEntry[]>,
        driversRes.ok ? (driversRes.json() as Promise<AutoDriver[]>) : Promise.resolve([]),
        ridesRes.ok ? (ridesRes.json() as Promise<AutoRide[]>) : Promise.resolve([]),
      ]);

      setEntries(dieselData);
      setDrivers(driversData);
      setRides(ridesData);
    } catch {
      setError("Could not load vehicle expenses. Is the backend reachable?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOwner) {
      loadData();
    }
  }, [isOwner]);

  // Aggregate totals
  const stats = useMemo(() => {
    let dieselAmount = 0;
    let dieselLitres = 0;
    let repairAmount = 0;

    for (const e of entries) {
      const amt = parseFloat(e.totalAmount || "0") || 0;
      if (e.type === "repair") {
        repairAmount += amt;
      } else {
        dieselAmount += amt;
      }
    }

    dieselLitres = dieselAmount / 104.32;

    return {
      dieselAmount,
      dieselLitres,
      repairAmount,
      totalInvestment: dieselAmount + repairAmount,
    };
  }, [entries]);

  // Map of rides by ID for fast lookup
  const ridesMap = useMemo(() => {
    const map = new Map<string, AutoRide>();
    for (const r of rides) {
      map.set(r.id, r);
    }
    return map;
  }, [rides]);

  // Chronological diesel entries (for 1st diesel, 2nd diesel labelling)
  const dieselEntriesChronological = useMemo(() => {
    return entries
      .filter((e) => (e.type || "diesel") === "diesel")
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));
  }, [entries]);

  // Map diesel ID to sequential label e.g. "1st Diesel", "2nd Diesel", "3rd Diesel"
  const dieselLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    dieselEntriesChronological.forEach((entry, idx) => {
      const num = idx + 1;
      let suffix = "th";
      if (num % 10 === 1 && num % 100 !== 11) suffix = "st";
      else if (num % 10 === 2 && num % 100 !== 12) suffix = "nd";
      else if (num % 10 === 3 && num % 100 !== 13) suffix = "rd";
      map.set(entry.id, `${num}${suffix} Diesel`);
    });
    return map;
  }, [dieselEntriesChronological]);

  const filteredEntries = useMemo(() => {
    if (filterType === "all") return entries;
    return entries.filter((e) => (e.type || "diesel") === filterType);
  }, [entries, filterType]);

  // Fast direct "Add to repairs" (Photo 4)
  async function handleAddRepair(e: React.FormEvent) {
    e.preventDefault();
    if (!repairReason.trim()) {
      alert("Please enter the repair reason (e.g. puncture, engine oil, brakes).");
      return;
    }
    const amt = parseFloat(repairAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      alert("Please enter a valid repair amount.");
      return;
    }

    setSubmittingRepair(true);
    setRepairSuccessMsg("");
    try {
      const res = await apiFetch("/api/auto-diesel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "repair",
          reason: repairReason.trim(),
          repairItem: repairReason.trim(),
          totalAmount: String(amt),
          date: repairDate.trim() || new Date().toISOString().slice(0, 10),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to add repair record");
      }

      const created = (await res.json()) as AutoDieselEntry;
      setEntries((prev) => [created, ...prev]);
      setRepairReason("");
      setRepairAmount("");
      setRepairSuccessMsg(`Repair added: ₹${amt.toLocaleString("en-IN")}`);
      setTimeout(() => setRepairSuccessMsg(""), 3500);
    } catch {
      alert("Could not save repair entry. Check connection.");
    } finally {
      setSubmittingRepair(false);
    }
  }

  // Open modal to link rides to a specific diesel fill (Photo 3)
  function handleOpenLinkRides(entry: AutoDieselEntry) {
    setTargetDiesel(entry);
    setSelectedRideIds(entry.rideIds || []);
    setRideSearch("");
    openLinkModal();
  }

  // Save selected rides to diesel entry
  async function handleSaveLinkedRides() {
    if (!targetDiesel) return;
    setLinkingRides(true);
    try {
      const res = await apiFetch(`/api/auto-diesel/${targetDiesel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideIds: selectedRideIds,
        }),
      });

      if (!res.ok) throw new Error("Failed to update linked rides");

      const updated = (await res.json()) as AutoDieselEntry;
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      onLinkModalOpenChange();
    } catch {
      alert("Failed to save rides to diesel entry.");
    } finally {
      setLinkingRides(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this expense record?")) return;
    try {
      const res = await apiFetch(`/api/auto-diesel/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      alert("Failed to delete expense.");
    }
  }

  if (authLoading || loading) {
    return <AutoDieselRepairSkeleton />;
  }

  if (!isOwner) {
    return (
      <div className="text-center py-24 space-y-3">
        <p className="text-xl font-bold text-[#F8F4E6]">Owner Access Only</p>
        <p className="text-sm text-[#F8F4E6]/70">Only the owner can view and manage auto investments &amp; fuel expenses.</p>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F8F4E6]" style={{ fontFamily: "var(--font-display)" }}>
              Diesel &amp; Repair Investments
            </h1>
            <p className="text-xs text-[#F8F4E6]/70 font-mono mt-0.5">
              Auto fleet maintenance, fuel cycles &amp; linked ride earnings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            color="primary"
            radius="sm"
            onPress={() => {
              setEditingEntry(null);
              openModal();
            }}
            className="font-bold text-[#241129] bg-primary shadow-sm hover:bg-primary/90"
            startContent={<Fuel size={18} />}
          >
            + Log Diesel Fill
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white/95 border border-primary/30 shadow-sm text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-gray-500">Diesel / Fuel Spent</span>
            <Fuel size={20} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary mt-2" style={{ fontFamily: "var(--font-display)" }}>
            ₹{stats.dieselAmount.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-gray-500 font-mono mt-1">
            ~{stats.dieselLitres.toFixed(1)} litres (@ ₹104.32/L)
          </p>
        </Card>

        <Card className="p-5 bg-white/95 border border-primary/30 shadow-sm text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-gray-500">Repairs &amp; Service</span>
            <Wrench size={20} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-[#241129] mt-2" style={{ fontFamily: "var(--font-display)" }}>
            ₹{stats.repairAmount.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Total vehicle maintenance costs
          </p>
        </Card>

        <Card className="p-5 bg-white/95 border border-primary/30 shadow-sm text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-gray-500">Total Auto Investment</span>
            <TrendingDown size={20} className="text-danger" />
          </div>
          <p className="text-2xl font-bold text-danger mt-2" style={{ fontFamily: "var(--font-display)" }}>
            ₹{stats.totalInvestment.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Investments deducted in monthly analytics
          </p>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* PHOTO 4: REPAIRS SECTION & FORM                                */}
      {/* "The repairs done for auto have to be calculated:              */}
      {/* Reason: ( ), Amount: ( ), [Add to repairs]"                    */}
      {/* ============================================================== */}
      <Card className="p-4 sm:p-5 bg-white/95 border border-[#D9A427]/40 shadow-sm rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-[#8B4A15]" />
            <h3 className="font-bold text-[#241129] text-base" style={{ fontFamily: "var(--font-display)" }}>
              Auto Repairs Calculator
            </h3>
            <span className="text-xs text-gray-400 font-mono">· Direct Entry</span>
          </div>
          {repairSuccessMsg && (
            <Chip size="sm" variant="flat" color="success" className="font-semibold text-xs">
              ✓ {repairSuccessMsg}
            </Chip>
          )}
        </div>

        <form onSubmit={handleAddRepair} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Input
            label="Reason:"
            value={repairReason}
            onValueChange={setRepairReason}
            variant="bordered"
            radius="sm"
            size="sm"
            isRequired
          />
          <Input
            type="number"
            label="Amount (₹):"
            value={repairAmount}
            onValueChange={setRepairAmount}
            variant="bordered"
            radius="sm"
            size="sm"
            isRequired
            startContent={<span className="text-xs font-bold font-mono text-primary">₹</span>}
          />
          <Input
            type="date"
            label="Date:"
            value={repairDate}
            onValueChange={setRepairDate}
            variant="bordered"
            radius="sm"
            size="sm"
          />
          <Button
            type="submit"
            color="primary"
            radius="sm"
            isLoading={submittingRepair}
            className="font-bold text-[#241129] bg-primary h-10 shadow-sm hover:bg-primary/90"
            startContent={!submittingRepair && <PlusCircle size={16} />}
          >
            Add to repairs
          </Button>
        </form>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-primary/30 pb-2">
        <button
          type="button"
          onClick={() => setFilterType("all")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            filterType === "all"
              ? "bg-primary text-[#241129] shadow-sm"
              : "text-[#F8F4E6]/75 hover:text-[#D9A427] hover:bg-[#F8F4E6]/5"
          }`}
        >
          All Investments ({entries.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType("diesel")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            filterType === "diesel"
              ? "bg-primary text-[#241129] shadow-sm"
              : "text-[#F8F4E6]/75 hover:text-[#D9A427] hover:bg-[#F8F4E6]/5"
          }`}
        >
          Diesel Fills &amp; Rides ({entries.filter((e) => (e.type || "diesel") === "diesel").length})
        </button>
        <button
          type="button"
          onClick={() => setFilterType("repair")}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            filterType === "repair"
              ? "bg-primary text-[#241129] shadow-sm"
              : "text-[#F8F4E6]/75 hover:text-[#D9A427] hover:bg-[#F8F4E6]/5"
          }`}
        >
          Repairs Ledger ({entries.filter((e) => e.type === "repair").length})
        </button>
      </div>

      {/* ============================================================== */}
      {/* PHOTO 3: DIESEL FILLS WITH LINKED RIDES (1st Diesel, 2nd...)   */}
      {/* ============================================================== */}
      {filteredEntries.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#D9A427]/30 text-gray-500 space-y-3">
          <Fuel size={40} className="mx-auto text-gray-300" />
          <p className="text-base font-medium">No expenses logged yet.</p>
          <Button
            color="primary"
            size="sm"
            radius="sm"
            onPress={() => {
              setEditingEntry(null);
              openModal();
            }}
            className="font-bold text-[#241129] bg-primary"
          >
            + Log First Expense
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((e) => {
            const isRepair = e.type === "repair";
            const amt = parseFloat(e.totalAmount || "0") || 0;
            const litresDisplay = e.litres ? `${e.litres} L` : `~${(amt / 104.32).toFixed(2)} L`;
            const dieselLabel = !isRepair ? dieselLabelsMap.get(e.id) || "Diesel Fill" : "Repair";

            // Linked rides info (Photo 3: Rides done -> x, y, z)
            const linkedRides = (e.rideIds || [])
              .map((id) => ridesMap.get(id))
              .filter((r): r is AutoRide => Boolean(r));

            const totalLinkedFare = linkedRides.reduce(
              (sum, r) => sum + (parseFloat(r.totalAmount || "0") || 0),
              0
            );
            const netFuelMargin = totalLinkedFare - amt;

            return (
              <Card
                key={e.id}
                className="p-5 bg-white/95 border border-[#D9A427]/30 shadow-sm rounded-xl space-y-3.5"
              >
                {/* Top Row: Type/Label, Date, Amount, Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={isRepair ? "secondary" : "primary"}
                      startContent={isRepair ? <Wrench size={13} /> : <Fuel size={13} />}
                      className="font-bold text-xs"
                    >
                      {dieselLabel}
                    </Chip>
                    <span className="font-mono text-xs text-gray-500 flex items-center gap-1">
                      <Calendar size={13} /> {e.date}
                    </span>
                    {!isRepair && e.filledByDriver && (
                      <span className="text-xs text-gray-500 font-mono">
                        · Pilot: {e.filledByDriver}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="font-bold text-lg text-[#241129]">
                      ₹{amt.toLocaleString("en-IN")}
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        radius="full"
                        aria-label="Edit expense"
                        onPress={() => {
                          setEditingEntry(e);
                          openModal();
                        }}
                      >
                        <Edit2 size={14} className="text-gray-500" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        radius="full"
                        aria-label="Delete expense"
                        onPress={() => handleDelete(e.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Details description */}
                <div className="text-sm">
                  {isRepair ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase text-gray-400">Repair Reason:</span>
                      <span className="font-semibold text-[#241129]">
                        {e.reason || e.repairItem || "General service / repair"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                      <span>
                        <strong className="text-[#241129]">{litresDisplay}</strong> (@ ₹104.32/L)
                      </span>
                      {e.notes && <span className="italic text-gray-400">({e.notes})</span>}
                    </div>
                  )}
                </div>

                {/* Photo 3: For Diesel Fills -> Rides Done: x, y, z linked by clicking checkbox */}
                {!isRepair && (
                  <div className="p-3.5 rounded-xl bg-[#F8F4E6] border border-[#D9A427]/30 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <LinkIcon size={14} className="text-primary" />
                        <span className="text-xs font-bold uppercase font-mono text-[#241129]">
                          Rides Done on this {dieselLabel} ({linkedRides.length}):
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {totalLinkedFare > 0 && (
                          <span className="text-xs font-mono font-semibold text-gray-700">
                            Earned: <strong className="text-success">₹{totalLinkedFare.toLocaleString("en-IN")}</strong>
                            {" · "}
                            Margin: <strong className={netFuelMargin >= 0 ? "text-success" : "text-danger"}>
                              {netFuelMargin >= 0 ? "+" : ""}₹{netFuelMargin.toLocaleString("en-IN")}
                            </strong>
                          </span>
                        )}

                        <Button
                          size="sm"
                          color="primary"
                          variant="solid"
                          radius="sm"
                          onPress={() => handleOpenLinkRides(e)}
                          className="font-bold text-xs h-7 text-[#241129] bg-primary"
                        >
                          {linkedRides.length > 0 ? "Edit Linked Rides" : `+ Add Rides to ${dieselLabel}`}
                        </Button>
                      </div>
                    </div>

                    {linkedRides.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">
                        No rides linked to this diesel fill yet. Click &quot;Add Rides to {dieselLabel}&quot; to select trips completed on this fuel.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {linkedRides.map((r) => (
                          <div
                            key={r.id}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#D9A427]/30 text-xs shadow-xs flex items-center gap-2"
                          >
                            <span className="font-bold font-mono text-primary text-[11px]">{r.id}</span>
                            <span className="font-semibold text-[#241129]">{r.customerName}</span>
                            {r.reason && (
                              <span className="text-[10px] text-gray-500">({r.reason})</span>
                            )}
                            <span className="font-bold font-mono text-success text-[11px]">
                              ₹{parseFloat(r.totalAmount || "0").toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* PHOTO 3: MODAL TO SELECT RIDES VIA CHECKBOX (x, y, z)          */}
      {/* ============================================================== */}
      <Modal
        isOpen={isLinkModalOpen}
        onOpenChange={onLinkModalOpenChange}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => {
            const targetLabel = targetDiesel ? dieselLabelsMap.get(targetDiesel.id) || "Diesel Fill" : "Diesel";

            const filteredRidesList = rides.filter((r) => {
              if (!rideSearch.trim()) return true;
              const q = rideSearch.toLowerCase();
              return (
                r.customerName?.toLowerCase().includes(q) ||
                r.id.toLowerCase().includes(q) ||
                r.reason?.toLowerCase().includes(q) ||
                r.date?.includes(q)
              );
            });

            return (
              <>
                <ModalHeader className="flex flex-col gap-1 text-[#241129]">
                  <span className="text-xs font-mono uppercase text-primary font-bold">
                    Photo 3 · Link Rides to Fuel Cycle
                  </span>
                  <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    Add Rides to {targetLabel} (₹{targetDiesel?.totalAmount})
                  </h3>
                  <p className="text-xs text-gray-500 font-normal">
                    Select customer rides completed on this fuel fill using the checkboxes.
                  </p>
                </ModalHeader>

                <ModalBody className="space-y-3">
                  <Input
                    value={rideSearch}
                    onValueChange={setRideSearch}
                    size="sm"
                    variant="bordered"
                    radius="sm"
                    startContent={<Search size={14} className="text-primary" />}
                    isClearable
                    onClear={() => setRideSearch("")}
                  />

                  <div className="flex items-center justify-between text-xs font-mono px-1">
                    <span className="text-gray-500">
                      {selectedRideIds.length} ride{selectedRideIds.length === 1 ? "" : "s"} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedRideIds.length === filteredRidesList.length) {
                          setSelectedRideIds([]);
                        } else {
                          setSelectedRideIds(filteredRidesList.map((r) => r.id));
                        }
                      }}
                      className="text-primary font-bold hover:underline"
                    >
                      {selectedRideIds.length === filteredRidesList.length ? "Deselect All" : "Select All Visible"}
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {filteredRidesList.length === 0 ? (
                      <p className="p-6 text-center text-xs text-gray-400">No rides found.</p>
                    ) : (
                      filteredRidesList.map((ride) => {
                        const isChecked = selectedRideIds.includes(ride.id);
                        const fare = parseFloat(ride.totalAmount || "0") || 0;

                        return (
                          <label
                            key={ride.id}
                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-primary/5 transition-colors ${
                              isChecked ? "bg-primary/10" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                isSelected={isChecked}
                                onValueChange={(checked) => {
                                  if (checked) {
                                    setSelectedRideIds((prev) => [...prev, ride.id]);
                                  } else {
                                    setSelectedRideIds((prev) => prev.filter((id) => id !== ride.id));
                                  }
                                }}
                                color="primary"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs font-mono text-primary">{ride.id}</span>
                                  <span className="font-bold text-sm text-[#241129]">{ride.customerName}</span>
                                  {ride.reason && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#F3ECD8] text-[#8B4A15] font-semibold">
                                      {ride.reason}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">
                                  {ride.pickupLocation || "VKM"} → {ride.dropLocation || "Drop"} · {ride.date}
                                </p>
                              </div>
                            </div>

                            <span className="font-bold text-sm text-[#241129] font-mono shrink-0">
                              ₹{fare.toLocaleString("en-IN")}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </ModalBody>

                <ModalFooter>
                  <Button variant="light" radius="sm" onPress={onClose} className="font-semibold text-gray-500">
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    radius="sm"
                    onPress={handleSaveLinkedRides}
                    isLoading={linkingRides}
                    className="font-bold text-[#241129] bg-primary shadow-sm hover:bg-primary/90"
                    startContent={!linkingRides && <Check size={16} />}
                  >
                    Add to {targetLabel} ({selectedRideIds.length} Rides)
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      {/* Edit / New Diesel Modal */}
      <AutoDieselModal
        isOpen={isModalOpen}
        onOpenChange={onModalOpenChange}
        onSuccess={() => loadData()}
        drivers={drivers}
        editEntry={editingEntry}
      />
    </div>
  );
}
