import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {BRANDS, getBrand, matchesBrands} from '@/lib/brands';
import {CITIES} from '@/lib/cities';
import {cityCentroid} from '@/lib/city-data';
import {allBundledStores, locateBundledStores} from '@/lib/locate';
import {pageMetadata, SITE_URL} from '@/lib/seo';
import {localizedPath} from '@/i18n/routing';
import {CityHeader, CityFooter} from '@/components/city/chrome';
import {JsonLd} from '@/components/json-ld';

export const revalidate = 86400;
export function generateStaticParams() { return ['thrift-stores', ...BRANDS.filter(b => b.id !== 'goodwill').map(b => b.id)].map(brand => ({brand})); }
function resolve(id: string) { if (id === 'thrift-stores') return null; const brand = getBrand(id); if (!brand || id === 'goodwill') notFound(); return brand; }
export async function generateMetadata({params}: {params: Promise<{locale: string; brand: string}>}): Promise<Metadata> {
  const {locale, brand: id} = await params; const brand = resolve(id);
  const t = await getTranslations({locale, namespace: 'directory'});
  return pageMetadata(brand ? t('brandTitle', {brand: brand.name}) : t('allTitle'), brand ? t('brandDescription', {brand: brand.name}) : t('allDescription'), `/${id}`, true, locale);
}
export default async function DirectoryHub({params}: {params: Promise<{locale: string; brand: string}>}) {
  const {locale, brand: id} = await params; const brand = resolve(id); setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: 'directory'}); const p = await getTranslations({locale, namespace: 'pages'});
  const ids = brand ? [brand.id] : [];
  const cities = CITIES.filter(city => { const center = cityCentroid(city.slug); return center && locateBundledStores(center, city.radiusMiles, ids).length > 0; });
  const title = brand ? t('brandTitle', {brand: brand.name}) : t('allTitle');
  const base = SITE_URL + localizedPath('', locale);
  const jsonLd = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    {'@type': 'ListItem', position: 1, name: p('home'), item: base || SITE_URL},
    {'@type': 'ListItem', position: 2, name: title, item: SITE_URL + localizedPath(`/${id}`, locale)},
  ]};
  return <div className="flex min-h-dvh flex-col"><JsonLd data={jsonLd}/><CityHeader/><main id="main-content" tabIndex={-1} className="flex-1"><div className="site-gutter mx-auto max-w-5xl py-8 sm:py-14">
    <nav aria-label={p('breadcrumb')} className="text-sm text-muted-foreground"><Link href="/">{p('home')}</Link> / {title}</nav>
    <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
    <p className="mt-3 max-w-2xl text-muted-foreground">{brand ? t(`brandIntro_${brand.id}`) : t('allIntro')}</p>
    <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t('coverageNote')}</p>
    <p className="mt-3 text-sm">{t('brandCoverage', {count: allBundledStores().filter(store => matchesBrands(store, ids)).length})}</p>
    {brand && <a href={brand.website} className="mt-3 inline-block underline" target="_blank" rel="noopener noreferrer">{t('officialLocator', {brand: brand.name})}</a>}
    <h2 className="mt-10 text-xl font-semibold">{t('browseCities')}</h2>
    <div className="mt-4 grid gap-x-8 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{cities.map(city => <Link key={city.slug} href={`/${id}/${city.slug}`} prefetch={false} className="min-h-12 border-b border-border py-3 text-sm font-medium hover:text-brand">{city.city}, {city.state}</Link>)}</div>
    <h2 className="mt-10 text-xl font-semibold">{t('browseBrands')}</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-3"><Link href="/thrift-stores" className="underline">{t('allStores')}</Link>{BRANDS.map(b => <Link key={b.id} href={`/${b.id}`} className="underline">{b.name}</Link>)}</div>
  </div></main><CityFooter/></div>;
}
