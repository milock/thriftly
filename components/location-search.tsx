"use client";

import { useState } from "react";
import { Search, LocateFixed, LoaderCircle } from "lucide-react";
import type { LatLng } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  onLocate: (c: LatLng) => void;
  className?: string;
}

export function LocationSearch({ onLocate, className }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocate({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = (await res.json()) as { location: LatLng | null };
        if (data.location) onLocate(data.location);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ZIP code or address"
          aria-label="Search by ZIP code or address"
          className="h-10 pl-9 pr-3"
        />
      </div>
      <Button type="submit" disabled={busy} className="h-10 shrink-0">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : "Search"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={useMyLocation}
        disabled={locating}
        title="Use my location"
        aria-label="Use my location"
        className="size-10 shrink-0"
      >
        {locating ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <LocateFixed className="size-4" />
        )}
      </Button>
    </form>
  );
}
