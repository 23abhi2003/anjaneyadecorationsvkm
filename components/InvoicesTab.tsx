"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Card,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  DateRangePicker,
} from "@heroui/react";
import { LayoutGrid, List as ListIcon, Search } from "lucide-react";
import type { DateValue } from "@react-types/datepicker";
import type { RangeValue } from "@react-types/shared";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { Order, OrderStatus } from "@/lib/types";
import { PAYMENT_TYPES } from "@/lib/catalog";
import Pagination from "@/components/pagination";
import { MIN_PAGE_SIZE, clampPage, paginate } from "@/lib/pagination";

const statusColor: Record<OrderStatus, "warning" | "success" | "secondary"> = {
  pending: "warning",
  confirmed: "success",
  completed: "secondary",
};

type PaymentFilter = "all" | "due" | "paid";

const PAYMENT_TYPE_OPTIONS = [{ key: "all", label: "All types" }, ...PAYMENT_TYPES.map((t) => ({ key: t, label: t }))];

/** A fully completed order (work done + payment done) is never treated as having a due —
 * regardless of what the raw total/advance numbers say. */
function invoiceMoney(o: Order) {
  const total = parseFloat(o.invoice?.totalAmount || "0") || 0;
  const advance = parseFloat(o.invoice?.advancePaid || "0") || 0;
  const due = o.status === "completed" ? 0 : Math.max(total - advance, 0);
  return { total, advance, due };
}

/** Money a single order owes staff (sum of every staff member assigned to it). */
function orderStaffAmount(o: Order): number {
  return (o.staffAssigned || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
}

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Parses an order/event date string (YYYY-MM-DD) into a comparable Date, tolerating blanks. */
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

/** True if the free-text search matches this order's customer name, order id, or invoice amount. */
function matchesSearch(o: Order, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { total } = invoiceMoney(o);
  const haystacks = [o.customer?.name || "", o.id || "", String(total)];
  return haystacks.some((h) => h.toLowerCase().includes(q));
}

export default function InvoicesTab({ orders }: { orders: Order[] }) {
  // Opening Invoices goes straight to grid view.
  const [view, setView] = useState<"list" | "grid">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | string>("all");
  const [range, setRange] = useState<RangeValue<DateValue> | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = MIN_PAGE_SIZE;

  const filtersActive =
    !!search || statusFilter !== "all" || paymentFilter !== "all" || paymentTypeFilter !== "all" || !!range;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setPaymentTypeFilter("all");
    setRange(null);
    setPage(1);
  }

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, paymentFilter, paymentTypeFilter, range]);

  const rows = useMemo(() => {
    return [...orders]
      .filter((o) => matchesSearch(o, search))
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => {
        if (paymentFilter === "all") return true;
        const { due } = invoiceMoney(o);
        return paymentFilter === "due" ? due > 0 : due <= 0;
      })
      .filter((o) => paymentTypeFilter === "all" || (o.invoice?.paymentType || "") === paymentTypeFilter)
      .filter((o) => withinRange(o.eventDate, range))
      // Newest first: latest event date (and latest order id as a tiebreaker) leads page 1.
      .sort((a, b) => {
        const byDate = (b.eventDate || "").localeCompare(a.eventDate || "");
        if (byDate !== 0) return byDate;
        return (b.id || "").localeCompare(a.id || "");
      });
  }, [orders, search, statusFilter, paymentFilter, paymentTypeFilter, range]);

  /** Owner-facing totals across the currently filtered invoices: amount, dues, staff pay, and net profit. */
  const summary = useMemo(() => {
    return rows.reduce(
      (acc, o) => {
        const { total, due } = invoiceMoney(o);
        const staffAmount = orderStaffAmount(o);
        const investment = parseFloat(o.invoice?.investment || "0") || 0;
        acc.total += total;
        acc.due += due;
        acc.staff += staffAmount;
        acc.profit += total - staffAmount - investment;
        return acc;
      },
      { total: 0, due: 0, staff: 0, profit: 0 }
    );
  }, [rows]);

  const currentPage = clampPage(page, rows.length, pageSize);
  const paged = useMemo(() => paginate(rows, currentPage, pageSize), [rows, currentPage, pageSize]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
          {rows.length} {rows.length === 1 ? "invoice" : "invoices"}
        </p>
        <div className="flex items-center gap-1 bg-content2 rounded-md p-1">
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

      <div className="bg-content1 rounded-lg p-4 flex flex-wrap items-end gap-3">
        <Input
          label="Search"
          placeholder="Customer name or amount"
          variant="bordered"
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch("")}
          startContent={<Search size={16} className="text-foreground/50" />}
          className="max-w-xs"
        />
        <Select
          label="Status"
          variant="bordered"
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as "all" | OrderStatus | undefined;
            if (next) setStatusFilter(next);
          }}
          disallowEmptySelection
          className="max-w-45"
        >
          <SelectItem key="all">All statuses</SelectItem>
          <SelectItem key="pending">Pending</SelectItem>
          <SelectItem key="confirmed">Confirmed</SelectItem>
          <SelectItem key="completed">Completed</SelectItem>
        </Select>
        <Select
          label="Payment"
          variant="bordered"
          selectedKeys={[paymentFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as PaymentFilter | undefined;
            if (next) setPaymentFilter(next);
          }}
          disallowEmptySelection
          className="max-w-40"
        >
          <SelectItem key="all">Due &amp; paid</SelectItem>
          <SelectItem key="due">Due</SelectItem>
          <SelectItem key="paid">Paid</SelectItem>
        </Select>
        <Select
          label="Payment type"
          variant="bordered"
          items={PAYMENT_TYPE_OPTIONS}
          selectedKeys={[paymentTypeFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as string | undefined;
            if (next) setPaymentTypeFilter(next);
          }}
          disallowEmptySelection
          className="max-w-45"
        >
          {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
        </Select>
        <DateRangePicker
          label="Event date range"
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

      {view === "list" ? (
        <div className="bg-content1 rounded-lg p-2 overflow-x-auto">
          <Table removeWrapper aria-label="Invoices" className="min-w-180">
            <TableHeader>
              <TableColumn>ORDER</TableColumn>
              <TableColumn>CUSTOMER</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>TOTAL</TableColumn>
              <TableColumn>ADVANCE</TableColumn>
              <TableColumn>DUE</TableColumn>
              <TableColumn>PAYMENT</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No invoices match these filters.">
              {paged.map((o) => {
                const { total, advance, due } = invoiceMoney(o);
                return (
                  <TableRow key={o.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/orders/detail?id=${encodeURIComponent(o.id)}`} className="text-secondary hover:underline">
                        {o.id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{o.customer?.name}</TableCell>
                    <TableCell>{o.eventDate || "—"}</TableCell>
                    <TableCell>₹{total.toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{advance.toLocaleString("en-IN")}</TableCell>
                    <TableCell className={due > 0 ? "text-warning font-semibold" : ""}>₹{due.toLocaleString("en-IN")}</TableCell>
                    <TableCell>{o.invoice?.paymentType || "—"}</TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={statusColor[o.status] || "warning"} className="uppercase text-[10px]">
                        {o.status}
                      </Chip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-content1 rounded-lg py-16 text-center text-sm text-foreground/50">No invoices match these filters.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((o) => {
            const { total, advance, due } = invoiceMoney(o);
            return (
              <Card key={o.id} className="bg-content1 border border-divider">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
                      className="text-secondary font-semibold hover:underline"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {o.id}
                    </Link>
                    <Chip size="sm" variant="flat" color={statusColor[o.status] || "warning"} className="uppercase text-[10px]">
                      {o.status}
                    </Chip>
                  </div>

                  <div>
                    <p className="font-medium truncate">{o.customer?.name || "—"}</p>
                    <p className="text-xs text-foreground/50">{o.eventDate || "No date set"}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-divider/60">
                    <div>
                      <p className="text-[10px] uppercase text-foreground/40" style={{ fontFamily: "var(--font-mono)" }}>
                        Total
                      </p>
                      <p className="text-sm font-semibold">₹{total.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-foreground/40" style={{ fontFamily: "var(--font-mono)" }}>
                        Advance
                      </p>
                      <p className="text-sm font-semibold">₹{advance.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-foreground/40" style={{ fontFamily: "var(--font-mono)" }}>
                        Due
                      </p>
                      <p className={`text-sm font-semibold ${due > 0 ? "text-warning" : ""}`}>₹{due.toLocaleString("en-IN")}</p>
                    </div>
                  </div>

                  <p className="text-xs text-foreground/50">Payment: {o.invoice?.paymentType || "—"}</p>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination page={currentPage} pageSize={pageSize} total={rows.length} itemLabel="invoices" onPageChange={setPage} />

      <div className="grid sm:grid-cols-4 gap-4 pt-2">
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total amount
          </p>
          <p className="text-2xl text-secondary mt-1" style={{ fontFamily: "var(--font-display)" }}>
            {inr(summary.total)}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total dues
          </p>
          <p className={`text-2xl mt-1 ${summary.due > 0 ? "text-warning" : "text-foreground"}`} style={{ fontFamily: "var(--font-display)" }}>
            {inr(summary.due)}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total staff pay
          </p>
          <p className="text-2xl mt-1" style={{ fontFamily: "var(--font-display)", color: "#8B4A15" }}>
            {inr(summary.staff)}
          </p>
        </div>
        <div className="bg-content1 rounded-lg p-5 shadow-lg">
          <p className="text-xs uppercase tracking-wide text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
            Total profit
          </p>
          <p className={`text-2xl mt-1 ${summary.profit < 0 ? "text-danger" : "text-success"}`} style={{ fontFamily: "var(--font-display)" }}>
            {inr(summary.profit)}
          </p>
        </div>
      </div>
    </div>
  );
}