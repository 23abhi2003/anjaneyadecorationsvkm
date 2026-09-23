"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Chip,
  Card,
  CardBody,
  Select,
  SelectItem,
  DateRangePicker,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import type { DateValue } from "@react-types/datepicker";
import type { RangeValue } from "@react-types/shared";
import { getLocalTimeZone, today } from "@internationalized/date";
import { LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { inr, parseAmt, todayLocalISO } from "@/lib/staffPay";
import { INVESTMENT_CATEGORIES } from "@/lib/types";
import type { Investment, InvestmentCategory } from "@/lib/types";
import Pagination from "@/components/pagination";
import { MIN_PAGE_SIZE, clampPage, paginate } from "@/lib/pagination";

type CategoryFilter = "all" | InvestmentCategory;

const CATEGORY_LABELS: Record<InvestmentCategory, string> = {
  decoration: "Decoration",
  tenthouse: "Tenthouse",
  lighting: "Lighting",
  dj: "DJ",
  food: "Food",
  flowers: "Flowers",
  others: "Others",
};

const CATEGORY_COLORS: Record<InvestmentCategory, "primary" | "secondary" | "success" | "warning" | "danger" | "default"> = {
  decoration: "secondary",
  tenthouse: "primary",
  lighting: "warning",
  dj: "danger",
  food: "success",
  flowers: "default",
  others: "default",
};

function toDate(d?: string | null): Date | null {
  if (!d) return null;
  const parsed = new Date(d + "T00:00:00");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function withinRange(dateStr: string | null | undefined, range: RangeValue<DateValue> | null): boolean {
  if (!range) return true;
  const d = toDate(dateStr);
  if (!d) return false;
  const start = range.start.toDate(getLocalTimeZone());
  const end = range.end.toDate(getLocalTimeZone());
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

/** True if the free-text search matches this investment's name or category label. */
function matchesSearch(inv: Investment, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystacks = [inv.name || "", CATEGORY_LABELS[inv.category] || inv.category || ""];
  return haystacks.some((h) => h.toLowerCase().includes(q));
}

export default function InvestmentsClient({
  investments: initialInvestments,
  onChanged,
}: {
  investments: Investment[];
  onChanged?: () => void;
}) {
  const [investments, setInvestments] = useState<Investment[]>(initialInvestments);

  // ---- add form ----
  const [name, setName] = useState("");
  const [category, setCategory] = useState<InvestmentCategory>("decoration");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocalISO());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ---- filters, view, pagination ----
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [range, setRange] = useState<RangeValue<DateValue> | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const pageSize = MIN_PAGE_SIZE;

  const filtersActive = !!search || categoryFilter !== "all" || !!range;

  function clearFilters(): void {
    setSearch("");
    setCategoryFilter("all");
    setRange(null);
    setPage(1);
  }

  // ---- delete state ----
  const [target, setTarget] = useState<Investment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const { isOpen: deleteOpen, onOpen: openDelete, onOpenChange: onDeleteOpenChange } = useDisclosure();

  useEffect(() => {
    setInvestments(initialInvestments);
  }, [initialInvestments]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  async function addInvestment(): Promise<void> {
    setFormError("");
    if (!name.trim()) {
      setFormError("Give it a name — what was this spent on?");
      return;
    }
    if (!amount.trim() || Number.isNaN(parseFloat(amount))) {
      setFormError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    const res = await apiFetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, amount, date: date || todayLocalISO() }),
    });
    setSaving(false);
    if (res.ok) {
      setName("");
      setAmount("");
      setCategory("decoration");
      setDate(todayLocalISO());
      onChanged?.();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setFormError(data.error || "Could not save this investment.");
    }
  }

  function askDelete(inv: Investment): void {
    setTarget(inv);
    setDeleteError("");
    openDelete();
  }

  async function confirmDelete(close: () => void): Promise<void> {
    if (!target) return;
    setDeleting(true);
    setDeleteError("");
    const res = await apiFetch(`/api/investments/${encodeURIComponent(target.id)}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setDeleteError(data.error || "Could not delete this investment.");
      return;
    }
    setInvestments((prev) => prev.filter((i) => i.id !== target.id));
    setNotice(`Deleted "${target.name}".`);
    setTarget(null);
    close();
    onChanged?.();
  }

  const filtered = useMemo(() => {
    return investments
      .filter((i) => matchesSearch(i, search))
      .filter((i) => categoryFilter === "all" || i.category === categoryFilter)
      .filter((i) => withinRange(i.date, range))
      .sort((a, b) => {
        const da = toDate(a.date)?.getTime() ?? 0;
        const db = toDate(b.date)?.getTime() ?? 0;
        return db - da;
      });
  }, [investments, search, categoryFilter, range]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, range]);

  const currentPage = clampPage(page, filtered.length, pageSize);
  const paged = useMemo(() => paginate(filtered, currentPage, pageSize), [filtered, currentPage, pageSize]);

  const totalInvested = useMemo(() => filtered.reduce((sum, i) => sum + parseAmt(i.amount), 0), [filtered]);

  return (
    <div className="space-y-6">
      {notice && (
        <div className="bg-success/10 border border-success/40 text-success rounded-lg px-4 py-2 text-sm no-print">
          {notice}
        </div>
      )}

      {/* ---- add form ---- */}
      <div className="bg-content1 rounded-lg p-5 flex flex-wrap items-end gap-3">
        <Input label="Invested in" placeholder="e.g. New LED lights" variant="bordered" value={name} onValueChange={setName} className="max-w-xs" />
        <Select
          label="Category"
          variant="bordered"
          selectedKeys={[category]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as InvestmentCategory | undefined;
            if (next) setCategory(next);
          }}
          disallowEmptySelection
          className="max-w-40"
        >
          {INVESTMENT_CATEGORIES.map((cat) => (
            <SelectItem key={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
          ))}
        </Select>
        <Input
          label="Amount (₹)"
          variant="bordered"
          inputMode="decimal"
          value={amount}
          onValueChange={(v) => setAmount(v.replace(/[^\d.]/g, ""))}
          className="max-w-40"
        />
        <Input label="Date" type="date" variant="bordered" value={date} onValueChange={setDate} className="max-w-40" />
        <Button color="primary" radius="sm" onPress={addInvestment} isLoading={saving} className="font-semibold">
          + Add investment
        </Button>
      </div>
      {formError && <p className="text-sm text-danger">{formError}</p>}

      {/* ---- filters ---- */}
      <div className="bg-content1 rounded-lg p-4 flex flex-wrap items-end gap-3 no-print">
        <Input
          label="Search"
          placeholder="Name or category"
          variant="bordered"
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch("")}
          startContent={<Search size={16} className="text-foreground/50" />}
          className="max-w-xs"
        />
        <Select
          label="Invested in"
          variant="bordered"
          selectedKeys={[categoryFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as CategoryFilter | undefined;
            if (next) setCategoryFilter(next);
          }}
          disallowEmptySelection
          className="max-w-44"
        >
          {(["all", ...INVESTMENT_CATEGORIES] as CategoryFilter[]).map((cat) => (
            <SelectItem key={cat}>{cat === "all" ? "All categories" : CATEGORY_LABELS[cat]}</SelectItem>
          ))}
        </Select>
        <DateRangePicker
          label="Date range"
          variant="bordered"
          value={range}
          onChange={setRange}
          maxValue={today(getLocalTimeZone())}
          className="max-w-xs"
        />
        {filtersActive && (
          <Button size="sm" variant="light" onPress={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* ---- summary + view toggle ---- */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
          {filtered.length} {filtered.length === 1 ? "investment" : "investments"}
        </p>
        <div className="flex items-center gap-1 bg-content2 rounded-md p-1 no-print">
          <Button
            isIconOnly
            size="sm"
            radius="sm"
            variant={view === "list" ? "solid" : "light"}
            color={view === "list" ? "primary" : "default"}
            onPress={() => setView("list")}
            aria-label="List view"
            title="List view"
          >
            <ListIcon size={16} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            radius="sm"
            variant={view === "grid" ? "solid" : "light"}
            color={view === "grid" ? "primary" : "default"}
            onPress={() => setView("grid")}
            aria-label="Grid view"
            title="Grid view"
          >
            <LayoutGrid size={16} />
          </Button>
        </div>
      </div>

      {/* ---- list / grid ---- */}
      {view === "list" ? (
        <div className="bg-content1 rounded-lg p-2 overflow-x-auto">
          <Table removeWrapper aria-label="Investments" className="min-w-[640px]">
            <TableHeader>
              <TableColumn>INVESTED IN</TableColumn>
              <TableColumn>CATEGORY</TableColumn>
              <TableColumn>AMOUNT</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No investments match these filters.">
              {paged.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={CATEGORY_COLORS[i.category] || "default"}>
                      {CATEGORY_LABELS[i.category] || i.category}
                    </Chip>
                  </TableCell>
                  <TableCell>{inr(parseAmt(i.amount))}</TableCell>
                  <TableCell>{i.date || "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="bordered" color="danger" radius="sm" className="no-print" onPress={() => askDelete(i)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : paged.length === 0 ? (
        <div className="bg-content1 rounded-lg py-16 text-center text-sm text-foreground/50">
          No investments match these filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((i) => (
            <Card key={i.id} className="bg-content1 border border-divider">
              <CardBody className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold truncate">{i.name}</p>
                  <Chip size="sm" variant="flat" color={CATEGORY_COLORS[i.category] || "default"}>
                    {CATEGORY_LABELS[i.category] || i.category}
                  </Chip>
                </div>
                <p className="text-lg text-secondary" style={{ fontFamily: "var(--font-display)" }}>
                  {inr(parseAmt(i.amount))}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-divider/60">
                  <span className="text-xs text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
                    {i.date || "no date"}
                  </span>
                  <Button size="sm" variant="bordered" color="danger" radius="sm" className="no-print" onPress={() => askDelete(i)}>
                    Delete
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} itemLabel="investments" onPageChange={setPage} />

      {/* ---- total invested ---- */}
      <div className="bg-content1 rounded-lg p-5 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-foreground/60" style={{ fontFamily: "var(--font-mono)" }}>
          {filtersActive ? "Total invested (filtered)" : "Total invested"}
        </p>
        <p className="text-2xl text-secondary" style={{ fontFamily: "var(--font-display)" }}>
          {inr(totalInvested)}
        </p>
      </div>

      {/* ---- delete confirmation ---- */}
      <Modal isOpen={deleteOpen} onOpenChange={onDeleteOpenChange} size="md">
        <ModalContent>
          {(onClose) => {
            if (!target) return null;
            return (
              <>
                <ModalHeader style={{ fontFamily: "var(--font-display)" }}>Delete investment</ModalHeader>
                <ModalBody className="space-y-3">
                  <p className="text-sm text-foreground/80">
                    Delete <span className="font-semibold">{target.name}</span> ({inr(parseAmt(target.amount))})? This can&apos;t be
                    undone.
                  </p>
                  {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
                </ModalBody>
                <ModalFooter>
                  <Button variant="bordered" radius="sm" onPress={onClose} isDisabled={deleting}>
                    Cancel
                  </Button>
                  <Button color="danger" radius="sm" className="font-semibold" isLoading={deleting} onPress={() => confirmDelete(onClose)}>
                    Delete investment
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
