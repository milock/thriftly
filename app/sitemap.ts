import type {MetadataRoute} from 'next';
import {STATES,CITIES} from '@/lib/cities';
import {BRANDS, matchesBrands} from '@/lib/brands';
import {cityCentroid} from '@/lib/city-data';
import {locateBundledStores} from '@/lib/locate';
import {SITE_URL} from '@/lib/seo';
import {locales,localizedPath} from '@/i18n/routing';
import {losAngelesOutlets} from '@/lib/outlets';

export default function sitemap(): MetadataRoute.Sitemap {
  const directories = ['thrift-stores', ...BRANDS.map(brand => brand.id)];
  const paths = ['/', '/search', '/privacy', '/terms', '/how-we-score', ...directories.map(id => `/${id}`), ...STATES.map(state => `/goodwill/state/${state.slug}`)];
  if (losAngelesOutlets().length) paths.push('/goodwill/los-angeles-ca/outlets');
  for (const city of CITIES) {
    const center = cityCentroid(city.slug);
    if (!center) continue;
    const stores = locateBundledStores(center, city.radiusMiles);
    if (stores.length) paths.push(`/thrift-stores/${city.slug}`);
    if (city.slug === 'san-diego-ca' && stores.some(store => store.operatorType === 'independent')) paths.push(`/independent-thrift-stores/${city.slug}`);
    for (const brand of BRANDS) if (stores.some(store => matchesBrands(store, [brand.id]))) paths.push(`/${brand.id}/${city.slug}`);
  }
  return locales.flatMap(locale => paths.map(path => ({url: SITE_URL + localizedPath(path, locale)})));
}
