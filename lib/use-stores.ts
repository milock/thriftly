"use client";

import { useCallback, useState } from "react";
import type { LatLng, ScoredStore } from "@/lib/types";

interface State {
  stores: ScoredStore[];
  loading: boolean;
  error: string | null;
}

export function useStores() {
  const [state, setState] = useState<State>({ stores: [], loading: false, error: null });

  const search = useCallback(async (center: LatLng, radiusMiles: number) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/stores?lat=${center.lat}&lon=${center.lon}&radius=${radiusMiles}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { stores: ScoredStore[] };
      setState({ stores: data.stores ?? [], loading: false, error: null });
    } catch (e) {
      setState({ stores: [], loading: false, error: (e as Error).message });
    }
  }, []);

  return { ...state, search };
}
