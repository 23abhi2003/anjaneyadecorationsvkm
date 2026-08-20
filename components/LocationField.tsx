"use client";

import { useState } from "react";
import { Input, Button } from "@heroui/react";
import type { GeoLocation } from "@/lib/types";

interface LocationFieldProps {
  address: string;
  location: GeoLocation | null;
  onAddressChange: (value: string) => void;
  onLocationChange: (value: GeoLocation | null) => void;
}

export default function LocationField({ address, location, onAddressChange, onLocationChange }: LocationFieldProps) {
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  function useCurrentLocation(): void {
    if (!("geolocation" in navigator)) {
      setLocError("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("Couldn't get your location. You can type the address instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const mapsPreviewLink = location
    ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
    : address.trim()
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <Input
          label="Address"
          variant="bordered"
          value={address}
          onValueChange={onAddressChange}
          placeholder="House / street / village / landmark"
          className="flex-1"
        />
        <Button
          type="button"
          variant="bordered"
          radius="sm"
          onPress={useCurrentLocation}
          isLoading={locating}
          className="shrink-0"
        >
          Use current location
        </Button>
      </div>
      {locError && <p className="text-xs text-danger">{locError}</p>}
      {location && (
        <p className="text-xs text-foreground/50" style={{ fontFamily: "var(--font-mono)" }}>
          Pinned: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}{" "}
          <button
            type="button"
            className="text-danger underline ml-1"
            onClick={() => onLocationChange(null)}
          >
            clear
          </button>
        </p>
      )}
      {mapsPreviewLink && (
        <a
          href={mapsPreviewLink}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs text-secondary hover:underline"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Preview on Google Maps &rarr;
        </a>
      )}
    </div>
  );
}
