import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";

/** Opens the supplemental OSM layer; edits do not modify primary AllThePlaces listings. */
export function AddToOsm({ lat, lon, className }: { lat: number; lon: number; className?: string }) {
  const t = useTranslations("ui");
  const href = `https://www.openstreetmap.org/edit#map=15/${lat.toFixed(4)}/${lon.toFixed(4)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-[12px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline ${className ?? ""}`}
    >
      <MapPin className="size-3" />
      {t("osm")}
    </a>
  );
}
