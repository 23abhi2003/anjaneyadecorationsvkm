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
  MessageCircle,
  Tag,
  Save,
  X,
  Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import { loadCustomerDirectory, type ContactDirectoryItem } from "@/lib/customerSuggestions";
import { waLink, cleanLocationForMaps, buildRouteDirectionsUrl } from "@/lib/orderDisplay";
import type { AutoRide, AutoDriver, GeoLocation } from "@/lib/types";

export type StepKey = "details" | "amount" | "payment";

const STEP_TITLES: Record<StepKey, string> = {
  details: "Step 1: Ride Details",
  amount: "Step 2: Amount & Summary",
  payment: "Step 3: Payment & Settlement",
};

const STEP_SUBTITLES: Record<StepKey, string> = {
  details: "Enter passenger name, reason for ride, location (from to to), and date",
  amount: "Review Step 1 details and enter the fare amount for this ride",
  payment: "Total fare, advance received, calculated due, and save booking",
};

export const COMMON_RIDE_REASONS = [
  "Marriage / Function",
  "Hospital / Medical",
  "Goods / Transport",
  "Temple / Pooja",
  "School / College",
  "Personal / Family",
  "Bus Stand / Railway Station",
];

interface RideWizardForm {
  customerName: string;
  customerPhone: string;
  reason: string;
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
  reason: "",
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
    reason: ride.reason || "",
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
    reason?: string;
    pickupLocation?: string;
    dropLocation?: string;
    date: string;
    driverPay?: string;
    totalAmount?: string;
    advancePaid?: string;
    dueAmount?: string;
    notes?: string;
  },
  driverName: string
): string {
  const pickup = cleanLocationForMaps(ride.pickupLocation);
  const drop = cleanLocationForMaps(ride.dropLocation);
  const mapsUrl = buildRouteDirectionsUrl(ride.pickupLocation, ride.dropLocation);

  const lines = [
    `*Anjaneya Auto Rentals — V.K.M*`,
    `Namaskaram ${driverName}, you have an assigned ride booking:`,
    ``,
    `🚖 *Trip ID*: ${ride.id || "New Booking"}`,
    `📅 *Trip Date*: ${ride.date}`,
    `👤 *Passenger*: ${ride.customerName}`,
    ride.customerPhone ? `📞 *Phone*: ${ride.customerPhone}` : "",
    ride.reason ? `🎯 *Purpose/Reason*: ${ride.reason}` : "",
    `🟢 *From (Pickup)*: ${pickup}`,
    `🔴 *To (Drop)*: ${drop}`,
    ride.totalAmount ? `💰 *Fare Total*: ₹${parseFloat(ride.totalAmount).toLocaleString("en-IN")}` : "",
    ride.dueAmount && parseFloat(ride.dueAmount) > 0 ? `⚠️ *Pending Due*: ₹${parseFloat(ride.dueAmount).toLocaleString("en-IN")}` : "",
    ride.driverPay && parseFloat(ride.driverPay) > 0
      ? `💵 *Pilot Pay*: ₹${parseFloat(ride.driverPay).toLocaleString("en-IN")}`
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
  initialCustomerName = "",
  initialCustomerPhone = "",
  initialPickup = "",
}: {
  drivers: AutoDriver[];
  initialRide?: AutoRide;
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  initialPickup?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const isDriver = user?.role === "driver" || user?.role === "staff";
  const isEdit = Boolean(initialRide);

  // 3-step wizard matching Photo 1: Step 1 (Details), Step 2 (Amount & Summary), Step 3 (Payment & Save)
  const steps: StepKey[] = ["details", "amount", "payment"];

  const [form, setForm] = useState<RideWizardForm>(() => {
    if (initialRide) return rideToForm(initialRide);
    return {
      ...emptyForm,
      customerName: initialCustomerName || "",
      customerPhone: initialCustomerPhone || "",
      pickupLocation: initialPickup || "",
      driverAssigned: isDriver && user?.name ? user.name : "Unassigned",
    };
  });

  const [stepIdx, setStepIdx] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [directoryContacts, setDirectoryContacts] = useState<ContactDirectoryItem[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<ContactDirectoryItem[]>([]);

  // Location & Geolocation (Exact same style as Anjaneya Decorations LocationField)
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [pickupCoords, setPickupCoords] = useState<GeoLocation | null>(null);

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

  const step = steps[stepIdx] || "details";
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

  // Exact same geolocation logic as Anjaneya Decorations LocationField
  function useCurrentLocation(): void {
    if (!("geolocation" in navigator)) {
      setLocError("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPickupCoords({ lat, lng });

        // Try to reverse-geocode to friendly name, fallback to GPS
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        )
          .then((res) => res.json())
          .then((data) => {
            const addr = data.address || {};
            const cleanName =
              addr.road || addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || data.display_name?.split(",")[0];
            const area = addr.town || addr.city || addr.county || "Vikarabad";
            updateField("pickupLocation", cleanName ? `${cleanName}, ${area}` : `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          })
          .catch(() => {
            updateField("pickupLocation", `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          })
          .finally(() => {
            setLocating(false);
          });
      },
      () => {
        setLocError("Couldn't get your location. You can type the address instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const pickupMapsLink = pickupCoords
    ? `https://www.google.com/maps?q=${pickupCoords.lat},${pickupCoords.lng}`
    : form.pickupLocation.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.pickupLocation)}`
    : null;

  const routeDirectionsUrl =
    form.pickupLocation || form.dropLocation
      ? buildRouteDirectionsUrl(form.pickupLocation, form.dropLocation)
      : null;

  // Calculation helpers
  const total = parseFloat(form.totalAmount) || 0;
  const advance = parseFloat(form.advancePaid) || 0;
  const due = Math.max(total - advance, 0);
  const pilotWage = parseFloat(form.driverPay) || 0;

  function handleTotalChange(val: string) {
    updateField("totalAmount", val);
    const tot = parseFloat(val) || 0;
    const adv = parseFloat(form.advancePaid) || 0;
    const calcDue = Math.max(tot - adv, 0);
    updateField("paymentStatus", calcDue <= 0 && tot > 0 ? "paid" : "due");
  }

  function handleAdvanceChange(val: string) {
    updateField("advancePaid", val);
    const adv = parseFloat(val) || 0;
    const tot = parseFloat(form.totalAmount) || 0;
    const calcDue = Math.max(tot - adv, 0);
    updateField("paymentStatus", calcDue <= 0 && tot > 0 ? "paid" : "due");
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
    if (currentStepKey === "details") {
      if (!form.customerName.trim()) {
        setError("Please enter the passenger/customer name.");
        return false;
      }
    }
    if (currentStepKey === "amount") {
      if (isOwner && (!form.totalAmount.trim() || Number.isNaN(parseFloat(form.totalAmount)))) {
        setError("Please enter a valid fare amount.");
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

  // Driver WhatsApp resolution
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
            reason: form.reason,
            pickupLocation: form.pickupLocation,
            dropLocation: form.dropLocation,
            date: form.date,
            driverPay: form.driverPay,
            totalAmount: form.totalAmount,
            advancePaid: form.advancePaid,
            dueAmount: String(due),
            notes: form.notes,
          },
          form.driverAssigned
        )
      )
    : null;

  async function handleSave(sendToDriverAfter = false) {
    if (!form.customerName.trim()) {
      setError("Please enter the passenger name.");
      goToStep(0);
      return;
    }
    if (isOwner && (!form.totalAmount.trim() || Number.isNaN(parseFloat(form.totalAmount)))) {
      setError("Please enter a valid total fare amount.");
      goToStep(1);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const assignedPilot = form.driverAssigned.trim() || (isDriver && user?.name ? user.name : "Unassigned");
      const payload: Partial<AutoRide> = {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        reason: form.reason.trim(),
        pickupLocation: form.pickupLocation.trim(),
        dropLocation: form.dropLocation.trim(),
        date: form.date.trim() || new Date().toISOString().slice(0, 10),
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
    <Card className="bg-content1 border border-[#D9A427]/30 shadow-md rounded-2xl">
      <CardBody className="p-5 sm:p-8 md:p-10 space-y-6">
        {/* Progress bar */}
        <div className="space-y-3">
          <Progress
            value={progressPct}
            color="primary"
            size="sm"
            className="w-full"
            aria-label="Ride wizard progress"
          />

          {/* Interactive Steps Bar (Photo 1 & 2: Click to jump or edit any step) */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {steps.map((s, idx) => {
              const isCurrent = stepIdx === idx;
              const isCompleted = stepIdx > idx;

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={`text-left p-2.5 sm:p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? "bg-primary text-[#241129] border-primary shadow-sm font-bold"
                      : isCompleted
                      ? "bg-primary/20 text-[#241129] border-primary/40"
                      : "bg-[#F3ECD8]/50 border-transparent hover:border-primary/30 text-[#241129]/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                        isCurrent
                          ? "bg-[#241129] text-primary"
                          : isCompleted
                          ? "bg-primary text-[#241129]"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </span>
                    <div className="truncate">
                      <span className="text-xs sm:text-sm font-semibold truncate block">
                        {s === "details" && "1. Details"}
                        {s === "amount" && "2. Amount"}
                        {s === "payment" && "3. Payment"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary/25 pb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary font-bold font-mono">
              Step {stepIdx + 1} of {steps.length} · {isEdit ? "Edit Ride" : "Create Ride"}
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold text-[#241129] mt-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {STEP_TITLES[step]}
            </h2>
            <p className="text-xs sm:text-sm text-[#241129]/70 mt-0.5">
              {STEP_SUBTITLES[step]}
            </p>
          </div>

          {/* Direct Save Button available on ALL steps if editing (Photo 2 instruction) */}
          {isEdit && (
            <Button
              color="primary"
              size="sm"
              radius="sm"
              onPress={() => handleSave(false)}
              isLoading={saving}
              startContent={!saving && <Save size={15} />}
              className="font-bold text-[#241129] bg-primary self-start sm:self-auto shadow-sm"
            >
              Save Edits Directly
            </Button>
          )}
        </div>

        {error && (
          <div className="p-3.5 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: NAME, REASON, LOCATION (From -> To), DATE (Photo 1)  */}
        {/* ============================================================== */}
        {step === "details" && (
          <div className="space-y-6 max-w-2xl">
            {/* 1. Name */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#241129] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User size={16} className="text-primary" />
                  Name: *
                </span>
                <span className="text-[11px] font-mono text-gray-400 font-normal">Customer / Passenger</span>
              </label>
              <div className="relative">
                <Input
                  value={form.customerName}
                  onValueChange={handleNameChange}
                  isRequired
                  variant="bordered"
                  radius="sm"
                  size="lg"
                  startContent={<User size={18} className="text-primary" />}
                />

                {nameSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-primary/40 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-100">
                    <div className="px-3.5 py-1.5 bg-[#F8F4E6] text-[11px] font-mono text-primary font-bold flex items-center gap-1.5">
                      <Sparkles size={13} className="text-primary" />
                      Known Customers
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
            </div>

            {/* Optional Customer Phone */}
            <Input
              label="Phone Number (Optional)"
              value={form.customerPhone}
              onValueChange={(v) => updateField("customerPhone", v)}
              variant="bordered"
              radius="sm"
              size="md"
              startContent={<Phone size={16} className="text-primary" />}
            />

            {/* 2. Reason (Photo 1: Purpose of ride) */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#241129] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag size={16} className="text-primary" />
                  Reason / Purpose of Ride:
                </span>
                <span className="text-[11px] font-mono text-gray-400 font-normal">e.g. Marriage, Hospital, Goods</span>
              </label>

              <Input
                value={form.reason}
                onValueChange={(v) => updateField("reason", v)}
                variant="bordered"
                radius="sm"
                size="md"
                startContent={<Tag size={16} className="text-primary" />}
              />

              {/* Quick suggestion chips for Reason */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COMMON_RIDE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => updateField("reason", r)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      form.reason === r
                        ? "bg-primary text-[#241129] font-bold shadow-sm"
                        : "bg-[#F3ECD8] text-[#241129]/80 hover:bg-primary/20 border border-primary/20"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Location: (text) to (text) (EXACT SAME AS ANJANEYA DECORATIONS) */}
            <div className="space-y-3 p-4 rounded-xl bg-[#F8F4E6] border border-primary/30">
              <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-2">
                <Navigation size={16} className="text-primary" />
                Location: From (text) to (text)
              </span>

              {/* From (Pickup Location) - with Use current location button like LocationField */}
              <div className="space-y-1.5">
                <div className="flex gap-2 items-end">
                  <Input
                    label="From (Pickup Location)"
                    variant="bordered"
                    radius="sm"
                    value={form.pickupLocation}
                    onValueChange={(v) => updateField("pickupLocation", v)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="bordered"
                    radius="sm"
                    onPress={useCurrentLocation}
                    isLoading={locating}
                    className="shrink-0 font-medium"
                  >
                    Use current location
                  </Button>
                </div>
                {locError && <p className="text-xs text-danger">{locError}</p>}
                {pickupCoords && (
                  <p className="text-xs text-foreground/60 font-mono">
                    Pinned: {pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}{" "}
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
                {pickupMapsLink && (
                  <a
                    href={pickupMapsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs text-secondary hover:underline font-mono"
                  >
                    Preview Pickup on Google Maps &rarr;
                  </a>
                )}
              </div>

              {/* To (Drop Destination) */}
              <div className="space-y-1.5 pt-1">
                <Input
                  label="To (Drop Location)"
                  variant="bordered"
                  radius="sm"
                  value={form.dropLocation}
                  onValueChange={(v) => updateField("dropLocation", v)}
                />
              </div>

              {/* Google Maps Route directions link */}
              {routeDirectionsUrl && form.pickupLocation && form.dropLocation && (
                <div className="pt-1 flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-500 truncate max-w-[240px]">
                    {form.pickupLocation} → {form.dropLocation}
                  </span>
                  <a
                    href={routeDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary font-bold hover:underline inline-flex items-center gap-1"
                  >
                    Preview Route on Google Maps ↗
                  </a>
                </div>
              )}
            </div>

            {/* 4. Date: (setting) (Photo 1: Defaults to current date) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Date: (setting)"
                value={form.date}
                onValueChange={(v) => updateField("date", v)}
                variant="bordered"
                radius="sm"
                size="md"
                startContent={<Calendar size={18} className="text-primary" />}
              />

              <Select
                label="Assigned Pilot / Driver"
                variant="bordered"
                radius="sm"
                size="md"
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

            {/* Optional Notes */}
            <Textarea
              label="Notes (Optional)"
              value={form.notes}
              onValueChange={(v) => updateField("notes", v)}
              variant="bordered"
              radius="sm"
              size="sm"
              minRows={2}
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: DISPLAY ALL STEP 1 & ASK FOR AMOUNT (Photo 1)          */}
        {/* ============================================================== */}
        {step === "amount" && (
          <div className="space-y-6 max-w-2xl">
            {/* Display all the Step 1 details (Photo 1 instruction) */}
            <div className="p-5 rounded-2xl bg-[#F8F4E6] border border-primary/40 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-primary" />
                  Step 1 Summary Details
                </span>
                {/* Photo 2: Direct Edit option to jump back to Step 1 */}
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={() => goToStep(0)}
                  startContent={<Edit2 size={13} />}
                  className="font-bold text-xs h-7"
                >
                  Edit Step 1
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-sm">
                <div>
                  <span className="text-[11px] uppercase font-mono text-gray-500 block">Name:</span>
                  <span className="font-bold text-[#241129] text-base">{form.customerName || "—"}</span>
                  {form.customerPhone && (
                    <span className="text-xs font-mono text-gray-500 block">{form.customerPhone}</span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] uppercase font-mono text-gray-500 block">Reason:</span>
                  <span className="font-semibold text-primary">{form.reason || "General Ride"}</span>
                </div>

                <div>
                  <span className="text-[11px] uppercase font-mono text-gray-500 block">Location:</span>
                  {form.pickupLocation && form.dropLocation ? (
                    <span className="font-semibold text-gray-800">
                      {form.pickupLocation} → {form.dropLocation}
                    </span>
                  ) : form.pickupLocation ? (
                    <span className="font-semibold text-gray-800">{form.pickupLocation}</span>
                  ) : form.dropLocation ? (
                    <span className="font-semibold text-gray-800">{form.dropLocation}</span>
                  ) : (
                    <span className="text-gray-400 italic">Not entered</span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] uppercase font-mono text-gray-500 block">Date:</span>
                  <span className="font-mono text-xs font-bold text-[#241129]">{form.date}</span>
                  {form.driverAssigned !== "Unassigned" && (
                    <span className="text-xs text-gray-500 block mt-0.5">Pilot: {form.driverAssigned}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Ask for Amount (Photo 1 instruction) */}
            <div className="p-5 rounded-2xl bg-white border border-primary/30 shadow-sm space-y-4">
              <label className="text-base font-bold text-[#241129] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Wallet size={18} className="text-primary" />
                  Amount: (₹) *
                </span>
                <span className="text-xs font-mono text-primary font-bold">Total Fare</span>
              </label>

              <Input
                type="number"
                value={form.totalAmount}
                onValueChange={handleTotalChange}
                isRequired
                variant="bordered"
                radius="sm"
                size="lg"
                startContent={<span className="text-lg text-primary font-bold font-mono">₹</span>}
              />

              {/* Quick Amount presets for fast touch on mobile */}
              <div className="flex flex-wrap gap-2">
                {[50, 100, 150, 200, 300, 400, 500, 800, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleTotalChange(String(amt))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      form.totalAmount === String(amt)
                        ? "bg-primary text-[#241129] shadow-sm"
                        : "bg-[#F3ECD8] text-[#241129] hover:bg-primary/20 border border-primary/20"
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {/* Optional Pilot Wage (Owner only) */}
              {isOwner && (
                <div className="pt-3 border-t border-gray-100">
                  <Input
                    type="number"
                    label="Pilot Wage / Pay (Optional ₹)"
                    value={form.driverPay}
                    onValueChange={(v) => updateField("driverPay", v)}
                    variant="bordered"
                    radius="sm"
                    size="sm"
                    startContent={<span className="text-xs text-primary font-bold font-mono">₹</span>}
                    description="Amount handed to driver for this trip"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: TOTAL, ADV, DUE, STATUS, (SAVE) (CANCEL) (Photo 1)      */}
        {/* ============================================================== */}
        {step === "payment" && (
          <div className="space-y-6 max-w-2xl">
            {/* Step 1 & 2 Summary Card with Edit Buttons (Photo 2) */}
            <div className="p-4 rounded-xl bg-[#F8F4E6] border border-primary/30 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#241129] text-sm">
                  {form.customerName} {form.reason ? `· ${form.reason}` : ""}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {form.pickupLocation || form.dropLocation ? `${form.pickupLocation || ""} ${form.pickupLocation && form.dropLocation ? "→" : ""} ${form.dropLocation || ""}` : "Location not set"} · {form.date}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() => goToStep(0)}
                  startContent={<Edit2 size={12} />}
                  className="font-semibold text-xs h-7"
                >
                  Edit Step 1
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() => goToStep(1)}
                  startContent={<Edit2 size={12} />}
                  className="font-semibold text-xs h-7"
                >
                  Edit Step 2
                </Button>
              </div>
            </div>

            {/* Payment Fields: Total, Adv, Due (Photo 1) */}
            <div className="p-5 rounded-2xl bg-white border border-primary/30 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Total */}
                <div className="space-y-1">
                  <label className="text-xs uppercase font-mono font-bold text-gray-500 block">
                    Total: (₹)
                  </label>
                  <Input
                    type="number"
                    value={form.totalAmount}
                    onValueChange={handleTotalChange}
                    variant="bordered"
                    radius="sm"
                    size="lg"
                    startContent={<span className="text-sm text-primary font-bold font-mono">₹</span>}
                  />
                </div>

                {/* 2. Adv */}
                <div className="space-y-1">
                  <label className="text-xs uppercase font-mono font-bold text-gray-500 block">
                    Adv: (₹)
                  </label>
                  <Input
                    type="number"
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
                      className="text-[11px] text-primary hover:underline font-mono font-semibold"
                    >
                      Fill full (₹{total})
                    </button>
                  )}
                </div>

                {/* 3. Due (Calculated: Total - Adv) */}
                <div className="p-3.5 rounded-xl bg-[#F3ECD8] border border-primary/40 flex flex-col justify-center">
                  <span className="text-[11px] text-[#241129]/60 uppercase font-mono font-bold">
                    Due: (Total - Adv)
                  </span>
                  <span
                    className={`text-2xl font-bold ${due > 0 ? "text-[#8B4A15]" : "text-success"}`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    ₹{due.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Status / Payment Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <Select
                  label="Payment Status (Paid / Due)"
                  variant="bordered"
                  radius="sm"
                  size="md"
                  selectedKeys={[form.paymentStatus]}
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys)[0] as "paid" | "due";
                    if (val) updateField("paymentStatus", val);
                  }}
                >
                  <SelectItem key="paid" textValue="Paid in Full">Paid in Full</SelectItem>
                  <SelectItem key="due" textValue="Payment Due">Payment Due</SelectItem>
                </Select>

                <Select
                  label="Ride Completion Status"
                  variant="bordered"
                  radius="sm"
                  size="md"
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
              </div>
            </div>

            {/* Optional Pilot WhatsApp Share */}
            {driverWhatsAppUrl && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="text-emerald-700" size={18} />
                  <span className="text-xs font-semibold text-emerald-900">
                    Dispatch trip info to Pilot {form.driverAssigned} via WhatsApp
                  </span>
                </div>
                <Button
                  size="sm"
                  color="success"
                  variant="flat"
                  onPress={() => handleSave(true)}
                  isLoading={saving}
                  className="font-bold text-xs"
                >
                  Save &amp; WhatsApp Pilot
                </Button>
              </div>
            )}
          </div>
        )}

        <Divider className="my-4 border-primary/25" />

        {/* ============================================================== */}
        {/* STEPPER NAVIGATION BUTTONS: (SAVE) (CANCEL) (Photo 1)          */}
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
              Back to {stepIdx === 1 ? "Step 1" : "Step 2"}
            </Button>
          ) : (
            <Button
              variant="light"
              radius="sm"
              onPress={() => router.push("/auto-rides/rides")}
              startContent={<X size={16} />}
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
                Next: {stepIdx === 0 ? "Amount (Step 2)" : "Payment & Due (Step 3)"} →
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="light"
                  radius="sm"
                  onPress={() => router.push("/auto-rides/rides")}
                  className="font-semibold text-gray-500"
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  radius="sm"
                  onPress={() => handleSave(false)}
                  isLoading={saving}
                  startContent={!saving && <CheckCircle2 size={18} />}
                  className="font-bold text-[#241129] bg-primary shadow-lg hover:bg-primary/90 px-8 text-base"
                >
                  {isEdit ? "Save Ride Edits" : "Save Ride"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
