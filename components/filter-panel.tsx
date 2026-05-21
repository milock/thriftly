"use client";

import {
  type Filters,
  type SortKey,
  RADIUS_STOPS,
  SORT_LABELS,
} from "@/lib/filters";
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
}

function radiusLabel(mi: number): string {
  return mi < 1 ? `${mi} mi` : `${mi} mi`;
}

const toNum = (v: number | readonly number[]): number => (Array.isArray(v) ? v[0] : (v as number));

export function FilterPanel({ filters, onChange, className }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const radiusIndex = Math.max(0, RADIUS_STOPS.indexOf(filters.radiusMiles));

  return (
    <div className={`space-y-6 ${className ?? ""}`}>
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <Label className="text-[13px] text-muted-foreground">Search radius</Label>
          <span className="tabular text-[13px] font-semibold">{radiusLabel(filters.radiusMiles)}</span>
        </div>
        <Slider
          min={0}
          max={RADIUS_STOPS.length - 1}
          step={1}
          value={[radiusIndex < 0 ? 6 : radiusIndex]}
          onValueChange={(v) => set({ radiusMiles: RADIUS_STOPS[toNum(v)] })}
          aria-label="Search radius"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0.5 mi</span>
          <span>100 mi</span>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <Label className="text-[13px] text-muted-foreground">Minimum Goods Score</Label>
          <span className="tabular text-[13px] font-semibold">{filters.minScore}</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[filters.minScore]}
          onValueChange={(v) => set({ minScore: toNum(v) })}
          aria-label="Minimum Goods Score"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="open-now" className="text-[13px] text-muted-foreground">
          Open now only
        </Label>
        <Switch
          id="open-now"
          checked={filters.openNowOnly}
          onCheckedChange={(v) => set({ openNowOnly: v })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[13px] text-muted-foreground">Sort by</Label>
        <Select value={filters.sort} onValueChange={(v) => set({ sort: v as SortKey })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
