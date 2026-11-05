"use client";

import { useTranslations, useLocale } from "next-intl";

import { formatDistance } from "@/lib/format";
import { useState } from "react";
import { type Filters, type SortKey, SORT_LABELS } from "@/lib/filters";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  className?: string;
  hoursAvailable?: boolean;
}

const toNum = (v: number | readonly number[]): number => (Array.isArray(v) ? v[0] : (v as number));

// Smooth, non-linear radius mapping: a quadratic curve gives fine control close in
// (0.5–10 mi) while still reaching 100 mi. The slider glides continuously; we only
// commit (and refetch) on release.
function pctToMiles(p: number): number {
  const t = Math.max(0, Math.min(1, p / 100));
  return 0.5 + 99.5 * t * t;
}
function milesToPct(m: number): number {
  return Math.sqrt(Math.max(0, (m - 0.5) / 99.5)) * 100;
}
function snapMiles(m: number): number {
  return m < 10 ? Math.round(m * 2) / 2 : Math.round(m);
}

export function FilterPanel({ filters, onChange, className, hoursAvailable = true }: Props) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const [radiusPct, setRadiusPct] = useState(() => milesToPct(filters.radiusMiles));
  const [previousRadius, setPreviousRadius] = useState(filters.radiusMiles);
  if (previousRadius !== filters.radiusMiles) {
    setPreviousRadius(filters.radiusMiles);
    setRadiusPct(milesToPct(filters.radiusMiles));
  }
  const draftMiles = snapMiles(pctToMiles(radiusPct));

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-[13px] text-muted-foreground">{t("radius")}</Label>
          <span className="tabular text-[13px] font-semibold">{formatDistance(draftMiles, locale)}</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={0.5}
          value={[radiusPct]}
          onValueChange={(v) => setRadiusPct(toNum(v))}
          onValueCommitted={(v) => set({ radiusMiles: snapMiles(pctToMiles(toNum(v))) })}
          aria-label={t("radius")}
          aria-valuetext={`${formatDistance(draftMiles, locale)}`}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{formatDistance(0.5, locale)}</span>
          <span>{formatDistance(100, locale)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-[13px] text-muted-foreground">{t("minScore")}</Label>
          <span className="tabular text-[13px] font-semibold">{filters.minScore}</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[filters.minScore]}
          onValueChange={(v) => set({ minScore: toNum(v) })}
          aria-label={t("minScore")}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="open-now" className="text-[13px] text-muted-foreground">
          {t("openOnly")}
        </Label>
        <Switch
          id="open-now"
          disabled={!hoursAvailable && !filters.openNowOnly}
          aria-describedby={!hoursAvailable ? "hours-unavailable" : undefined}
          checked={filters.openNowOnly}
          onCheckedChange={(v) => set({ openNowOnly: v })}
        />
      </div>

      {!hoursAvailable && <p id="hours-unavailable" className="text-sm leading-relaxed text-muted-foreground">{t("hoursUnavailable")}</p>}
      <div className="space-y-2">
        <Label className="text-[13px] text-muted-foreground">{t("sort")}</Label>
        <Select value={filters.sort} onValueChange={(v) => set({ sort: v as SortKey })}>
          <SelectTrigger aria-label={t("sort")} className="min-h-11 w-full">
            <SelectValue>{(value) => t(value as SortKey)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {t(k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
