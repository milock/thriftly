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
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const skipNext = useRef(false);
  // Read the latest bias at fetch time without making it an effect dependency —
  // otherwise the map center moving (which it does after every search) would
  // re-fire the typeahead and reopen the panel on a settled query.
  const biasRef = useRef(bias);
  biasRef.current = bias;

  // Debounced live suggestions. Opens the panel and shows a loading state the
  // instant a usable query is typed, so the few-hundred-ms Photon round trip
  // reads as "working" rather than "broken". Prior matches stay on screen while
  // the next request resolves (no flicker).
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const results = await suggestPlaces(q, biasRef.current, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setSuggestions(results);
      setActive(-1);
      setLoading(false);
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  function choose(s: Suggestion) {
    skipNext.current = true;
    setQuery(s.label);
    setSuggestions([]);
    setLoading(false);
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
        {loading ? (
          <LoaderCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => query.trim().length >= 3 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="ZIP code or address"
          aria-label="Search by ZIP code or address"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          className="h-10 pl-9 pr-3"
        />
        {open && query.trim().length >= 3 && (
          <ul className="animate-in fade-in slide-in-from-top-1 absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg duration-150">
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => (
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
              ))
            ) : (
              <li className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground">
                {loading ? (
                  <>
                    <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
                    Searching…
                  </>
                ) : (
                  <>
                    <MapPin className="size-3.5 shrink-0" />
                    No matches — try a ZIP or “City, ST”
                  </>
                )}
              </li>
            )}
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
