"use client";

import { Input } from "@heroui/react";
import type { QtyMap } from "@/lib/types";

interface QtyGridProps {
  options: string[];
  values: QtyMap;
  onChange: (key: string, value: string) => void;
  unitLabel?: string;
}

export default function QtyGrid({ options, values, onChange, unitLabel = "" }: QtyGridProps) {
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {options.map((opt) => (
        <Input
          key={opt}
          type="number"
          min={0}
          label={unitLabel ? `${opt} ${unitLabel}` : opt}
          variant="bordered"
          size="sm"
          value={values?.[opt] ?? ""}
          onValueChange={(v) => onChange(opt, v)}
        />
      ))}
    </div>
  );
}