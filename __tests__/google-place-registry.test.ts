import {describe, expect, it} from 'vitest';
import {confirmedPlaceIds, listingIdentityFingerprint, parseGooglePlaceRegistry, type GooglePlaceRegistry} from '@/lib/google-place-registry';
import {matchRegistry} from '../scripts/match-google-places';
import type {Store} from '@/lib/types';
const store: Store = {id: 'one', name: 'Goodwill', brandId: 'goodwill', street: '100 Main St', locality: 'San Diego', region: 'CA', facilityType: 'retail', location: {lat: 32.7, lon: -117.1}};
const confirmation = (item = store, placeId = 'ChIJconfirmed') => ({storeId: item.id, placeId, identityFingerprint: listingIdentityFingerprint(item), checkedAt: '2026-11-06T00:00:00Z'});
const registry = (records = [confirmation()]): GooglePlaceRegistry => ({version: 1, records});

describe('durable confirmed identities', () => {
  it('publishes only current fingerprint matches without requiring any rating', () => {
    expect(confirmedPlaceIds([store], registry()).get('one')).toBe('ChIJconfirmed');
    for (const patch of [{name: 'Changed'}, {street: '101 Main St'}, {location: {lat: 32.8, lon: -117.1}}, {operatorType: 'independent' as const}, {facilityType: 'outlet' as const}]) expect(confirmedPlaceIds([{...store, ...patch}], registry()).size).toBe(0);
    expect(listingIdentityFingerprint({...store, googlePlaceId: 'ignored'})).toBe(listingIdentityFingerprint(store));
  });
  it('holds duplicate place IDs and duplicate directory IDs rather than choosing one silently', () => {
    const other = {...store, id: 'two'};
    expect(confirmedPlaceIds([store, other], registry([confirmation(), confirmation(other)])).size).toBe(0);
    expect(confirmedPlaceIds([store], registry([confirmation(), confirmation()])).size).toBe(0);
    expect(confirmedPlaceIds([store, other], registry([confirmation(), confirmation(other, 'ChIJdifferent')])).size).toBe(2);
  });
  it('rejects malformed registry records and strips every extra field', () => {
    for (const value of [null, {}, {version: 2, records: [confirmation()]}, {version: 1, records: 'bad'}]) expect(parseGooglePlaceRegistry(value).records).toEqual([]);
    expect(parseGooglePlaceRegistry({version: 1, records: [null, {...confirmation(), placeId: '../arbitrary'}, {...confirmation(), checkedAt: 'bad'}, {...confirmation(), identityFingerprint: 'bad'}]}).records).toEqual([]);
    expect(parseGooglePlaceRegistry({version: 1, records: [{...confirmation(), rating: 5, reviews: 'private'}]}).records).toEqual([confirmation()]);
  });
  it('preserves previous confirmations across an API outage and bounds concurrency at six', async () => {
    const stores = Array.from({length: 16}, (_, i) => ({...store, id: `store-${i}`}));
    const initial = registry(stores.map(item => confirmation(item, `ChIJ${item.id}`)));
    let pending = 0;
    let peak = 0;
    const result = await matchRegistry(stores, initial, async () => {
      pending++;
      peak = Math.max(peak, pending);
      await new Promise(resolve => setTimeout(resolve, 1));
      pending--;
      throw new Error('upstream outage');
    }, () => {}, true);
    expect(peak).toBe(6);
    expect(result.registry.records).toHaveLength(16);
    expect(result.decisions.every(row => row.preservedConfirmation && row.reason === 'lookup_unavailable')).toBe(true);
    expect(confirmedPlaceIds(stores, result.registry).size).toBe(16);
  });
  it.each(['closed', 'ambiguous'] as const)('retires an identity after a successful %s finding', async reason => {
    const result = await matchRegistry([store], registry(), async () => ({placeId: null, reason}), () => {}, true);
    expect(result.registry.records).toEqual([]);
    expect(result.decisions[0].reason).toBe(reason);
  });
  it('skips valid saved identities and records only our own decisions for holdouts', async () => {
    const second = {...store, id: 'two'};
    const calls: string[] = [];
    const result = await matchRegistry([store, second], registry(), async item => {calls.push(item.id); return {placeId: null, reason: 'address-mismatch'};}, () => {});
    expect(calls).toEqual(['two']);
    expect(result.registry.records).toEqual([confirmation()]);
    expect(result.decisions).toHaveLength(1);
    expect(Object.keys(result.decisions[0]).sort()).toEqual(['checkedAt','identityFingerprint','reason','storeId']);
  });
});
