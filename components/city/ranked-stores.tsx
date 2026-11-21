"use client";

import { hasNeighborhoodBaseline } from "@/lib/scoring";

import { ScoreDetails } from "@/components/score-details";
import { ListingDetails } from "@/components/listing-details";
import { useTranslations, useLocale } from "next-intl";
import { safeWebsiteUrl, formatDistance } from "@/lib/format";
import { Navigation, ExternalLink } from "lucide-react";
import type { ScoredStore } from "@/lib/types";
import {storeOpenNow} from "@/lib/store-status";
import { scoreColor, scoreInk, scoreTier } from "@/lib/score-color";

function directionsUrl(s: ScoredStore): string {
  const params = new URLSearchParams({ api: "1", destination: `${s.location.lat},${s.location.lon}` });
  if (s.googlePlaceId) params.set("destination_place_id", s.googlePlaceId);
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Ranks the published listings by Visit score. */
export function RankedStores({ stores, cityName, radiusMiles }: { stores: ScoredStore[]; cityName: string; radiusMiles?: number }) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const ranked = stores.filter(s => radiusMiles === undefined || s.distanceMiles <= radiusMiles).sort((a, b) => b.score.total - a.score.total);
  return (
    <ol className="divide-y divide-border border-y border-border">
      {ranked.map((s, i) => {
        const website = safeWebsiteUrl(s.website);
        const scored = hasNeighborhoodBaseline(s.score);
        const total = Math.round(s.score.total);
        const tier = scoreTier(s.score.total);
        const open = storeOpenNow(s);
        const addr = [s.street, s.locality, s.region].filter(Boolean).join(", ") || s.address;
        return (
          <li
            key={s.id}
            data-store-id={s.id}
            className="relative py-4"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_4rem] gap-x-4 gap-y-2">
              <div className="col-start-2 row-start-1">
              {scored ? <ScoreDetails score={s.score}><span
                className="tabular row-start-1 flex size-12 items-center justify-center rounded-full text-[17px] font-bold"
                style={scored ? { backgroundColor: scoreColor(s.score.total), color: scoreInk(s.score.total) } : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
              >
                {new Intl.NumberFormat(locale, {numberingSystem: locale === "ar" ? "arab" : "latn"}).format(total)}
              </span></ScoreDetails> : <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-label={t("notScored")}>—</span>}
              </div>
              <div className="col-start-1 row-start-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-[12px] font-medium text-muted-foreground">#{i + 1}</span>
                  {i !== 0 && <span className="text-xs text-muted-foreground">
                    {scored ? t(tier.label) : t("notScored")}
                  </span>}
                  {i === 0 && scored && (
                    <span className="text-xs font-medium text-brand">
                      {t("bestFind")}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 break-words text-[17px] font-semibold leading-snug">
                  <bdi>{s.name}</bdi>
                </h3>
              </div>
              <div className="col-span-2">
                {addr && <p className="break-words text-sm leading-relaxed text-muted-foreground"><bdi dir="ltr">{addr}</bdi></p>}
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {t("downtown", { distance: formatDistance(s.distanceMiles, locale), city: cityName })}{open !== null && <> · {t(open ? "open" : "closed")}</>}
                </p>
                <ListingDetails store={s} actions={<>
                  <a href={directionsUrl(s)} target="_blank" rel="noopener noreferrer" className="me-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-foreground px-4 text-[13px] font-medium text-background hover:bg-foreground/90"><Navigation className="size-3.5" aria-hidden />{t("directions")}</a>
                  {website && <a href={website} target="_blank" rel="noopener noreferrer" aria-label={t("website")} title={t("website")} className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"><ExternalLink className="size-4" aria-hidden /></a>}
                </>} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
