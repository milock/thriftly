import {getTranslations} from 'next-intl/server';
import {pageMetadata} from '@/lib/seo';
import {LegalPage} from '@/components/legal-page';
export async function generateMetadata({params}:{params:Promise<{locale:string}>}) {
 const {locale}=await params; const t=await getTranslations({locale,namespace:'legal'});
 return pageMetadata(t('privacyTitle'),t('privacyDescription'),'/privacy',true,locale);
}
export default async function Page({params}:{params:Promise<{locale:string}>}) {const {locale}=await params;return <LegalPage locale={locale} kind="privacy"/>;}
