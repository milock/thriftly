import {sitemapIndexXml} from '@/lib/sitemap';

export const dynamic = 'force-static';

export function GET() {
  return new Response(sitemapIndexXml(), {headers: {'Content-Type': 'application/xml; charset=utf-8'}});
}
