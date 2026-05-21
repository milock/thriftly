"use client";

import { useState } from "react";
import type { LatLng } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LocationSearch({ onLocate }: { onLocate: (c: LatLng) => void }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onLocate({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setBusy(false),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    setBusy(false);
    if (!res.ok) return;
    const data = (await res.json()) as { location: LatLng | null };
    if (data.location) onLocate(data.location);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Button type="button" variant="secondary" onClick={useMyLocation} disabled={busy}>
        📍 Use my location
      </Button>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ZIP code or address" className="sm:max-w-xs" />
      <Button type="submit" disabled={busy}>Search</Button>
    </form>
  );
}
