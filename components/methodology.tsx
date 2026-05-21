"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WEIGHTS } from "@/lib/reference-ranges";
import { FACTOR_LABELS, FACTOR_BLURB } from "@/lib/score-color";
import type { FactorKey } from "@/lib/types";

const ORDER: FactorKey[] = [
  "medianHomeValue",
  "medianHouseholdIncome",
  "pctBachelorsPlus",
  "medianGrossRent",
];

export function Methodology() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <Info className="size-4" />
        <span className="hidden sm:inline">How scoring works</span>
        <span className="sm:hidden">Scoring</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="border-b p-4">
          <h3 className="text-sm font-semibold">The Goods Score</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Stores in wealthier areas receive better donations. Each store is scored on the
            affluence of the census tracts within ~3 miles, weighted by population and distance.
          </p>
        </div>
        <ul className="divide-y">
          {ORDER.map((k) => (
            <li key={k} className="flex gap-3 p-4">
              <span className="tabular mt-0.5 w-9 shrink-0 text-sm font-semibold">
                {Math.round(WEIGHTS[k] * 100)}%
              </span>
              <div>
                <p className="text-[13px] font-medium">{FACTOR_LABELS[k]}</p>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {FACTOR_BLURB[k]}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t p-3 text-[11px] leading-relaxed text-muted-foreground">
          Data: U.S. Census ACS + OpenStreetMap. The score estimates donation quality, not live
          inventory, and coverage may be incomplete.
        </p>
      </PopoverContent>
    </Popover>
  );
}
