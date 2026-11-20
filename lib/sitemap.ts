import type {MetadataRoute} from 'next';
import {STATES,CITIES} from '@/lib/cities';
import {BRANDS, matchesBrands} from '@/lib/brands';
import {cityCentroid} from '@/lib/city-data';
import {locateBundledStores} from '@/lib/locate';
import {SITE_URL} from '@/lib/seo';
import {isLocale,locales,localizedPath,type Locale} from '@/i18n/routing';
import {losAngelesOutlets} from '@/lib/outlets';

/** Unprefixed paths of every indexable page, shared by each language's sitemap. */
export function sitemapPaths(): string[] {
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
  return paths;
}

/** Sitemap entries for one language, or for every language when none is given. */
export function sitemapEntries(locale?: Locale): MetadataRoute.Sitemap {
  const paths = sitemapPaths();
  return (locale ? [locale] : [...locales]).flatMap(l => paths.map(path => ({url: SITE_URL + localizedPath(path, l)})));
}

/** Public URL of one language's sitemap (served by app/sitemap/[file]/route.ts). */
export function sitemapUrl(locale: Locale): string {
  return `${SITE_URL}/sitemap/${locale}.xml`;
}

/** Sitemap index listing one sitemap per language. */
export function sitemapIndexXml(): string {
  const items = locales.map(locale => `<sitemap><loc>${sitemapUrl(locale)}</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>\n`;
}

const escapeXml = (value: string) => value.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'})[c]!);

/** One language's sitemap as XML. No <lastmod>: the site has no trustworthy per-page dates. */
export function languageSitemapXml(locale: Locale): string {
  const items = sitemapEntries(locale).map(entry => `<url><loc>${escapeXml(entry.url)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

/** Maps a sitemap file name such as "es.xml" to its language. */
export function sitemapFileLocale(file: string): Locale | null {
  const match = /^(.+)\.xml$/.exec(file);
  return match && isLocale(match[1]) ? match[1] : null;
}
