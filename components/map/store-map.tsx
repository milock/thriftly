"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { LatLng, ScoredStore } from "@/lib/types";
import { scoreColor } from "@/lib/score-color";

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon]);
  }, [center, map]);
  return null;
}

interface Props {
  center: LatLng;
  stores: ScoredStore[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function StoreMap({ center, stores, selectedId, onSelect }: Props) {
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={11} className="h-full w-full rounded-xl" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter center={center} />
      {stores.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.location.lat, s.location.lon]}
          radius={s.id === selectedId ? 12 : 9}
          pathOptions={{
            color: "#fff",
            weight: s.id === selectedId ? 3 : 1,
            fillColor: scoreColor(s.score.total),
            fillOpacity: 0.9,
          }}
          eventHandlers={{ click: () => onSelect(s.id) }}
        >
          <Popup>
            <div className="space-y-1">
              <strong>{s.name}</strong>
              <div>Goods Score: {Math.round(s.score.total)}</div>
              <div>{s.distanceMiles.toFixed(1)} mi away</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
