import type {Metadata, Viewport} from 'next';
import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages, getTranslations, setRequestLocale} from 'next-intl/server';
import {GeistSans} from 'geist/font/sans';
import {GeistMono} from 'geist/font/mono';
import {Analytics} from '@vercel/analytics/next';
import {ThemeProvider} from '@/components/theme-provider';
import {JsonLd} from '@/components/json-ld';
import {isLocale, locales, localizedPath} from '@/i18n/routing';
import {pageMetadata, SITE_URL} from '@/lib/seo';
import '../globals.css';

export function generateStaticParams() { return locales.map(locale=>({locale})); }
export const viewport: Viewport = {
  width:'device-width',initialScale:1,
  themeColor:[{media:'(prefers-color-scheme: light)',color:'#fafafa'},{media:'(prefers-color-scheme: dark)',color:'#18181b'}],
};
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata> {
  const {locale}=await params;
  if(!isLocale(locale)) notFound();
  const t=await getTranslations({locale,namespace:'pages'});
  const title=t('meta.homeTitle'); const description=t('meta.homeDescription');
  return {
    ...pageMetadata(title,description,'/',true,locale),
    metadataBase:new URL(SITE_URL),
    title:{default:title,template:'%s | Thriftly'},
    applicationName:'Thriftly',creator:'Thriftly',category:'lifestyle',manifest:'/manifest.webmanifest',
  };
}
export default async function LocaleLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}) {
  const {locale}=await params;
  if(!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages=await getMessages();
  const t=await getTranslations({locale,namespace:'pages'});
  const ui=await getTranslations({locale,namespace:"ui"});
  const url=SITE_URL+localizedPath('/',locale);
  return <html lang={locale} dir={locale==='ar'?'rtl':'ltr'} className={`${GeistSans.variable} ${GeistMono.variable} h-full`} suppressHydrationWarning>
    <body className="bg-background text-foreground min-h-full antialiased">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[1000] focus:rounded-md focus:bg-background focus:p-4 focus:text-foreground">{ui("skipMain")}</a>
      <JsonLd data={{'@context':'https://schema.org','@graph':[
        {'@type':'WebSite','@id':`${url}#website`,url,name:'Thriftly',inLanguage:locale,description:t('meta.homeDescription'),publisher:{'@id':`${SITE_URL}/#org`}},
        {'@type':'Organization','@id':`${SITE_URL}/#org`,name:'Thriftly',url:SITE_URL,logo:`${SITE_URL}/icon.svg`},
        {'@type':'WebApplication',name:'Thriftly',url,inLanguage:locale,applicationCategory:'LifestyleApplication',operatingSystem:'Web',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'}},
      ]}}/>
      <NextIntlClientProvider messages={messages}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</ThemeProvider>
      </NextIntlClientProvider>
      <Analytics/>
    </body>
  </html>;
}
