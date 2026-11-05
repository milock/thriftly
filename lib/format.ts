import type { LatLng } from "@/lib/types";

export function formatCurrency(value: number | null, opts?: { perMonth?: boolean; locale?: string }): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(opts?.locale ?? "en", { numberingSystem: opts?.locale === "ar" ? "arab" : "latn", style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) + (opts?.perMonth ? "/mo" : "");
}
export function formatCompactCurrency(value: number | null, locale = "en"): string {
  return value == null ? "—" : new Intl.NumberFormat(locale, { numberingSystem: locale === "ar" ? "arab" : "latn", style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}
export function formatPercent(value: number | null, locale = "en"): string {
  return value == null ? "—" : new Intl.NumberFormat(locale, { numberingSystem: locale === "ar" ? "arab" : "latn", style: "percent", maximumFractionDigits: 0 }).format(value / 100);
}
// Fixed unit labels avoid server/browser CLDR spacing differences during hydration.
const MILE_UNITS: Record<string, string> = {en:"mi", es:"mi", "zh-Hans":"英里", "zh-Hant":"英里", tl:"mi", vi:"dặm", ar:"ميل"};
export function formatDistance(miles: number, locale = "en"): string {
  const n = new Intl.NumberFormat(locale, { numberingSystem: locale === "ar" ? "arab" : "latn", minimumFractionDigits: miles < 10 ? 1 : 0, maximumFractionDigits: miles < 10 ? 1 : 0 });
  return `${miles < 0.1 ? "< " : ""}${n.format(Math.max(0.1, miles))}${locale.startsWith("zh") ? "" : " "}${MILE_UNITS[locale] ?? "mi"}`;
}
export function formatPopulation(value: number, locale = "en"): string {
  return new Intl.NumberFormat(locale, { numberingSystem: locale === "ar" ? "arab" : "latn", notation: "compact", maximumFractionDigits: 1 }).format(value);
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

/** Only navigable HTTP(S) URLs from untrusted OSM tags. */
export function safeWebsiteUrl(value: string | undefined): string | null {
  if (!value || /[\u0000-\u0020\u007f]/.test(value) || value.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) return null;
    return url.href;
  } catch { return null; }
}
