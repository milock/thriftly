"use client";

import { useEffect, useRef, useState } from "react";
import { Search, LocateFixed, LoaderCircle, MapPin } from "lucide-react";
import type { LatLng } from "@/lib/types";
import { suggestPlaces, geocodeAddress, type PlaceSuggestion } from "@/lib/geocode-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Suggestion = PlaceSuggestion;

interface Props {
  onLocate: (c: LatLng) => void;
  /** Current map center; biases typeahead + geocoding toward the user's area. */
  bias?: LatLng;
  className?: string;
}

export function LocationSearch({ onLocate, bias, className }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const skipNext = useRef(false);

  // Debounced live suggestions.
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const results = await suggestPlaces(q, bias, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setSuggestions(results);
      setActive(-1);
      setOpen(results.length > 0);
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, bias]);

  function choose(s: Suggestion) {
    skipNext.current = true;
    setQuery(s.label);
    setSuggestions([]);
    setOpen(false);
    onLocate({ lat: s.lat, lon: s.lon });
  }

  async function geocodeRaw() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const location = await geocodeAddress(query, bias);
      if (location) onLocate(location);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (active >= 0 && suggestions[active]) choose(suggestions[active]);
    else geocodeRaw();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocate({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <form onSubmit={onSubmit} className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="ZIP code or address"
          aria-label="Search by ZIP code or address"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          className="h-10 pl-9 pr-3"
        />
        {open && suggestions.length > 0 && (
          <ul className="animate-in fade-in slide-in-from-top-1 absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg duration-150">
            {suggestions.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(s);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                    i === active ? "bg-accent" : ""
                  }`}
                >
                  <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button type="submit" disabled={busy} className="h-10 shrink-0">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : "Search"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={useMyLocation}
        disabled={locating}
        title="Use my location"
        aria-label="Use my location"
        className="size-10 shrink-0"
      >
        {locating ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
      </Button>
    </form>
  );
}
