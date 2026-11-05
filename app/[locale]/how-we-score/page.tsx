import {Link} from '@/i18n/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {pageMetadata} from '@/lib/seo';
import {CityHeader, CityFooter} from '@/components/city/chrome';
import {WEIGHTS, CATCHMENT_RADIUS_MILES} from '@/lib/reference-ranges';
import {datasetGeneratedAt} from '@/lib/locate';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: 'pages'});
  return pageMetadata(t('methodTitle'),t('methodDescription'),'/how-we-score',true,locale);
}
export default async function MethodologyPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages');
  return <div className="flex min-h-dvh flex-col"><CityHeader/><main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-5 py-12">
    <nav aria-label={t('breadcrumb')}><Link href="/">{t('home')}</Link> / {t('methodShort')}</nav>
    <h1 className="text-4xl font-semibold tracking-tight">{t('methodTitle')}</h1>
    <p className="text-lg">{t('methodIntro')}</p>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">{t('fourMeasures')}</h2>
      <table className="w-full text-start"><caption className="sr-only">{t('factorWeights')}</caption><thead><tr><th className="py-3 text-start">{t('measure')}</th><th className="text-start">{t('weightLabel')}</th></tr></thead><tbody>{Object.entries(WEIGHTS).map(([key,weight])=><tr key={key} className="border-t border-border"><td className="py-3 pe-4">{t(`factor_${key}`)}</td><td>{Math.round(weight*100)}%</td></tr>)}</tbody></table>
      <p>{t('catchment',{radius:CATCHMENT_RADIUS_MILES})}</p><p>{t('normalization')}</p>
    </section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">{t('sourcesDates')}</h2>
      <p>{t('dataBody')}</p><p>{t('storeScope')}</p>
      <p>{t('published')}: <time dateTime={datasetGeneratedAt() ?? undefined}>{datasetGeneratedAt() ? new Intl.DateTimeFormat(locale, {dateStyle: 'long', timeZone: 'UTC'}).format(new Date(datasetGeneratedAt()!)) : t('dateUnavailable')}</time>. {t('refresh')}</p>
      <ul className="list-disc space-y-2 ps-5"><li><a className="underline" href="https://www.alltheplaces.xyz/">{t('atpData')}</a> · <a className="underline" href="https://creativecommons.org/publicdomain/zero/1.0/">{t('cc0')}</a></li><li><a className="underline" href="https://www.census.gov/data/developers/data-sets/acs-5year/2022.html">{t('acsData')}</a></li><li><a className="underline" href="https://www.openstreetmap.org/copyright">{t('osmData')}</a></li><li><a className="underline" href="https://github.com/milock/thriftly/blob/main/lib/scoring.ts">{t('implementation')}</a> · <a className="underline" href="https://github.com/milock/thriftly/blob/main/lib/reference-ranges.ts">{t('ranges')}</a></li></ul>
    </section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">{t('verify')}</h2><p>{t('verifyBody')}</p><Link className="underline" href="/goodwill">{t('browseLocations')}</Link></section>
  </main><CityFooter/></div>;
}
