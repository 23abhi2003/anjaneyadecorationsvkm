"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Chip,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import {
  Fuel,
  Wrench,
  PlusCircle,
  Calendar,
  Trash2,
  Edit2,
  DollarSign,
  TrendingDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import type { AutoDieselEntry, AutoDriver } from "@/lib/types";
import BackButton from "@/components/BackButton";
import AutoDieselModal from "@/components/autorides/AutoDieselModal";

export default function AutoDieselRepairPage() {
  const { user, loading: authLoading } = useAuth();
  const isOwner = user?.role === "owner";

  const [entries, setEntries] = useState<AutoDieselEntry[]>([]);
  const [drivers, setDrivers] = useState<AutoDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<"all" | "diesel" | "repair">("all");

  const {
    isOpen: isModalOpen,
    onOpen: openModal,
    onOpenChange: onModalOpenChange,
  } = useDisclosure();
  const [editingEntry, setEditingEntry] = useState<AutoDieselEntry | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [dieselRes, driversRes] = await Promise.all([
        apiFetch("/api/auto-diesel"),
        apiFetch("/api/auto-drivers"),
      ]);

      if (!dieselRes.ok) throw new Error("Failed to load diesel & repair expenses");

      const [dieselData, driversData] = await Promise.all([
        dieselRes.json() as Promise<AutoDieselEntry[]>,
        driversRes.ok ? (driversRes.json() as Promise<AutoDriver[]>) : Promise.resolve([]),
      ]);

      setEntries(dieselData);
      setDrivers(driversData);
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
        dieselLitres += parseFloat(e.litres || "0") || 0;
      }
    }

    return {
      dieselAmount,
      dieselLitres,
      repairAmount,
      totalInvestment: dieselAmount + repairAmount,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (filterType === "all") return entries;
    return entries.filter((e) => (e.type || "diesel") === filterType);
  }, [entries, filterType]);

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
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading diesel & repair expenses..." color="warning" />
      </div>
    );
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
              Diesel &amp; Repair Expenses
            </h1>
            <p className="text-xs text-[#F8F4E6]/70 font-mono mt-0.5">
              Auto fleet maintenance and fuel investments ledger
            </p>
          </div>
        </div>

        <Button
          color="primary"
          radius="sm"
          onPress={() => {
            setEditingEntry(null);
            openModal();
          }}
          className="font-bold text-[#241129] bg-primary shadow-sm hover:bg-primary/90"
          startContent={<PlusCircle size={18} />}
        >
          Log Expense
        </Button>
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
            ~{stats.dieselLitres > 0 ? stats.dieselLitres.toFixed(1) : (stats.dieselAmount / 104.32).toFixed(1)} litres (@ ₹104.32/L)
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
            Mechanic &amp; parts maintenance
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
            Deducted from gross profits
          </p>
        </Card>
      </div>

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
          All Expenses ({entries.length})
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
          Diesel Only ({entries.filter((e) => (e.type || "diesel") === "diesel").length})
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
          Repairs Only ({entries.filter((e) => e.type === "repair").length})
        </button>
      </div>

      {/* Expenses Table */}
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
        <div className="bg-white rounded-xl border border-primary/30 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8F4E6] text-xs font-mono uppercase text-[#241129] border-b border-primary/30">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Details / Litres</th>
                  <th className="px-4 py-3">Pilot</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEntries.map((e) => {
                  const isRepair = e.type === "repair";
                  const amt = parseFloat(e.totalAmount || "0") || 0;
                  const litresDisplay = e.litres ? `${e.litres} L` : `~${(amt / 104.32).toFixed(2)} L`;

                  return (
                    <tr key={e.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={isRepair ? "secondary" : "primary"}
                          startContent={isRepair ? <Wrench size={13} /> : <Fuel size={13} />}
                          className="font-bold text-xs"
                        >
                          {isRepair ? "Repair" : "Diesel"}
                        </Chip>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-600">
                        {e.date}
                      </td>
                      <td className="px-4 py-3.5">
                        {isRepair ? (
                          <span className="font-semibold text-[#241129]">
                            {e.repairItem || "Mechanical repair"}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#241129]">
                              {litresDisplay}
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono">
                              (@ ₹104.32/L)
                            </span>
                          </div>
                        )}
                        {e.notes && <p className="text-xs text-gray-400 italic mt-0.5">{e.notes}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">
                        {isRepair ? "—" : e.filledByDriver || "Owner directly"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-base text-[#241129]">
                        ₹{amt.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expense Modal */}
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
