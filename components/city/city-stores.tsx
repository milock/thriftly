"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ScoredStore } from "@/lib/types";
import { RankedStores } from "./ranked-stores";
import { cn } from "@/lib/utils";

type Enrichment = Pick<ScoredStore, "neighborhood" | "street" | "locality" | "region">;

function relativeTime(iso: string | null): string {
  if (!iso) return "recently";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  const mo = Math.round(d / 30);
  return `${mo} month${mo > 1 ? "s" : ""} ago`;
}

// Reverse-geocode store coords into neighborhood + street addresses. Soft-fails
// to whatever OSM already had so the list still renders.
async function enrichStores(list: ScoredStore[]): Promise<ScoredStore[]> {
  try {
    const points = list.map((s) => ({ lat: s.location.lat, lon: s.location.lon }));
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    });
    const enriched: Record<string, Enrichment> = res.ok ? (await res.json()).enriched : {};
    return list.map((st) => {
      const e = enriched[`${st.location.lat},${st.location.lon}`];
      if (!e) return { ...st, enriched: true };
      const street = st.street ?? e.street;
      const locality = st.locality ?? e.locality;
      const region = st.region ?? e.region;
      return {
        ...st,
        enriched: true,
        neighborhood: st.neighborhood ?? e.neighborhood,
        street,
        locality,
        region,
        address: [street, locality, region].filter(Boolean).join(", ") || st.address,
      };
    });
  } catch {
    return list.map((st) => ({ ...st, enriched: true }));
  }
}

/**
 * Renders the ranked list immediately (server-provided), fills in neighborhoods
 * client-side, and shows when the data was last refreshed plus a Refresh button
 * that runs an on-demand live OpenStreetMap lookup for the city.
 */
export function CityStores({
  initial,
  cityName,
  lat,
  lon,
  radiusMiles,
  generatedAt,
}: {
  initial: ScoredStore[];
  cityName: string;
  lat?: number | null;
  lon?: number | null;
  radiusMiles?: number;
  generatedAt?: string | null;
}) {
  const [stores, setStores] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState<string | null>(generatedAt ?? null);
  const [refreshing, setRefreshing] = useState(false);
  // Compute the relative label only after mount + on a timer, so the server and
  // client agree on first paint (no hydration mismatch) and "just now" ages.
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(relativeTime(updatedAt));
    const id = setInterval(() => setLabel(relativeTime(updatedAt)), 60_000);
    return () => clearInterval(id);
  }, [updatedAt]);

  useEffect(() => {
    let active = true;
    enrichStores(initial).then((next) => {
      if (active) setStores(next);
    });
    return () => {
      active = false;
    };
  }, [initial]);

  const canRefresh =
    typeof lat === "number" && typeof lon === "number" && typeof radiusMiles === "number";
  const refresh = useCallback(async () => {
    if (!canRefresh || refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/stores?lat=${lat}&lon=${lon}&radius=${radiusMiles}&live=1`);
      if (res.ok) {
        const data = (await res.json()) as { stores?: ScoredStore[] };
        const fresh = data.stores ?? [];
        if (fresh.length) setStores(await enrichStores(fresh));
        setUpdatedAt(new Date().toISOString());
      }
    } finally {
      setRefreshing(false);
    }
  }, [canRefresh, refreshing, lat, lon, radiusMiles]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
        <span>Updated {label ?? "recently"}</span>
        {canRefresh && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>
      <RankedStores stores={stores} cityName={cityName} />
    </div>
  );
}
