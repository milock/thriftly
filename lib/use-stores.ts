"use client";
import {useCallback, useEffect, useRef, useState} from 'react';
import type {LatLng, ScoredStore, NearestHint} from '@/lib/types';
import {storeSearchKey, type InitialSearchQuery} from '@/lib/search-query';
interface State {stores: ScoredStore[]; loading: boolean; error: string | null; nearest: NearestHint | null}
interface InitialStores {stores: ScoredStore[]; query: InitialSearchQuery | null; nearest?: NearestHint | null}
export function useStores(initial?: InitialStores) {
  const [state, setState] = useState<State>(() => ({stores: initial?.stores ?? [], loading: false, error: null, nearest: initial?.nearest ?? null}));
  const loadedQuery = useRef(initial?.query ? storeSearchKey(initial.query.center, initial.query.filters.radiusMiles, initial.query.filters.brandIds) : null);
  const pending = useRef<AbortController | null>(null);
  const pendingQuery = useRef<string | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const search = useCallback(async (center: LatLng, radiusMiles: number, brandIds: readonly string[] = [], force = false) => {
    const key = storeSearchKey(center, radiusMiles, brandIds);
    if (!force && key === loadedQuery.current) {
      if (pending.current) {
        pending.current.abort(); pending.current = null; pendingQuery.current = null;
        setState(s => ({...s, loading: false}));
      }
      return;
    }
    if (!force && key === pendingQuery.current) return;
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller; pendingQuery.current = key;
    setState(s => ({...s, loading: true, error: null}));
    try {
      const response = await fetch(`/api/stores?lat=${center.lat}&lon=${center.lon}&radius=${radiusMiles}&brands=${encodeURIComponent(brandIds.join(','))}`, {signal: controller.signal});
      if (!response.ok) throw new Error('Search unavailable');
      const data = await response.json() as {stores: ScoredStore[]; nearest?: NearestHint | null};
      if (controller.signal.aborted) return;
      loadedQuery.current = key;
      setState({stores: data.stores ?? [], loading: false, error: null, nearest: data.nearest ?? null});
    } catch {
      if (!controller.signal.aborted) setState(s => ({...s, loading: false, error: 'Search unavailable'}));
    } finally {
      if (pending.current === controller) {pending.current = null; pendingQuery.current = null;}
    }
  }, []);
  return {...state, search};
}
