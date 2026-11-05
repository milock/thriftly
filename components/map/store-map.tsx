"use client";

import { useTranslations, useLocale } from "next-intl";

import {
  MapContainer,
  ZoomControl,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTheme } from "next-themes";
import { Search, Star, Navigation, X } from "lucide-react";
import type { LatLng, ScoredStore } from "@/lib/types";
import { scoreColor, scoreInk } from "@/lib/score-color";
import { formatDistance, directionsUrl, mapsPlaceUrl } from "@/lib/format";
import { haversineMiles } from "@/lib/distance";
import { parseHours, isOpenNow } from "@/lib/hours";
import { ScoreRing } from "@/components/score-ring";

interface Props {
  center: LatLng;
  radiusMiles: number;
  stores: ScoredStore[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSearchArea: (c: LatLng) => void;
}

const MI_TO_M = 1609.34;

function pinIcon(score: number, selected: boolean, locale: string, scored = true): L.DivIcon {
  const color = scored ? scoreColor(score) : "#71717a";
  const ink = scored ? scoreInk(score) : "#ffffff";
  const size = selected ? 40 : 30;
  const ring = selected
    ? "box-shadow:0 0 0 3px rgba(0,0,0,0.55),0 2px 6px rgba(0,0,0,0.35);"
    : "box-shadow:0 1px 4px rgba(0,0,0,0.35);";
  return L.divIcon({
    className: "gw-pin",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:${ink};display:flex;align-items:center;justify-content:center;font-family:var(--font-geist-sans),system-ui,sans-serif;font-weight:700;font-size:${selected ? 14 : 12}px;border:2px solid #fff;${ring};transition:all .15s ease;">${scored ? new Intl.NumberFormat(locale, {numberingSystem: locale === "ar" ? "arab" : "latn"}).format(Math.round(score)) : "—"}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

const centerIcon = L.divIcon({
  className: "gw-center",
  html: `<div style="position:relative;width:18px;height:18px;"><div style="position:absolute;inset:0;border-radius:9999px;background:rgba(59,130,246,.25);"></div><div style="position:absolute;inset:4px;border-radius:9999px;background:#3b82f6;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function PopupClose() {
  const map = useMap();
  const t = useTranslations("ui");
  return <button type="button" aria-label={t("close")} onClick={() => map.closePopup()} className="absolute end-1 top-1 flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" aria-hidden /></button>;
}

function ViewController({
  center,
  radiusMiles,
  selected,
  programmaticRef,
}: {
  center: LatLng;
  radiusMiles: number;
  selected: ScoredStore | null;
  programmaticRef: RefObject<boolean>;
}) {
  const map = useMap();
  // Fit the viewport to the search radius whenever location or radius changes,
  // so the whole circle stays visible (even at 100 mi).
  useEffect(() => {
    programmaticRef.current = true;
    const bounds = L.latLng(center.lat, center.lon).toBounds(radiusMiles * MI_TO_M * 2);
    map.fitBounds(bounds, { padding: [48, 48], animate: true });
  }, [center, radiusMiles, map, programmaticRef]);
  useEffect(() => {
    if (selected) {
      programmaticRef.current = true;
      map.flyTo([selected.location.lat, selected.location.lon], Math.max(map.getZoom(), 13), {
        duration: 0.6,
      });
    }
  }, [selected, map, programmaticRef]);
  return null;
}

function MoveWatcher({
  programmaticRef,
  onMoved,
}: {
  programmaticRef: RefObject<boolean>;
  onMoved: (c: LatLng) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      if (programmaticRef.current) {
        programmaticRef.current = false;
        return;
      }
      const c = map.getCenter();
      onMoved({ lat: c.lat, lon: c.lng });
    },
  });
  return null;
}

export default function StoreMap({
  center,
  radiusMiles,
  stores,
  selectedId,
  onSelect,
  onSearchArea,
}: Props) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const selected = stores.find((s) => s.id === selectedId) ?? null;
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const ringColor = dark ? "#a1a1aa" : "#52525b";
  const programmaticRef = useRef(false);
  const [movedCenter, setMovedCenter] = useState<LatLng | null>(null);

  // Show "Search this area" once the user pans meaningfully away from the search center.
  const handleMoved = (c: LatLng) => {
    const far = haversineMiles(c, center) > Math.max(0.4, radiusMiles * 0.25);
    setMovedCenter(far ? c : null);
  };

  return (
    <div dir="ltr" className="relative isolate h-full w-full">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={11}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl={false}
        attributionControl
      >
        <ZoomControl zoomInTitle={t("zoomIn")} zoomOutTitle={t("zoomOut")} />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ${t("contributors")}`}
          className="thriftly-basemap"
          maxZoom={19}
        />
        <Circle
          center={[center.lat, center.lon]}
          radius={radiusMiles * MI_TO_M}
          pathOptions={{
            color: ringColor,
            weight: 1.5,
            opacity: dark ? 0.6 : 0.45,
            fillColor: ringColor,
            fillOpacity: 0.05,
            dashArray: "5 6",
          }}
        />
        <Marker position={[center.lat, center.lon]} icon={centerIcon} />
        <ViewController
          center={center}
          radiusMiles={radiusMiles}
          selected={selected}
          programmaticRef={programmaticRef}
        />
        <MoveWatcher programmaticRef={programmaticRef} onMoved={handleMoved} />
        {stores.map((s) => {
          const open = isOpenNow(parseHours(s.openingHours), new Date(), s.timezone);
          return (
            <Marker
              title={s.name}
              alt={s.name}
              key={s.id}
              position={[s.location.lat, s.location.lon]}
              icon={pinIcon(s.score.total, s.id === selectedId, locale, s.score.catchment.tractCount > 0)}
              zIndexOffset={s.id === selectedId ? 1000 : 0}
              eventHandlers={{ click: () => onSelect(s.id) }}
            >
              <Popup closeButton={false}>
                <div dir={locale === "ar" ? "rtl" : "ltr"} className="relative max-h-[min(28rem,calc(100dvh-11rem))] w-64 max-w-[calc(100vw-3rem)] overflow-y-auto overscroll-contain p-4 pt-12">
                  <PopupClose />
                  <div className="flex items-start gap-3">
                    {s.score.catchment.tractCount > 0 ? <ScoreRing score={s.score.total} size={46} strokeWidth={4} /> : <span className="text-xs text-muted-foreground">{t("notScored")}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-base font-semibold leading-tight text-foreground">
                        {s.locality || s.street || "Goodwill"}
                      </p>
                      {s.street && s.locality && (
                        <p className="break-words text-sm leading-relaxed text-muted-foreground"><bdi dir="ltr">{s.street}</bdi></p>
                      )}
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        <span className="tabular">{t("away", { distance: formatDistance(s.distanceMiles, locale) })}</span>
                        {open !== null && (
                          <>
                            {" · "}
                            <span style={open ? { color: "var(--brand)", fontWeight: 500 } : undefined}>
                              {open ? t("open") : t("closed")}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={directionsUrl(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--background)", textDecoration: "none" }}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                    >
                      <Navigation className="size-3.5" />
                      {t("directions")}
                    </a>
                    <a
                      href={mapsPlaceUrl(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--foreground)", textDecoration: "none" }}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      <Star className="size-3.5" />
                      {t("reviews")}
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {movedCenter && (
        <button
          type="button"
          onClick={() => {
            onSearchArea(movedCenter);
            setMovedCenter(null);
          }}
          className="animate-in fade-in slide-in-from-top-2 absolute left-1/2 top-3 z-[500] flex min-h-11 max-w-[calc(100%-7rem)] -translate-x-1/2 items-center justify-center gap-1.5 rounded-full bg-card px-4 py-2 text-center text-sm font-medium text-foreground shadow-lg transition-colors hover:bg-accent"
        >
          <Search className="size-3.5" />
          {t("searchArea")}
        </button>
      )}
    </div>
  );
}
