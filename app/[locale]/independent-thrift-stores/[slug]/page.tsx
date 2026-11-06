import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {getCity} from '@/lib/cities';
import {cityCentroid} from '@/lib/city-data';
import {datasetGeneratedAt, locateBundledStores} from '@/lib/locate';
import {pageMetadata, SITE_URL} from '@/lib/seo';
import {localizedPath} from '@/i18n/routing';
import {CityHeader, CityFooter} from '@/components/city/chrome';
import {CityStores} from '@/components/city/city-stores';
import {BrandNavigation} from '@/components/city/brand-navigation';
import {JsonLd} from '@/components/json-ld';

const SLUG='san-diego-ca';
const PATH=`/independent-thrift-stores/${SLUG}`;
export const revalidate=86400;
export const dynamicParams=false;
export function generateStaticParams(){return [{slug:SLUG}];}
function resolve(slug:string){
 if(slug!==SLUG)notFound();
 const city=getCity(slug);if(!city)notFound();
 const center=cityCentroid(slug);
 const stores=center?locateBundledStores(center,city.radiusMiles,['independent']):[];
 return {city,center,stores};
}
export async function generateMetadata({params}:{params:Promise<{locale:string;slug:string}>}):Promise<Metadata>{
 const {locale,slug}=await params;const {city,stores}=resolve(slug);const t=await getTranslations({locale,namespace:'directory'});const place=`${city.city}, ${city.state}`;
 return pageMetadata(t('independentCityTitle',{place}),stores.length?t('independentCityDescription',{count:stores.length,radius:city.radiusMiles,place}):t('cityEmptyDescription',{place}),PATH,stores.length>0,locale);
}
export default async function IndependentCity({params}:{params:Promise<{locale:string;slug:string}>}){
 const {locale,slug}=await params;const {city,center,stores}=resolve(slug);setRequestLocale(locale);
 const t=await getTranslations({locale,namespace:'directory'});const p=await getTranslations({locale,namespace:'pages'});const place=`${city.city}, ${city.state}`;
 const title=t('independentCityTitle',{place});const date=datasetGeneratedAt(['independent']);
 const url=(path:string)=>SITE_URL+localizedPath(path,locale);
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:p('home'),item:url('/')},{'@type':'ListItem',position:2,name:t('allTitle'),item:url('/thrift-stores')},{'@type':'ListItem',position:3,name:title,item:url(PATH)}]},
  ...(stores.length?[{'@type':'ItemList',name:title,numberOfItems:stores.length,itemListElement:stores.slice(0,20).map((store,i)=>({'@type':'ListItem',position:i+1,item:{'@type':'Store',identifier:store.id,name:store.name,address:{'@type':'PostalAddress',streetAddress:store.street,addressLocality:store.locality,addressRegion:store.region,addressCountry:'US'},geo:{'@type':'GeoCoordinates',latitude:store.location.lat,longitude:store.location.lon}}}))}]:[]),
 ]};
 const mapHref=center?`/search?lat=${center.lat}&lon=${center.lon}&radius=${city.radiusMiles}&label=${encodeURIComponent(place)}&brands=independent`:'/search?brands=independent';
 return <div className="flex min-h-dvh flex-col"><JsonLd data={schema}/><CityHeader/><main id="main-content" tabIndex={-1} className="flex-1"><div className="site-gutter mx-auto max-w-3xl py-6 sm:py-12">
  <nav aria-label={p('breadcrumb')} className="text-sm text-muted-foreground"><Link href="/">{p('home')}</Link> / <Link href="/thrift-stores">{t('allTitle')}</Link> / {place}</nav>
  <h1 id="pilot-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
  {!stores.length&&<p className="mt-3 text-muted-foreground">{t('cityEmpty',{city:city.city})}</p>}
  <p className="mt-2 text-sm text-muted-foreground">{t('independentPilotScope')}</p>
  <BrandNavigation city={city} active="independent-thrift-stores" compactMobile/>
  {stores.length>0&&<section aria-labelledby="pilot-title" className="mt-4 sm:mt-6"><h2 className="sr-only">{t('cityResults',{city:city.city})}</h2><CityStores initial={stores} cityName={city.city} lat={center?.lat} lon={center?.lon} radiusMiles={city.radiusMiles} brandIds={['independent']} generatedAt={date}/></section>}
  <Link href={mapHref} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-brand px-5 font-medium text-brand-foreground">{t('openMap')}</Link>
  <p className="mt-6 text-sm text-muted-foreground">{t('neighborhoodNote')} <Link href="/how-we-score" className="underline">{p('methodShort')}</Link></p>
  <p className="mt-6 text-sm text-muted-foreground">{date&&<>{t('sourceDate',{date:new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'UTC'}).format(new Date(date))})}. </>}{t('independent')}</p>
  <Link href={`/thrift-stores/${slug}`} className="mt-8 inline-block underline">{t('allStores')}</Link>
 </div></main><CityFooter/></div>;
}
