"use client";

import { useTranslations, useLocale } from "next-intl";

import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { weeklyRows, type Week } from "@/lib/hours";

export function StoreHours({ week, timezone }: { week: Week; timezone?: string }) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const rows = weeklyRows(week, new Date(), timezone, locale, { closed: t("closed"), allDay: t("allDay") });
  return (
    <Popover>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Clock className="size-3.5" />
        {t("hours")}
      </PopoverTrigger>
      <PopoverContent
        onClick={(e) => e.stopPropagation()}
        align="start"
        className="w-56 p-3"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("weeklyHours")}
        </p>
        <dl className="space-y-1">
          {rows.map((row) => (
            <div
              key={row.day}
              className={`flex justify-between text-[13px] ${row.isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              <dt>{row.day}</dt>
              <dd className="tabular">{row.hours}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
