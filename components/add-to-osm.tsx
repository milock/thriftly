import { MapPin } from "lucide-react";

/**
 * Subtle prompt to crowdsource coverage gaps: Thriftly's store data comes from
 * OpenStreetMap, so a missing/wrong store can be added there and it flows in on
 * the next weekly refresh. Links to the OSM editor centered on the location.
 */
export function AddToOsm({ lat, lon, className }: { lat: number; lon: number; className?: string }) {
  const href = `https://www.openstreetmap.org/edit#map=15/${lat.toFixed(4)}/${lon.toFixed(4)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-[12px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline ${className ?? ""}`}
    >
      <MapPin className="size-3" />
      Missing a store, or see one that&apos;s wrong? Add it on OpenStreetMap.
    </a>
  );
}
