"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  Input,
  Button,
  Progress,
  Chip,
  Select,
  SelectItem,
  Textarea,
  Divider,
} from "@heroui/react";
import {
  User,
  Phone,
  MapPin,
  Calendar,
  Wallet,
  Navigation,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Edit2,
  ExternalLink,
  MessageCircle,
  LocateFixed,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import { loadCustomerDirectory, type ContactDirectoryItem } from "@/lib/customerSuggestions";
import { waLink, cleanLocationForMaps, buildRouteDirectionsUrl } from "@/lib/orderDisplay";
import LocationSearchInput from "@/components/autorides/LocationSearchInput";
import type { AutoRide, AutoDriver } from "@/lib/types";

type StepKey = "passenger" | "route" | "fare" | "review";

const STEP_TITLES: Record<StepKey, string> = {
  passenger: "Passenger Details",
  route: "Route & Pilot Assignment",
  fare: "Fare, Settlement & Pilot Pay",
  review: "Review & Confirm Ride Booking",
};

const STEP_SUBTITLES: Record<StepKey, string> = {
  passenger: "Enter passenger name, contact number, and special instructions",
  route: "Select pickup and destination points with Google Maps, set date, and assign a pilot",
  fare: "Set trip fare, advance collected, pilot wage, and settlement status",
  review: "Verify booking information and dispatch trip assignment directly to the pilot via WhatsApp",
};

interface RideWizardForm {
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  dropLocation: string;
  date: string;
  driverAssigned: string;
  totalAmount: string;
  advancePaid: string;
  driverPay: string;
  status: "completed" | "scheduled" | "cancelled";
  paymentStatus: "paid" | "due";
  notes: string;
}

const emptyForm: RideWizardForm = {
  customerName: "",
  customerPhone: "",
  pickupLocation: "",
  dropLocation: "",
  date: new Date().toISOString().slice(0, 10),
  driverAssigned: "Unassigned",
  totalAmount: "",
  advancePaid: "",
  driverPay: "",
  status: "completed",
  paymentStatus: "paid",
  notes: "",
};

function rideToForm(ride: AutoRide): RideWizardForm {
  return {
    customerName: ride.customerName || "",
    customerPhone: ride.customerPhone || "",
    pickupLocation: ride.pickupLocation || "",
    dropLocation: ride.dropLocation || "",
    date: ride.date || new Date().toISOString().slice(0, 10),
    driverAssigned: ride.driverAssigned || "Unassigned",
    totalAmount: ride.totalAmount || "",
    advancePaid: ride.advancePaid || "",
    driverPay: ride.driverPay || "",
    status: ride.status || "completed",
    paymentStatus: ride.paymentStatus || "paid",
    notes: ride.notes || "",
  };
}

export function buildDriverRideWhatsAppMessage(
  ride: {
    id?: string;
    customerName: string;
    customerPhone?: string;
    pickupLocation?: string;
    dropLocation?: string;
    date: string;
    driverPay?: string;
    totalAmount?: string;
    advancePaid?: string;
    notes?: string;
  },
  driverName: string
): string {
  const pickup = cleanLocationForMaps(ride.pickupLocation);
  const drop = cleanLocationForMaps(ride.dropLocation);
  const mapsUrl = buildRouteDirectionsUrl(ride.pickupLocation, ride.dropLocation);

  const lines = [
    `*Anjaneya Auto Rentals — V.K.M*`,
    `Namaskaram ${driverName}, you have been assigned to this ride booking:`,
    ``,
    `🚖 *Trip ID*: ${ride.id || "New Booking"}`,
    `📅 *Trip Date*: ${ride.date}`,
    `👤 *Passenger*: ${ride.customerName}`,
    ride.customerPhone ? `📞 *Passenger Phone*: ${ride.customerPhone}` : "",
    `🟢 *Pickup Point*: ${pickup}`,
    `🔴 *Drop Destination*: ${drop}`,
    ride.driverPay && parseFloat(ride.driverPay) > 0
      ? `💵 *Pilot Wage / Pay*: ₹${parseFloat(ride.driverPay).toLocaleString("en-IN")}`
      : "",
    ride.notes ? `📝 *Notes*: ${ride.notes}` : "",
    ``,
    `🗺️ *Google Maps Route Directions*:`,
    mapsUrl,
    ``,
    `_Please contact passenger upon departure. Safe driving!_`,
  ].filter(Boolean);

  return lines.join("\n");
}

export default function RideWizard({
  drivers = [],
  initialRide,
}: {
  drivers: AutoDriver[];
  initialRide?: AutoRide;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const isDriver = user?.role === "driver" || user?.role === "staff";
  const isEdit = Boolean(initialRide);

  // Owners get all 4 steps (including fare & driver wage); Pilots skip the fare step completely (same as decoration staff)
  const steps: StepKey[] = useMemo(() => {
    if (isOwner) {
      return ["passenger", "route", "fare", "review"];
    }
    return ["passenger", "route", "review"];
  }, [isOwner]);

  const [form, setForm] = useState<RideWizardForm>(() => {
    if (initialRide) return rideToForm(initialRide);
    return {
      ...emptyForm,
      driverAssigned: isDriver && user?.name ? user.name : "Unassigned",
    };
  });
  const [stepIdx, setStepIdx] = useState<number>(isEdit ? steps.length - 1 : 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [directoryContacts, setDirectoryContacts] = useState<ContactDirectoryItem[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<ContactDirectoryItem[]>([]);

  // Maps & Location
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropCoords, setDropCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    loadCustomerDirectory().then((contacts) => {
      if (isMounted) setDirectoryContacts(contacts);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialRide && isDriver && user?.name && (form.driverAssigned === "Unassigned" || !form.driverAssigned)) {
      updateField("driverAssigned", user.name);
    }
  }, [initialRide, isDriver, user?.name, form.driverAssigned]);

  const step = steps[stepIdx] || "passenger";
  const progressPct = ((stepIdx + 1) / steps.length) * 100;

  function updateField<K extends keyof RideWizardForm>(key: K, value: RideWizardForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(val: string) {
    updateField("customerName", val);
    if (val.trim().length >= 2) {
      const q = val.toLowerCase();
      const matches = directoryContacts.filter(
        (c) => c.fullName.toLowerCase().includes(q) || c.phone.includes(q)
      );
      setNameSuggestions(matches.slice(0, 5));
    } else {
      setNameSuggestions([]);
    }
  }

  function selectContact(c: ContactDirectoryItem) {
    setForm((prev) => ({
      ...prev,
      customerName: c.mainName || c.fullName,
      customerPhone: c.phone || prev.customerPhone,
    }));
    setNameSuggestions([]);
  }

  // Geolocation with reverse geocoding
  function useCurrentLocation(): void {
    if (!("geolocation" in navigator)) {
      setLocError("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPickupCoords({ lat, lng });
        try {
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          if (revRes.ok) {
            const data = await revRes.json();
            const addr = data.address || {};
            const cleanName =
              addr.road || addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || data.display_name?.split(",")[0];
            const area = addr.town || addr.city || addr.county || "Vikarabad";
            updateField("pickupLocation", cleanName ? `${cleanName}, ${area}` : `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          } else {
            updateField("pickupLocation", `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }
        } catch {
          updateField("pickupLocation", `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        setLocating(false);
      },
      () => {
        setLocError("Couldn't get your location. You can type or search the address instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const pickupMapsUrl = pickupCoords
    ? `https://www.google.com/maps?q=${pickupCoords.lat},${pickupCoords.lng}`
    : form.pickupLocation.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.pickupLocation)}`
    : null;

  const dropMapsUrl = form.dropLocation.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.dropLocation)}`
    : null;

  const routeDirectionsUrl =
    form.pickupLocation || form.dropLocation
      ? buildRouteDirectionsUrl(form.pickupLocation, form.dropLocation)
      : null;

  // Driver WhatsApp Resolution
  const assignedDriver = drivers.find((d) => d.name === form.driverAssigned);
  const driverPhone = assignedDriver?.phone || "";
  const driverWhatsAppUrl = driverPhone
    ? waLink(
        driverPhone,
        buildDriverRideWhatsAppMessage(
          {
            id: initialRide?.id,
            customerName: form.customerName,
            customerPhone: form.customerPhone,
            pickupLocation: form.pickupLocation,
            dropLocation: form.dropLocation,
            date: form.date,
            driverPay: form.driverPay,
            totalAmount: form.totalAmount,
            advancePaid: form.advancePaid,
            notes: form.notes,
          },
          form.driverAssigned
        )
      )
    : null;

  const total = parseFloat(form.totalAmount) || 0;
  const advance = parseFloat(form.advancePaid) || 0;
  const due = Math.max(total - advance, 0);
  const pilotWage = parseFloat(form.driverPay) || 0;
  const netProfit = total - pilotWage;

  function handleTotalChange(val: string) {
    updateField("totalAmount", val);
    const tot = parseFloat(val) || 0;
    const adv = parseFloat(form.advancePaid) || 0;
    updateField("paymentStatus", tot > 0 && tot <= adv ? "paid" : "due");
  }

  function handleAdvanceChange(val: string) {
    updateField("advancePaid", val);
    const adv = parseFloat(val) || 0;
    const tot = parseFloat(form.totalAmount) || 0;
    updateField("paymentStatus", tot > 0 && adv >= tot ? "paid" : "due");
  }

  function fillFullAdvance() {
    if (total > 0) {
      updateField("advancePaid", String(total));
      updateField("paymentStatus", "paid");
    }
  }

  function validateStep(idx: number): boolean {
    setError("");
    const currentStepKey = steps[idx];
    if (currentStepKey === "passenger") {
      if (!form.customerName.trim()) {
        setError("Please enter the passenger name to proceed.");
        return false;
      }
    }
    if (currentStepKey === "route") {
      if (!form.pickupLocation.trim() && !form.dropLocation.trim()) {
        setError("Please specify at least a pickup or destination location.");
        return false;
      }
    }
    if (currentStepKey === "fare") {
      if (isOwner && (!form.totalAmount.trim() || Number.isNaN(parseFloat(form.totalAmount)))) {
        setError("Please enter a valid total fare amount.");
        return false;
      }
    }
    return true;
  }

  function next() {
    if (validateStep(stepIdx)) {
      setStepIdx((i) => Math.min(i + 1, steps.length - 1));
    }
  }

  function back() {
    setError("");
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  function goToStep(idx: number) {
    setError("");
    setStepIdx(idx);
  }

  async function handleSave(sendToDriverAfter = false) {
    if (!form.customerName.trim()) {
      setError("Please enter passenger name.");
      goToStep(0);
      return;
    }
    if (isOwner && (!form.totalAmount.trim() || Number.isNaN(parseFloat(form.totalAmount)))) {
      setError("Please enter valid total fare amount.");
      const fareIdx = steps.indexOf("fare");
      if (fareIdx >= 0) goToStep(fareIdx);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const assignedPilot = form.driverAssigned.trim() || (isDriver && user?.name ? user.name : "Unassigned");
      const payload: Partial<AutoRide> = {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        pickupLocation: form.pickupLocation.trim(),
        dropLocation: form.dropLocation.trim(),
        date: form.date.trim(),
        driverAssigned: assignedPilot,
        totalAmount: isOwner ? String(total) : (initialRide?.totalAmount || "0"),
        advancePaid: isOwner ? String(advance) : (initialRide?.advancePaid || "0"),
        dueAmount: isOwner ? String(due) : (initialRide?.dueAmount || "0"),
        driverPay: isOwner ? String(pilotWage) : (initialRide?.driverPay || "0"),
        status: form.status,
        paymentStatus: isOwner ? form.paymentStatus : (initialRide?.paymentStatus || "due"),
        notes: form.notes.trim(),
      };

      const url = isEdit && initialRide ? `/api/auto-rides/${initialRide.id}` : "/api/auto-rides";
      const method = isEdit ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save ride booking");
      }

      const savedRide = (await res.json()) as AutoRide;

      if (sendToDriverAfter && driverPhone) {
        const message = buildDriverRideWhatsAppMessage(savedRide, form.driverAssigned);
        const link = waLink(driverPhone, message);
        if (link) {
          window.open(link, "_blank");
        }
      }

      router.push("/auto-rides/rides");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error. Could not save ride booking.");
      setSaving(false);
    }
  }

  return (
    <Card className="bg-content1 border border-primary/30 shadow-md rounded-2xl">
      <CardBody className="p-6 md:p-10 space-y-6">
        {/* Progress bar */}
        <div className="space-y-3">
          <Progress
            value={progressPct}
            color="primary"
            size="sm"
            className="w-full"
            aria-label="Wizard progress"
          />

          {/* Interactive Steps Bar */}
          <div className={`grid grid-cols-2 ${isOwner ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-2 pt-1`}>
            {steps.map((s, idx) => {
              const isCurrent = stepIdx === idx;
              const isCompleted = stepIdx > idx;

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={`text-left p-2.5 rounded-xl border transition-all ${
                    isCurrent
                      ? "bg-primary text-[#241129] border-primary shadow-sm font-bold"
                      : isCompleted
                      ? "bg-primary/20 text-[#241129] border-primary/40"
                      : "bg-[#F3ECD8]/50 border-transparent hover:border-primary/30 text-[#241129]/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                        isCurrent
                          ? "bg-[#241129] text-primary"
                          : isCompleted
                          ? "bg-primary text-[#241129]"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </span>
                    <span className="text-xs font-semibold truncate">
                      {s === "passenger" && "Passenger"}
                      {s === "route" && "Route & Pilot"}
                      {s === "fare" && "Fare & Pay"}
                      {s === "review" && "Review"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Header */}
        <div className="border-b border-primary/25 pb-4">
          <p
            className="text-xs uppercase tracking-widest text-primary font-bold"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Step {stepIdx + 1} of {steps.length} · Auto Rides
          </p>
          <h2
            className="text-2xl sm:text-3xl font-bold text-[#241129] mt-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {STEP_TITLES[step]}
          </h2>
          <p className="text-sm text-[#241129]/70 mt-0.5">
            {STEP_SUBTITLES[step]}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: PASSENGER DETAILS */}
        {/* ============================================================== */}
        {step === "passenger" && (
          <div className="space-y-6 max-w-2xl">
            <div className="p-4 rounded-xl bg-[#F8F4E6] border border-primary/30 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-2">
                <User size={16} className="text-primary" />
                Passenger Contact Info
              </span>
              <Chip size="sm" variant="flat" color="primary" className="text-[10px] font-mono font-bold">
                Directory Auto-Link
              </Chip>
            </div>

            <div className="relative">
              <Input
                label="Passenger Full Name"
                value={form.customerName}
                onValueChange={handleNameChange}
                isRequired
                variant="bordered"
                radius="sm"
                size="lg"
                startContent={<User size={18} className="text-primary" />}
              />

              {nameSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white border border-primary/40 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-100">
                  <div className="px-3.5 py-1.5 bg-[#F8F4E6] text-[11px] font-mono text-primary font-bold flex items-center gap-1.5">
                    <Sparkles size={13} className="text-primary" />
                    Directory Matches
                  </div>
                  {nameSuggestions.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectContact(c)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-primary/10 flex justify-between items-center transition-colors"
                    >
                      <span className="font-semibold text-[#241129]">{c.mainName || c.fullName}</span>
                      <div className="flex items-center gap-2">
                        {c.phone && (
                          <Chip size="sm" variant="flat" color="primary" className="text-xs font-mono font-semibold">
                            {c.phone}
                          </Chip>
                        )}
                        <span className="text-[11px] text-gray-400 capitalize">{c.source}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Input
              label="Passenger Mobile Phone Number"
              value={form.customerPhone}
              onValueChange={(v) => updateField("customerPhone", v)}
              variant="bordered"
              radius="sm"
              size="lg"
              startContent={<Phone size={18} className="text-primary" />}
            />

            <Textarea
              label="Passenger Notes &amp; Special Requests"
              value={form.notes}
              onValueChange={(v) => updateField("notes", v)}
              variant="bordered"
              radius="sm"
              size="md"
              minRows={3}
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: ROUTE, MAPS & PILOT ASSIGNMENT */}
        {/* ============================================================== */}
        {step === "route" && (
          <div className="space-y-6 max-w-2xl">
            <div className="p-4 rounded-xl bg-[#F8F4E6] border border-primary/30 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-2">
                <Navigation size={16} className="text-primary" />
                Route &amp; Google Maps
              </span>
              <Chip size="sm" variant="flat" color="primary" className="text-[10px] font-mono font-bold">
                V.K.M Area Navigation
              </Chip>
            </div>

            {/* Google Maps Route Preview Bar */}
            {routeDirectionsUrl && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-mono text-[#241129] truncate">
                  <span className="font-bold text-success truncate">{form.pickupLocation || "Pickup"}</span>
                  <ArrowRight size={16} className="text-primary shrink-0" />
                  <span className="font-bold text-danger truncate">{form.dropLocation || "Destination"}</span>
                </div>
                <Button
                  as="a"
                  href={routeDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="primary"
                  variant="solid"
                  size="sm"
                  startContent={<ExternalLink size={14} />}
                  className="font-bold text-[#241129] shrink-0"
                >
                  View Route on Google Maps ↗
                </Button>
              </div>
            )}

            {/* Pickup Location with Live Geocoding Search */}
            <div className="space-y-1">
              <LocationSearchInput
                label="Pickup Location"
                value={form.pickupLocation}
                onChange={(val, coords) => {
                  updateField("pickupLocation", val);
                  if (coords) setPickupCoords(coords);
                }}
                isPickup={true}
                onUseCurrentLocation={useCurrentLocation}
                locating={locating}
              />

              {locError && <p className="text-xs text-danger">{locError}</p>}

              {pickupCoords && (
                <p className="text-xs text-foreground/60 font-mono">
                  📍 Pinned: {pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}{" "}
                  <button
                    type="button"
                    className="text-danger underline ml-1"
                    onClick={() => {
                      setPickupCoords(null);
                      updateField("pickupLocation", "");
                    }}
                  >
                    clear
                  </button>
                </p>
              )}
            </div>

            {/* Drop Location with Live Geocoding Search */}
            <div className="space-y-1">
              <LocationSearchInput
                label="Destination (Drop)"
                value={form.dropLocation}
                onChange={(val, coords) => {
                  updateField("dropLocation", val);
                  if (coords) setDropCoords(coords);
                }}
                isPickup={false}
              />
            </div>


            {/* Date & Driver Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Input
                type="date"
                label="Trip Date"
                value={form.date}
                onValueChange={(v) => updateField("date", v)}
                variant="bordered"
                radius="sm"
                size="lg"
                startContent={<Calendar size={18} className="text-primary" />}
              />

              <Select
                label="Assigned Pilot"
                variant="bordered"
                radius="sm"
                size="lg"
                selectedKeys={[form.driverAssigned]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  if (val) updateField("driverAssigned", val);
                }}
              >
                {[
                  <SelectItem key="Unassigned" textValue="Unassigned">
                    -- Unassigned --
                  </SelectItem>,
                  ...drivers.map((d) => (
                    <SelectItem key={d.name} textValue={`${d.name} (${d.phone})`}>
                      {d.name} {d.phone ? `(${d.phone})` : ""}
                    </SelectItem>
                  )),
                ]}
              </Select>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: FARE, ADVANCE & PILOT SETTLEMENT */}
        {/* ============================================================== */}
        {step === "fare" && (
          <div className="space-y-6 max-w-2xl">
            <div className="p-4 rounded-xl bg-[#F8F4E6] border border-primary/30 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-2">
                <Wallet size={16} className="text-primary" />
                Fare, Advance &amp; Pilot Settlement
              </span>
              <span className="text-xs font-mono font-bold text-primary">Rupees (₹)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                type="number"
                label="Total Fare Amount (₹)"
                value={form.totalAmount}
                onValueChange={handleTotalChange}
                isRequired
                variant="bordered"
                radius="sm"
                size="lg"
                startContent={<span className="text-sm text-primary font-bold font-mono">₹</span>}
              />

              <div>
                <Input
                  type="number"
                  label="Advance Collected (₹)"
                  value={form.advancePaid}
                  onValueChange={handleAdvanceChange}
                  variant="bordered"
                  radius="sm"
                  size="lg"
                  startContent={<span className="text-sm text-success font-bold font-mono">₹</span>}
                />
                {total > 0 && advance < total && (
                  <button
                    type="button"
                    onClick={fillFullAdvance}
                    className="text-xs text-primary hover:underline mt-1.5 font-mono font-semibold block"
                  >
                    Mark fully paid (₹{total})
                  </button>
                )}
              </div>

              {/* Pending Due Display */}
              <div className="p-4 rounded-xl bg-[#F3ECD8] border border-primary/40 flex flex-col justify-center">
                <span className="text-[11px] text-[#241129]/60 uppercase font-mono font-semibold">
                  Pending Due Balance
                </span>
                <span
                  className={`text-xl font-bold ${due > 0 ? "text-[#241129]" : "text-success"}`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {due > 0 ? `₹${due.toLocaleString("en-IN")}` : "Fully Settled"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <Input
                type="number"
                label="Pilot Wage / Pay (₹)"
                value={form.driverPay}
                onValueChange={(v) => updateField("driverPay", v)}
                variant="bordered"
                radius="sm"
                size="lg"
                description="Wage handed to pilot"
                startContent={<span className="text-sm text-primary font-bold font-mono">₹</span>}
              />

              <Select
                label="Trip Status"
                variant="bordered"
                radius="sm"
                size="lg"
                selectedKeys={[form.status]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as "completed" | "scheduled" | "cancelled";
                  if (val) updateField("status", val);
                }}
              >
                <SelectItem key="completed" textValue="Completed">Completed</SelectItem>
                <SelectItem key="scheduled" textValue="Scheduled">Scheduled</SelectItem>
                <SelectItem key="cancelled" textValue="Cancelled">Cancelled</SelectItem>
              </Select>

              <Select
                label="Payment Status"
                variant="bordered"
                radius="sm"
                size="lg"
                selectedKeys={[form.paymentStatus]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as "paid" | "due";
                  if (val) updateField("paymentStatus", val);
                }}
              >
                <SelectItem key="paid" textValue="Paid in Full">Paid in Full</SelectItem>
                <SelectItem key="due" textValue="Payment Due">Payment Due</SelectItem>
              </Select>
            </div>

            {total > 0 && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between font-mono text-sm">
                <span className="text-[#241129]/80">
                  Owner Net Margin (Fare ₹{total} − Pilot ₹{pilotWage}):
                </span>
                <span
                  className={`font-bold text-base ${
                    netProfit >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  ₹{netProfit.toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 4: REVIEW & CONFIRM (WITH SEND TO DRIVER WHATSAPP) */}
        {/* ============================================================== */}
        {step === "review" && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-[#F8F4E6] border border-primary/30 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success" />
                Final Review &amp; Dispatch
              </span>
              <Chip size="sm" variant="flat" color="primary" className="text-[10px] font-mono font-bold uppercase">
                Ready to Record
              </Chip>
            </div>

            <div className={`grid grid-cols-1 ${isOwner ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
              {/* Passenger Card */}
              <div className="p-5 rounded-2xl bg-white border border-primary/30 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase font-mono text-primary flex items-center gap-1.5">
                    <User size={14} />
                    Passenger
                  </span>
                  <Button
                    size="sm"
                    variant="light"
                    color="primary"
                    onPress={() => goToStep(0)}
                    startContent={<Edit2 size={12} />}
                    className="h-7 text-xs font-semibold"
                  >
                    Edit
                  </Button>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-[#241129]">{form.customerName || "—"}</p>
                  <p className="text-xs font-mono text-gray-500">{form.customerPhone || "No phone entered"}</p>
                  {form.notes && (
                    <p className="text-xs text-gray-600 pt-2 border-t border-gray-100 italic">
                      &quot;{form.notes}&quot;
                    </p>
                  )}
                </div>
              </div>

              {/* Route & Pilot Card */}
              <div className="p-5 rounded-2xl bg-white border border-primary/30 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase font-mono text-primary flex items-center gap-1.5">
                    <Navigation size={14} />
                    Route &amp; Pilot
                  </span>
                  <Button
                    size="sm"
                    variant="light"
                    color="primary"
                    onPress={() => goToStep(1)}
                    startContent={<Edit2 size={12} />}
                    className="h-7 text-xs font-semibold"
                  >
                    Edit
                  </Button>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-[11px] text-gray-400 font-mono uppercase block">Pickup</span>
                    <span className="font-semibold text-success">{form.pickupLocation || "VKM"}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 font-mono uppercase block">Destination</span>
                    <span className="font-semibold text-danger">{form.dropLocation || "VKM"}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-500">Date: {form.date}</span>
                    <Chip size="sm" variant="flat" color="primary">
                      Pilot: {form.driverAssigned}
                    </Chip>
                  </div>
                </div>
              </div>

              {/* Financial Settlement Card (Owner only, hidden from pilots same as decoration staff) */}
              {isOwner && (
                <div className="p-5 rounded-2xl bg-white border border-primary/30 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase font-mono text-primary flex items-center gap-1.5">
                      <Wallet size={14} />
                      Settlement
                    </span>
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      onPress={() => {
                        const fareIdx = steps.indexOf("fare");
                        if (fareIdx >= 0) goToStep(fareIdx);
                      }}
                      startContent={<Edit2 size={12} />}
                      className="h-7 text-xs font-semibold"
                    >
                      Edit
                    </Button>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Fare:</span>
                      <span className="font-bold text-[#241129]">₹{total.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Advance Paid:</span>
                      <span className="font-semibold text-success">₹{advance.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pending Due:</span>
                      <span className={`font-bold ${due > 0 ? "text-[#241129]" : "text-success"}`}>
                        ₹{due.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-100">
                      <span className="text-gray-500">Pilot Wage:</span>
                      <span className="font-semibold text-secondary">₹{pilotWage.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-100 text-xs font-mono font-bold">
                      <span>Owner Net Margin:</span>
                      <span className={netProfit >= 0 ? "text-success" : "text-danger"}>
                        ₹{netProfit.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SEND TO PILOT DISPATCH BANNER */}
            <div className="p-5 rounded-2xl bg-[#F8F4E6] border border-primary/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MessageCircle className="text-success" size={20} />
                  <h3 className="font-bold text-base text-[#241129]">
                    Send Trip Details to Pilot via WhatsApp
                  </h3>
                </div>
                <p className="text-xs text-foreground/70">
                  {driverPhone
                    ? `Assigned pilot ${form.driverAssigned} (${driverPhone}) will receive the complete route, Google Maps directions, and passenger details.`
                    : form.driverAssigned !== "Unassigned"
                    ? `No phone number on file for ${form.driverAssigned}. Register phone in Pilots section to send WhatsApp directly.`
                    : "Assign a pilot in Step 2 to enable 1-click WhatsApp dispatch."}
                </p>
              </div>

              {driverWhatsAppUrl ? (
                <Button
                  as="a"
                  href={driverWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="success"
                  variant="solid"
                  size="md"
                  startContent={<MessageCircle size={18} />}
                  className="font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shrink-0"
                >
                  Send to Pilot (WhatsApp)
                </Button>
              ) : (
                <Button
                  isDisabled
                  size="md"
                  variant="flat"
                  className="font-semibold text-gray-400 shrink-0"
                >
                  Pilot WhatsApp Unavailable
                </Button>
              )}
            </div>
          </div>
        )}

        <Divider className="my-6 border-primary/25" />

        {/* ============================================================== */}
        {/* STEPPER NAVIGATION BUTTONS */}
        {/* ============================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {stepIdx > 0 ? (
            <Button
              variant="bordered"
              radius="sm"
              onPress={back}
              startContent={<ArrowLeft size={16} />}
              className="font-semibold"
            >
              Back
            </Button>
          ) : (
            <Button
              variant="light"
              radius="sm"
              onPress={() => router.push("/auto-rides/rides")}
              className="font-semibold text-gray-500"
            >
              Cancel
            </Button>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {stepIdx < steps.length - 1 ? (
              <Button
                color="primary"
                radius="sm"
                onPress={next}
                endContent={<ArrowRight size={16} />}
                className="font-bold text-[#241129] bg-primary shadow-md hover:bg-primary/90 px-6"
              >
                Continue to {steps[stepIdx + 1] === "route" ? "Route & Maps" : steps[stepIdx + 1] === "fare" ? "Fare" : "Review"}
              </Button>
            ) : (
              <>
                {driverWhatsAppUrl && (
                  <Button
                    color="success"
                    radius="sm"
                    onPress={() => handleSave(true)}
                    isLoading={saving}
                    startContent={!saving && <MessageCircle size={18} />}
                    className="font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md px-6 text-sm"
                  >
                    Confirm &amp; Send to Pilot
                  </Button>
                )}
                <Button
                  color="primary"
                  radius="sm"
                  onPress={() => handleSave(false)}
                  isLoading={saving}
                  startContent={!saving && <CheckCircle2 size={18} />}
                  className="font-bold text-[#241129] bg-primary shadow-lg hover:bg-primary/90 px-8 text-base"
                >
                  {isEdit ? "Save Ride Changes" : "Confirm & Book Ride"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
