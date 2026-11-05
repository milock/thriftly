import { useTranslations, useLocale } from "next-intl";
import { safeWebsiteUrl, formatDistance } from "@/lib/format";
import { Crown, Navigation, ExternalLink } from "lucide-react";
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
            className="relative py-6"
          >
            {i === 0 && scored && (
              <div
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ background: scoreColor(s.score.total) }}
              />
            )}
            <div className="flex items-start gap-4">
              <div
                className="tabular flex size-12 shrink-0 items-center justify-center rounded-full text-[17px] font-bold"
                style={scored ? { backgroundColor: scoreColor(s.score.total), color: scoreInk(s.score.total) } : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
                aria-label={scored ? t("scoreAria", { score: total }) : t("notScored")}
              >
                {scored ? new Intl.NumberFormat(locale).format(total) : "—"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-[12px] font-medium text-muted-foreground">#{i + 1}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {scored ? t(tier.label) : t("notScored")}
                  </span>
                  {i === 0 && scored && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                      <Crown className="size-2.5" />
                      {t("bestFind")}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-base font-semibold leading-tight">
                  {s.name}
                  {place && (
                    <span className="animate-in fade-in duration-500">, {place}</span>
                  )}
                </h3>
                {s.facilityType && <p className="mt-1 text-xs text-muted-foreground">{t(s.facilityType)}</p>}
                {addr && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground"><bdi dir="ltr">{addr}</bdi></p>}
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {t("downtown", { distance: formatDistance(s.distanceMiles, locale), city: cityName })}
                  {" · "}
                  {scored ? t("band", { band: t(tier.label) }) : t("notScored")}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
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
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
