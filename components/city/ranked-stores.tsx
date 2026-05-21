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
  return (
    <ol className="space-y-3">
      {stores.map((s, i) => {
        const total = Math.round(s.score.total);
        const tier = scoreTier(s.score.total);
        const place = s.neighborhood || s.locality;
        const addr = [s.street, s.locality, s.region].filter(Boolean).join(", ");
        return (
          <li
            key={s.id}
            className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5"
          >
            {i === 0 && (
              <div
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ background: scoreColor(s.score.total) }}
              />
            )}
            <div className="flex items-start gap-4">
              <div
                className="tabular flex size-12 shrink-0 items-center justify-center rounded-full text-[17px] font-bold"
                style={{ backgroundColor: scoreColor(s.score.total), color: scoreInk(s.score.total) }}
                aria-label={`Goods Score ${total} out of 100`}
              >
                {total}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-[12px] font-medium text-muted-foreground">#{i + 1}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {tier.label}
                  </span>
                  {i === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                      <Crown className="size-2.5" />
                      Best find
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-[15px] font-semibold leading-tight">
                  {s.name}
                  {place && (
                    <span className="animate-in fade-in duration-500">, {place}</span>
                  )}
                </h3>
                {addr && <p className="mt-0.5 text-[13px] text-muted-foreground">{addr}</p>}
                <p className="mt-1 text-[12px] text-muted-foreground">
                  <span className="tabular">{s.distanceMiles.toFixed(1)} mi</span> from downtown {cityName}
                  {" · "}
                  {tier.blurb}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    <Navigation className="size-3.5" />
                    Directions
                  </a>
                  {s.website && (
                    <a
                      href={s.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      <ExternalLink className="size-3.5" />
                      Website
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
