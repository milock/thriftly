import {locales} from '@/i18n/routing';
import {languageSitemapXml, sitemapFileLocale} from '@/lib/sitemap';

// One sitemap per language at /sitemap/<locale>.xml, listed by the index at /sitemap.xml.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map(locale => ({file: `${locale}.xml`}));
}

export async function GET(_request: Request, {params}: {params: Promise<{file: string}>}) {
  const locale = sitemapFileLocale((await params).file);
  if (!locale) return new Response('Not found', {status: 404});
  return new Response(languageSitemapXml(locale), {headers: {'Content-Type': 'application/xml; charset=utf-8'}});
}
