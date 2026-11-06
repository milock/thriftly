import type {Metadata} from 'next';
import {locales, localizedPath} from '@/i18n/routing';

export const SITE_URL = 'https://www.thriftly.xyz';
const ogLocales: Record<string,string> = {en:'en_US',es:'es_US','zh-Hans':'zh_CN','zh-Hant':'zh_TW',tl:'tl_PH',vi:'vi_VN',ar:'ar'};

export function languageAlternates(path:string): Record<string,string> {
  return {...Object.fromEntries(locales.map(locale=>[locale,SITE_URL+localizedPath(path,locale)])), 'x-default':SITE_URL+path};
}
/** One self-canonical URL per locale. Empty guides never advertise language alternates. */
export function pageMetadata(title:string, description:string, path:string, index=true, locale='en'): Metadata {
  const url=localizedPath(path,locale);
  const socialTitle=title.includes('Thriftly')?title:`${title} | Thriftly`;
  const cityImage=/^\/goodwill\/[^/]+$/.test(path);
  const socialImage={url:`${SITE_URL}/${locale}${cityImage?path:''}/opengraph-image/0`,width:1200,height:630,alt:cityImage?title:'Thriftly'};
  return {
    // Own the suffix here so already-branded titles cannot inherit it twice.
    title: {absolute: socialTitle}, description,
    alternates:{canonical:url,...(index?{languages:languageAlternates(path)}:{})},
    robots:{index,follow:true,googleBot:{index,follow:true}},
    openGraph:{title:socialTitle,description,url,type:'website',siteName:'Thriftly',locale:ogLocales[locale]??locale,images:[socialImage]},
    twitter:{card:'summary_large_image',title:socialTitle,description,images:[socialImage]},
  };
}
