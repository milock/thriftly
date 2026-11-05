"use client";

import { useTranslations, useLocale } from "next-intl";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ScoredStore } from "@/lib/types";
import { RankedStores } from "./ranked-stores";
import { cn } from "@/lib/utils";

type Enrichment = Pick<ScoredStore, "neighborhood" | "street" | "locality" | "region">;

function relativeTime(iso: string | null, locale: string, fallback: string): string {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return fallback;
  const seconds = Math.min(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds > -60) return formatter.format(0, "minute");
  if (seconds > -3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (seconds > -86400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}

// Reverse-geocode store coords into neighborhood + street addresses. Soft-fails
// to whatever OSM already had so the list still renders.
async function enrichStores(list: ScoredStore[]): Promise<ScoredStore[]> {
  try {
    const points = list.slice(0, 60).map((s) => ({ lat: s.location.lat, lon: s.location.lon }));
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
  initialDateLabel,
}: {
  initial: ScoredStore[];
  cityName: string;
  lat?: number | null;
  lon?: number | null;
  radiusMiles?: number;
  generatedAt?: string | null;
  initialDateLabel?: string;
}) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const [stores, setStores] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState<string | null>(generatedAt ?? null);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Compute the relative label only after mount + on a timer, so the server and
  // client agree on first paint (no hydration mismatch) and "just now" ages.
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setLabel(relativeTime(updatedAt, locale, t("recent"))), 0);
    const id = setInterval(() => setLabel(relativeTime(updatedAt, locale, t("recent"))), 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [updatedAt, locale, t]);

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
    setRefreshError(false);
    try {
      const res = await fetch(`/api/stores?lat=${lat}&lon=${lon}&radius=${radiusMiles}&live=1`);
      if (!res.ok) throw new Error("Refresh unavailable");
      if (res.ok) {
        const data = (await res.json()) as { stores?: ScoredStore[]; generatedAt?: string | null };
        const fresh = data.stores ?? [];
        if (fresh.length) setStores(await enrichStores(fresh));
        setUpdatedAt(data.generatedAt ?? generatedAt ?? null);
      }
    } catch {
      setRefreshError(true);
      // Keep the last usable results when a refresh is unavailable.
    } finally {
      setRefreshing(false);
    }
  }, [canRefresh, refreshing, lat, lon, radiusMiles, generatedAt]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
        <span>{t("updated", { time: label ?? initialDateLabel ?? updatedAt?.slice(0, 10) ?? t("recent") })}</span>
        {canRefresh && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? t("refreshing") : t("refresh")}
          </button>
        )}
      </div>
      {refreshError && <p role="alert" className="mb-4 text-sm text-muted-foreground">{t("refreshFailed")}</p>}
      <RankedStores stores={stores} cityName={cityName} />
    </div>
  );
}
