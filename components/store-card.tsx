"use client";

import { hasNeighborhoodBaseline } from "@/lib/scoring";

import { useTranslations, useLocale } from "next-intl";

import { useEffect, useRef } from "react";
import { Navigation, Globe, Phone, ChevronDown, Clock } from "lucide-react";
import type { ScoredStore } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScoreDetails } from "@/components/score-details";
import { ListingDetails } from "@/components/listing-details";
import { StoreHours } from "@/components/store-hours";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {storeOpenNow} from "@/lib/store-status";
import { scoreTier } from "@/lib/score-color";
import {
  formatDistance,
  directionsUrl,
  safeWebsiteUrl,
  prettyDomain,
  telUrl,
} from "@/lib/format";
import { parseHours, todayHours } from "@/lib/hours";

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
  const scored = hasNeighborhoodBaseline(store.score);
  const tier = scoreTier(store.score.total);
  const week = parseHours(store.openingHours);
  const liveHours = store.google?.currentOpeningHours ?? store.google?.regularOpeningHours;
  const open = storeOpenNow(store);
  const today = todayHours(week, new Date(), store.timezone, locale, { closed: t("closed"), allDay: t("allDay") });
  const best = scored && highest;
  const expanded = selected;

  const sub = store.google?.address ||
    [store.street, store.locality, store.region].filter(Boolean).join(", ") || store.address;
  const website = store.google?.website ?? store.website;
  const phone = store.google?.phone ?? store.phone;
  const directionParams = new URLSearchParams({api: "1", destination: `${store.google?.location.lat ?? store.location.lat},${store.google?.location.lon ?? store.location.lon}`});
  if (store.google?.placeId) directionParams.set("destination_place_id", store.google.placeId);
  const directions = store.google ? `https://www.google.com/maps/dir/?${directionParams}` : directionsUrl(store);

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
      <div className="relative grid grid-cols-[minmax(0,1fr)_4rem] gap-x-3 gap-y-1 px-4 pb-0 pt-4">
        <button type="button" data-store-toggle aria-label={store.google?.name || store.name} aria-expanded={expanded} onClick={toggle} className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring" />
        <div className="min-w-0 self-center">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular font-medium">#{rank}</span>
            {best ? (
              <span className="font-medium text-brand">
                {t("bestFind")}
              </span>
            ) : <span>{scored ? t(tier.label) : t("notScored")}</span>}
          </div>
          <h3 className="mt-1 break-words text-[17px] font-semibold leading-snug">
            <bdi>{store.google?.name || store.name}</bdi>
          </h3>
        </div>
        <div className="self-start">
          {scored ? <ScoreDetails score={store.score} /> : <span className="flex size-14 items-center justify-center rounded-full bg-muted text-2xl text-muted-foreground" aria-label={t("notScored")}>—</span>}
        </div>
        {sub && <p data-store-address className="col-span-2 break-words text-sm leading-relaxed text-muted-foreground"><bdi dir="ltr">{sub}</bdi></p>}
        <div className="col-span-2 flex items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {store.facilityType === "outlet" && <><span>{t(store.facilityType)}</span><span aria-hidden>·</span></>}
            <span className="tabular">{t("away", { distance: formatDistance(store.distanceMiles, locale) })}</span>
            {open !== null && (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium" style={open ? { color: "var(--brand)" } : undefined}>
                  {open ? t("open") : t("closed")}
                </span>
              </>
            )}
            {!store.google && today && open !== null && (
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

      <div className="px-4 pb-3"><ListingDetails store={store} actions={<a href={directions} target="_blank" rel="noopener noreferrer" className="me-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-foreground px-4 text-[13px] font-medium text-background hover:bg-foreground/90"><Navigation className="size-3.5" aria-hidden />{t("directions")}</a>} /></div>
      {expanded && (
        <div className="space-y-3.5 border-t px-4 pb-4 pt-3.5">
          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            {safeWebsiteUrl(website) && (
              <a href={safeWebsiteUrl(website)!} target="_blank" rel="noopener noreferrer" className={ACTION}>
                <Globe className="size-3.5" />
                <span className="max-w-[10rem] truncate">{prettyDomain(website!)}</span>
              </a>
            )}
            {phone && (
              <a href={telUrl(phone)} className={ACTION}>
                <Phone className="size-3.5" />
                {t("call")}
              </a>
            )}
            {liveHours?.weekdayDescriptions.length ? <Popover>
              <PopoverTrigger className={ACTION}><Clock className="size-3.5" aria-hidden />{t("hours")}</PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-3"><p className="font-medium">{t("weeklyHours")}</p><ul className="space-y-1 text-xs text-muted-foreground">{liveHours.weekdayDescriptions.map(day => <li key={day}>{day}</li>)}</ul><p className="text-xs text-muted-foreground">Google</p></PopoverContent>
            </Popover> : !store.google && week && <StoreHours week={week} timezone={store.timezone} />}
          </div>
        </div>
      )}
    </div>
  );
}
