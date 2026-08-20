"use client";

import { Input } from "@heroui/react";

interface QtyFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
}

export default function QtyField({ label, value, onChange, type = "number" }: QtyFieldProps) {
  return (
    <Input
      type={type}
      min={type === "number" ? 0 : undefined}
      label={label}
      variant="bordered"
      size="sm"
      value={value || ""}
      onValueChange={onChange}
    />
  );
}
