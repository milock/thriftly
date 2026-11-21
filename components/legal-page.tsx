import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {CityHeader, CityFooter} from '@/components/city/chrome';

export async function LegalPage({locale,kind}: {locale:string;kind:'terms'|'privacy'}) {
  setRequestLocale(locale);
  const t=await getTranslations({locale,namespace:'legal'});
  return <div className="flex min-h-dvh flex-col"><CityHeader/><main id="main-content" tabIndex={-1} className="site-gutter mx-auto w-full max-w-3xl flex-1 py-10 sm:py-16">
    <Link href="/" className="text-sm underline">{t('home')}</Link>
    <h1 className="mt-5 text-3xl font-semibold tracking-tight">{t(`${kind}Title`)}</h1>
    <p className="mt-3 text-sm text-muted-foreground">{t('updated')}</p>
    <div className="mt-8 space-y-5 text-base leading-relaxed">{Array.from({length:kind==='privacy'?5:4},(_,i)=><p key={i}>{t(`${kind}${i}`)}</p>)}</div>
    <ul className="mt-8 space-y-3 underline"><li><a href="https://maps.google.com/help/terms_maps/">{t('googleTerms')}</a></li><li><a href="https://policies.google.com/privacy">{t('googlePrivacy')}</a></li><li><a href="https://vercel.com/legal/privacy-policy">{t('vercelPrivacy')}</a></li><li><a href="https://github.com/milock/thriftly">{t('project')}</a></li></ul>
  </main><CityFooter/></div>;
}
