"use client";

import { useTranslations, useLocale } from "next-intl";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ScoredStore } from "@/lib/types";
import { InfoDisclosure } from "@/components/info-disclosure";
import { RankedStores } from "./ranked-stores";
import { cn } from "@/lib/utils";

function relativeTime(iso: string | null, locale: string, fallback: string): string {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return fallback;
  const seconds = Math.min(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds > -60) return formatter.format(0, "minute");
  if (seconds > -3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (seconds > -86400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}

export function CityStores({
  initial,
  cityName,
  lat,
  lon,
  radiusMiles,
  generatedAt,
  initialDateLabel,
  brandIds = [],
}: {
  initial: ScoredStore[];
  cityName: string;
  lat?: number | null;
  lon?: number | null;
  radiusMiles?: number;
  generatedAt?: string | null;
  initialDateLabel?: string;
  brandIds?: readonly string[];
}) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const [stores, setStores] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState<string | null>(generatedAt ?? null);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Compute the relative label only after mount + on a timer, so the server and
  // client agree on first paint (no hydration mismatch) and "just now" ages.
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setLabel(relativeTime(updatedAt, locale, t("recent"))), 0);
    const id = setInterval(() => setLabel(relativeTime(updatedAt, locale, t("recent"))), 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [updatedAt, locale, t]);

  const canRefresh =
    typeof lat === "number" && typeof lon === "number" && typeof radiusMiles === "number";
  const refresh = useCallback(async () => {
    if (!canRefresh || refreshing) return;
    setRefreshing(true);
    setRefreshError(false);
    try {
      const res = await fetch(`/api/stores?lat=${lat}&lon=${lon}&radius=${radiusMiles}${brandIds.length ? `&brands=${encodeURIComponent(brandIds.join(","))}` : ""}`);
      if (!res.ok) throw new Error("Refresh unavailable");
      if (res.ok) {
        const data = (await res.json()) as { stores?: ScoredStore[]; generatedAt?: string | null };
        if (!Array.isArray(data.stores) || (stores.length > 0 && data.stores.length === 0)) throw new Error("No usable refresh results");
        setStores(data.stores);
        setRefreshKey(value => value + 1);
        setUpdatedAt(data.generatedAt ?? generatedAt ?? null);
      }
    } catch {
      setRefreshError(true);
      // Keep the last usable results when a refresh is unavailable.
    } finally {
      setRefreshing(false);
    }
  }, [canRefresh, refreshing, lat, lon, radiusMiles, generatedAt, brandIds, stores.length]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {updatedAt && <InfoDisclosure label={t("sourceInfo")}><p>{t("sourceUpdated", { time: label ?? initialDateLabel ?? updatedAt.slice(0, 10) })}</p></InfoDisclosure>}
        {canRefresh && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="ms-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? t("refreshing") : t("refresh")}
          </button>
        )}
      </div>
      {refreshError && <p role="alert" className="mb-4 text-sm text-muted-foreground">{t("refreshFailed")}</p>}
      <RankedStores stores={stores} cityName={cityName} center={typeof lat === 'number' && typeof lon === 'number' ? {lat, lon} : undefined} radiusMiles={radiusMiles} refreshKey={refreshKey} />
    </div>
  );
}
