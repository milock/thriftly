import type { Metadata } from 'next';

export const SITE_URL = 'https://www.thriftly.xyz';

/** Give each page its own search and social identity rather than inheriting home. */
export function pageMetadata(title: string, description: string, path: string, index = true): Metadata {
  return {
    title, description,
    alternates: {canonical: path},
    robots: {index, follow: true, googleBot: {index, follow:true}},
    openGraph: {title: `${title} | Thriftly`, description, url:path, type:'website', siteName:'Thriftly'},
    twitter: {card:'summary_large_image', title:`${title} | Thriftly`, description},
  };
}
