"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Card,
  CardBody,
} from "@heroui/react";
import {
  MapPin,
  Phone,
  MessageCircle,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Edit2,
  Trash2,
  Car,
  User,
  HardHat,
  Wallet,
  Check,
} from "lucide-react";
import type { AutoRide, AutoDriver } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { waLink, cleanLocationForMaps, buildRouteDirectionsUrl } from "@/lib/orderDisplay";
import { buildDriverRideWhatsAppMessage } from "@/components/autorides/RideWizard";

interface RideDetailModalProps {
  ride: AutoRide | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
  drivers?: AutoDriver[];
  onEdit?: (ride: AutoRide) => void;
  onDeleted?: (id: string) => void;
  onUpdated?: (ride: AutoRide) => void;
}

export default function RideDetailModal({
  ride,
  isOpen,
  onOpenChange,
  isOwner,
  drivers = [],
  onEdit,
  onDeleted,
  onUpdated,
}: RideDetailModalProps) {
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!ride) return null;

  const total = parseFloat(ride.totalAmount || "0") || 0;
  const advance = parseFloat(ride.advancePaid || "0") || 0;
  const due = Math.max(total - advance, 0);
  const driverPay = parseFloat(ride.driverPay || "0") || 0;
  const netProfit = total - driverPay;

  const cleanPhone = (ride.customerPhone || "").replace(/\D/g, "");
  const mapsUrl = buildRouteDirectionsUrl(ride.pickupLocation, ride.dropLocation);

  const waCustomerMessage = encodeURIComponent(
    `Namaskaram ${ride.customerName},\nThank you for choosing Anjaneya Auto Rentals V.K.M!\n\n🚖 *Ride Details*:\nTrip ID: ${ride.id}\nPickup: ${ride.pickupLocation || "VKM"}\nDrop: ${ride.dropLocation || "VKM"}\nDate: ${ride.date}\nTotal Fare: ₹${total}\nAdvance: ₹${advance}\nPending Due: ₹${due}\n\nFor any help, call: 9704452180.`
  );

  // Driver WhatsApp
  const assignedDriver = drivers.find((d) => d.name === ride.driverAssigned);
  const driverPhone = assignedDriver?.phone || "";
  const driverWhatsAppUrl = driverPhone
    ? waLink(
        driverPhone,
        buildDriverRideWhatsAppMessage(ride, ride.driverAssigned)
      )
    : null;

  async function handleMarkPaid() {
    if (!ride) return;
    setUpdating(true);
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
        onUpdated?.(updated);
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleCompleteRide() {
    if (!ride) return;
    setUpdating(true);
    try {
      const res = await apiFetch(`/api/auto-rides/${ride.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        const updated = (await res.json()) as AutoRide;
        onUpdated?.(updated);
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!ride) return;
    if (!confirm(`Are you sure you want to delete ride booking ${ride.id}?`)) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/auto-rides/${ride.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted?.(ride.id);
        onOpenChange(false);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-[#F8F4E6] border-2 border-primary/50 text-[#241129] shadow-2xl rounded-2xl",
        header: "border-b border-primary/30 pb-3 bg-[#F8F4E6]",
        footer: "border-t border-primary/30 pt-3 bg-[#F8F4E6]",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/40 shadow-sm">
                  <Car size={24} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-[#241129]" style={{ fontFamily: "var(--font-display)" }}>
                      Ride {ride.id}
                    </span>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={
                        ride.status === "completed" &&
                        (ride.paymentStatus === "paid" ||
                          (parseFloat(ride.dueAmount || "0") || 0) <= 0)
                          ? "success"
                          : ride.status === "cancelled"
                          ? "danger"
                          : "warning"
                      }
                      className="font-bold text-xs capitalize"
                    >
                      {ride.status === "completed" &&
                      (ride.paymentStatus === "paid" ||
                        (parseFloat(ride.dueAmount || "0") || 0) <= 0)
                        ? "Fully Completed"
                        : ride.status === "cancelled"
                        ? "Cancelled"
                        : "Pending"}
                    </Chip>
                  </div>
                  <p className="text-xs text-primary font-mono font-bold">
                    Trip Date: {ride.date}
                  </p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4">
              {/* Route Card with Google Maps Link */}
              <Card className="bg-content1 border border-primary/30 shadow-sm rounded-xl">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary" />
                      Trip Route
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
                      className="h-7 text-xs font-bold"
                      startContent={<ExternalLink size={12} />}
                    >
                      Google Maps Directions ↗
                    </Button>
                  </div>

                  <div className="space-y-2 pt-1 font-mono text-sm">
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-success mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] text-gray-400 uppercase block">Pickup Point</span>
                        <span className="font-semibold text-success text-base">
                          {ride.pickupLocation || "VKM"}
                        </span>
                      </div>
                    </div>

                    <div className="ml-1 pl-3 border-l-2 border-dashed border-gray-200 h-3" />

                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-danger mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] text-gray-400 uppercase block">Destination (Drop)</span>
                        <span className="font-semibold text-danger text-base">
                          {ride.dropLocation || "VKM"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Passenger & Driver 2-Col Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Passenger */}
                <Card className="bg-content1 border border-primary/30 shadow-sm rounded-xl">
                  <CardBody className="p-4 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                      <User size={14} className="text-primary" />
                      Passenger
                    </span>
                    <p className="text-base font-bold text-[#241129]">{ride.customerName}</p>
                    <p className="text-xs text-primary font-mono font-medium">
                      {ride.customerPhone || "No contact provided"}
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
                          className="h-8 text-xs font-bold"
                          startContent={<Phone size={13} />}
                        >
                          Call
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
                          className="h-8 text-xs font-bold"
                          startContent={<MessageCircle size={13} />}
                        >
                          WhatsApp
                        </Button>
                      </div>
                    )}
                  </CardBody>
                </Card>

                {/* Driver */}
                <Card className="bg-content1 border border-primary/30 shadow-sm rounded-xl">
                  <CardBody className="p-4 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                      <HardHat size={14} className="text-primary" />
                      Assigned Pilot
                    </span>
                    <p className="text-base font-bold text-[#241129]">
                      {ride.driverAssigned || "Unassigned"}
                    </p>
                    {isOwner && (
                      <div className="p-2.5 rounded-xl bg-[#F8F4E6] border border-primary/30 flex items-center justify-between">
                        <span className="text-xs text-[#241129]/70 font-mono">Pilot Wage:</span>
                        <span className="text-sm font-bold text-[#241129]">
                          ₹{driverPay.toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}

                    {/* SEND TO DRIVER WHATSAPP BUTTON */}
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
                        className="w-full font-bold text-white bg-emerald-600 hover:bg-emerald-700 mt-2 shadow-sm"
                        startContent={<MessageCircle size={14} />}
                      >
                        Send to Pilot (WhatsApp)
                      </Button>
                    ) : ride.driverAssigned !== "Unassigned" ? (
                      <p className="text-[11px] text-gray-400 font-mono italic pt-1">
                        Pilot phone not registered
                      </p>
                    ) : null}
                  </CardBody>
                </Card>
              </div>

              {/* Financial Breakdown (OWNER ONLY) */}
              {isOwner ? (
                <Card className="bg-content1 border border-primary/30 shadow-sm rounded-xl">
                  <CardBody className="p-4 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#241129] font-mono flex items-center gap-1.5">
                      <Wallet size={14} className="text-primary" />
                      Financial Summary (Owner View)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-[#F8F4E6] border border-primary/25">
                        <p className="text-[10px] text-gray-500 uppercase font-mono">Total Fare</p>
                        <p className="text-lg font-bold text-[#241129] mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                          ₹{total.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                        <p className="text-[10px] text-blue-700 uppercase font-mono">Advance</p>
                        <p className="text-lg font-bold text-blue-900 mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                          ₹{advance.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${due > 0 ? "bg-amber-50/80 border-amber-200" : "bg-emerald-50/80 border-emerald-200"}`}>
                        <p className="text-[10px] text-amber-800 uppercase font-mono font-semibold">Due Balance</p>
                        <p className={`text-lg font-bold mt-0.5 ${due > 0 ? "text-amber-900" : "text-emerald-700"}`} style={{ fontFamily: "var(--font-display)" }}>
                          ₹{due.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                        <p className="text-[10px] text-emerald-700 uppercase font-mono">Net Margin</p>
                        <p className="text-lg font-bold text-emerald-900 mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                          ₹{netProfit.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                /* DRIVER VIEW */
                <Card className="bg-content1 border border-primary/30 shadow-sm rounded-xl">
                  <CardBody className="p-4 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary font-mono">
                      Your Pilot Trip Wage
                    </span>
                    <p className="text-2xl font-bold text-success" style={{ fontFamily: "var(--font-display)" }}>
                      ₹{driverPay.toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      Trip compensation payable by owner.
                    </p>
                  </CardBody>
                </Card>
              )}

              {/* Quick Status Toggles for Owner */}
              {isOwner && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {due > 0 && (
                    <Button
                      size="sm"
                      color="success"
                      variant="flat"
                      radius="sm"
                      isLoading={updating}
                      onPress={handleMarkPaid}
                      startContent={<Check size={14} />}
                      className="font-bold"
                    >
                      Mark Due Paid (₹{due})
                    </Button>
                  )}
                  {ride.status !== "completed" && (
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      radius="sm"
                      isLoading={updating}
                      onPress={handleCompleteRide}
                      startContent={<CheckCircle2 size={14} />}
                      className="font-bold"
                    >
                      Mark Ride Completed
                    </Button>
                  )}
                </div>
              )}

              {/* Notes */}
              {ride.notes && (
                <div className="p-3 bg-white rounded-xl border border-gray-200 text-xs text-gray-700 space-y-1">
                  <span className="font-bold uppercase font-mono text-[10px] text-gray-400">Notes</span>
                  <p>{ride.notes}</p>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex justify-between items-center">
              <div>
                {isOwner && (
                  <Button
                    color="danger"
                    variant="light"
                    size="sm"
                    radius="sm"
                    isLoading={deleting}
                    onPress={handleDelete}
                    startContent={<Trash2 size={15} />}
                  >
                    Delete Ride
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {isOwner && onEdit && (
                  <Button
                    variant="bordered"
                    size="sm"
                    radius="sm"
                    onPress={() => {
                      onOpenChange(false);
                      onEdit(ride);
                    }}
                    startContent={<Edit2 size={15} />}
                    className="font-bold text-[#241129]"
                  >
                    Edit
                  </Button>
                )}
                <Button variant="light" size="sm" radius="sm" onPress={onClose} className="font-semibold text-gray-600">
                  Close
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
