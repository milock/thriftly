'use client';
import {createContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {LiveStoreSession, withLiveDetails, type LiveStoreState} from '@/lib/live-store-session';
import type {LatLng, LiveGoogleDetails, ScoredStore} from '@/lib/types';
export interface LiveStoresContextValue {
  records: ReadonlyMap<string, LiveStoreState>;
  request: (id: string, priority?: number, retry?: boolean) => void;
}
export const LiveStoresContext = createContext<LiveStoresContextValue | null>(null);
async function fetchDetails(storeId: string, signal: AbortSignal): Promise<LiveGoogleDetails> {
  const response = await fetch('/api/store-details', {method: 'POST', cache: 'no-store', signal,
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify({storeId})});
  if (!response.ok) throw new Error('details unavailable');
  const payload = await response.json();
  if (payload.storeId !== storeId || !payload.google) throw new Error('invalid details');
  return payload.google as LiveGoogleDetails;
}
export function useLiveStores(stores: ScoredStore[], selectedId?: string | null, center?: LatLng, radiusMiles?: number, refreshKey = 0) {
  const [session] = useState(() => new LiveStoreSession(fetchDetails, 4, stores.filter(store => store.google?.placeId === store.googlePlaceId)));
  const records = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  const priorRefresh = useRef(refreshKey);
  useEffect(() => { if (priorRefresh.current !== refreshKey) { priorRefresh.current = refreshKey; session.reset(); } }, [session, refreshKey]);
  useEffect(() => {
    session.setStores(stores.filter(store => store.googlePlaceId).map(store => store.id));
    if (selectedId) session.request(selectedId, -1);
    stores.slice(0, 6).forEach(store => session.request(store.id, 1));
    stores.slice(6, 18).forEach(store => session.request(store.id, 2));
  }, [stores, selectedId, session, refreshKey]);
  useEffect(() => () => session.dispose(), [session]);
  const lat = center?.lat, lon = center?.lon;
  const live = useMemo(() => stores.map(store => withLiveDetails(store, records.get(store.id)?.google, lat !== undefined && lon !== undefined ? {lat, lon} : undefined))
    .filter(store => store.google?.businessStatus !== 'CLOSED_PERMANENTLY' && (radiusMiles === undefined || store.distanceMiles <= radiusMiles)), [stores, records, lat, lon, radiusMiles]);
  const context = useMemo(() => ({records, request: session.request}), [records, session]);
  return {stores: live, context};
}
