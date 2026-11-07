import {isStoreFilterId, parseStoreFilterIds} from '@/lib/brands';
import {DEFAULT_FILTERS, parseDepartments, type Filters} from '@/lib/filters';
import type {LatLng} from '@/lib/types';

export type SearchParams = Record<string, string | string[] | undefined>;
export interface InitialSearchQuery {
  center: LatLng;
  filters: Filters;
  selectedId: string | null;
  label: string | null;
}

/** Stable across filter order and the query's presentation-only fields. */
export function storeSearchKey(center: LatLng, radiusMiles: number, brandIds: readonly string[] = []): string {
  return JSON.stringify([center.lat, center.lon, radiusMiles, [...new Set(brandIds)].sort()]);
}

/** Only explicit, bounded coordinate links qualify for billed server-side details. */
export function parseInitialSearch(params: SearchParams): InitialSearchQuery | null {
  const keys = ['lat', 'lon', 'radius', 'brands', 'departments', 'minScore', 'open', 'sort', 'sel', 'label'];
  if (keys.some(key => Array.isArray(params[key]) || (typeof params[key] === 'string' && params[key]!.length > 240))) return null;
  const string = (key: string) => typeof params[key] === 'string' ? params[key] as string : undefined;
  const rawLat = string('lat'), rawLon = string('lon');
  if (!rawLat?.trim() || !rawLon?.trim()) return null;
  const lat = Number(rawLat), lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const rawBrands = string('brands');
  if (rawBrands && rawBrands.split(',').some(value => !isStoreFilterId(value))) return null;
  const radius = Number(string('radius') ?? DEFAULT_FILTERS.radiusMiles);
  const minScore = Number(string('minScore') ?? 0);
  const sort = string('sort');
  const selectedId = string('sel');
  const label = string('label')?.trim();
  return {
    center: {lat, lon},
    filters: {
      ...DEFAULT_FILTERS,
      radiusMiles: Number.isFinite(radius) ? Math.min(100, Math.max(0.5, radius)) : DEFAULT_FILTERS.radiusMiles,
      brandIds: parseStoreFilterIds(rawBrands), departments: parseDepartments(string('departments') ?? null),
      minScore: Number.isFinite(minScore) ? Math.min(100, Math.max(0, minScore)) : 0,
      openNowOnly: string('open') === '1',
      sort: sort === 'distance' || sort === 'best-nearby' ? sort : 'score',
    },
    selectedId: selectedId && /^[a-z0-9_/-]{1,200}$/i.test(selectedId) ? selectedId : null,
    label: label && label.length <= 200 && !/[\u0000-\u001f\u007f]/.test(label) ? label : null,
  };
}
