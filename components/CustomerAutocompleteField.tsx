"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { Input } from "@heroui/react";
import { Phone, User, UserCheck, Sparkles } from "lucide-react";
import {
  searchCustomerNames,
  searchReferralNames,
  type ContactDirectoryItem,
  type NameSuggestion,
  type ReferralSuggestion,
} from "@/lib/customerSuggestions";

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <span>{text}</span>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <span>
      {before}
      <span className="text-primary font-bold underline decoration-primary/40">{match}</span>
      {after}
    </span>
  );
}

// -------------------------------------------------------------
// Customer Name Autocomplete Input
// -------------------------------------------------------------
export function CustomerNameSuggestInput({
  value,
  onChange,
  onSelectSuggestion,
  contacts,
  label = "Customer name",
  variant = "bordered",
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  onSelectSuggestion: (name: string, phone: string) => void;
  contacts: ContactDirectoryItem[];
  label?: string;
  variant?: "bordered" | "flat" | "faded" | "underlined";
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const suggestions = React.useMemo(() => {
    if (!value || value.trim().length < 1) return [];
    return searchCustomerNames(contacts, value);
  }, [contacts, value]);

  // Keep dropdown open when there are suggestions and focused
  const showDropdown = isOpen && suggestions.length > 0;

  useEffect(() => {
    setHighlightIdx(-1);
  }, [suggestions]);

  function handleSelect(s: NameSuggestion) {
    onSelectSuggestion(s.name, s.phone || "");
    setIsOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightIdx]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Input
        label={label}
        variant={variant}
        value={value}
        onValueChange={(val) => {
          onChange(val);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Delay closing so click events on dropdown items register first
          setTimeout(() => setIsOpen(false), 200);
        }}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-controls={showDropdown ? listboxId : undefined}
        aria-expanded={showDropdown}
        autoComplete="off"
      />

      {showDropdown && (
        <div
          id={listboxId}
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-content3 bg-content1/95 p-1.5 shadow-2xl backdrop-blur-md max-h-64 overflow-y-auto"
        >
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium tracking-wide text-foreground/50 border-b border-content3/60 mb-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Name suggestions</span>
            </span>
            <span className="text-[10px] text-primary font-mono">auto-fills phone</span>
          </div>

          <div className="space-y-0.5">
            {suggestions.map((item, idx) => {
              const isSelected = idx === highlightIdx;
              return (
                <button
                  key={`${item.name}-${item.phone}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    // prevent input from blurring before click completes
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    isSelected ? "bg-primary/20 text-foreground" : "hover:bg-content2 text-foreground"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      <User className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                      <HighlightMatch text={item.name} query={value} />
                    </div>
                    {item.subtext && (
                      <div className="text-xs text-foreground/50 truncate pl-5">
                        {item.subtext}
                      </div>
                    )}
                  </div>

                  {item.phone && (
                    <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/25 text-xs font-mono font-medium text-primary-700">
                      <Phone className="w-3 h-3 text-primary" />
                      <span>{item.phone}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Referral Name Autocomplete Input
// -------------------------------------------------------------
export function ReferralNameSuggestInput({
  value,
  onChange,
  onSelectSuggestion,
  contacts,
  label = "Referred by",
  placeholder = "Who referred this customer? (optional)",
  variant = "bordered",
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  onSelectSuggestion: (referName: string, phone: string) => void;
  contacts: ContactDirectoryItem[];
  label?: string;
  placeholder?: string;
  variant?: "bordered" | "flat" | "faded" | "underlined";
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const suggestions = React.useMemo(() => {
    if (!value || value.trim().length < 1) return [];
    return searchReferralNames(contacts, value);
  }, [contacts, value]);

  const showDropdown = isOpen && suggestions.length > 0;

  useEffect(() => {
    setHighlightIdx(-1);
  }, [suggestions]);

  function handleSelect(s: ReferralSuggestion) {
    onSelectSuggestion(s.referName, s.phone || "");
    setIsOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightIdx]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Input
        label={label}
        placeholder={placeholder}
        variant={variant}
        value={value}
        onValueChange={(val) => {
          onChange(val);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => setIsOpen(false), 200);
        }}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-controls={showDropdown ? listboxId : undefined}
        aria-expanded={showDropdown}
        autoComplete="off"
      />

      {showDropdown && (
        <div
          id={listboxId}
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-content3 bg-content1/95 p-1.5 shadow-2xl backdrop-blur-md max-h-64 overflow-y-auto"
        >
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium tracking-wide text-foreground/50 border-b border-content3/60 mb-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Referral suggestions</span>
            </span>
            <span className="text-[10px] text-primary font-mono">auto-fills phone</span>
          </div>

          <div className="space-y-0.5">
            {suggestions.map((item, idx) => {
              const isSelected = idx === highlightIdx;
              return (
                <button
                  key={`${item.referName}-${item.phone}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    isSelected ? "bg-primary/20 text-foreground" : "hover:bg-content2 text-foreground"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                      <HighlightMatch text={item.referName} query={value} />
                    </div>
                    {item.subtext && (
                      <div className="text-xs text-foreground/50 truncate pl-5">
                        {item.subtext}
                      </div>
                    )}
                  </div>

                  {item.phone && (
                    <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/25 text-xs font-mono font-medium text-primary-700">
                      <Phone className="w-3 h-3 text-primary" />
                      <span>{item.phone}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
