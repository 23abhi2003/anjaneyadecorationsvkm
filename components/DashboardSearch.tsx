"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@heroui/react";
import type { Order } from "@/lib/types";

export default function DashboardSearch({ orders }: { orders: Order[] }) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return orders
      .filter((o) =>
        [o.customer?.name, o.customer?.phone, o.id].filter(Boolean).some((f) => f!.toLowerCase().includes(query))
      )
      .slice(0, 6);
  }, [q, orders]);

  return (
    <div className="relative text-left">
      <Input
        value={q}
        onValueChange={setQ}
        placeholder="Search by phone number, Order ID, or name…"
        variant="bordered"
        radius="sm"
        classNames={{ inputWrapper: "bg-content1" }}
      />
      {results.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-content1 rounded-md overflow-hidden shadow-xl">
          {results.map((o) => (
            <Link
              key={o.id}
              href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
              className="block px-4 py-2.5 text-sm text-foreground hover:bg-primary/10 border-b border-divider last:border-0"
            >
              <strong>{o.customer?.name}</strong>{" "}
              <span className="text-foreground/50">
                {o.id} &middot; {o.customer?.phone}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
