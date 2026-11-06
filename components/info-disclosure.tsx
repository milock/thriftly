"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export function InfoDisclosure({ label, children, icon }: { label: string; children: ReactNode; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressFocusUntil = useRef(0);
  const closeLater = () => { clearTimeout(timer.current); timer.current = setTimeout(() => { if (!pinned.current) setOpen(false); }, 350); };
  const preview = () => { clearTimeout(timer.current); setOpen(true); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <Popover open={open} onOpenChange={value => { setOpen(value); if (!value) { pinned.current = false; suppressFocusUntil.current = Date.now() + 400; } }}>
    <PopoverTrigger title={label} aria-label={label} onPointerEnter={e => { if (e.pointerType === "mouse") preview(); }} onPointerLeave={closeLater} onFocus={e => { if (Date.now() >= suppressFocusUntil.current && e.currentTarget.matches(":focus-visible")) preview(); }} onBlur={closeLater} onClick={e => { e.preventBaseUIHandler(); clearTimeout(timer.current); pinned.current = !pinned.current; setOpen(pinned.current); }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {icon ?? <Info className="size-4" aria-hidden />}
    </PopoverTrigger>
    <PopoverContent align="end" onPointerEnter={preview} onPointerLeave={closeLater} onFocus={preview} onBlur={closeLater} className="max-h-[min(var(--available-height),70vh,32rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-4 text-xs leading-relaxed">
      <PopoverTitle className="text-sm">{label}</PopoverTitle>{children}
    </PopoverContent>
  </Popover>;
}
