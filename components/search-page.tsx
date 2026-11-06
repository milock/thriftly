"use client";

import { useTranslations, useLocale } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, List as ListIcon, Map as MapIcon, ChevronDown, ArrowRight } from "lucide-react";
import type { LatLng, ScoredStore, NearestHint } from "@/lib/types";
import { parseStoreFilterIds } from "@/lib/brands";
import { MapBoundary } from "@/components/map/map-boundary";
import { useStores } from "@/lib/use-stores";
import type {InitialSearchQuery} from "@/lib/search-query";
import { useLiveStores, LiveStoresContext } from "@/lib/use-live-stores";
import { formatDistance } from "@/lib/format";
import {storeOpenNow} from "@/lib/store-status";
import { applyFilters, parseDepartments, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { LocationSearch } from "@/components/location-search";
import { reverseLabel } from "@/lib/geocode-client";
import { FilterPanel } from "@/components/filter-panel";
import { resolveSelectedStoreId } from "@/components/store-selection";
import { StoreList } from "@/components/store-list";
import { AddToOsm } from "@/components/add-to-osm";
import { Methodology } from "@/components/methodology";
import { ThemeToggle } from "@/components/theme-toggle";
import { CoffeeLink } from "@/components/coffee-link";
import { GithubLink } from "@/components/github-link";
import { Wordmark } from "@/components/wordmark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const StoreMap = dynamic(() => import("@/components/map/store-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

const SAN_DIEGO: LatLng = { lat: 32.7157, lon: -117.1611 };

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

interface Props {
  initialStores?: ScoredStore[];
  initialQuery?: InitialSearchQuery | null;
  initialNearest?: NearestHint | null;
}
export default function SearchPage({initialStores = [], initialQuery = null, initialNearest = null}: Props) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [initialized, setInitialized] = useState(!!initialQuery);
  const [center, setCenter] = useState<LatLng>(initialQuery?.center ?? SAN_DIEGO);
  const [filters, setFilters] = useState<Filters>(initialQuery?.filters ?? DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(initialQuery?.selectedId ?? null);
  const [areaLabel, setAreaLabel] = useState<string | null>(initialQuery?.label ?? null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Briefly nudge the Filters caret on first load so it's discoverable while
  // collapsed; clears on a timer or as soon as the user opens the panel.
  const [caretHint, setCaretHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setCaretHint(false), 2600);
    return () => clearTimeout(t);
  }, []);
  const { stores: registryStores, loading, error, nearest, search } = useStores({stores: initialStores, query: initialQuery, nearest: initialNearest});
  const live = useLiveStores(registryStores, selectedId, center, filters.radiusMiles);
  const stores = live.stores;
  const isDesktop = useIsDesktop();
  const visible = useMemo(() => applyFilters(stores, filters), [stores, filters]);
  const canonicalSelectedId = resolveSelectedStoreId(visible, selectedId);

  // On first load: honor a deep link (?lat&lon[&radius][&label]) coming from a
  // city landing page; otherwise center on the visitor's actual location
  // (which itself falls back to the default).
  useEffect(() => {
    if (initialQuery) return;
    // Read once after hydration; defer updates to avoid a synchronous effect cascade.
    const initialSearch = window.location.search;
    const timer = setTimeout(() => {
    setInitialized(true);
    const p = new URLSearchParams(initialSearch);
    const minScore = Number(p.get("minScore") ?? 0);
    const sort = p.get("sort");
    setFilters(f => ({...f, brandIds: parseStoreFilterIds(p.get("brands")), departments: parseDepartments(p.get("departments")), minScore: Number.isFinite(minScore) ? Math.max(0, Math.min(100, minScore)) : 0, openNowOnly: p.get("open") === "1", sort: sort === "distance" || sort === "best-nearby" ? sort : "score"}));
    const qlat = parseFloat(p.get("lat") ?? "");
    const qlon = parseFloat(p.get("lon") ?? "");
    if (
      Number.isFinite(qlat) && Number.isFinite(qlon) &&
      qlat >= -90 && qlat <= 90 && qlon >= -180 && qlon <= 180
    ) {
      const qradius = parseFloat(p.get("radius") ?? "");
      const label = p.get("label");
      const sel = p.get("sel");
      if (Number.isFinite(qradius)) {
        setFilters((f) => ({ ...f, radiusMiles: Math.min(100, Math.max(0.5, qradius)) }));
      }
      if (label) setAreaLabel(label);
      if (sel) setSelectedId(sel);
      setCenter({ lat: qlat, lon: qlon });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) { setLocationUnavailable(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelectedId(null);
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setLocationUnavailable(true),
      { enableHighAccuracy: true, timeout: 8000 },
    );
    }, 0);
    return () => clearTimeout(timer);
  }, [initialQuery]);

  useEffect(() => {
    if (initialized) search(center, filters.radiusMiles, filters.brandIds);
  }, [initialized, center, filters.radiusMiles, filters.brandIds, search]);

  // Mirror the current view into the URL (shallow replace, no reload) so the
  // page is shareable: opening the link restores the same location, radius, and
  // selected store. The mount effect above reads these same params back.
  useEffect(() => {
    if (!initialized) return;
    const p = new URLSearchParams();
    p.set("lat", center.lat.toFixed(5));
    p.set("lon", center.lon.toFixed(5));
    p.set("radius", String(filters.radiusMiles));
    if (filters.departments.length) p.set("departments", filters.departments.join(","));
    if (filters.brandIds.length) p.set("brands", filters.brandIds.join(","));
    if (filters.minScore) p.set("minScore", String(filters.minScore));
    if (filters.openNowOnly) p.set("open", "1");
    if (filters.sort !== "score") p.set("sort", filters.sort);
    if (areaLabel) p.set("label", areaLabel);
    if (canonicalSelectedId) p.set("sel", canonicalSelectedId);
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}${window.location.hash}`);
  }, [initialized, center, filters, areaLabel, canonicalSelectedId]);

  // Reverse-geocode the search center to show a friendly "near {place}" label.
  useEffect(() => {
    if (!initialized) return;
    let active = true;
    reverseLabel(center.lat, center.lon).then((label) => {
      if (active && label) setAreaLabel(label);
    });
    return () => {
      active = false;
    };
  }, [initialized, center]);

  const relocate = (c: LatLng) => {
    setLocationUnavailable(false);
    setCenter(c);
    setSelectedId(null);
  };

  const filterCount = Number(filters.departments.length > 0) + Number(filters.brandIds.length > 0) + Number(filters.minScore > 0) + Number(filters.openNowOnly) + Number(filters.sort !== "score") + Number(filters.radiusMiles !== DEFAULT_FILTERS.radiusMiles);
  const hoursAvailable = stores.some(s => storeOpenNow(s) !== null);
  const resetFilters = () => setFilters({...DEFAULT_FILTERS, radiusMiles: filters.radiusMiles});
  const resultLine = loading ? t("searchNearby") : areaLabel ? t("resultsNear", { count: visible.length, place: areaLabel }) : t("results", { count: visible.length });

  // Only surface the "nearest is N mi away" hint when the search genuinely found
  // nothing in range — not when the user's own filters (min score) hid the
  // results. The API only returns `nearest` when it found zero stores, so this
  // also requires the unfiltered set to be empty.
  const expandToNearest = () => {
    if (!nearest) return;
    setFilters((f) => ({ ...f, radiusMiles: Math.min(100, Math.ceil(nearest.distanceMiles)) }));
  };
  const list = (
    <>
      <StoreList
        stores={visible}
        loading={loading}
        error={error}
        selectedId={canonicalSelectedId}
        onSelect={setSelectedId}
        nearest={stores.length === 0 ? nearest : null}
        onExpand={expandToNearest}
        filteredOut={stores.length > 0}
        onReset={resetFilters}
        onRetry={() => search(center, filters.radiusMiles, filters.brandIds, true)}
      />
      {!loading && (
        <div className="px-1 pt-4">
          <AddToOsm lat={center.lat} lon={center.lon} />
        </div>
      )}
    </>
  );
  const map = (
    <MapBoundary><StoreMap
      center={center}
      radiusMiles={filters.radiusMiles}
      stores={visible}
      selectedId={canonicalSelectedId}
      onSelect={setSelectedId}
      onSearchArea={relocate}
    /></MapBoundary>
  );

  return (
    <LiveStoresContext.Provider value={live.context}>
    <div className="flex h-dvh flex-col">
      <header className="search-header relative z-30 shrink-0 border-b bg-background">
        <div className="search-header-row site-gutter flex items-center justify-between gap-2 py-2">
          <Wordmark />
          <div className="hidden flex-1 justify-center px-6 lg:flex">
            <LocationSearch onLocate={relocate} bias={center} className="w-full max-w-md" />
          </div>
          <div className="search-utilities flex items-center gap-0.5">
            <Methodology />
            <LanguageSwitcher />
            <GithubLink className="hidden lg:inline-flex" />
            <CoffeeLink className="hidden lg:inline-flex" />
            <ThemeToggle />
          </div>
        </div>
        {!isDesktop && (
          <div className="search-mobile-location site-gutter pb-3">
            <LocationSearch onLocate={relocate} bias={center} />
          </div>
        )}
      </header>

      {locationUnavailable && <p role="status" className="border-b bg-muted px-4 py-2 text-sm">{t("locationFallback")}</p>}
      <main id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">{t("searchAddress")}</h1>
      {isDesktop ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(360px,30%)_1fr]">
          <aside className="flex min-h-0 flex-col border-e">
            <div className="border-b">
              <button
                type="button"
                onClick={() => {
                  setFiltersOpen((v) => !v);
                  setCaretHint(false);
                }}
                aria-expanded={filtersOpen}
                aria-controls="desktop-filters"
                className="flex w-full items-center justify-between px-5 py-2.5 text-[13px] font-medium transition-colors hover:bg-accent/50"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <SlidersHorizontal className="size-3.5" />
                  {t("filters")}{filterCount > 0 && <span className="tabular ms-1">({filterCount})</span>}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200",
                    filtersOpen ? "rotate-180" : "",
                    caretHint && !filtersOpen ? "animate-caret-hint text-foreground" : "",
                  )}
                />
              </button>
              <div id="desktop-filters" inert={!filtersOpen} aria-hidden={!filtersOpen}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="max-h-[42dvh] overflow-y-auto overscroll-contain px-5 pb-4 pt-1">
                    <FilterPanel filters={filters} onChange={setFilters} hoursAvailable={hoursAvailable} />
                    {filterCount > 0 && <button type="button" className="mt-3 min-h-11 text-sm font-medium underline underline-offset-4" onClick={() => setFilters(DEFAULT_FILTERS)}>{t("resetFilters")}</button>}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-b px-5 py-2.5">
              <p role="status" aria-live="polite" className="text-sm font-medium">{resultLine}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t(filters.sort)} · {formatDistance(filters.radiusMiles, locale)}</p>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">{list}</div>
          </aside>
          <div className="relative min-h-0">{map}</div>
        </div>
      ) : (
        <Tabs defaultValue="list" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="search-result-summary site-gutter shrink-0 border-b py-2.5">
            <p role="status" aria-live="polite" className="text-sm font-medium">{resultLine}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t(filters.sort)} · {formatDistance(filters.radiusMiles, locale)}</p>
          </div>
          <TabsContent value="list" className="search-list-panel scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
            {list}
          </TabsContent>
          <TabsContent value="map" className="min-h-0 flex-1">
            {map}
          </TabsContent>
          <div data-mobile-toolbar className="site-gutter flex shrink-0 items-center gap-3 border-t bg-background pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
            <TabsList className="h-auto min-h-12 flex-1 p-1">
              <TabsTrigger value="list" className="min-h-11 gap-2 text-sm">
                <ListIcon className="size-4" />
                {t("list")}
              </TabsTrigger>
              <TabsTrigger value="map" className="min-h-11 gap-2 text-sm">
                <MapIcon className="size-4" />
                {t("map")}
              </TabsTrigger>
            </TabsList>
            <Sheet>
              <SheetTrigger
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-12 gap-1.5 px-3")}
              >
                <SlidersHorizontal className="size-4" />
                {t("filters")}{filterCount > 0 && <span className="tabular ms-1">({filterCount})</span>}
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[90dvh] gap-0 overflow-hidden rounded-t-2xl">
                <SheetHeader className="shrink-0 border-b py-5 pe-16">
                  <SheetTitle>{t("filters")}{filterCount > 0 && <span className="tabular ms-1">({filterCount})</span>}</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5">
                  <FilterPanel filters={filters} onChange={setFilters} hoursAvailable={hoursAvailable} />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {filterCount > 0 && <button type="button" className="min-h-11 px-2 text-sm font-medium underline underline-offset-4" onClick={() => setFilters(DEFAULT_FILTERS)}>{t("resetFilters")}</button>}
                  <SheetClose className={cn(buttonVariants(), "ms-auto min-h-12 h-auto flex-1 gap-2 whitespace-normal py-3")}>
                    {t("showResults", {count: visible.length})}<ArrowRight className="size-4 shrink-0 rtl:rotate-180" />
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </Tabs>
      )}
      </main>
    </div>
    </LiveStoresContext.Provider>
  );
}
