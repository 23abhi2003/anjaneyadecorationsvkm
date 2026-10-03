"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Select,
  SelectItem,
  Chip,
} from "@heroui/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  Car,
  Fuel,
  HardHat,
  TrendingUp,
  Wallet,
  AlertCircle,
  Wrench,
} from "lucide-react";
import type { AutoRide, AutoDieselEntry, AutoDriver } from "@/lib/types";

export type AnalyticsMetric = "rides" | "diesel" | "driver" | "profit" | "all";

interface DateDataPoint {
  date: string;
  displayDate: string;
  ridesRevenue: number;
  ridesCount: number;
  dieselSpend: number;
  dieselLitres: number;
  repairSpend: number;
  driverWages: number;
  netProfit: number;
}

const METRIC_CONFIG: Record<
  AnalyticsMetric,
  {
    label: string;
    description: string;
    primaryColor: string;
    secondaryColor?: string;
  }
> = {
  rides: {
    label: "Rides & Booking Revenue",
    description: "Daily customer fare bookings & completed trips",
    primaryColor: "#D9A427", // Gold
  },
  diesel: {
    label: "Diesel Expense & Litres",
    description: "Fuel investments & auto maintenance costs (auto-calc @ ₹104.32/L)",
    primaryColor: "#E0B73E", // Amber Ochre
  },
  driver: {
    label: "Pilot Wages & Payouts",
    description: "Daily pilot wage earnings handed per trip",
    primaryColor: "#5B2674", // Deep Purple
  },
  profit: {
    label: "Net Operating Profit",
    description: "Daily net margin (Fare Revenue − Pilot Wage − Diesel − Repair)",
    primaryColor: "#3F6B1F", // Leaf Green
  },
  all: {
    label: "All-in-One Comparison",
    description: "Compare Revenue, Pilot Wages, Diesel, and Net Profit together",
    primaryColor: "#D9A427",
  },
};

export default function AutoRidesAnalyticsCard({
  rides,
  dieselEntries,
  drivers = [],
}: {
  rides: AutoRide[];
  dieselEntries: AutoDieselEntry[];
  drivers?: AutoDriver[];
}) {
  const [metric, setMetric] = useState<AnalyticsMetric>("rides");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Aggregated timeline data grouped by date
  const chartData: DateDataPoint[] = useMemo(() => {
    const dateMap = new Map<string, DateDataPoint>();

    function getOrCreate(dateStr: string): DateDataPoint {
      const trimmed = dateStr.trim();
      if (!dateMap.has(trimmed)) {
        // Friendly display format: e.g. "02 Oct" or raw if invalid
        let display = trimmed;
        try {
          const [y, m, d] = trimmed.split("-");
          if (y && m && d) {
            const months = [
              "Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
            ];
            const mIdx = parseInt(m, 10) - 1;
            if (mIdx >= 0 && mIdx < 12) {
              display = `${parseInt(d, 10)} ${months[mIdx]}`;
            }
          }
        } catch {
          display = trimmed;
        }

        dateMap.set(trimmed, {
          date: trimmed,
          displayDate: display,
          ridesRevenue: 0,
          ridesCount: 0,
          dieselSpend: 0,
          dieselLitres: 0,
          repairSpend: 0,
          driverWages: 0,
          netProfit: 0,
        });
      }
      return dateMap.get(trimmed)!;
    }

    // Process Rides
    for (const r of rides) {
      if (!r.date) continue;
      const point = getOrCreate(r.date);
      const fare = parseFloat(r.totalAmount || "0") || 0;
      const wage = parseFloat(r.driverPay || "0") || 0;
      point.ridesRevenue += fare;
      point.ridesCount += 1;
      point.driverWages += wage;
    }

    // Process Diesel & Repair Entries
    for (const d of dieselEntries) {
      if (!d.date) continue;
      const point = getOrCreate(d.date);
      const amt = parseFloat(d.totalAmount || "0") || 0;
      if (d.type === "repair") {
        point.repairSpend += amt;
      } else {
        point.dieselSpend += amt;
        point.dieselLitres += amt / 104.32;
      }
    }

    // Calculate Net Profit for each point
    const sorted = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    for (const p of sorted) {
      p.netProfit = p.ridesRevenue - p.driverWages - p.dieselSpend - p.repairSpend;
      p.dieselLitres = parseFloat(p.dieselLitres.toFixed(1));
    }

    return sorted;
  }, [rides, dieselEntries]);

  // Overall Totals & Calculations (Down like dashboard)
  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalDues = 0;
    let duesCount = 0;
    let totalDriverWages = 0;

    for (const r of rides) {
      const tot = parseFloat(r.totalAmount || "0") || 0;
      const adv = parseFloat(r.advancePaid || "0") || 0;
      const due =
        r.status === "completed" && r.paymentStatus === "paid"
          ? 0
          : Math.max(tot - adv, 0);
      const wage = parseFloat(r.driverPay || "0") || 0;

      totalRevenue += tot;
      totalDues += due;
      if (due > 0 || r.paymentStatus === "due") {
        duesCount += 1;
      }
      totalDriverWages += wage;
    }

    let totalDiesel = 0;
    let totalRepairs = 0;
    for (const d of dieselEntries) {
      const amt = parseFloat(d.totalAmount || "0") || 0;
      if (d.type === "repair") {
        totalRepairs += amt;
      } else {
        totalDiesel += amt;
      }
    }

    const totalLitres = totalDiesel / 104.32;
    const totalOperatingCosts = totalDriverWages + totalDiesel + totalRepairs;
    const netProfit = totalRevenue - totalOperatingCosts;
    const profitMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const avgFare = rides.length > 0 ? totalRevenue / rides.length : 0;
    const avgWage = rides.length > 0 ? totalDriverWages / rides.length : 0;

    return {
      totalRides: rides.length,
      totalRevenue,
      totalDues,
      duesCount,
      totalDriverWages,
      totalDiesel,
      totalLitres,
      totalRepairs,
      totalOperatingCosts,
      netProfit,
      profitMargin,
      avgFare,
      avgWage,
    };
  }, [rides, dieselEntries]);

  const activeConfig = METRIC_CONFIG[metric];

  return (
    <Card className="bg-content1 border border-[#D9A427]/30 shadow-lg rounded-2xl overflow-hidden">
      {/* Header with Title and Dropdown */}
      <CardBody className="p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D9A427]/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/20 text-[#241129] border border-primary/40">
                <BarChart3 size={20} className="text-[#241129]" />
              </span>
              <div>
                <h3
                  className="text-xl sm:text-2xl font-bold text-[#241129]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Auto Fleet Analytics &amp; Trends
                </h3>
                <p className="text-xs text-[#241129]/65 font-mono">
                  {activeConfig.description}
                </p>
              </div>
            </div>
          </div>

          {/* Metric Selector Dropdown */}
          <div className="w-full sm:w-72">
            <Select
              label="Select Analytics Graph"
              selectedKeys={[metric]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as AnalyticsMetric;
                if (val) setMetric(val);
              }}
              variant="bordered"
              radius="sm"
              size="sm"
              classNames={{
                trigger: "bg-white border-[#D9A427]/50 text-[#241129] font-medium shadow-sm",
                label: "text-xs font-semibold text-[#241129]/75",
              }}
            >
              <SelectItem
                key="rides"
                textValue="🚗 Rides & Booking Revenue"
                startContent={<Car size={16} className="text-primary" />}
              >
                🚗 Rides &amp; Booking Revenue
              </SelectItem>
              <SelectItem
                key="diesel"
                textValue="⛽ Diesel Expense & Litres"
                startContent={<Fuel size={16} className="text-warning-600" />}
              >
                ⛽ Diesel Expense &amp; Litres
              </SelectItem>
              <SelectItem
                key="driver"
                textValue="👨‍✈️ Pilot Amount / Wages"
                startContent={<HardHat size={16} className="text-secondary" />}
              >
                👨‍✈️ Pilot Amount / Wages
              </SelectItem>
              <SelectItem
                key="profit"
                textValue="📈 Net Operating Profit"
                startContent={<TrendingUp size={16} className="text-success-600" />}
              >
                📈 Net Operating Profit
              </SelectItem>
              <SelectItem
                key="all"
                textValue="📊 All-in-One Comparison"
                startContent={<BarChart3 size={16} className="text-primary-700" />}
              >
                📊 All-in-One Comparison
              </SelectItem>
            </Select>
          </div>
        </div>

        {/* Interactive Graph Section */}
        <div className="w-full">
          {!mounted ? (
            <div className="h-72 flex items-center justify-center text-xs text-gray-400 font-mono">
              Loading graph visualizations...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center p-6 bg-[#F8F4E6]/50 rounded-xl border border-dashed border-[#D9A427]/30 space-y-2">
              <Car size={36} className="text-gray-300 mx-auto" />
              <p className="text-sm font-semibold text-[#241129]/70">
                No ride or expense activity recorded yet.
              </p>
              <p className="text-xs text-gray-500 font-mono max-w-sm">
                Create new auto rides or log diesel expenses to see historical trend graphs.
              </p>
            </div>
          ) : (
            <div className="w-full h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                >
                  <defs>
                    {/* Rides Gradient */}
                    <linearGradient id="ridesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D9A427" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#D9A427" stopOpacity={0.05} />
                    </linearGradient>

                    {/* Diesel Gradient */}
                    <linearGradient id="dieselFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E0B73E" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#E0B73E" stopOpacity={0.05} />
                    </linearGradient>

                    {/* Driver Wages Gradient */}
                    <linearGradient id="driverFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B2674" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#5B2674" stopOpacity={0.05} />
                    </linearGradient>

                    {/* Profit Gradient */}
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3F6B1F" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#3F6B1F" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(36, 17, 41, 0.08)"
                  />

                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 11, fill: "#241129", opacity: 0.7 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={40}
                  />

                  <YAxis
                    tick={{ fontSize: 11, fill: "#241129", opacity: 0.7 }}
                    tickFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
                    width={70}
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0].payload as DateDataPoint;
                      return (
                        <div className="bg-[#241129] text-[#F8F4E6] p-3 rounded-xl shadow-xl border border-[#D9A427]/40 text-xs space-y-1.5 font-mono">
                          <p className="font-bold text-[#D9A427] border-b border-white/10 pb-1">
                            {pt.displayDate} ({pt.date})
                          </p>

                          {(metric === "rides" || metric === "all") && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-300">Ride Revenue:</span>
                              <span className="font-bold text-[#D9A427]">
                                ₹{pt.ridesRevenue.toLocaleString("en-IN")} ({pt.ridesCount} trips)
                              </span>
                            </div>
                          )}

                          {(metric === "diesel" || metric === "all") && (
                            <>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-300">Diesel Expense:</span>
                                <span className="font-bold text-warning-400">
                                  ₹{pt.dieselSpend.toLocaleString("en-IN")}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-300">Litres:</span>
                                <span className="font-bold text-gray-200">
                                  {pt.dieselLitres} L (@ ₹104.32/L)
                                </span>
                              </div>
                              {pt.repairSpend > 0 && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-300">Repair Costs:</span>
                                  <span className="font-bold text-danger-300">
                                    ₹{pt.repairSpend.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {(metric === "driver" || metric === "all") && (
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-300">Pilot Wages:</span>
                              <span className="font-bold text-purple-300">
                                ₹{pt.driverWages.toLocaleString("en-IN")}
                              </span>
                            </div>
                          )}

                          {(metric === "profit" || metric === "all") && (
                            <div className="flex justify-between gap-4 border-t border-white/10 pt-1">
                              <span className="text-gray-300">Net Profit:</span>
                              <span
                                className={`font-bold ${
                                  pt.netProfit >= 0 ? "text-success-400" : "text-danger-400"
                                }`}
                              >
                                ₹{pt.netProfit.toLocaleString("en-IN")}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />

                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                  />

                  {/* Dynamic Area Rendering based on dropdown selection */}
                  {(metric === "rides" || metric === "all") && (
                    <Area
                      type="monotone"
                      dataKey="ridesRevenue"
                      name="Rides Fare Revenue"
                      stroke="#D9A427"
                      strokeWidth={2.5}
                      fill="url(#ridesFill)"
                    />
                  )}

                  {(metric === "driver" || metric === "all") && (
                    <Area
                      type="monotone"
                      dataKey="driverWages"
                      name="Pilot Wages"
                      stroke="#5B2674"
                      strokeWidth={2.5}
                      fill="url(#driverFill)"
                    />
                  )}

                  {(metric === "diesel" || metric === "all") && (
                    <Area
                      type="monotone"
                      dataKey="dieselSpend"
                      name="Diesel Spend"
                      stroke="#E0B73E"
                      strokeWidth={2.5}
                      fill="url(#dieselFill)"
                    />
                  )}

                  {(metric === "profit" || metric === "all") && (
                    <Area
                      type="monotone"
                      dataKey="netProfit"
                      name="Net Business Profit"
                      stroke="#3F6B1F"
                      strokeWidth={2.5}
                      fill="url(#profitFill)"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Total Calculations Down Like Dashboard */}
        <div className="pt-6 border-t border-[#D9A427]/25 space-y-3">
          <div className="flex items-center justify-between">
            <h4
              className="text-base font-bold text-[#241129] flex items-center gap-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <Wallet size={18} className="text-primary" />
              Total Financial Calculations &amp; Operational Metrics
            </h4>
            <Chip
              size="sm"
              variant="flat"
              color={totals.netProfit >= 0 ? "success" : "danger"}
              className="font-mono text-xs font-bold"
            >
              {totals.netProfit >= 0 ? "Fleet Profitable" : "Operating Deficit"}
            </Chip>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            {/* 1. Total Rides & Fare */}
            <div className="p-3.5 rounded-xl bg-white border border-[#D9A427]/30 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-mono text-gray-500">
                  Total Rides &amp; Fare
                </p>
                <p
                  className="text-lg font-bold text-primary-700 mt-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ₹{totals.totalRevenue.toLocaleString("en-IN")}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-1">
                {totals.totalRides} trips (avg ₹{Math.round(totals.avgFare)})
              </p>
            </div>

            {/* 2. Pilot Wages */}
            <div className="p-3.5 rounded-xl bg-white border border-[#D9A427]/30 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-mono text-gray-500">
                  Pilot Wages
                </p>
                <p
                  className="text-lg font-bold text-[#5B2674] mt-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ₹{totals.totalDriverWages.toLocaleString("en-IN")}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-1">
                Avg ₹{Math.round(totals.avgWage)} / trip
              </p>
            </div>

            {/* 3. Diesel Spend */}
            <div className="p-3.5 rounded-xl bg-white border border-[#D9A427]/30 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-mono text-gray-500">
                  Diesel Expense
                </p>
                <p
                  className="text-lg font-bold text-warning-700 mt-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ₹{totals.totalDiesel.toLocaleString("en-IN")}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-1">
                {totals.totalLitres.toFixed(1)} L (@ ₹104.32/L)
              </p>
            </div>

            {/* 4. Repairs & Parts */}
            <div className="p-3.5 rounded-xl bg-white border border-[#D9A427]/30 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-mono text-gray-500">
                  Repairs &amp; Service
                </p>
                <p
                  className="text-lg font-bold text-danger-700 mt-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ₹{totals.totalRepairs.toLocaleString("en-IN")}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-1">
                Maintenance costs
              </p>
            </div>

            {/* 5. Customer Dues */}
            <div className="p-3.5 rounded-xl bg-white border border-[#D9A427]/30 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-mono text-gray-500">
                  Pending Dues
                </p>
                <p
                  className="text-lg font-bold text-[#8B4A15] mt-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ₹{totals.totalDues.toLocaleString("en-IN")}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-1">
                {totals.duesCount} trip{totals.duesCount === 1 ? "" : "s"} pending
              </p>
            </div>

            {/* 6. Net Profit */}
            <div className="p-3.5 rounded-xl bg-[#F8F4E6] border border-[#D9A427]/40 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-mono text-gray-500">
                  Net Profit
                </p>
                <p
                  className={`text-lg font-bold mt-1 ${
                    totals.netProfit >= 0 ? "text-success-700" : "text-danger-700"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ₹{totals.netProfit.toLocaleString("en-IN")}
                </p>
              </div>
              <p className="text-[11px] text-gray-600 font-mono mt-1">
                Margin: {totals.profitMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
