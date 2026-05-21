"use client";

import { useCallback, useRef, useState } from "react";
import type { LatLng, ScoredStore } from "@/lib/types";

interface State {
  stores: ScoredStore[];
  loading: boolean;
  error: string | null;
}

type Enrichment = Pick<ScoredStore, "neighborhood" | "street" | "locality" | "region">;

export function useStores() {
  const [state, setState] = useState<State>({ stores: [], loading: false, error: null });
  // Tracks the latest search so a slow response from a superseded search can't
  // overwrite newer results (e.g. fast radius changes or "search this area").
  const reqId = useRef(0);

  // Fill in neighborhood + street addresses after the list has painted. Runs
  // off the critical path so results show immediately; cards update when it
  // returns. Silently no-ops on failure (cards keep their OSM data).
  const enrich = useCallback(async (stores: ScoredStore[], id: number) => {
    try {
      const points = stores.map((s) => ({ lat: s.location.lat, lon: s.location.lon }));
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
      if (!res.ok) return;
      const { enriched } = (await res.json()) as { enriched: Record<string, Enrichment> };
      if (reqId.current !== id) return; // a newer search has taken over
      setState((s) => ({
        ...s,
        stores: s.stores.map((st) => {
          const e = enriched[`${st.location.lat},${st.location.lon}`];
          if (!e) return st;
          const street = st.street ?? e.street;
          const locality = st.locality ?? e.locality;
          const region = st.region ?? e.region;
          return {
            ...st,
            neighborhood: st.neighborhood ?? e.neighborhood,
            street,
            locality,
            region,
            address: [street, locality, region].filter(Boolean).join(", ") || st.address,
          };
        }),
      }));
    } catch {
      // ignore: enrichment is best-effort
    }
  }, []);

  const search = useCallback(
    async (center: LatLng, radiusMiles: number) => {
      const id = ++reqId.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(`/api/stores?lat=${center.lat}&lon=${center.lon}&radius=${radiusMiles}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as { stores: ScoredStore[] };
        if (reqId.current !== id) return; // superseded
        const stores = data.stores ?? [];
        setState({ stores, loading: false, error: null });
        if (stores.length) void enrich(stores, id);
      } catch (e) {
        if (reqId.current !== id) return;
        setState({ stores: [], loading: false, error: (e as Error).message });
      }
    },
    [enrich],
  );

  return { ...state, search };
}
