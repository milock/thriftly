import {afterEach, describe, expect, it, vi} from 'vitest';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertSourceSnapshot} from '@/lib/refresh-quality';
import {ATP_MAX_AGE_DAYS, LAST_GOOD_HOLD_DAYS, failureReason, readSourceHealth, recordSourceHealth, retentionStatus, unhealthySources} from '@/lib/source-health';
import {carryForwardConfirmations, confirmedPlaceIds, listingIdentityFingerprint} from '@/lib/google-place-registry';
import {corroborateStores, corroboratedStoreIds, isOsmPublicShop, osmBrandMatches, parseCorroborationRegistry, type OsmShop} from '@/lib/osm-corroboration';
import {toSnapshot} from '../scripts/fetch-osm-thrift';
import type {Store} from '@/lib/types';

const NOW = Date.parse('2026-11-16T19:37:00Z');
const days = (n: number) => new Date(NOW - n * 86400000).toISOString();
const store = (over: Partial<Store> = {}): Store => ({id: 'goodwill/1', name: 'Goodwill', brandId: 'goodwill', brand: 'Goodwill', facilityType: 'retail', street: '100 Main Street', address: '100 Main Street, San Diego, CA', locality: 'San Diego', region: 'CA', location: {lat: 32.7, lon: -117.1}, ...over});
const shop = (over: Partial<OsmShop> = {}, tags: Record<string, string> = {}): OsmShop => ({id: 'node/10', lat: 32.7002, lon: -117.1, tags: {shop: 'charity', name: 'Goodwill', ...tags}, ...over});

afterEach(() => vi.restoreAllMocks());

describe('source freshness windows', () => {
  it('accepts the 8 to 10 day old All the Places extracts that broke the Nov 9 and Nov 16 runs', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    expect(() => assertSourceSnapshot(days(8.6))).toThrow();
    expect(() => assertSourceSnapshot(days(8.6), {maxAgeDays: ATP_MAX_AGE_DAYS})).not.toThrow();
    expect(() => assertSourceSnapshot(days(ATP_MAX_AGE_DAYS + 1), {maxAgeDays: ATP_MAX_AGE_DAYS})).toThrow();
    expect(() => assertSourceSnapshot(days(-1), {maxAgeDays: ATP_MAX_AGE_DAYS})).toThrow();
  });
  it('marks retained data overdue only after the hold window', () => {
    expect(retentionStatus(days(30), NOW)).toBe('retained-last-good');
    expect(retentionStatus(days(LAST_GOOD_HOLD_DAYS + 1), NOW)).toBe('overdue');
    expect(retentionStatus(undefined, NOW)).toBe('overdue');
  });
  it('keeps one health row per source and flags only overdue or failed sources', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const path = join(mkdtempSync(join(tmpdir(), 'health-')), 'health.json');
    recordSourceHealth({source: 'savers', status: 'failed', reason: 'x'}, path);
    recordSourceHealth({source: 'savers', status: 'retained-last-good'}, path);
    recordSourceHealth({source: 'goodwill', status: 'overdue'}, path);
    const rows = readSourceHealth(path);
    expect(rows.map(r => [r.source, r.status])).toEqual([['goodwill', 'overdue'], ['savers', 'retained-last-good']]);
    expect(unhealthySources(rows).map(r => r.source)).toEqual(['goodwill']);
  });
  it('keeps failure reasons short and free of URLs', () => {
    expect(failureReason(new Error('Source HTTP 503 at https://example.org/a?b=c'))).toBe('Source HTTP 503 at [url]');
  });
});

describe('carrying Google identities through small edits', () => {
  const before = store();
  const registry = {version: 1 as const, records: [{storeId: before.id, placeId: 'ChIJkeep', identityFingerprint: listingIdentityFingerprint(before), checkedAt: '2026-11-06T00:00:00Z'}]};
  it('keeps a listing public when its pin moves a few meters or the street is abbreviated', () => {
    const after = store({location: {lat: 32.7001, lon: -117.1001}, street: '100 Main St'});
    const {registry: next, carried} = carryForwardConfirmations(registry, [before], [after]);
    expect(carried).toHaveLength(1);
    expect(confirmedPlaceIds([after], next).get(after.id)).toBe('ChIJkeep');
  });
  it('drops the identity when the listing moved, changed brand or was never confirmed', () => {
    for (const after of [store({location: {lat: 32.71, lon: -117.1}}), store({brandId: 'savers', name: 'Savers'}), store({facilityType: 'outlet', name: 'Goodwill Outlet'}), store({street: '900 Other Rd', address: '900 Other Rd, San Diego, CA', location: {lat: 32.7001, lon: -117.1}})]) {
      const {registry: next, carried} = carryForwardConfirmations(registry, [before], [after]);
      expect(carried).toHaveLength(0);
      expect(confirmedPlaceIds([after], next).size).toBe(0);
    }
    const stale = {version: 1 as const, records: [{...registry.records[0], identityFingerprint: 'a'.repeat(64)}]};
    expect(carryForwardConfirmations(stale, [before], [store({street: '100 Main St'})]).carried).toHaveLength(0);
  });
});

describe('OpenStreetMap corroboration', () => {
  it('recognises brands and walk-in shops only', () => {
    expect(osmBrandMatches({name: 'Goodwill Store & Donation Center'}, 'goodwill')).toBe(true);
    expect(osmBrandMatches({'brand:wikidata': 'Q5583655', name: 'Thrift'}, 'goodwill')).toBe(true);
    expect(osmBrandMatches({name: 'Value Village'}, 'savers')).toBe(true);
    expect(osmBrandMatches({name: 'Goodwill'}, 'savers')).toBe(false);
    expect(isOsmPublicShop({shop: 'charity', name: 'Goodwill'})).toBe(true);
    expect(isOsmPublicShop({shop: 'clothes', second_hand: 'only', name: 'Buffalo Exchange'})).toBe(true);
    expect(isOsmPublicShop({shop: 'clothes', name: 'Buffalo Exchange'})).toBe(false);
    expect(isOsmPublicShop({shop: 'charity', name: 'Goodwill Donation Center'})).toBe(false);
    expect(isOsmPublicShop({shop: 'charity', name: 'Goodwill Store and Donation Center'})).toBe(true);
    expect(isOsmPublicShop({shop: 'charity', name: 'Goodwill', opening_hours: 'closed'})).toBe(false);
    expect(isOsmPublicShop({amenity: 'recycling', name: 'Goodwill'})).toBe(false);
  });
  it('corroborates a nearby shop of the same brand, or a farther one with the same street number', () => {
    const now = new Date(NOW);
    expect(corroborateStores([store()], [shop()], {now})).toMatchObject([{storeId: 'goodwill/1', osmId: 'node/10', basis: 'osm-brand-nearby', distanceMeters: 22}]);
    const farther = shop({lat: 32.701}, {'addr:housenumber': '100'});
    expect(corroborateStores([store()], [farther], {now})).toMatchObject([{basis: 'osm-brand-and-street-number'}]);
    expect(corroborateStores([store()], [shop({lat: 32.701})], {now})).toEqual([]);
    expect(corroborateStores([store()], [shop({}, {name: 'Savers'})], {now})).toEqual([]);
    expect(corroborateStores([store()], [shop({lat: 32.703})], {now})).toEqual([]);
  });
  it('treats a node and its building as one shop but refuses ambiguous or shared matches', () => {
    const now = new Date(NOW);
    expect(corroborateStores([store()], [shop(), shop({id: 'way/11', lat: 32.7001})], {now})).toMatchObject([{osmId: 'way/11'}]);
    const twoShops = [shop({lat: 32.7004}), shop({id: 'node/12', lat: 32.6996, lon: -117.1003})];
    expect(corroborateStores([store()], twoShops, {now})).toEqual([]);
    const neighbour = store({id: 'goodwill/2', location: {lat: 32.7004, lon: -117.1}});
    expect(corroborateStores([store(), neighbour], [shop()], {now})).toEqual([]);
    expect(corroborateStores([store()], [shop()], {now, blocked: new Set(['goodwill/1'])})).toEqual([]);
    expect(corroborateStores([store({facilityType: 'donation'})], [shop()], {now})).toEqual([]);
  });
  it('publishes a corroboration only while the listing is unchanged', () => {
    const registry = parseCorroborationRegistry({version: 1, records: corroborateStores([store()], [shop()], {now: new Date(NOW)})});
    expect([...corroboratedStoreIds([store()], registry)]).toEqual(['goodwill/1']);
    expect(corroboratedStoreIds([store({street: '102 Main Street'})], registry).size).toBe(0);
    expect(parseCorroborationRegistry({version: 1, records: [{storeId: 'x', osmId: 'https://evil', identityFingerprint: 'a'.repeat(64), distanceMeters: 1, basis: 'osm-brand-nearby', checkedAt: '2026-11-01'}]}).records).toEqual([]);
  });
  it('rejects stale, partial or tiny Overpass responses and keeps only needed tags', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const elements = Array.from({length: 2000}, (_, i) => ({type: 'node', id: i + 1, lat: 32, lon: -117, tags: {shop: 'charity', name: 'Goodwill', phone: '555', 'contact:email': 'a@b.c'}}));
    const snapshot = toSnapshot({elements, osm3s: {timestamp_osm_base: days(0.1)}});
    expect(snapshot.elements).toHaveLength(2000);
    expect(snapshot.elements[0].tags).toEqual({shop: 'charity', name: 'Goodwill'});
    expect(() => toSnapshot({elements, osm3s: {timestamp_osm_base: days(9)}})).toThrow();
    expect(() => toSnapshot({elements, osm3s: {timestamp_osm_base: days(0.1)}, remark: 'runtime error: timeout'})).toThrow();
    expect(() => toSnapshot({elements: elements.slice(0, 10), osm3s: {timestamp_osm_base: days(0.1)}})).toThrow();
  });
});
