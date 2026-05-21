"use client";

import {
  MapContainer,
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
import { Search, Star, Navigation } from "lucide-react";
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

function pinIcon(score: number, selected: boolean): L.DivIcon {
  const color = scoreColor(score);
  const ink = scoreInk(score);
  const size = selected ? 40 : 30;
  const ring = selected
    ? "box-shadow:0 0 0 3px rgba(0,0,0,0.55),0 2px 6px rgba(0,0,0,0.35);"
    : "box-shadow:0 1px 4px rgba(0,0,0,0.35);";
  return L.divIcon({
    className: "gw-pin",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:${ink};display:flex;align-items:center;justify-content:center;font-family:var(--font-geist-sans),system-ui,sans-serif;font-weight:700;font-size:${selected ? 14 : 12}px;border:2px solid #fff;${ring};transition:all .15s ease;">${Math.round(score)}</div>`,
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

function ViewController({
  center,
  radiusMiles,
  selected,
  programmatic,
}: {
  center: LatLng;
  radiusMiles: number;
  selected: ScoredStore | null;
  programmatic: RefObject<boolean>;
}) {
  const map = useMap();
  // Fit the viewport to the search radius whenever location or radius changes,
  // so the whole circle stays visible (even at 100 mi).
  useEffect(() => {
    programmatic.current = true;
    const bounds = L.latLng(center.lat, center.lon).toBounds(radiusMiles * MI_TO_M * 2);
    map.fitBounds(bounds, { padding: [48, 48], animate: true });
  }, [center, radiusMiles, map, programmatic]);
  useEffect(() => {
    if (selected) {
      programmatic.current = true;
      map.flyTo([selected.location.lat, selected.location.lon], Math.max(map.getZoom(), 13), {
        duration: 0.6,
      });
    }
  }, [selected, map, programmatic]);
  return null;
}

function MoveWatcher({
  programmatic,
  onMoved,
}: {
  programmatic: RefObject<boolean>;
  onMoved: (c: LatLng) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      if (programmatic.current) {
        programmatic.current = false;
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
  const selected = stores.find((s) => s.id === selectedId) ?? null;
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const ringColor = dark ? "#a1a1aa" : "#52525b";
  const programmatic = useRef(false);
  const [movedCenter, setMovedCenter] = useState<LatLng | null>(null);

  // Show "Search this area" once the user pans meaningfully away from the search center.
  const handleMoved = (c: LatLng) => {
    const far = haversineMiles(c, center) > Math.max(0.4, radiusMiles * 0.25);
    setMovedCenter(far ? c : null);
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={11}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl
        attributionControl
      >
        <TileLayer
          key={dark ? "dark" : "light"}
          url={`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`}
          attribution="&copy; OpenStreetMap &copy; CARTO"
          subdomains="abcd"
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
          programmatic={programmatic}
        />
        <MoveWatcher programmatic={programmatic} onMoved={handleMoved} />
        {stores.map((s) => {
          const open = isOpenNow(parseHours(s.openingHours));
          return (
            <Marker
              key={s.id}
              position={[s.location.lat, s.location.lon]}
              icon={pinIcon(s.score.total, s.id === selectedId)}
              zIndexOffset={s.id === selectedId ? 1000 : 0}
              eventHandlers={{ click: () => onSelect(s.id) }}
            >
              <Popup>
                <div className="w-60 p-3.5">
                  <div className="flex items-start gap-3">
                    <ScoreRing score={s.score.total} size={46} strokeWidth={4} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold leading-tight text-foreground">
                        {s.locality || s.street || "Goodwill"}
                      </p>
                      {s.street && s.locality && (
                        <p className="truncate text-[12px] text-muted-foreground">{s.street}</p>
                      )}
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        <span className="tabular">{formatDistance(s.distanceMiles)} away</span>
                        {open !== null && (
                          <>
                            {" · "}
                            <span style={open ? { color: "var(--brand)", fontWeight: 500 } : undefined}>
                              {open ? "Open now" : "Closed"}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a
                      href={directionsUrl(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--background)", textDecoration: "none" }}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-90"
                    >
                      <Navigation className="size-3.5" />
                      Directions
                    </a>
                    <a
                      href={mapsPlaceUrl(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--foreground)", textDecoration: "none" }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-accent"
                    >
                      <Star className="size-3.5" />
                      Reviews
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
          className="animate-in fade-in slide-in-from-top-2 absolute left-1/2 top-3 z-[500] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-foreground shadow-lg transition-colors hover:bg-accent"
        >
          <Search className="size-3.5" />
          Search this area
        </button>
      )}
    </div>
  );
}
