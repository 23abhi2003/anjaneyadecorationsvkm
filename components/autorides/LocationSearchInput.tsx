"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Button, Spinner, Chip } from "@heroui/react";
import { MapPin, Search, LocateFixed, X, Navigation } from "lucide-react";

export interface PlaceResult {
  name: string;
  formatted: string;
  lat?: number;
  lng?: number;
  type?: string;
}

const LOCAL_PRESETS = [
  { name: "Vikarabad Bus Stand", formatted: "TGSRTC Bus Station, Vikarabad, Telangana", lat: 17.3374, lng: 77.9096, type: "transit" },
  { name: "Vikarabad Railway Station", formatted: "Vikarabad Junction, Vikarabad, Telangana", lat: 17.3374, lng: 77.9096, type: "railway" },
  { name: "Ananthagiri Hills", formatted: "Ananthagiri Temple & Hills, Vikarabad, Telangana", lat: 17.3228, lng: 77.8618, type: "landmark" },
  { name: "Godamguda", formatted: "Godamguda, Vikarabad mandal, Telangana", lat: 17.3255, lng: 77.8920, type: "locality" },
  { name: "Tandur", formatted: "Tandur, Vikarabad District, Telangana", lat: 17.2567, lng: 77.5851, type: "city" },
  { name: "Chevella", formatted: "Chevella, Ranga Reddy, Telangana", lat: 17.3090, lng: 78.1360, type: "town" },
  { name: "Pargi", formatted: "Pargi, Vikarabad District, Telangana", lat: 17.1812, lng: 77.8824, type: "town" },
  { name: "Mominpet", formatted: "Mominpet, Vikarabad District, Telangana", lat: 17.4697, lng: 77.9691, type: "town" },
  { name: "Hyderabad", formatted: "Hyderabad, Telangana", lat: 17.3850, lng: 78.4867, type: "metro" },
];

interface LocationSearchInputProps {
  label: string;
  value: string;
  onChange: (value: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  isPickup?: boolean;
  onUseCurrentLocation?: () => void;
  locating?: boolean;
}

export default function LocationSearchInput({
  label,
  value,
  onChange,
  placeholder,
  isPickup = false,
  onUseCurrentLocation,
  locating = false,
}: LocationSearchInputProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync external changes to query
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search logic on typing
  async function searchLocation(text: string) {
    const q = text.trim();
    if (q.length < 2) {
      // Show local presets matching query or top presets
      const matchedPresets = LOCAL_PRESETS.filter(
        (p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.formatted.toLowerCase().includes(q.toLowerCase())
      );
      setResults(matchedPresets);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // 1. Search Photon API (fast OpenStreetMap geocoder)
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`
      );

      if (res.ok) {
        const data = await res.json();
        const features = data?.features || [];

        const mapped: PlaceResult[] = features.map((f: any) => {
          const p = f.properties || {};
          const coords = f.geometry?.coordinates; // [lng, lat]
          const name = p.name || p.street || p.city || q;
          const parts = [
            p.street,
            p.district || p.suburb,
            p.city || p.county,
            p.state,
            p.postcode,
          ].filter(Boolean);
          const formatted = parts.length > 0 ? parts.join(", ") : p.country || "India";

          return {
            name,
            formatted,
            lat: coords ? coords[1] : undefined,
            lng: coords ? coords[0] : undefined,
            type: p.type || p.osm_value,
          };
        });

        // Also check if any local presets match query and prepend them if relevant
        const matchingLocal = LOCAL_PRESETS.filter((p) =>
          p.name.toLowerCase().includes(q.toLowerCase())
        );

        const combined = [...matchingLocal, ...mapped].slice(0, 6);
        setResults(combined);
      } else {
        // Fallback to local presets
        const matchingLocal = LOCAL_PRESETS.filter((p) =>
          p.name.toLowerCase().includes(q.toLowerCase())
        );
        setResults(matchingLocal);
      }
    } catch {
      // Fallback to local presets if offline or blocked
      const matchingLocal = LOCAL_PRESETS.filter((p) =>
        p.name.toLowerCase().includes(q.toLowerCase())
      );
      setResults(matchingLocal);
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(val: string) {
    setQuery(val);
    onChange(val);
    setIsOpen(true);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      searchLocation(val);
    }, 280);
  }

  function handleSelect(place: PlaceResult) {
    const finalName = place.name;
    setQuery(finalName);
    onChange(finalName, place.lat && place.lng ? { lat: place.lat, lng: place.lng } : undefined);
    setIsOpen(false);
  }

  function handleClear() {
    setQuery("");
    onChange("");
    setResults([]);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      <div className="flex gap-2 items-end">
        <div className="relative flex-1">
          <Input
            label={label}
            placeholder={placeholder || (isPickup ? "Type pickup place, landmark, village…" : "Type drop location, town, city…")}
            value={query}
            onValueChange={handleInputChange}
            onFocus={() => {
              setIsOpen(true);
              if (results.length === 0) searchLocation(query);
            }}
            variant="bordered"
            radius="sm"
            size="lg"
            startContent={
              <MapPin
                size={18}
                className={isPickup ? "text-success shrink-0" : "text-danger shrink-0"}
              />
            }
            endContent={
              <div className="flex items-center gap-1">
                {loading && <Spinner size="sm" color="warning" />}
                {query && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            }
            className="w-full"
          />
        </div>

        {isPickup && onUseCurrentLocation && (
          <Button
            type="button"
            variant="bordered"
            radius="sm"
            size="lg"
            onPress={onUseCurrentLocation}
            isLoading={locating}
            startContent={!locating && <LocateFixed size={18} className="text-primary" />}
            className="shrink-0 font-semibold"
          >
            Use current location
          </Button>
        )}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border-2 border-[#D9A427]/40 max-h-72 overflow-y-auto divide-y divide-gray-100 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="p-2 bg-gray-50 flex items-center justify-between text-[11px] font-mono font-bold text-gray-500 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Search size={12} className="text-primary" />
              {loading ? "Searching locations…" : "Matching Locations"}
            </span>
            <span>Tap to select</span>
          </div>

          {results.length === 0 && !loading ? (
            <div className="p-4 text-center text-sm text-gray-500 font-mono">
              No matching locations found. You can keep typing custom address.
            </div>
          ) : (
            results.map((place, idx) => (
              <button
                key={`${place.name}-${idx}`}
                type="button"
                onClick={() => handleSelect(place)}
                className="w-full text-left p-3 hover:bg-primary/10 transition-colors flex items-start gap-2.5 group"
              >
                <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${isPickup ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"} group-hover:scale-105 transition-transform`}>
                  <MapPin size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-bold text-sm text-[#241129] truncate">{place.name}</p>
                    {place.type && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0 capitalize">
                        {place.type}
                      </span>
                    )}
                  </div>
                  {place.formatted && (
                    <p className="text-xs text-gray-500 truncate mt-0.5 font-mono">
                      {place.formatted}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}

          {/* Quick preset chips at bottom for 1-tap fill */}
          <div className="p-2.5 bg-gray-50/80 border-t border-gray-100 flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] uppercase font-mono font-bold text-gray-400 mr-1">
              Popular:
            </span>
            {LOCAL_PRESETS.slice(0, 4).map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleSelect(preset)}
                className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 hover:border-primary hover:text-primary transition-all font-mono"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
