"use client";

import { useState } from "react";
import { Input, Button } from "@heroui/react";
import type { QtyMap } from "@/lib/types";

interface QtyGridProps {
  /** The fixed catalog options always shown, in order. */
  options: string[];
  values: QtyMap;
  onChange: (key: string, value: string) => void;
  unitLabel?: string;
  /**
   * Let staff add their own item (a heading, then a qty) on top of the fixed
   * `options` list, for anything that isn't in the standard catalog.
   * Defaults to true so every catalog-style step gets this by default.
   */
  allowCustom?: boolean;
  /** Label shown on the "add item" name field. */
  addLabel?: string;
  /** Text on the button that opens the add-item form. */
  addButtonLabel?: string;
}

export default function QtyGrid({
  options,
  values,
  onChange,
  unitLabel = "",
  allowCustom = true,
  addLabel = "Item name",
  addButtonLabel = "+ Add item",
}: QtyGridProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  // Headings the user has created via "+ Add item" but hasn't (yet, or ever)
  // put a qty against. Kept locally so the row (and its empty qty box) stays
  // visible even though an empty qty is never written into `values`.
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);

  // Custom rows = anything already saved in `values` that isn't a fixed option,
  // plus any heading just created that doesn't have a qty yet.
  const savedExtraKeys = Object.keys(values || {}).filter((k) => !options.includes(k));
  const extraKeys = [...savedExtraKeys, ...pendingKeys.filter((k) => !savedExtraKeys.includes(k))];

  /** Step 1: just create the heading — no qty yet. The user fills the qty in afterwards. */
  function createItem(): void {
    const name = newName.trim();
    if (!name) return;
    if (options.includes(name) || extraKeys.includes(name)) {
      // Already exists — just close and let them use the existing row instead of duplicating it.
      setNewName("");
      setAdding(false);
      return;
    }
    setPendingKeys((prev) => [...prev, name]);
    setNewName("");
    setAdding(false);
  }

  function removeItem(key: string): void {
    onChange(key, "");
    setPendingKeys((prev) => prev.filter((k) => k !== key));
  }

  return (
    <div className="space-y-3">
      {(options.length > 0 || extraKeys.length > 0) && (
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
          {extraKeys.map((key) => (
            <div key={key} className="flex items-end gap-1">
              <Input
                type="number"
                min={0}
                autoFocus
                label={unitLabel ? `${key} ${unitLabel}` : key}
                placeholder="Qty"
                variant="bordered"
                size="sm"
                value={values?.[key] ?? ""}
                onValueChange={(v) => onChange(key, v)}
              />
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                aria-label={`Remove ${key}`}
                onPress={() => removeItem(key)}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      {allowCustom && (
        <div>
          {adding ? (
            <div className="flex flex-wrap items-end gap-2">
              <Input
                autoFocus
                label={addLabel}
                placeholder="e.g. Extra chairs"
                variant="bordered"
                size="sm"
                value={newName}
                onValueChange={setNewName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createItem();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewName("");
                  }
                }}
                className="max-w-64"
              />
              <Button size="sm" color="secondary" onPress={createItem} isDisabled={!newName.trim()}>
                Add
              </Button>
              <Button
                size="sm"
                variant="light"
                onPress={() => {
                  setAdding(false);
                  setNewName("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="bordered" color="secondary" onPress={() => setAdding(true)}>
              {addButtonLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}