"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { GoodsScore } from "@/lib/types";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { ScoreRing } from "@/components/score-ring";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

/** A score is a control: activate it to inspect all available factors. */
export function ScoreDetails({ score, children }: { score: GoodsScore; children?: ReactNode }) {
  const t = useTranslations("listing");
  const [open, setOpen] = useState(false);
  const partial = !score.visit?.coverage.googleRatingCount;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger aria-label={`${t("openScore", { score: Math.round(score.total) })}${partial ? `. ${t("partialRating")}` : ""}`} className="relative z-20 inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {children ?? <ScoreRing score={score.total} size={56} />}
      <span aria-hidden className="absolute end-0 top-0 flex size-4 items-center justify-center rounded-full bg-foreground text-[11px] font-bold leading-none text-background">+</span>
      <span aria-hidden={!partial} className={`mt-1 min-h-3 max-w-16 text-center text-[10px] leading-tight text-muted-foreground${partial ? "" : " invisible"}`}>{t("partialRating")}</span>
    </PopoverTrigger>
    <PopoverContent align="end" className="max-h-[min(var(--available-height),75vh,36rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-4">
      <PopoverTitle>{t("visitScore")}</PopoverTitle>
      <ScoreBreakdown score={score} />
    </PopoverContent>
  </Popover>;
}
