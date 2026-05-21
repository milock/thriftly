"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { LatLng } from "@/lib/types";
import { useStores } from "@/lib/use-stores";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { LocationSearch } from "@/components/location-search";
import { FilterPanel } from "@/components/filter-panel";
import { StoreList } from "@/components/store-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const StoreMap = dynamic(() => import("@/components/map/store-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-muted" />,
});

const SAN_DIEGO: LatLng = { lat: 32.7157, lon: -117.1611 };

export default function Home() {
  const [center, setCenter] = useState<LatLng>(SAN_DIEGO);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { stores, loading, error, search } = useStores();

  useEffect(() => {
    search(center, filters.radiusMiles);
  }, [center, filters.radiusMiles, search]);

  const visible = useMemo(() => applyFilters(stores, filters), [stores, filters]);

  return (
    <main className="mx-auto flex h-screen max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Goodwill Locator</h1>
        <LocationSearch onLocate={setCenter} />
      </header>

      <p className="text-xs text-muted-foreground">
        Goods Score blends nearby census-tract affluence (home value, income, education, rent).
        Store coverage comes from OpenStreetMap and may be incomplete. It estimates donation quality, not inventory.
      </p>

      {/* Desktop: filters + list | map */}
      <div className="hidden min-h-0 flex-1 gap-4 lg:grid lg:grid-cols-[380px_1fr]">
        <div className="flex min-h-0 flex-col gap-4">
          <FilterPanel filters={filters} onChange={setFilters} />
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <StoreList stores={visible} loading={loading} error={error} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
        <div className="min-h-0">
          <StoreMap center={center} stores={visible} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      {/* Mobile: tabs */}
      <div className="min-h-0 flex-1 lg:hidden">
        <Tabs defaultValue="list" className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>
          <TabsContent value="filters"><FilterPanel filters={filters} onChange={setFilters} /></TabsContent>
          <TabsContent value="list" className="min-h-0 flex-1 overflow-y-auto">
            <StoreList stores={visible} loading={loading} error={error} selectedId={selectedId} onSelect={setSelectedId} />
          </TabsContent>
          <TabsContent value="map" className="min-h-0 flex-1">
            <StoreMap center={center} stores={visible} selectedId={selectedId} onSelect={setSelectedId} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
