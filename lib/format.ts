import type { LatLng } from "@/lib/types";

export function formatCurrency(value: number | null, opts?: { perMonth?: boolean }): string {
  if (value == null) return "—";
  return `$${Math.round(value).toLocaleString()}${opts?.perMonth ? "/mo" : ""}`;
}

export function formatCompactCurrency(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1000)}K`;
  return `$${Math.round(value)}`;
}

export function formatPercent(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatPopulation(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k`;
  return `${value}`;
}

/** Google Maps turn-by-turn directions to the store's exact coordinates. */
export function directionsUrl(store: { location: LatLng; address?: string }): string {
  const dest = `${store.location.lat},${store.location.lon}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

/** Open the place on Google Maps (name + address when available). */
export function mapsPlaceUrl(store: { location: LatLng; address?: string }): string {
  const query = store.address ? `Goodwill ${store.address}` : `${store.location.lat},${store.location.lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function ensureHttp(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** "sdgoodwill.org" from a full URL, for tidy link labels. */
export function prettyDomain(url: string): string {
  try {
    return new URL(ensureHttp(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
