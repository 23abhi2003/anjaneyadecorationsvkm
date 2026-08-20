"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Input, Button, Progress, Divider } from "@heroui/react";
import QtyGrid from "@/components/QtyGrid";
import QtyField from "@/components/QtyField";
import LocationField from "@/components/LocationField";
import { apiFetch } from "@/lib/api";
import {
  PROGRAM_TYPES,
  TENT_SIZES,
  BOWL_TYPES,
  FRAME_SIZES,
  CEILING_SIZES,
  FLOWER_TYPES,
  CEILING_POLE_SIZES,
  PAYMENT_TYPES,
  STOVE_TYPES,
} from "@/lib/catalog";
import type {
  ServiceType,
  CustomerType,
  QtyMap,
  BowlsInfo,
  TenthouseInfo,
  DecorationInfo,
  StaffAssignment,
  InvoiceInfo,
  GeoLocation,
  StaffMember,
  Order,
} from "@/lib/types";

interface WizardForm {
  customer: { name: string; phone: string; type: CustomerType; address: string; location: GeoLocation | null };
  serviceType: ServiceType;
  program: { type: string; name: string; imageUrl: string };
  eventDate: string;
  tenthouse: TenthouseInfo;
  decoration: DecorationInfo;
  staffAssigned: StaffAssignment[];
  invoice: InvoiceInfo;
}

const emptyForm: WizardForm = {
  customer: { name: "", phone: "", type: "new", address: "", location: null },
  serviceType: "",
  program: { type: "", name: "", imageUrl: "" },
  eventDate: "",
  tenthouse: {
    tents: {},
    bowls: { Baghoni: {}, Anda: {}, Lagan: {} },
    tablesBig: "",
    tablesSmall: "",
    riceDishes: "",
    riceSpoons: "",
    curryBuckets: "",
    currySpoons: "",
    curryDonga: "",
    kabgir: "",
    jallithati: "",
    stoveType: "",
    stands: "",
    drums: "",
    ledLights: "",
    djBoxes: "",
    woodenTables: "",
  },
  decoration: {
    frames: {},
    woodenTables: "",
    mats: "",
    stageClothType: "",
    stageClothColor: "",
    stageClothQty: "",
    djBoxes: "",
    ledLights: "",
    ceiling: {},
    sidewalls: "",
    ceilingPoles: {},
    flowers: {},
  },
  staffAssigned: [],
  invoice: { totalAmount: "", advancePaid: "", paymentType: "" },
};

type StepKey =
  | "customer"
  | "serviceType"
  | "program"
  | "tent-size"
  | "bowls"
  | "tent-utensils"
  | "tent-extras"
  | "frames-cloth"
  | "ceiling-poles"
  | "flowers"
  | "staff"
  | "invoice"
  | "review";

const STEP_TITLES: Record<StepKey, string> = {
  customer: "Create order",
  serviceType: "Tent house or decoration?",
  program: "Program",
  "tent-size": "Tent size",
  bowls: "Bowls / gas",
  "tent-utensils": "Tables & utensils",
  "tent-extras": "Stoves, stands & lighting",
  "frames-cloth": "Frames, stage & lighting",
  "ceiling-poles": "Ceiling & sidewalls",
  flowers: "Flowers",
  staff: "Assign staff",
  invoice: "Invoice",
  review: "Review & save",
};

function useSteps(serviceType: ServiceType): StepKey[] {
  return useMemo(() => {
    const steps: StepKey[] = ["customer", "serviceType"];
    if (!serviceType) return steps;
    steps.push("program");
    if (serviceType === "tenthouse" || serviceType === "both") {
      steps.push("tent-size", "bowls", "tent-utensils", "tent-extras");
    }
    if (serviceType === "decoration" || serviceType === "both") {
      steps.push("frames-cloth", "ceiling-poles", "flowers");
    }
    steps.push("staff", "invoice", "review");
    return steps;
  }, [serviceType]);
}

function ChoiceChips({
  options,
  value,
  onChange,
  color = "secondary" as const,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  color?: "secondary" | "primary";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Button
          key={opt}
          size="sm"
          radius="full"
          variant={value === opt ? "solid" : "bordered"}
          color={value === opt ? color : "default"}
          onPress={() => onChange(opt)}
        >
          {opt}
        </Button>
      ))}
    </div>
  );
}

/** Deep-set a value at a dot path without any `any`. Keys are validated by caller convention. */
function setDeep<T extends object>(obj: T, path: string, value: unknown): T {
  const copy: T = structuredClone(obj);
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = copy;
  for (let i = 0; i < parts.length - 1; i++) cursor = cursor[parts[i]];
  cursor[parts[parts.length - 1]] = value;
  return copy;
}

export default function OrderWizard({ staffList }: { staffList: StaffMember[] }) {
  const router = useRouter();
  const [form, setForm] = useState<WizardForm>(emptyForm);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const steps = useSteps(form.serviceType);
  const step = steps[stepIdx] || "customer";

  useEffect(() => {
    if (stepIdx > steps.length - 1) setStepIdx(steps.length - 1);
  }, [steps, stepIdx]);

  function next(): void {
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  }
  function back(): void {
    setStepIdx((i) => Math.max(i - 1, 0));
  }
  function goToStep(key: StepKey): void {
    const idx = steps.indexOf(key);
    if (idx !== -1) setStepIdx(idx);
  }

  function setPath(path: string, value: unknown): void {
    setForm((f) => setDeep(f, path, value));
  }

  function setQty(groupPath: string, key: string, value: string): void {
    setForm((f) => {
      const copy = structuredClone(f);
      const parts = groupPath.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cursor: any = copy;
      for (const p of parts) cursor = cursor[p];
      if (value === "") delete cursor[key];
      else cursor[key] = value;
      return copy;
    });
  }

  const totalAmount = parseFloat(form.invoice.totalAmount) || 0;
  const advancePaid = parseFloat(form.invoice.advancePaid) || 0;
  const dueAmount = Math.max(totalAmount - advancePaid, 0);

  async function onSave(): Promise<void> {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tenthouse: form.serviceType === "decoration" ? null : form.tenthouse,
          decoration: form.serviceType === "tenthouse" ? null : form.decoration,
          invoice: { ...form.invoice, dueAmount: String(dueAmount) },
        }),
      });
      if (!res.ok) throw new Error("failed");
      const created = (await res.json()) as Order;
      router.push(`/orders/detail?id=${encodeURIComponent(created.id)}`);
    } catch {
      setError("Could not save the order. Please try again.");
      setSaving(false);
    }
  }

  const progressPct = ((stepIdx + 1) / steps.length) * 100;

  return (
    <Card className="bg-content1">
      <CardBody className="p-6 md:p-10">
        <Progress value={progressPct} color="primary" size="sm" className="mb-8" aria-label="Wizard progress" />

        <p className="text-xs uppercase tracking-wide text-foreground/40 mb-1" style={{ fontFamily: "var(--font-mono)" }}>
          Step {stepIdx + 1} of {steps.length}
        </p>
        <h2 className="text-2xl font-semibold text-foreground mb-4" style={{ fontFamily: "var(--font-display)" }}>
          {STEP_TITLES[step]}
        </h2>

        <div className="space-y-5">
          {step === "customer" && (
            <>
              <ChoiceChips
                options={["new", "older"]}
                value={form.customer.type}
                onChange={(v) => setPath("customer.type", v)}
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Customer name"
                  variant="bordered"
                  value={form.customer.name}
                  onValueChange={(v) => setPath("customer.name", v)}
                />
                <Input
                  label="Phone number"
                  variant="bordered"
                  value={form.customer.phone}
                  onValueChange={(v) => setPath("customer.phone", v)}
                />
              </div>
              <LocationField
                address={form.customer.address}
                location={form.customer.location}
                onAddressChange={(v) => setPath("customer.address", v)}
                onLocationChange={(v) => setPath("customer.location", v)}
              />
            </>
          )}

          {step === "serviceType" && (
            <div className="grid sm:grid-cols-3 gap-3">
              {(
                [
                  ["tenthouse", "Tent House"],
                  ["decoration", "Decoration"],
                  ["both", "Both"],
                ] as const
              ).map(([val, label]) => (
                <Card
                  key={val}
                  isPressable
                  onPress={() => setPath("serviceType", val)}
                  className={`p-6 text-center border-2 ${
                    form.serviceType === val ? "border-primary bg-primary/10" : "border-transparent bg-content2"
                  }`}
                >
                  <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    {label}
                  </span>
                </Card>
              ))}
            </div>
          )}

          {step === "program" && (
            <>
              <ChoiceChips options={PROGRAM_TYPES} value={form.program.type} onChange={(v) => setPath("program.type", v)} />
              {form.program.type === "Others" && (
                <Input
                  label="Program name"
                  variant="bordered"
                  value={form.program.name}
                  onValueChange={(v) => setPath("program.name", v)}
                />
              )}
              <Input
                type="date"
                label="Event date"
                variant="bordered"
                className="max-w-[220px]"
                value={form.eventDate}
                onValueChange={(v) => setPath("eventDate", v)}
              />
              <Input
                label="Decoration image (link or filename for now)"
                variant="bordered"
                value={form.program.imageUrl}
                onValueChange={(v) => setPath("program.imageUrl", v)}
              />
            </>
          )}

          {step === "tent-size" && (
            <>
              <div className="flex justify-end">
                <Button size="sm" variant="bordered" color="warning" onPress={next}>
                  Skip
                </Button>
              </div>
              <QtyGrid options={TENT_SIZES} values={form.tenthouse.tents} onChange={(k, v) => setQty("tenthouse.tents", k, v)} />
            </>
          )}

          {step === "bowls" && (
            <>
              <div className="flex justify-end">
                <Button size="sm" variant="bordered" color="warning" onPress={next}>
                  Skip
                </Button>
              </div>
              <div className="space-y-5">
                {Object.entries(BOWL_TYPES).map(([type, sizes]) => (
                  <div key={type}>
                    <p className="text-xs uppercase tracking-wide text-secondary mb-2" style={{ fontFamily: "var(--font-mono)" }}>
                      {type}
                    </p>
                    <QtyGrid
                      options={sizes}
                      values={form.tenthouse.bowls[type as keyof BowlsInfo]}
                      onChange={(k, v) => setQty(`tenthouse.bowls.${type}`, k, v)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {step === "tent-utensils" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <QtyField label="Tables, big" value={form.tenthouse.tablesBig} onChange={(v) => setPath("tenthouse.tablesBig", v)} />
              <QtyField label="Tables, small" value={form.tenthouse.tablesSmall} onChange={(v) => setPath("tenthouse.tablesSmall", v)} />
              <QtyField label="Rice dishes (thatlu)" value={form.tenthouse.riceDishes} onChange={(v) => setPath("tenthouse.riceDishes", v)} />
              <QtyField label="Rice spoons" value={form.tenthouse.riceSpoons} onChange={(v) => setPath("tenthouse.riceSpoons", v)} />
              <QtyField label="Curry buckets (bakitlu)" value={form.tenthouse.curryBuckets} onChange={(v) => setPath("tenthouse.curryBuckets", v)} />
              <QtyField label="Curry spoons" value={form.tenthouse.currySpoons} onChange={(v) => setPath("tenthouse.currySpoons", v)} />
              <QtyField label="Curry donga (big)" value={form.tenthouse.curryDonga} onChange={(v) => setPath("tenthouse.curryDonga", v)} />
              <QtyField label="Kabgir (big spoon)" value={form.tenthouse.kabgir} onChange={(v) => setPath("tenthouse.kabgir", v)} />
              <QtyField label="Jallithati (rice filter bowl)" value={form.tenthouse.jallithati} onChange={(v) => setPath("tenthouse.jallithati", v)} />
            </div>
          )}

          {step === "tent-extras" && (
            <>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground/50 mb-2" style={{ fontFamily: "var(--font-mono)" }}>
                  Stoves
                </p>
                <ChoiceChips options={STOVE_TYPES} value={form.tenthouse.stoveType} onChange={(v) => setPath("tenthouse.stoveType", v)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <QtyField label="Stands (poles)" value={form.tenthouse.stands} onChange={(v) => setPath("tenthouse.stands", v)} />
                <QtyField label="Drums" value={form.tenthouse.drums} onChange={(v) => setPath("tenthouse.drums", v)} />
                <QtyField label="LED lights" value={form.tenthouse.ledLights} onChange={(v) => setPath("tenthouse.ledLights", v)} />
                <QtyField label="DJ boxes" value={form.tenthouse.djBoxes} onChange={(v) => setPath("tenthouse.djBoxes", v)} />
                <QtyField label="Wooden tables" value={form.tenthouse.woodenTables} onChange={(v) => setPath("tenthouse.woodenTables", v)} />
              </div>
            </>
          )}

          {step === "frames-cloth" && (
            <>
              <p className="text-xs uppercase tracking-wide text-secondary mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                Frames
              </p>
              <QtyGrid options={FRAME_SIZES} values={form.decoration.frames} onChange={(k, v) => setQty("decoration.frames", k, v)} />
              <div className="grid sm:grid-cols-2 gap-3">
                <QtyField label="Wooden tables" value={form.decoration.woodenTables} onChange={(v) => setPath("decoration.woodenTables", v)} />
                <QtyField label="Mats" value={form.decoration.mats} onChange={(v) => setPath("decoration.mats", v)} />
                <QtyField label="DJ boxes" value={form.decoration.djBoxes} onChange={(v) => setPath("decoration.djBoxes", v)} />
                <QtyField label="LED lights" value={form.decoration.ledLights} onChange={(v) => setPath("decoration.ledLights", v)} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-secondary mb-2" style={{ fontFamily: "var(--font-mono)" }}>
                  Stage cloth
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Input label="Type" variant="bordered" size="sm" value={form.decoration.stageClothType} onValueChange={(v) => setPath("decoration.stageClothType", v)} />
                  <Input label="Color" variant="bordered" size="sm" value={form.decoration.stageClothColor} onValueChange={(v) => setPath("decoration.stageClothColor", v)} />
                  <Input type="number" label="Qty" variant="bordered" size="sm" value={form.decoration.stageClothQty} onValueChange={(v) => setPath("decoration.stageClothQty", v)} />
                </div>
              </div>
            </>
          )}

          {step === "ceiling-poles" && (
            <>
              <p className="text-xs uppercase tracking-wide text-secondary mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                Ceiling sizes
              </p>
              <QtyGrid options={CEILING_SIZES} values={form.decoration.ceiling} onChange={(k, v) => setQty("decoration.ceiling", k, v)} />
              <QtyField label="Sidewalls" value={form.decoration.sidewalls} onChange={(v) => setPath("decoration.sidewalls", v)} />
              <p className="text-xs uppercase tracking-wide text-secondary mb-1 mt-2" style={{ fontFamily: "var(--font-mono)" }}>
                Ceiling poles (includes + type)
              </p>
              <QtyGrid options={CEILING_POLE_SIZES} values={form.decoration.ceilingPoles} onChange={(k, v) => setQty("decoration.ceilingPoles", k, v)} />
            </>
          )}

          {step === "flowers" && (
            <>
              <div className="flex justify-end">
                <Button size="sm" variant="bordered" color="warning" onPress={next}>
                  Skip / later
                </Button>
              </div>
              <QtyGrid options={FLOWER_TYPES} values={form.decoration.flowers} onChange={(k, v) => setQty("decoration.flowers", k, v)} />
            </>
          )}

          {step === "staff" && (
            <StaffStep staffList={staffList} assigned={form.staffAssigned} onChange={(a) => setPath("staffAssigned", a)} />
          )}

          {step === "invoice" && (
            <>
              <div className="flex justify-end">
                <Button size="sm" variant="bordered" color="warning" onPress={next}>
                  Skip / later
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Total amount (₹)"
                  variant="bordered"
                  value={form.invoice.totalAmount}
                  onValueChange={(v) => setPath("invoice.totalAmount", v)}
                />
                <Input
                  type="number"
                  label="Advance paid (₹)"
                  variant="bordered"
                  value={form.invoice.advancePaid}
                  onValueChange={(v) => setPath("invoice.advancePaid", v)}
                />
              </div>
              <div className="bg-primary/10 border border-primary/40 rounded-md px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-foreground/70" style={{ fontFamily: "var(--font-mono)" }}>
                  Due amount
                </span>
                <span className="text-xl text-warning" style={{ fontFamily: "var(--font-display)" }}>
                  ₹{dueAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-foreground/50 mb-2" style={{ fontFamily: "var(--font-mono)" }}>
                  Type of payment
                </p>
                <ChoiceChips options={PAYMENT_TYPES} value={form.invoice.paymentType} onChange={(v) => setPath("invoice.paymentType", v)} />
              </div>
            </>
          )}

          {step === "review" && (
            <>
              <ReviewSummary form={form} dueAmount={dueAmount} onEdit={goToStep} />
              {error && <p className="text-sm text-danger">{error}</p>}
            </>
          )}
        </div>

        <Divider className="my-8" />

        <div className="flex items-center justify-between no-print">
          <Button variant="bordered" onPress={back} isDisabled={stepIdx === 0} radius="sm">
            Back
          </Button>
          {step !== "review" ? (
            <Button
              color="primary"
              onPress={next}
              radius="sm"
              className="font-semibold"
              isDisabled={(step === "customer" && !form.customer.name.trim()) || (step === "serviceType" && !form.serviceType)}
            >
              Continue
            </Button>
          ) : (
            <Button color="primary" onPress={onSave} isLoading={saving} radius="sm" className="font-semibold">
              Save order
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function StaffStep({
  staffList,
  assigned,
  onChange,
}: {
  staffList: StaffMember[];
  assigned: StaffAssignment[];
  onChange: (assigned: StaffAssignment[]) => void;
}) {
  function toggle(staffId: string, name: string): void {
    const exists = assigned.find((a) => a.staffId === staffId);
    if (exists) onChange(assigned.filter((a) => a.staffId !== staffId));
    else onChange([...assigned, { staffId, name, amount: "" }]);
  }
  function setAmount(staffId: string, amount: string): void {
    onChange(assigned.map((a) => (a.staffId === staffId ? { ...a, amount } : a)));
  }
  return (
    <div className="space-y-2">
      {staffList.map((s) => {
        const picked = assigned.find((a) => a.staffId === s.id);
        return (
          <div
            key={s.id}
            className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 ${
              picked ? "bg-primary/10 border border-primary/40" : "bg-content2"
            }`}
          >
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!picked} onChange={() => toggle(s.id, s.name)} />
              {s.name}
            </label>
            {picked && (
              <Input
                type="number"
                size="sm"
                placeholder="Amount ₹"
                className="w-32"
                value={picked.amount}
                onValueChange={(v) => setAmount(s.id, v)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Which wizard step to jump back to when editing a given review-summary group. */
const GROUP_STEP: Record<string, StepKey> = {
  "Tent sizes": "tent-size",
  Frames: "frames-cloth",
  Ceiling: "ceiling-poles",
  "Ceiling poles": "ceiling-poles",
  Flowers: "flowers",
};

function EditButton({ onPress }: { onPress: () => void }) {
  return (
    <Button size="sm" variant="bordered" color="secondary" radius="sm" onPress={onPress} className="no-print">
      Edit
    </Button>
  );
}

function ReviewSummary({
  form,
  dueAmount,
  onEdit,
}: {
  form: WizardForm;
  dueAmount: number;
  onEdit: (step: StepKey) => void;
}) {
  const rows: Array<{ label: string; entries: Array<[string, string]>; step: StepKey }> = [];
  const pushGroup = (label: string, obj: QtyMap) => {
    const entries = Object.entries(obj || {}).filter(([, v]) => v);
    const step = GROUP_STEP[label] || (label.startsWith("Bowls") ? "bowls" : "review");
    if (entries.length) rows.push({ label, entries, step });
  };

  if (form.serviceType === "tenthouse" || form.serviceType === "both") {
    pushGroup("Tent sizes", form.tenthouse.tents);
    Object.entries(form.tenthouse.bowls).forEach(([t, obj]) => pushGroup(`Bowls — ${t}`, obj));
  }
  if (form.serviceType === "decoration" || form.serviceType === "both") {
    pushGroup("Frames", form.decoration.frames);
    pushGroup("Ceiling", form.decoration.ceiling);
    pushGroup("Ceiling poles", form.decoration.ceilingPoles);
    pushGroup("Flowers", form.decoration.flowers);
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="bg-content2 rounded-md p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="uppercase tracking-wide text-secondary text-xs" style={{ fontFamily: "var(--font-mono)" }}>
            Customer &amp; program
          </p>
          <EditButton onPress={() => onEdit("customer")} />
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <p><span className="text-foreground/50">Customer:</span> {form.customer.name || "—"}</p>
          <p><span className="text-foreground/50">Phone:</span> {form.customer.phone || "—"}</p>
          <p><span className="text-foreground/50">Address:</span> {form.customer.address || "—"}</p>
          <p><span className="text-foreground/50">Service:</span> {form.serviceType || "—"}</p>
          <p><span className="text-foreground/50">Program:</span> {form.program.type || "—"}</p>
          <p><span className="text-foreground/50">Event date:</span> {form.eventDate || "—"}</p>
        </div>
      </div>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between mb-1">
            <p className="uppercase tracking-wide text-secondary text-xs" style={{ fontFamily: "var(--font-mono)" }}>
              {r.label}
            </p>
            <EditButton onPress={() => onEdit(r.step)} />
          </div>
          <p className="text-foreground/80">{r.entries.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
        </div>
      ))}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="uppercase tracking-wide text-secondary text-xs" style={{ fontFamily: "var(--font-mono)" }}>
            Staff assigned
          </p>
          <EditButton onPress={() => onEdit("staff")} />
        </div>
        <p className="text-foreground/80">
          {form.staffAssigned.length > 0
            ? form.staffAssigned.map((a) => `${a.name} (₹${a.amount || 0})`).join(" · ")
            : "None assigned yet."}
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="uppercase tracking-wide text-secondary text-xs" style={{ fontFamily: "var(--font-mono)" }}>
            Invoice
          </p>
          <EditButton onPress={() => onEdit("invoice")} />
        </div>
        <div className="flex justify-between bg-primary/10 border border-primary/40 rounded-md px-4 py-3">
          <span>
            Total ₹{form.invoice.totalAmount || 0} · Advance ₹{form.invoice.advancePaid || 0} · Payment{" "}
            {form.invoice.paymentType || "—"}
          </span>
          <span className="text-warning" style={{ fontFamily: "var(--font-display)" }}>
            Due ₹{dueAmount.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </div>
  );
}
