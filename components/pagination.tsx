"use client";

import { Button, Select, SelectItem } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clampPage, pageNumbers, PAGE_SIZE_OPTIONS } from "@/lib/pagination";

/**
 * Pagination bar shared by every paginated list in the app (Invoices, Staff
 * assignments, Customers). Shows "Showing X–Y of Z {itemLabel}" on the left
 * and prev / numbered pages / next on the right, same shape as most
 * data-table pagination the owner will recognise.
 *
 * `pageSize` is always at least `MIN_PAGE_SIZE` (6) — see lib/pagination.ts.
 */
export default function Pagination({
  page,
  pageSize,
  total,
  itemLabel,
  onPageChange,
  onPageSizeChange,
  tone = "dark",
  className = "",
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Plural noun for the summary line, e.g. "orders", "customers". */
  itemLabel: string;
  onPageChange: (page: number) => void;
  /** Omit to hide the rows-per-page selector. */
  onPageSizeChange?: (size: number) => void;
  /** "light" when pagination sits inside a light card (e.g. staff assignments), "dark" when on the main dark page. Defaults to "dark". */
  tone?: "light" | "dark";
  className?: string;
}) {
  if (total === 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = clampPage(page, total, pageSize);
  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);
  const isLight = tone === "light";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 pt-1 ${className}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <p
          className={`text-sm ${isLight ? "text-foreground/70" : "text-white/60"}`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Showing {start}–{end} of {total} {itemLabel}
        </p>
        {onPageSizeChange && (
          <Select
            aria-label="Rows per page"
            size="sm"
            variant="bordered"
            selectedKeys={[String(pageSize)]}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0] as string | undefined;
              if (next) onPageSizeChange(parseInt(next, 10));
            }}
            disallowEmptySelection
            className="w-32"
            classNames={{
              trigger: isLight
                ? "border-amber-500/50 data-[hover=true]:border-amber-600 bg-content2/40"
                : "border-amber-400/40 data-[hover=true]:border-amber-400/70",
              value: isLight
                ? "text-amber-800 font-semibold whitespace-nowrap"
                : "text-amber-400 whitespace-nowrap",
              selectorIcon: isLight ? "text-amber-700" : "text-amber-400",
            }}
            popoverProps={{
              classNames: {
                content: isLight ? "bg-content1 text-foreground border border-divider shadow-md" : "bg-neutral-900",
              },
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem
                key={String(n)}
                textValue={`${n} / page`}
                classNames={{
                  base: isLight
                    ? "data-[hover=true]:bg-amber-400/20 data-[selectable=true]:focus:bg-amber-400/20"
                    : "data-[hover=true]:bg-amber-400/10 data-[selectable=true]:focus:bg-amber-400/10",
                  title: isLight ? "text-foreground font-medium" : "text-amber-400",
                  selectedIcon: isLight ? "text-amber-600" : "text-amber-400",
                }}
              >
                {`${n} / page`}
              </SelectItem>
            ))}
          </Select>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            radius="full"
            isDisabled={current === 1}
            onPress={() => onPageChange(current - 1)}
            aria-label="Previous page"
            className={
              isLight
                ? "bg-foreground/5 text-foreground border border-foreground/15 data-[hover=true]:bg-foreground/15 disabled:opacity-30"
                : "bg-white/10 text-white data-[hover=true]:bg-white/20 disabled:opacity-30"
            }
          >
            <ChevronLeft size={16} />
          </Button>
          {pageNumbers(current, pageCount).map((p, i) =>
            p === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className={`px-1 text-sm select-none ${isLight ? "text-foreground/50" : "text-white/40"}`}
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                size="sm"
                isIconOnly
                radius="full"
                variant={p === current ? "solid" : "flat"}
                onPress={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === current ? "page" : undefined}
                className={
                  p === current
                    ? "bg-amber-400 text-black font-semibold shadow-sm"
                    : isLight
                      ? "bg-foreground/5 text-foreground border border-foreground/15 data-[hover=true]:bg-foreground/15 font-medium"
                      : "bg-white/10 text-white data-[hover=true]:bg-white/20"
                }
              >
                {p}
              </Button>
            )
          )}
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            radius="full"
            isDisabled={current === pageCount}
            onPress={() => onPageChange(current + 1)}
            aria-label="Next page"
            className={
              isLight
                ? "bg-foreground/5 text-foreground border border-foreground/15 data-[hover=true]:bg-foreground/15 disabled:opacity-30"
                : "bg-white/10 text-white data-[hover=true]:bg-white/20 disabled:opacity-30"
            }
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}