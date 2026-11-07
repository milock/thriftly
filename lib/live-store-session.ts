import type { LatLng, LiveGoogleDetails, ScoredStore } from '@/lib/types';
import { computeVisitScore } from '@/lib/visit-score';
import {hasNeighborhoodBaseline} from '@/lib/scoring';
import {haversineMiles} from '@/lib/distance';
export type LiveStoreState = {status: 'queued' | 'loading' | 'loaded' | 'unavailable'; google?: LiveGoogleDetails};
type FetchDetails = (id: string, signal: AbortSignal) => Promise<LiveGoogleDetails>;
const EMPTY: ReadonlyMap<string, LiveStoreState> = new Map();

/** Current-page memory only. Responses never enter browser or server persistence. */
export class LiveStoreSession {
  private allowed = new Set<string>();
  private records = new Map<string, LiveStoreState>();
  private snapshot: ReadonlyMap<string, LiveStoreState> = EMPTY;
  private serverSnapshot: ReadonlyMap<string, LiveStoreState> = EMPTY;
  private listeners = new Set<() => void>();
  private queue = new Map<string, number>();
  private pending = new Map<string, AbortController>();
  private deadlines = new Map<string, ReturnType<typeof setTimeout>>();
  private commitTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  constructor(private fetchDetails: FetchDetails, private concurrency = 4, seeds: readonly {id: string; google?: LiveGoogleDetails}[] = []) {
    for (const store of seeds) if (store.google) this.records.set(store.id, {status:'loaded', google:store.google});
    this.snapshot = new Map(this.records); this.serverSnapshot = this.snapshot;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.serverSnapshot;
  setStores(ids: readonly string[]) {
    this.disposed = false;
    this.allowed = new Set(ids);
    for (const id of this.records.keys()) if (!this.allowed.has(id)) this.records.delete(id);
    for (const id of this.queue.keys()) if (!this.allowed.has(id)) this.queue.delete(id);
    for (const [id, timer] of this.deadlines) if (!this.allowed.has(id)) { clearTimeout(timer); this.deadlines.delete(id); }
    for (const [id, controller] of this.pending) if (!this.allowed.has(id)) { controller.abort(); this.pending.delete(id); }
    this.commit();
  }
  request = (id: string, priority = 0, retry = false) => {
    if (this.disposed || !this.allowed.has(id)) return;
    const existing = this.records.get(id);
    if (existing?.status === 'loaded' || this.pending.has(id) || (existing?.status === 'unavailable' && !retry)) return;
    this.records.set(id, {status: 'queued'});
    this.queue.set(id, Math.min(priority, this.queue.get(id) ?? Infinity));
    if (!this.deadlines.has(id)) this.deadlines.set(id, setTimeout(() => {
      this.queue.delete(id); this.records.set(id, {status: 'unavailable'});
      this.pending.get(id)?.abort(); this.deadlines.delete(id); this.commit();
    }, 5000));
    this.scheduleCommit(); this.pump();
  };
  private pump() {
    while (!this.disposed && this.pending.size < this.concurrency && this.queue.size) {
      const [id] = [...this.queue.entries()].sort((a, b) => a[1] - b[1])[0];
      this.queue.delete(id);
      const controller = new AbortController();
      this.pending.set(id, controller); this.records.set(id, {status: 'loading'});
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 5000);
      const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true}));
      void Promise.race([this.fetchDetails(id, controller.signal), aborted]).then(google => {
        if (!this.disposed && this.allowed.has(id) && !controller.signal.aborted) this.records.set(id, {status: 'loaded', google});
      }).catch(() => {
        if (!this.disposed && this.allowed.has(id) && (timedOut || !controller.signal.aborted)) this.records.set(id, {status: 'unavailable'});
      }).finally(() => {
        clearTimeout(timer);
        if (this.pending.get(id) === controller) {
          clearTimeout(this.deadlines.get(id)); this.deadlines.delete(id);
          this.pending.delete(id);
        }
        this.scheduleCommit(); this.pump();
      });
    }
  }
  private scheduleCommit() {
    if (this.disposed || this.commitTimer) return;
    // Ratings, score surfaces, filters and ordering change in a single batch.
    this.commitTimer = setTimeout(() => { this.commitTimer = undefined; this.commit(); }, 100);
  }
  private commit() {
    if (this.disposed) return;
    this.snapshot = new Map(this.records); this.listeners.forEach(listener => listener());
  }
  reset() { this.dispose(); this.records.clear(); this.disposed = false; this.commit(); }
  dispose() {
    this.disposed = true; clearTimeout(this.commitTimer); this.commitTimer = undefined;
    this.pending.forEach(controller => controller.abort()); this.pending.clear(); this.queue.clear();
    this.deadlines.forEach(timer => clearTimeout(timer)); this.deadlines.clear();
    for (const [id, record] of this.records) if (record.status === 'loading' || record.status === 'queued') this.records.delete(id);
  }
}
export function withLiveDetails(store: ScoredStore, google?: LiveGoogleDetails, center?: LatLng): ScoredStore {
  if (!google || google.placeId !== store.googlePlaceId) return store;
  const sameLocation = haversineMiles(store.location, google.location) <= 0.12;
  const visit = computeVisitScore({
    neighborhood: sameLocation && hasNeighborhoodBaseline(store.score) ? store.score.baselineTotal ?? store.score.total : null,
    googleRatings: {source: 'google', rating: google.rating, ratingCount: google.ratingCount},
    walkability: sameLocation ? store.score.visit?.components.walkability.value ?? null : null,
  });
  return {...store, google, registryIdentity: {name: store.name, address: store.address || [store.street, store.locality, store.region].filter(Boolean).join(', ')}, name: google.name, address: google.address, location: google.location,
    distanceMiles: center ? haversineMiles(center, google.location) : store.distanceMiles,
    website: google.website ?? store.website, phone: google.phone ?? store.phone, enriched: true,
    score: {...store.score, total: visit.total ?? 0, visit}};
}
