"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardBody,
  Divider,
  Button,
  Chip,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import Image from "next/image";
import {
  Car,
  MapPin,
  Phone,
  MessageCircle,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  User,
  HardHat,
  Wallet,
  Check,
  Save,
} from "lucide-react";
import type { AutoRide, AutoDriver } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/Auth";
import { waLink, cleanLocationForMaps, buildRouteDirectionsUrl } from "@/lib/orderDisplay";
import { buildDriverRideWhatsAppMessage } from "@/components/autorides/RideWizard";
import BackButton from "@/components/BackButton";

interface RideDetailClientProps {
  ride: AutoRide;
  drivers?: AutoDriver[];
  onUpdated?: (updated: AutoRide) => void;
}

export default function RideDetailClient({
  ride: initialRide,
  drivers = [],
  onUpdated,
}: RideDetailClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [ride, setRide] = useState<AutoRide>(initialRide);
  const [rideCompletion, setRideCompletion] = useState<"scheduled" | "completed">(
    initialRide.status === "completed" ? "completed" : "scheduled"
  );
  const [paymentCompletion, setPaymentCompletion] = useState<"due" | "paid">(
    initialRide.paymentStatus === "paid" ? "paid" : "due"
  );
  const [notes, setNotes] = useState(initialRide.notes || "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [deleting, setDeleting] = useState(false);

  const total = parseFloat(ride.totalAmount || "0") || 0;
  const advance = parseFloat(ride.advancePaid || "0") || 0;
  const due = paymentCompletion === "paid" ? 0 : Math.max(total - advance, 0);
  const driverPay = parseFloat(ride.driverPay || "0") || 0;
  const netProfit = total - driverPay;

  const cleanPhone = (ride.customerPhone || "").replace(/\D/g, "");
  const mapsUrl = buildRouteDirectionsUrl(ride.pickupLocation, ride.dropLocation);

  const waCustomerMessage = encodeURIComponent(
    `Namaskaram ${ride.customerName},\nThank you for choosing VKM Auto Rides V.K.M!\n\n🛺 *Ride Details*:\nTrip ID: ${ride.id}\nPickup: ${ride.pickupLocation || "VKM"}\nDrop: ${ride.dropLocation || "VKM"}\nDate: ${ride.date}${
      isOwner ? `\nTotal Fare: ₹${total}\nAdvance: ₹${advance}\nPending Due: ₹${due}` : ""
    }\n\nFor any help, call: 9704452180.`
  );

  // Pilot WhatsApp
  const assignedDriver = drivers.find(
    (d) => d.name.trim().toLowerCase() === (ride.driverAssigned || "").trim().toLowerCase()
  );
  const driverPhone = assignedDriver?.phone || "";
  const driverWhatsAppUrl = driverPhone
    ? waLink(driverPhone, buildDriverRideWhatsAppMessage(ride, ride.driverAssigned || "Pilot"))
    : null;

  async function handleSaveStatus(): Promise<void> {
    setSaving(true);
    try {
      const payload: Partial<AutoRide> = {
        status: rideCompletion,
        notes: notes.trim(),
        ...(isOwner
          ? {
              paymentStatus: paymentCompletion,
              advancePaid: paymentCompletion === "paid" ? String(total) : String(advance),
              dueAmount: paymentCompletion === "paid" ? "0" : String(due),
            }
          : {}),
      };

      const res = await apiFetch(`/api/auto-rides/${ride.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = (await res.json()) as AutoRide;
        setRide(updated);
        setSavedAt(new Date());
        onUpdated?.(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(): Promise<void> {
    setPaymentCompletion("paid");
    setSaving(true);
    try {
      const res = await apiFetch(`/api/auto-rides/${ride.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: "paid",
          advancePaid: String(total),
          dueAmount: "0",
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as AutoRide;
        setRide(updated);
        setSavedAt(new Date());
        onUpdated?.(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm(`Are you sure you want to delete ride ${ride.id} for ${ride.customerName}? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/auto-rides/${ride.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/auto-rides/rides");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Back Button */}
      <div className="no-print">
        <BackButton href="/auto-rides/rides" label="Back to Rides" />
      </div>

      {/* Main Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-[#D9A427] shadow-md bg-[#241129] shrink-0">
              <Image
                src="/vkm-auto-rides-logo.jpg"
                alt="VKM Auto Rides"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-xs uppercase tracking-[0.25em] text-[#D9A427] font-bold"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {ride.id}
                </span>

                {/* Fully Completed or Pending Badge */}
                {rideCompletion === "completed" && paymentCompletion === "paid" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-sm border border-emerald-400/40">
                    <Check size={13} strokeWidth={3} />
                    Fully Completed
                  </span>
                ) : ride.status === "cancelled" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-600 text-white shadow-sm border border-red-400/40">
                    Cancelled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500 text-[#241129] shadow-sm border border-amber-300/40">
                    <span className="w-2 h-2 rounded-full bg-[#241129] animate-pulse" />
                    Pending
                  </span>
                )}

                {/* Payment Status Badge (Owner only) */}
                {isOwner && (
                  paymentCompletion === "paid" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Paid in Full
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider bg-amber-950/90 text-amber-300 border border-amber-500/60 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Payment Due: ₹{due.toLocaleString("en-IN")}
                    </span>
                  )
                )}
              </div>
              <h1
                className="text-3xl font-bold text-[#F8F4E6] mt-1.5"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {ride.customerName}
              </h1>
            </div>
          </div>
          <p className="text-[#F8F4E6]/70 text-sm mt-1.5 flex items-center gap-2 font-mono">
            <span>📅 {ride.date}</span>
            <span>·</span>
            <span>📍 {ride.pickupLocation || "VKM"} → {ride.dropLocation || "VKM"}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <Button
            as={Link}
            href={`/auto-rides/edit?id=${encodeURIComponent(ride.id)}`}
            color="primary"
            variant="flat"
            radius="sm"
            className="font-semibold"
            startContent={<Edit2 size={15} />}
          >
            Edit Ride
          </Button>

          {cleanPhone && (
            <Button
              as="a"
              href={`https://wa.me/91${cleanPhone}?text=${waCustomerMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              color="success"
              variant="solid"
              radius="sm"
              className="font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
              startContent={<MessageCircle size={15} />}
            >
              WhatsApp Customer
            </Button>
          )}

          {driverWhatsAppUrl && (
            <Button
              as="a"
              href={driverWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              color="success"
              variant="bordered"
              radius="sm"
              className="font-semibold"
              startContent={<MessageCircle size={15} />}
            >
              Send to Pilot
            </Button>
          )}

          <Button
            color="primary"
            variant="solid"
            radius="sm"
            isLoading={saving}
            onPress={handleSaveStatus}
            className="font-bold text-[#241129] bg-primary shadow-sm"
            startContent={<Save size={16} />}
          >
            Save Status
          </Button>
        </div>
      </div>

      {savedAt && (
        <div className="p-3 bg-success-50 border border-success-200 text-success-800 text-xs rounded-xl font-mono flex items-center gap-2">
          <CheckCircle2 size={16} className="text-success" />
          <span>Status saved successfully at {savedAt.toLocaleTimeString()}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="space-y-6">
        {/* ============================================================== */}
        {/* COMPLETION STATUS (SAME AS DECORATION ORDERS)                  */}
        {/* ============================================================== */}
        <Card className="bg-content1 rounded-2xl border border-primary/30 shadow-md">
          <CardBody className="p-6 space-y-4">
            <div>
              <h2
                className="text-xl font-bold text-[#241129] flex items-center gap-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <CheckCircle2 size={20} className="text-primary" />
                Completion Status
              </h2>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Update trip execution and fare collection status (matches decoration orders)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* 1. Ride Completion Dropdown */}
              <Select
                label="Ride completion"
                description="Has the passenger trip / destination drop been completed?"
                selectedKeys={[rideCompletion]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as "scheduled" | "completed";
                  if (val) setRideCompletion(val);
                }}
                variant="bordered"
                radius="sm"
                className="w-full"
              >
                <SelectItem key="scheduled" textValue="pending / scheduled">
                  ⏳ Pending / Scheduled
                </SelectItem>
                <SelectItem key="completed" textValue="completed">
                  ✅ Completed
                </SelectItem>
              </Select>

              {/* 2. Payment Completion Dropdown */}
              {isOwner ? (
                <Select
                  label="Payment completion"
                  description="Has the total fare been collected in full?"
                  selectedKeys={[paymentCompletion]}
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys)[0] as "due" | "paid";
                    if (val) setPaymentCompletion(val);
                  }}
                  variant="bordered"
                  radius="sm"
                  className="w-full"
                >
                  <SelectItem key="due" textValue="due / pending">
                    ⚠️ Payment Due / Pending
                  </SelectItem>
                  <SelectItem key="paid" textValue="paid / completed">
                    ✅ Paid in Full
                  </SelectItem>
                </Select>
              ) : (
                <div className="flex items-center rounded-xl border border-primary/20 bg-[#F8F4E6]/50 px-4 py-3 text-sm text-[#241129]/70 font-mono">
                  💳 Payment status is managed by the owner.
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-mono">
                The ride is marked fully completed once both trip and payment are completed.
              </p>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                radius="sm"
                isLoading={saving}
                onPress={handleSaveStatus}
                className="font-bold"
                startContent={<Save size={14} />}
              >
                Save Status Changes
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* ============================================================== */}
        {/* TRIP ROUTE & GOOGLE MAPS                                      */}
        {/* ============================================================== */}
        <Card className="bg-content1 rounded-2xl border border-primary/30 shadow-md">
          <CardBody className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                <MapPin size={16} className="text-primary" />
                Trip Route &amp; Navigation
              </span>
              <Button
                as="a"
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                variant="flat"
                color="primary"
                radius="sm"
                className="font-bold text-xs"
                startContent={<ExternalLink size={13} />}
              >
                Google Maps Directions ↗
              </Button>
            </div>

            <div className="space-y-3 pt-1 font-mono text-sm">
              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full bg-success mt-1 shrink-0" />
                <div>
                  <span className="text-[11px] text-gray-400 uppercase block font-mono">
                    Pickup Location
                  </span>
                  <span className="font-bold text-success text-lg">
                    {ride.pickupLocation || "VKM"}
                  </span>
                </div>
              </div>

              <div className="ml-1.5 pl-4 border-l-2 border-dashed border-gray-300 h-4" />

              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full bg-danger mt-1 shrink-0" />
                <div>
                  <span className="text-[11px] text-gray-400 uppercase block font-mono">
                    Drop Destination
                  </span>
                  <span className="font-bold text-danger text-lg">
                    {ride.dropLocation || "VKM"}
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ============================================================== */}
        {/* PASSENGER & ASSIGNED PILOT 2-COLUMN GRID                       */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Passenger Contact Card */}
          <Card className="bg-content1 rounded-2xl border border-primary/30 shadow-md">
            <CardBody className="p-6 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                <User size={16} className="text-primary" />
                Passenger Details
              </span>
              <p className="text-xl font-bold text-[#241129]">{ride.customerName}</p>
              <p className="text-xs text-primary font-mono font-medium">
                {ride.customerPhone || "No contact number provided"}
              </p>

              {cleanPhone && (
                <div className="pt-2 flex items-center gap-2">
                  <Button
                    as="a"
                    href={`tel:${cleanPhone}`}
                    size="sm"
                    variant="flat"
                    color="primary"
                    radius="sm"
                    className="font-bold text-xs"
                    startContent={<Phone size={13} />}
                  >
                    Call Passenger
                  </Button>
                  <Button
                    as="a"
                    href={`https://wa.me/91${cleanPhone}?text=${waCustomerMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="flat"
                    color="success"
                    radius="sm"
                    className="font-bold text-xs"
                    startContent={<MessageCircle size={13} />}
                  >
                    WhatsApp Receipt
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Assigned Pilot Card */}
          <Card className="bg-content1 rounded-2xl border border-primary/30 shadow-md">
            <CardBody className="p-6 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                <HardHat size={16} className="text-primary" />
                Assigned Pilot
              </span>
              <p className="text-xl font-bold text-[#241129]">
                {ride.driverAssigned || "Unassigned"}
              </p>
              <p className="text-xs text-gray-500 font-mono">
                {driverPhone ? `Phone: ${driverPhone}` : "No pilot phone on file"}
              </p>

              {isOwner && (
                <div className="p-3 rounded-xl bg-[#F8F4E6] border border-primary/30 flex items-center justify-between">
                  <span className="text-xs text-[#241129]/70 font-mono">Pilot Trip Wage:</span>
                  <span className="text-base font-bold text-[#241129]">
                    ₹{driverPay.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {driverWhatsAppUrl ? (
                <Button
                  as="a"
                  href={driverWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  color="success"
                  variant="solid"
                  radius="sm"
                  className="w-full font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                  startContent={<MessageCircle size={15} />}
                >
                  Send Trip Details to Pilot via WhatsApp
                </Button>
              ) : ride.driverAssigned !== "Unassigned" ? (
                <p className="text-[11px] text-gray-400 font-mono italic">
                  Pilot phone not registered in Pilots directory.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>

        {/* ============================================================== */}
        {/* FINANCIAL SUMMARY (OWNER VIEW ONLY)                            */}
        {/* ============================================================== */}
        {isOwner ? (
          <Card className="bg-content1 rounded-2xl border border-primary/30 shadow-md">
            <CardBody className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                  <Wallet size={16} className="text-primary" />
                  Financial Summary (Owner View)
                </span>
                {due > 0 && (
                  <Button
                    size="sm"
                    color="success"
                    variant="flat"
                    radius="sm"
                    isLoading={saving}
                    onPress={handleMarkPaid}
                    className="font-bold text-xs"
                    startContent={<Check size={14} />}
                  >
                    Mark Due Paid (₹{due.toLocaleString("en-IN")})
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-4 rounded-xl bg-[#F8F4E6] border border-primary/25">
                  <p className="text-[11px] text-gray-500 uppercase font-mono">Total Fare</p>
                  <p
                    className="text-2xl font-bold text-[#241129] mt-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    ₹{total.toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                  <p className="text-[11px] text-blue-700 uppercase font-mono">Advance</p>
                  <p
                    className="text-2xl font-bold text-blue-900 mt-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    ₹{advance.toLocaleString("en-IN")}
                  </p>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    due > 0 ? "bg-amber-50/80 border-amber-200" : "bg-emerald-50/80 border-emerald-200"
                  }`}
                >
                  <p className="text-[11px] text-amber-800 uppercase font-mono font-semibold">
                    Due Balance
                  </p>
                  <p
                    className={`text-2xl font-bold mt-1 ${
                      due > 0 ? "text-amber-900" : "text-emerald-700"
                    }`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    ₹{due.toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <p className="text-[11px] text-emerald-700 uppercase font-mono">Net Margin</p>
                  <p
                    className="text-2xl font-bold text-emerald-900 mt-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    ₹{netProfit.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          /* Pilot View */
          <Card className="bg-content1 rounded-2xl border border-primary/30 shadow-md">
            <CardBody className="p-6 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary font-mono">
                Your Pilot Trip Wage
              </span>
              <p
                className="text-3xl font-bold text-success"
                style={{ fontFamily: "var(--font-display)" }}
              >
                ₹{driverPay.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-gray-500 font-mono">
                Trip compensation credited to your pilot ledger.
              </p>
            </CardBody>
          </Card>
        )}

        {/* ============================================================== */}
        {/* TRIP NOTES                                                     */}
        {/* ============================================================== */}
        <Card className="bg-content1 rounded-2xl border border-primary/30 shadow-md">
          <CardBody className="p-6 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono">
              Trip Notes &amp; Special Instructions
            </span>
            <Textarea
              value={notes}
              onValueChange={setNotes}
              placeholder="e.g. Passenger luggage, round trip, waiting time, landmark..."
              variant="bordered"
              radius="sm"
              minRows={2}
            />
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                color="primary"
                radius="sm"
                isLoading={saving}
                onPress={handleSaveStatus}
                className="font-bold text-[#241129] bg-primary"
                startContent={<Save size={14} />}
              >
                Save Notes
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* ============================================================== */}
        {/* BOTTOM DANGER ZONE (OWNER ONLY)                                */}
        {/* ============================================================== */}
        {isOwner && (
          <div className="pt-4 flex justify-between items-center border-t border-primary/20">
            <Button
              color="danger"
              variant="light"
              size="sm"
              radius="sm"
              isLoading={deleting}
              onPress={handleDelete}
              startContent={<Trash2 size={16} />}
              className="font-semibold"
            >
              Delete Ride Booking
            </Button>
            <BackButton href="/auto-rides/rides" label="Back to Rides" />
          </div>
        )}
      </div>
    </div>
  );
}
