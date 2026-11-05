"use client";

import { useTranslations } from "next-intl";

import { useEffect, useRef, useState, useId } from "react";
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
  const t = useTranslations("ui");
  const listId = useId();
  const [error, setError] = useState<string | null>(null);
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
  useEffect(() => { biasRef.current = bias; }, [bias]);

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
    if (q.length < 3) return;
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
    setError(null);
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
    setError(null);
    try {
      const location = await geocodeAddress(query, bias);
      if (location) onLocate(location);
      else setError(t("geocodeError"));
    } catch {
      setError(t("geocodeError"));
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
    if (e.key === "Escape") { setOpen(false); return; }
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
    if (!navigator.geolocation) { setError(t("locationError")); return; }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocate({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => { setLocating(false); setError(t("locationError")); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <form onSubmit={onSubmit} className={`relative flex items-center gap-2 ${className ?? ""}`}>
      <div className="min-w-0 flex-1">
        <div className="relative">
        {loading ? (
          <LoaderCircle className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            const usable = value.trim().length >= 3;
            setLoading(usable);
            setOpen(usable);
            if (!usable) setSuggestions([]);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => query.trim().length >= 3 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={t("zip")}
          aria-label={t("searchAddress")}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          className="h-11 ps-9 pe-3 text-base"
        />
        </div>
        {open && query.trim().length >= 3 && (
          <ul id={listId} role="listbox" aria-label={t("searchAddress")} className="animate-in fade-in slide-in-from-top-1 absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-[min(20rem,50dvh)] overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-lg duration-150">
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();

                    }}
                    onClick={() => choose(s)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 py-2 text-start text-[13px] transition-colors ${
                      i === active ? "bg-accent" : ""
                    }`}
                  >
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 break-words leading-relaxed">{s.label}</span>
                </li>
              ))
            ) : (
              <li className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground">
                {loading ? (
                  <>
                    <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
                    {t("searching")}
                  </>
                ) : (
                  <>
                    <MapPin className="size-3.5 shrink-0" />
                    {t("noMatches")}
                  </>
                )}
              </li>
            )}
          </ul>
        )}
      </div>
      <Button type="submit" aria-label={t("search")} disabled={busy} className="size-11 shrink-0 p-0 sm:w-auto sm:px-4">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <><Search className="size-4 sm:hidden" /><span className="hidden sm:inline">{t("search")}</span></>}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={useMyLocation}
        disabled={locating}
        title={t("myLocation")}
        aria-label={t("myLocation")}
        className="size-11 shrink-0"
      >
        {locating ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
      </Button>
      {error && <p role="alert" className="absolute inset-x-0 top-full z-50 mt-1 rounded-md border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md">{error}</p>}
    </form>
  );
}
