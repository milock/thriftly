"use client";

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
  ensureHttp,
  prettyDomain,
  telUrl,
} from "@/lib/format";
import { parseHours, isOpenNow, todayHours } from "@/lib/hours";

interface Props {
  store: ScoredStore;
  rank: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

const ACTION =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent";

export function StoreCard({ store, rank, selected, onSelect }: Props) {
  const tier = scoreTier(store.score.total);
  const color = scoreColor(store.score.total);
  const week = parseHours(store.openingHours);
  const open = isOpenNow(week);
  const today = todayHours(week);
  const best = rank === 1;
  const expanded = selected || best;

  const title = store.locality || store.street || "Goodwill";
  const sub = store.locality ? store.street || store.address : store.address;

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(store.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(store.id);
        }
      }}
      className={cn(
        "group relative scroll-mt-2 overflow-hidden rounded-xl border bg-card text-left outline-none transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        selected
          ? "border-foreground/25 shadow-md"
          : "border-border hover:border-foreground/15 hover:shadow-sm",
      )}
    >
      {best && (
        <div
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: color }}
          aria-hidden
        />
      )}

      <div className="flex items-start gap-3.5 p-4">
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <ScoreRing score={store.score.total} size={56} />
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color }}
          >
            {tier.label}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="tabular text-[11px] font-medium text-muted-foreground">
              #{rank}
            </span>
            {best && (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
                <Crown className="size-2.5" />
                Best find
              </span>
            )}
          </div>
          <h3 className="mt-0.5 truncate text-[15px] font-semibold leading-tight">
            {title}
          </h3>
          {sub && (
            <p className="truncate text-[13px] text-muted-foreground">{sub}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
            <span className="tabular">{formatDistance(store.distanceMiles)} away</span>
            {open !== null && (
              <>
                <span aria-hidden>·</span>
                <span
                  className="font-medium"
                  style={open ? { color: "var(--brand)" } : undefined}
                >
                  {open ? "Open now" : "Closed"}
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
        </div>

        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform duration-300",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </div>

      {expanded && (
        <div className="space-y-3.5 border-t px-4 pb-4 pt-3.5">
          <ScoreBreakdown score={store.score} />
          <div
            className="flex flex-wrap gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={directionsUrl(store)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(ACTION, "border-foreground bg-foreground text-background hover:bg-foreground/90")}
            >
              <Navigation className="size-3.5" />
              Directions
            </a>
            <a
              href={mapsPlaceUrl(store)}
              target="_blank"
              rel="noopener noreferrer"
              className={ACTION}
            >
              <Star className="size-3.5" />
              Reviews
            </a>
            {store.website && (
              <a
                href={ensureHttp(store.website)}
                target="_blank"
                rel="noopener noreferrer"
                className={ACTION}
              >
                <Globe className="size-3.5" />
                <span className="max-w-[10rem] truncate">{prettyDomain(store.website)}</span>
              </a>
            )}
            {store.phone && (
              <a href={telUrl(store.phone)} className={ACTION}>
                <Phone className="size-3.5" />
                Call
              </a>
            )}
            {week && <StoreHours week={week} />}
          </div>
        </div>
      )}
    </div>
  );
}
