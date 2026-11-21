import type { Store } from '@/lib/types';

export const BRANDS = [
  {id: 'goodwill', name: 'Goodwill', sourcingModel: 'donation', website: 'https://www.goodwill.org/locator/', featured: true},
  {id: 'salvation-army', name: 'Salvation Army', sourcingModel: 'donation', website: 'https://satruck.org/', featured: true},
  {id: 'savers', name: 'Savers / Value Village', sourcingModel: 'donation', website: 'https://stores.savers.com/', featured: true},
  {id: 'buffalo-exchange', name: 'Buffalo Exchange', sourcingModel: 'buy-sell-trade', website: 'https://buffaloexchange.com/locations/', featured: true},
  {id: 'out-of-the-closet', name: 'Out of the Closet', sourcingModel: 'donation', website: 'https://outofthecloset.org/locations/', featured: false},
] as const;

export type BrandId = typeof BRANDS[number]['id'];
export type StoreFilterId = BrandId | 'independent';
export type StoreBrand = typeof BRANDS[number];
export function getBrand(id: string): StoreBrand | undefined { return BRANDS.find(brand => brand.id === id); }
export function storeBrandId(store: Pick<Store, 'brandId' | 'operatorType'>): string | undefined { return store.operatorType === 'independent' ? undefined : store.brandId ?? 'goodwill'; }
export function parseBrandIds(value: string | null | undefined): BrandId[] {
  const selected = new Set((value ?? '').split(','));
  return BRANDS.filter(brand => selected.has(brand.id)).map(brand => brand.id);
}
export function parseStoreFilterIds(value: string | null | undefined): StoreFilterId[] {
  const selected = new Set((value ?? '').split(','));
  return [...BRANDS.map(brand => brand.id), 'independent' as const].filter(id => selected.has(id));
}
export function isStoreFilterId(id: string): id is StoreFilterId { return id === 'independent' || !!getBrand(id); }
export function matchesBrands(store: Pick<Store, 'brandId' | 'operatorType'>, brands: readonly string[] = []): boolean {
  if (!brands.length) return true;
  if (store.operatorType === 'independent') return brands.includes('independent');
  const brand = storeBrandId(store);
  return brand !== undefined && brands.includes(brand);
}
export function storePagePath(citySlug: string, brandId?: string): string {
  return `/${brandId ?? 'thrift-stores'}/${citySlug}`;
}
