import sitemap from '@/app/sitemap';

// Plain-text copy of /sitemap.xml: one absolute URL per line, the format Google accepts for text sitemaps.
export const dynamic = 'force-static';

export function GET() {
  const body = sitemap().map(entry => entry.url).join('\n') + '\n';
  return new Response(body, {headers: {'Content-Type': 'text/plain; charset=utf-8'}});
}
