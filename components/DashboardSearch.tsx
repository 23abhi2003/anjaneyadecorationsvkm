"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@heroui/react";
import { Search } from "lucide-react";
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
    <div className="relative text-left w-full">
      <Input
        aria-label="Search by phone number, Order ID, or name"
        placeholder="Search by phone number, Order ID, or name…"
        value={q}
        onValueChange={setQ}
        variant="flat"
        radius="full"
        size="lg"
        startContent={<Search className="text-[#8B4A15] shrink-0 ml-1" size={20} />}
        isClearable
        onClear={() => setQ("")}
        classNames={{
          base: "w-full",
          mainWrapper: "h-12",
          input: "text-sm sm:text-base text-[#241129] placeholder:text-gray-400 pl-1",
          inputWrapper:
            "h-12 bg-white border-2 border-[#D9A427]/70 shadow-lg hover:border-[#D9A427] focus-within:!border-[#D9A427] focus-within:!ring-2 focus-within:!ring-[#D9A427]/30 transition-all",
        }}
      />
      {results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-2 bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-[#D9A427]/40 divide-y divide-gray-100 animate-in fade-in-50 zoom-in-95 duration-100">
          {results.map((o) => (
            <Link
              key={o.id}
              href={`/orders/detail?id=${encodeURIComponent(o.id)}`}
              className="flex items-center justify-between px-4 py-3 text-sm text-[#241129] hover:bg-primary/10 transition-colors"
            >
              <div>
                <p className="font-bold text-[#241129] text-sm sm:text-base">{o.customer?.name}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {o.customer?.phone || "No phone"}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-primary/20 text-[#8B4A15]">
                  {o.id}
                </span>
                {o.eventDate && (
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                    {o.eventDate}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
