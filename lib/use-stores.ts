"use client";

import { useCallback, useRef, useState } from "react";
import type { LatLng, ScoredStore, NearestHint } from "@/lib/types";

interface State {
  stores: ScoredStore[];
  loading: boolean;
  error: string | null;
  nearest: NearestHint | null;
}

type Enrichment = Pick<ScoredStore, "neighborhood" | "street" | "locality" | "region">;

export function useStores() {
  const [state, setState] = useState<State>({
    stores: [],
    loading: false,
    error: null,
    nearest: null,
  });
  // Tracks the latest search so a slow response from a superseded search can't
  // overwrite newer results (e.g. fast radius changes or "search this area").
  const reqId = useRef(0);

  // Fill in neighborhood + street addresses after the list has painted. Runs
  // off the critical path so existing names and addresses show immediately.
  const enrich = useCallback(async (stores: ScoredStore[], id: number) => {
    const apply = (enriched?: Record<string, Enrichment>) =>
      setState((s) => {
        if (reqId.current !== id) return s; // a newer search has taken over
        return {
          ...s,
          stores: s.stores.map((st) => {
            const e = enriched?.[`${st.location.lat},${st.location.lon}`];
            if (!e) return { ...st, enriched: true };
            const street = st.street ?? e.street;
            const locality = st.locality ?? e.locality;
            const region = st.region ?? e.region;
            return {
              ...st,
              enriched: true,
              neighborhood: st.neighborhood ?? e.neighborhood,
              street,
              locality,
              region,
              address: [street, locality, region].filter(Boolean).join(", ") || st.address,
            };
          }),
        };
      });
    try {
      const points = stores.slice(0, 60).map((s) => ({ lat: s.location.lat, lon: s.location.lon }));
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
      if (!res.ok) {
        apply(); // keep the existing names and addresses
        return;
      }
      const { enriched } = (await res.json()) as { enriched: Record<string, Enrichment> };
      apply(enriched);
    } catch {
      apply();
    }
  }, []);

  const search = useCallback(
    async (center: LatLng, radiusMiles: number) => {
      const id = ++reqId.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(`/api/stores?lat=${center.lat}&lon=${center.lon}&radius=${radiusMiles}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as { stores: ScoredStore[]; nearest?: NearestHint | null };
        if (reqId.current !== id) return; // superseded
        const stores = data.stores ?? [];
        setState({ stores, loading: false, error: null, nearest: data.nearest ?? null });
        if (stores.length) void enrich(stores, id);
      } catch (e) {
        if (reqId.current !== id) return;
        setState({ stores: [], loading: false, error: (e as Error).message, nearest: null });
      }
    },
    [enrich],
  );

  return { ...state, search };
}
