"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, List as ListIcon, Map as MapIcon, ChevronDown } from "lucide-react";
import type { LatLng } from "@/lib/types";
import { useStores } from "@/lib/use-stores";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { LocationSearch } from "@/components/location-search";
import { FilterPanel } from "@/components/filter-panel";
import { StoreList } from "@/components/store-list";
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

export default function AppPage() {
  const [center, setCenter] = useState<LatLng>(SAN_DIEGO);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [areaLabel, setAreaLabel] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const { stores, loading, error, search } = useStores();
  const isDesktop = useIsDesktop();

  // On first load: honor a deep link (?lat&lon[&radius][&label]) coming from a
  // city landing page; otherwise center on the visitor's actual location
  // (which itself falls back to the default).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
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
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelectedId(null);
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    search(center, filters.radiusMiles);
  }, [center, filters.radiusMiles, search]);

  // Mirror the current view into the URL (shallow replace, no reload) so the
  // page is shareable: opening the link restores the same location, radius, and
  // selected store. The mount effect above reads these same params back.
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("lat", center.lat.toFixed(5));
    p.set("lon", center.lon.toFixed(5));
    p.set("radius", String(filters.radiusMiles));
    if (areaLabel) p.set("label", areaLabel);
    if (selectedId) p.set("sel", selectedId);
    window.history.replaceState(null, "", `/search?${p.toString()}`);
  }, [center, filters.radiusMiles, areaLabel, selectedId]);

  // Reverse-geocode the search center to show a friendly "near {place}" label.
  useEffect(() => {
    let active = true;
    fetch(`/api/reverse?lat=${center.lat}&lon=${center.lon}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) setAreaLabel(d.label);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [center]);

  const visible = useMemo(() => applyFilters(stores, filters), [stores, filters]);

  const relocate = (c: LatLng) => {
    setCenter(c);
    setSelectedId(null);
  };

  const resultLine = loading
    ? "Searching nearby…"
    : `${visible.length} store${visible.length === 1 ? "" : "s"} ranked${
        areaLabel ? ` near ${areaLabel}` : ""
      }`;

  const list = (
    <StoreList
      stores={visible}
      loading={loading}
      error={error}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  );
  const map = (
    <StoreMap
      center={center}
      radiusMiles={filters.radiusMiles}
      stores={visible}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onSearchArea={relocate}
    />
  );

  return (
    <div className="flex h-dvh flex-col">
      <header className="relative z-30 shrink-0 border-b bg-background/85 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Wordmark />
          <div className="hidden flex-1 justify-center px-6 lg:flex">
            <LocationSearch onLocate={relocate} className="w-full max-w-md" />
          </div>
          <div className="flex items-center gap-0.5">
            <Methodology />
            <GithubLink />
            <CoffeeLink />
            <ThemeToggle />
          </div>
        </div>
        {!isDesktop && (
          <div className="px-4 pb-3 sm:px-5">
            <LocationSearch onLocate={relocate} />
          </div>
        )}
      </header>

      {isDesktop ? (
        <div className="grid min-h-0 flex-1 grid-cols-[400px_1fr]">
          <aside className="flex min-h-0 flex-col border-r">
            <div className="border-b">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                className="flex w-full items-center justify-between px-5 py-3 text-[13px] font-medium transition-colors hover:bg-accent/50"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <SlidersHorizontal className="size-3.5" />
                  Filters
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200",
                    filtersOpen ? "rotate-180" : "",
                  )}
                />
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-5">
                    <FilterPanel filters={filters} onChange={setFilters} />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-b px-5 py-2.5">
              <span className="text-[13px] font-medium text-muted-foreground">{resultLine}</span>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">{list}</div>
          </aside>
          <div className="relative min-h-0">{map}</div>
        </div>
      ) : (
        <Tabs defaultValue="list" className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <Sheet>
              <SheetTrigger
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 gap-1.5 px-3")}
              >
                <SlidersHorizontal className="size-4" />
                Filters
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-8">
                  <FilterPanel filters={filters} onChange={setFilters} />
                </div>
              </SheetContent>
            </Sheet>
            <span className="text-[12px] text-muted-foreground">{resultLine}</span>
            <TabsList className="h-9">
              <TabsTrigger value="list" className="gap-1.5 text-xs">
                <ListIcon className="size-3.5" />
                List
              </TabsTrigger>
              <TabsTrigger value="map" className="gap-1.5 text-xs">
                <MapIcon className="size-3.5" />
                Map
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="list" className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
            {list}
          </TabsContent>
          <TabsContent value="map" className="min-h-0 flex-1">
            {map}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
