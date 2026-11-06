import type {MetadataRoute} from 'next';
import {STATES,CITIES} from '@/lib/cities';
import {BRANDS} from '@/lib/brands';
import {cityCentroid} from '@/lib/city-data';
import {locateBundledStores} from '@/lib/locate';
import {SITE_URL} from '@/lib/seo';
import {locales,localizedPath} from '@/i18n/routing';

export default function sitemap(): MetadataRoute.Sitemap {
  const directories = ['thrift-stores', ...BRANDS.map(brand => brand.id)];
  const paths = ['/', '/search', '/privacy', '/terms', '/how-we-score', '/goodwill/los-angeles-ca/outlets', ...directories.map(id => `/${id}`), ...STATES.map(state => `/goodwill/state/${state.slug}`)];
  for (const city of CITIES) {
    const center = cityCentroid(city.slug);
    if (!center) continue;
    const stores = locateBundledStores(center, city.radiusMiles);
    if (stores.length) paths.push(`/thrift-stores/${city.slug}`);
    for (const brand of BRANDS) if (stores.some(store => (store.brandId ?? 'goodwill') === brand.id)) paths.push(`/${brand.id}/${city.slug}`);
  }
  return locales.flatMap(locale => paths.map(path => ({url: SITE_URL + localizedPath(path, locale)})));
}
