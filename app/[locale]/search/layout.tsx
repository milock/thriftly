import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {pageMetadata} from '@/lib/seo';
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata> {
 const {locale}=await params; const t=await getTranslations({locale,namespace:'ui'});
 return pageMetadata(t('searchMetaTitle'),t('searchMetaDescription'),'/search',true,locale);
}
export default function SearchLayout({children}:{children:React.ReactNode}){return children;}
