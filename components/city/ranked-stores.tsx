import { ListingDetails } from "@/components/listing-details";
import { useTranslations, useLocale } from "next-intl";
import { safeWebsiteUrl, formatDistance } from "@/lib/format";
import { Navigation, ExternalLink } from "lucide-react";
import type { ScoredStore } from "@/lib/types";
import { scoreColor, scoreInk, scoreTier } from "@/lib/score-color";

function directionsUrl(s: ScoredStore): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${s.location.lat},${s.location.lon}`;
}

/**
 * Server-rendered, ranked list of scored stores for the city landing pages.
 * Pure HTML (no client JS) so the store names, addresses, and scores are
 * fully crawlable and the page paints instantly. Semantic <ol> conveys rank.
 */
export function RankedStores({ stores, cityName }: { stores: ScoredStore[]; cityName: string }) {
  const t = useTranslations("ui");
  const locale = useLocale();
  return (
    <ol className="divide-y divide-border border-y border-border">
      {stores.map((s, i) => {
        const website = safeWebsiteUrl(s.website);
        const scored = s.score.catchment.tractCount > 0;
        const total = Math.round(s.score.total);
        const tier = scoreTier(s.score.total);
        const place = s.neighborhood || s.locality;
        const addr = [s.street, s.locality, s.region].filter(Boolean).join(", ");
        return (
          <li
            key={s.id}
            data-store-id={s.id}
            className="relative py-6"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_3rem] gap-x-4 gap-y-2">
              <div
                className="tabular col-start-2 row-start-1 flex size-12 items-center justify-center rounded-full text-[17px] font-bold"
                style={scored ? { backgroundColor: scoreColor(s.score.total), color: scoreInk(s.score.total) } : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
                aria-label={scored ? t("scoreAria", { score: total }) : t("notScored")}
              >
                {scored ? new Intl.NumberFormat(locale, {numberingSystem: locale === "ar" ? "arab" : "latn"}).format(total) : "—"}
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
                  {s.name}
                  {place && (
                    <span className="animate-in fade-in duration-500">, {place}</span>
                  )}
                </h3>
              </div>
              <div className="col-span-2">
                {addr && <p className="break-words text-sm leading-relaxed text-muted-foreground"><bdi dir="ltr">{addr}</bdi></p>}
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {t("downtown", { distance: formatDistance(s.distanceMiles, locale), city: cityName })}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 font-medium text-background transition-colors hover:bg-foreground/90"
                  >
                    <Navigation className="size-3.5" />
                    {t("directions")}
                  </a>
                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      <ExternalLink className="size-3.5" />
                      {t("website")}
                    </a>
                  )}
                </div>
                <div className="mt-3"><ListingDetails store={s} /></div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
