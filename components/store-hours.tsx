"use client";

import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { weeklyRows, type Week } from "@/lib/hours";

export function StoreHours({ week }: { week: Week }) {
  const rows = weeklyRows(week);
  return (
    <Popover>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Clock className="size-3.5" />
        Hours
      </PopoverTrigger>
      <PopoverContent
        onClick={(e) => e.stopPropagation()}
        align="start"
        className="w-56 p-3"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Weekly hours
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
