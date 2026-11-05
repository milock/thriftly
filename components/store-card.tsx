"use client";

import { useTranslations, useLocale } from "next-intl";

import { useEffect, useRef } from "react";
import { Crown, Navigation, Globe, Phone, ChevronDown, Star } from "lucide-react";
import type { ScoredStore } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScoreRing } from "@/components/score-ring";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { StoreHours } from "@/components/store-hours";
import { scoreTier, scoreColor } from "@/lib/score-color";
import {
  formatDistance,
  directionsUrl,
  mapsPlaceUrl,
  safeWebsiteUrl,
  prettyDomain,
  telUrl,
} from "@/lib/format";
import { parseHours, isOpenNow, todayHours } from "@/lib/hours";

interface Props {
  store: ScoredStore;
  rank: number;
  selected: boolean;
  highest?: boolean;
  onSelect: (id: string | null) => void;
}

const ACTION =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent active:scale-[0.97]";

export function StoreCard({ store, rank, selected, highest = false, onSelect }: Props) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const scored = store.score.catchment.tractCount > 0;
  const tier = scoreTier(store.score.total);
  const color = scoreColor(store.score.total);
  const week = parseHours(store.openingHours);
  const open = isOpenNow(week, new Date(), store.timezone);
  const today = todayHours(week, new Date(), store.timezone, locale, { closed: t("closed"), allDay: t("allDay") });
  const best = scored && highest;
  const expanded = selected;

  // Lead with the neighborhood ("North Park") when we have it; fall back to the
  // city, then the street. Show existing addresses immediately; optional
  // neighborhood enrichment must not block usable store information.
  const title = store.neighborhood || store.locality || store.street || "Goodwill";
  const sub =
    [store.street, store.locality, store.region].filter(Boolean).join(", ") || store.address;

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest" });
  }, [selected]);

  // Clicking the card toggles its expanded/selected state.
  const toggle = () => onSelect(selected ? null : store.id);

  return (
    <div
      ref={ref}
      data-store-card
      className={cn(
        "group relative scroll-mt-2 overflow-hidden rounded-xl border bg-card text-start outline-none transition-all duration-200",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        selected
          ? "border-brand/60"
          : "border-border hover:border-foreground/30",
      )}
    >
      {best && (
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} aria-hidden />
      )}

      <div className="relative grid grid-cols-[minmax(0,1fr)_3.5rem] gap-x-3 gap-y-2 p-4">
        <button type="button" data-store-toggle aria-label={title} aria-expanded={expanded} onClick={toggle} className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring" />
        <div className="min-w-0 self-center">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular font-medium">#{rank}</span>
            {best ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
                <Crown className="size-3" />
                {t("bestFind")}
              </span>
            ) : <span>{scored ? t(tier.label) : t("notScored")}</span>}
          </div>
          <h3 className="mt-1 break-words text-[17px] font-semibold leading-snug">
            <bdi>{title}</bdi>
          </h3>
        </div>
        <div className="self-start">
          {scored ? <ScoreRing score={store.score.total} size={56} /> : <span className="flex size-14 items-center justify-center rounded-full bg-muted text-2xl text-muted-foreground" aria-label={t("notScored")}>—</span>}
        </div>
        {sub && <p data-store-address className="col-span-2 break-words text-sm leading-relaxed text-muted-foreground"><bdi dir="ltr">{sub}</bdi></p>}
        <div className="col-span-2 flex items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {store.facilityType && <><span>{t(store.facilityType)}</span><span aria-hidden>·</span></>}
            <span className="tabular">{t("away", { distance: formatDistance(store.distanceMiles, locale) })}</span>
            {open !== null && (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium" style={open ? { color: "var(--brand)" } : undefined}>
                  {open ? t("open") : t("closed")}
                </span>
              </>
            )}
            {today && open !== null && (
              <>
                <span aria-hidden className="hidden sm:inline">·</span>
                <span className="hidden truncate sm:inline">{today}</span>
              </>
            )}
          </div>
          <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            expanded && "rotate-180",
          )}
          aria-hidden
          />
        </div>
      </div>

      {expanded && (
        <div className="space-y-3.5 border-t px-4 pb-4 pt-3.5">
          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            <a
              href={directionsUrl(store)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(ACTION, "basis-full border-foreground bg-foreground text-background hover:bg-foreground/90")}
            >
              <Navigation className="size-3.5" />
              {t("directions")}
            </a>
            <a href={mapsPlaceUrl(store)} target="_blank" rel="noopener noreferrer" className={ACTION}>
              <Star className="size-3.5" />
              {t("reviews")}
            </a>
            {safeWebsiteUrl(store.website) && (
              <a href={safeWebsiteUrl(store.website)!} target="_blank" rel="noopener noreferrer" className={ACTION}>
                <Globe className="size-3.5" />
                <span className="max-w-[10rem] truncate">{prettyDomain(store.website!)}</span>
              </a>
            )}
            {store.phone && (
              <a href={telUrl(store.phone)} className={ACTION}>
                <Phone className="size-3.5" />
                {t("call")}
              </a>
            )}
            {week && <StoreHours week={week} timezone={store.timezone} />}
          </div>
          <ScoreBreakdown score={store.score} />
        </div>
      )}
    </div>
  );
}
