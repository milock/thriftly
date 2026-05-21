"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, List as ListIcon, Map as MapIcon } from "lucide-react";
import type { LatLng } from "@/lib/types";
import { useStores } from "@/lib/use-stores";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { LocationSearch } from "@/components/location-search";
import { FilterPanel } from "@/components/filter-panel";
import { StoreList } from "@/components/store-list";
import { Methodology } from "@/components/methodology";
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
  const [located, setLocated] = useState(false);
  const { stores, loading, error, search } = useStores();
  const isDesktop = useIsDesktop();

  // On first load, center on the visitor's actual location (falls back to the default).
  useEffect(() => {
    if (located || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocated(true);
        setSelectedId(null);
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setLocated(true),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [located]);

  useEffect(() => {
    search(center, filters.radiusMiles);
  }, [center, filters.radiusMiles, search]);

  const visible = useMemo(() => applyFilters(stores, filters), [stores, filters]);

  const relocate = (c: LatLng) => {
    setCenter(c);
    setSelectedId(null);
  };

  const resultLine = loading
    ? "Searching nearby…"
    : `${visible.length} store${visible.length === 1 ? "" : "s"} ranked`;

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
    />
  );

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-20 shrink-0 border-b bg-background/85 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Wordmark />
          <div className="hidden flex-1 justify-center px-6 lg:flex">
            <LocationSearch onLocate={relocate} className="w-full max-w-md" />
          </div>
          <Methodology />
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
            <div className="border-b p-5">
              <FilterPanel filters={filters} onChange={setFilters} />
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
