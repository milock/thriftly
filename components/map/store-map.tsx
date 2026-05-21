"use client";

import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import type { LatLng, ScoredStore } from "@/lib/types";
import { scoreColor, scoreInk } from "@/lib/score-color";
import { formatDistance, directionsUrl } from "@/lib/format";

interface Props {
  center: LatLng;
  radiusMiles: number;
  stores: ScoredStore[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const MI_TO_M = 1609.34;

function pinIcon(score: number, selected: boolean): L.DivIcon {
  const color = scoreColor(score);
  const ink = scoreInk(score);
  const size = selected ? 40 : 30;
  const ring = selected ? "box-shadow:0 0 0 3px rgba(0,0,0,0.55),0 2px 6px rgba(0,0,0,0.35);" : "box-shadow:0 1px 4px rgba(0,0,0,0.35);";
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
}: {
  center: LatLng;
  radiusMiles: number;
  selected: ScoredStore | null;
}) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(center.lat, center.lon).toBounds(radiusMiles * MI_TO_M * 2);
    map.fitBounds(bounds, { padding: [48, 48], animate: true });
  }, [center, radiusMiles, map]);
  useEffect(() => {
    if (selected) {
      map.flyTo([selected.location.lat, selected.location.lon], Math.max(map.getZoom(), 13), {
        duration: 0.6,
      });
    }
  }, [selected, map]);
  return null;
}

export default function StoreMap({ center, radiusMiles, stores, selectedId, onSelect }: Props) {
  const selected = stores.find((s) => s.id === selectedId) ?? null;
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const ringColor = dark ? "#a1a1aa" : "#52525b";
  return (
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
      <ViewController center={center} radiusMiles={radiusMiles} selected={selected} />
      {stores.map((s) => (
        <Marker
          key={s.id}
          position={[s.location.lat, s.location.lon]}
          icon={pinIcon(s.score.total, s.id === selectedId)}
          zIndexOffset={s.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(s.id) }}
        >
          <Popup>
            <div className="min-w-[12rem] p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Goods Score {Math.round(s.score.total)}
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-tight">
                {s.locality || s.street || "Goodwill"}
              </p>
              {s.street && s.locality && (
                <p className="text-[12px] text-muted-foreground">{s.street}</p>
              )}
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {formatDistance(s.distanceMiles)} away
              </p>
              <a
                href={directionsUrl(s)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background no-underline transition-opacity hover:opacity-90"
              >
                Get directions
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
