import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {BRANDS, getBrand, matchesBrands} from '@/lib/brands';
import {CITIES, getCity} from '@/lib/cities';
import {cityCentroid} from '@/lib/city-data';
import {datasetGeneratedAt, locateBundledStores} from '@/lib/locate';
import {pageMetadata, SITE_URL} from '@/lib/seo';
import {localizedPath} from '@/i18n/routing';
import {CityHeader, CityFooter} from '@/components/city/chrome';
import {CityStores} from '@/components/city/city-stores';
import {BrandNavigation} from '@/components/city/brand-navigation';
import {JsonLd} from '@/components/json-ld';

export const revalidate = 86400;
export function generateStaticParams() {
  return CITIES.flatMap(city => {
    const center = cityCentroid(city.slug);
    if (!center) return [];
    const stores = locateBundledStores(center, city.radiusMiles);
    return ['thrift-stores', ...BRANDS.filter(b => b.id !== 'goodwill').map(b => b.id)]
      .filter(id => id === 'thrift-stores' ? stores.length > 0 : stores.some(store => store.brandId === id))
      .map(brand => ({brand, slug: city.slug}));
  });
}
function resolve(id: string, slug: string) {
  const brand = id === 'thrift-stores' ? null : getBrand(id);
  const city = getCity(slug);
  if ((id !== 'thrift-stores' && (!brand || id === 'goodwill')) || !city) notFound();
  const center = cityCentroid(city.slug);
  const stores = center ? locateBundledStores(center, city.radiusMiles, brand ? [brand.id] : []) : [];
  return {brand, city, center, stores};
}
export async function generateMetadata({params}: {params: Promise<{locale: string; brand: string; slug: string}>}): Promise<Metadata> {
  const {locale, brand: id, slug} = await params; const {brand, city, stores} = resolve(id, slug);
  const t = await getTranslations({locale, namespace: 'directory'}); const place = `${city.city}, ${city.state}`;
  const title = brand ? t('cityBrandTitle', {brand: brand.name, place}) : t('cityAllTitle', {place});
  const desc = !stores.length ? t('cityEmptyDescription', {place}) : brand ? t('cityBrandDescription', {brand: brand.name, count: stores.length, radius: city.radiusMiles, place}) : t('cityAllDescription', {count: stores.length, radius: city.radiusMiles, place});
  return pageMetadata(title, desc, `/${id}/${slug}`, stores.length > 0, locale);
}
export default async function DirectoryCity({params}: {params: Promise<{locale: string; brand: string; slug: string}>}) {
  const {locale, brand: id, slug} = await params; const {brand, city, center, stores} = resolve(id, slug); setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: 'directory'}); const p = await getTranslations({locale, namespace: 'pages'});
  const place = `${city.city}, ${city.state}`; const title = brand ? t('cityBrandTitle', {brand: brand.name, place}) : t('cityAllTitle', {place});
  const hubTitle = brand ? t('brandTitle', {brand: brand.name}) : t('allTitle');
  const date = datasetGeneratedAt(brand ? [brand.id] : []);
  const representedBrands = BRANDS.filter(b => stores.some(store => matchesBrands(store, [b.id])));
  const url = (path: string) => SITE_URL + localizedPath(path, locale);
  const jsonLd = {'@context': 'https://schema.org', '@graph': [
    {'@type': 'BreadcrumbList', itemListElement: [
      {'@type': 'ListItem', position: 1, name: p('home'), item: url('/')},
      {'@type': 'ListItem', position: 2, name: hubTitle, item: url(`/${id}`)},
      {'@type': 'ListItem', position: 3, name: place, item: url(`/${id}/${slug}`)},
    ]},
    ...(stores.length ? [{'@type': 'ItemList', name: title, numberOfItems: stores.length, itemListElement: stores.slice(0, 20).map((store, i) => ({'@type': 'ListItem', position: i + 1, item: {'@type': 'Store', identifier: store.id, name: store.name, address: {'@type': 'PostalAddress', streetAddress: store.street, addressLocality: store.locality, addressRegion: store.region, addressCountry: 'US'}, geo: {'@type': 'GeoCoordinates', latitude: store.location.lat, longitude: store.location.lon}}}))}] : []),
  ]};
  const mapHref = center ? `/search?lat=${center.lat}&lon=${center.lon}&radius=${city.radiusMiles}&label=${encodeURIComponent(place)}${brand ? `&brands=${brand.id}` : ''}` : '/search';
  return <div className="flex min-h-dvh flex-col"><JsonLd data={jsonLd}/><CityHeader/><main id="main-content" tabIndex={-1} className="flex-1"><div className="site-gutter mx-auto max-w-3xl py-6 sm:py-12">
    <nav aria-label={p('breadcrumb')} className="text-sm text-muted-foreground"><Link href="/">{p('home')}</Link> / <Link href={`/${id}`}>{hubTitle}</Link> / {place}</nav>
    <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
    <p className="mt-3 text-muted-foreground">{!stores.length ? t('cityEmpty', {city: city.city}) : brand ? t('cityBrandIntro', {count: stores.length, brand: brand.name, radius: city.radiusMiles, city: city.city}) : t('cityAllIntro', {count: stores.length, radius: city.radiusMiles, city: city.city})}</p>
    <p className="mt-2 text-sm text-muted-foreground">{!brand && representedBrands.length === 1 && !stores.some(store => store.operatorType === 'independent') ? t('singleBrandCoverage', {brand: representedBrands[0].name}) : t('coverageNote')}</p>
    <Link href={mapHref} className="mt-5 inline-flex min-h-11 items-center rounded-md bg-brand px-5 font-medium text-brand-foreground">{t('openMap')}</Link>
    <BrandNavigation city={city} active={id}/>
    {stores.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">{t('cityResults', {city: city.city})}</h2><p className="mt-2 text-sm text-muted-foreground">{t('neighborhoodNote')}</p><div className="mt-4"><CityStores initial={stores} cityName={city.city} lat={center?.lat} lon={center?.lon} radiusMiles={city.radiusMiles} brandIds={brand ? [brand.id] : []} generatedAt={date} initialDateLabel={date ? new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(date)) : undefined}/></div></section>}
    <p className="mt-6 text-sm text-muted-foreground">{date && <>{t('sourceDate', {date: new Intl.DateTimeFormat(locale, {dateStyle: 'long', timeZone: 'UTC'}).format(new Date(date))})}. </>}{t('independent')}</p>
    <Link href={`/${id}`} className="mt-8 inline-block underline">{t('browseCities')}</Link>
  </div></main><CityFooter/></div>;
}
