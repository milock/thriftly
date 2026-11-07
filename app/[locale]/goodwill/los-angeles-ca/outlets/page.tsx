import {Link} from '@/i18n/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {pageMetadata,SITE_URL} from '@/lib/seo';
import {CityHeader,CityFooter} from '@/components/city/chrome';
import {JsonLd} from '@/components/json-ld';
import {InfoDisclosure} from '@/components/info-disclosure';
import {RankedStores} from '@/components/city/ranked-stores';
import {losAngelesOutlets} from '@/lib/outlets';
import {cityCentroid} from '@/lib/city-data';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: 'pages'});
  return pageMetadata(t('outletMeta'),t('outletDescription'),'/goodwill/los-angeles-ca/outlets',losAngelesOutlets().length > 0,locale);
}
export default async function LosAngelesOutlets({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages');
  const outlets = losAngelesOutlets();
  const base = SITE_URL + (locale === 'en' ? '' : `/${locale}`);
  return <div className="flex min-h-dvh flex-col"><CityHeader/><main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-5 py-12">
    <JsonLd data={{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
      {name:t('home'),item:base},{name:t('laStores'),item:base+'/goodwill/los-angeles-ca'},{name:t('laOutlets'),item:base+'/goodwill/los-angeles-ca/outlets'}
    ].map((x,i)=>({'@type':'ListItem',position:i+1,...x}))}}/>
    <nav aria-label={t('breadcrumb')}><Link href="/goodwill/los-angeles-ca" className="underline">{t('laStores')}</Link> / {t('outlets')}</nav>
    <h1 className="text-4xl font-semibold tracking-tight">{t('outletTitle')}</h1>
    <div className="flex items-start gap-2"><p className="text-lg">{t('outletIntro')}</p><InfoDisclosure label={t('sources')}><p>{t('outletSource')}</p></InfoDisclosure></div>
    {outlets.length > 0 && <section className="space-y-5"><h2 className="text-2xl font-semibold">{t('addresses')}</h2><RankedStores stores={outlets} cityName="Los Angeles" center={cityCentroid('los-angeles-ca') ?? undefined}/></section>}
    <section className="space-y-4"><h2 className="text-2xl font-semibold">{t('checkOperator')}</h2><p>{t('operatorBody')}</p><div className="flex flex-wrap gap-5"><a className="underline" href="https://www.goodwillsocal.org/outlet-store/">{t('operatorPage')}</a><a className="underline" href="https://www.goodwillsocal.org/shop/goodwill-locator/">{t('operatorLocator')}</a></div></section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">{t('regularTitle')}</h2><p>{t('regularBody')}</p><div className="flex flex-wrap gap-5"><Link className="underline" href="/goodwill/los-angeles-ca">{t('compareLA')}</Link><Link className="underline" href="/how-we-score">{t('understand')}</Link></div></section>
  </main><CityFooter/></div>;
}
