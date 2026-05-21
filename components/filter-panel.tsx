"use client";

import type { Filters, SortKey } from "@/lib/filters";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
}

export function FilterPanel({ filters, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div className="space-y-5 rounded-xl border p-4">
      <div className="space-y-2">
        <Label>Radius: {filters.radiusMiles} mi</Label>
        <Slider min={5} max={50} step={5} value={[filters.radiusMiles]} onValueChange={(v) => set({ radiusMiles: Array.isArray(v) ? v[0] : v })} />
      </div>
      <div className="space-y-2">
        <Label>Minimum Goods Score: {filters.minScore}</Label>
        <Slider min={0} max={100} step={5} value={[filters.minScore]} onValueChange={(v) => set({ minScore: Array.isArray(v) ? v[0] : v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="open-now">Open now</Label>
        <Switch id="open-now" checked={filters.openNowOnly} onCheckedChange={(v) => set({ openNowOnly: v })} />
      </div>
      <div className="space-y-2">
        <Label>Sort by</Label>
        <Select value={filters.sort} onValueChange={(v) => set({ sort: v as SortKey })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Goods Score</SelectItem>
            <SelectItem value="distance">Distance</SelectItem>
            <SelectItem value="best-nearby">Best nearby</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
