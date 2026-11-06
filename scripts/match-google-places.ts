/** Offline, resumable matching. Saves only IDs and our independent review decisions. */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { allCandidateStores } from '../lib/locate';
import { findGooglePlaceMatch, type GoogleMatchDecision } from '../lib/google-places';
import { confirmedPlaceIds, listingIdentityFingerprint, parseGooglePlaceRegistry, type GooglePlaceRegistry, type GooglePlaceConfirmation } from '../lib/google-place-registry';
import { haversineMiles } from '../lib/distance';
import type { Store } from '../lib/types';

export interface Decision {storeId: string; identityFingerprint: string; checkedAt: string; reason: string; preservedConfirmation?: boolean}
const registryPath = resolve('data/google-place-ids.json');
const auditPath = resolve('data/provenance/google-place-match-review.json');
function readJson(path: string): unknown {
  if (!existsSync(path)) return null;
  // A corrupt or unreadable existing registry must never be replaced with an empty one.
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function atomicJson(path: string, value: unknown) {
  mkdirSync(dirname(path), {recursive: true});
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  renameSync(temp, path);
}

export async function matchRegistry(stores: readonly Store[], initial: GooglePlaceRegistry, lookup: (store: Store) => Promise<GoogleMatchDecision>, save: (registry: GooglePlaceRegistry, decisions: Decision[], completed: number) => void, refresh = false) {
  // Keep previous confirmations across network failures. Changed fingerprints remain
  // safely unpublished until a fresh match succeeds; an outage never destroys them.
  const rows = new Map(initial.records.map(row => [row.storeId, row]));
  const confirmed = confirmedPlaceIds(stores, initial);
  const targets = stores.filter(store => refresh || !confirmed.has(store.id));
  const decisions: Decision[] = [];
  let next = 0;
  let completed = 0;
  const snapshot = () => ({version: 1 as const, records: [...rows.values()].sort((a, b) => a.storeId.localeCompare(b.storeId))});
  await Promise.all(Array.from({length: Math.min(6, targets.length)}, async () => {
    while (next < targets.length) {
      const store = targets[next++];
      const checkedAt = new Date().toISOString();
      const identityFingerprint = listingIdentityFingerprint(store);
      let result: GoogleMatchDecision | undefined;
      let error = 'lookup_unavailable';
      for (let attempt = 0; attempt < 2; attempt++) {
        try { result = await lookup(store); break; }
        catch (issue) {
          error = issue instanceof Error && /^lookup_http_\d{3}$/.test(issue.message) ? issue.message : 'lookup_unavailable';
          if (error === 'lookup_http_400' || error === 'lookup_http_401' || error === 'lookup_http_403') break;
        }
      }
      if (result?.placeId) rows.set(store.id, {storeId: store.id, placeId: result.placeId, identityFingerprint, checkedAt});
      else if (result?.reason === 'closed' || result?.reason === 'ambiguous') rows.delete(store.id);
      decisions.push({storeId: store.id, identityFingerprint, checkedAt, reason: result?.reason ?? error, ...(!result?.placeId && rows.has(store.id) ? {preservedConfirmation: true} : {})});
      completed++;
      if (completed % 20 === 0) save(snapshot(), decisions, completed);
    }
  }));
  const registry = snapshot();
  save(registry, decisions, completed);
  return {registry, decisions};
}

/** Unchanged holds stay held; valid IDs are refreshed only after twelve months. */
export function shouldReviewGoogleIdentity(store: Store, confirmation: GooglePlaceConfirmation | undefined, previous: Decision | undefined, now = new Date()): boolean {
  const fingerprint = listingIdentityFingerprint(store);
  if (confirmation?.identityFingerprint === fingerprint) {
    const cutoff = new Date(now);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    return Date.parse(confirmation.checkedAt) < cutoff.getTime();
  }
  return !previous || previous.identityFingerprint !== fingerprint || previous.reason === 'confirmed' || previous.reason.startsWith('lookup_');
}

async function main() {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex === -1 ? Infinity : Number(args[limitIndex + 1]);
  if (!(limit > 0)) throw new Error('Invalid limit');
  const filterIndex = args.indexOf('--store-id');
  const storeIds = filterIndex === -1 ? null : new Set((args[filterIndex + 1] ?? '').split(',').filter(Boolean));
  if (storeIds && !storeIds.size) throw new Error('Missing store ID');
  const all = allCandidateStores();
  const rawRegistry = readJson(registryPath);
  const initial = parseGooglePlaceRegistry(rawRegistry);
  if (rawRegistry !== null && (typeof rawRegistry !== 'object' || (rawRegistry as GooglePlaceRegistry).version !== 1 || !Array.isArray((rawRegistry as GooglePlaceRegistry).records) || initial.records.length !== (rawRegistry as GooglePlaceRegistry).records.length)) throw new Error('Invalid saved registry');
  const existing = confirmedPlaceIds(all, initial);
  const confirmations = new Map(initial.records.map(row => [row.storeId, row]));
  const oldAudit = readJson(auditPath) as {decisions?: Decision[]} | null;
  const audit = new Map((oldAudit?.decisions ?? []).map(row => [row.storeId, row]));
  const priority = [{lat: 32.7157, lon: -117.1611}, {lat: 40.7128, lon: -74.0060}, {lat: 34.0522, lon: -118.2437}, {lat: 39.7392, lon: -104.9903}];
  const targets = [...all].filter(store => {
    if (storeIds && !storeIds.has(store.id)) return false;
    if (args.includes('--refresh')) return true;
    const confirmation = existing.has(store.id) ? confirmations.get(store.id) : undefined;
    if ((storeIds || args.includes('--retry-held')) && !confirmation) return true;
    return shouldReviewGoogleIdentity(store, confirmation, audit.get(store.id));
  })
    .sort((a, b) => Math.min(...priority.map(point => haversineMiles(point, a.location))) - Math.min(...priority.map(point => haversineMiles(point, b.location))))
    .slice(0, limit);
  console.log(JSON.stringify({stage: 'start', candidates: all.length, previouslyConfirmed: existing.size, targets: targets.length, concurrency: 6}));
  let nextRequest = Date.now();
  let cooldownUntil = 0;
  const pacedLookup = async (store: Store) => {
    const scheduled = Math.max(Date.now(), nextRequest, cooldownUntil);
    nextRequest = scheduled + 200; // 300 requests/minute, below the default Search quota.
    if (scheduled > Date.now()) await new Promise(resolve => setTimeout(resolve, scheduled - Date.now()));
    while (cooldownUntil > Date.now()) await new Promise(resolve => setTimeout(resolve, cooldownUntil - Date.now()));
    try { return await findGooglePlaceMatch(store, apiKey); }
    catch (error) {
      if (error instanceof Error && error.message === 'lookup_http_429') cooldownUntil = Date.now() + 60_000;
      throw error;
    }
  };
  const result = await matchRegistry(targets, initial, pacedLookup, (registry, decisions, completed) => {
    for (const row of decisions) audit.set(row.storeId, row);
    atomicJson(registryPath, registry);
    const publishable = confirmedPlaceIds(all, registry);
    const placeStores = new Map<string, string[]>();
    for (const row of registry.records) placeStores.set(row.placeId, [...(placeStores.get(row.placeId) ?? []), row.storeId]);
    const duplicates = [...placeStores.entries()].filter(([, ids]) => ids.length > 1).map(([placeId, storeIds]) => ({placeId, storeIds}));
    for (const {storeIds} of duplicates) for (const storeId of storeIds) {
      const decision = audit.get(storeId);
      if (decision && !publishable.has(storeId)) audit.set(storeId, {...decision, reason: 'duplicate-identity'});
    }
    const reasons: Record<string, number> = {};
    for (const row of audit.values()) if (!publishable.has(row.storeId)) { const reason = row.reason === 'confirmed' ? 'duplicate-identity' : row.reason; reasons[reason] = (reasons[reason] ?? 0) + 1; }
    atomicJson(auditPath, {version: 1, checkedAt: new Date().toISOString(), candidates: all.length, confirmed: publishable.size, held: all.length - publishable.size, reasons, duplicates, decisions: [...audit.values()].sort((a, b) => a.storeId.localeCompare(b.storeId))});
    if (completed % 100 === 0 || completed === targets.length) console.log(JSON.stringify({stage: 'progress', completed, targets: targets.length, confirmed: publishable.size, holdReasons: reasons, duplicatePlaces: duplicates.length}));
  }, true); // Target selection above already handles saved, stale, and held identities.
  console.log(JSON.stringify({stage: 'complete', reviewed: result.decisions.length, confirmed: confirmedPlaceIds(all, result.registry).size}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Matching stopped; saved confirmations and audit progress remain intact.'); process.exitCode = 1; });
