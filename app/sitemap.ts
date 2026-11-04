import type { MetadataRoute } from 'next';
import {STATES,CITIES} from '@/lib/cities';
import {cityCentroid} from '@/lib/city-data';
import {locateBundledStores} from '@/lib/locate';
import {SITE_URL} from '@/lib/seo';

// Do not invent lastModified dates from deployment time. Emit only pages with
// usable location data; empty city guides remain accessible with noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths=['/','/search','/goodwill','/how-we-score','/goodwill/los-angeles-ca/outlets'];
  paths.push(...STATES.map(s=>`/goodwill/state/${s.slug}`));
  paths.push(...CITIES.filter(c=>{
    const p=cityCentroid(c.slug);
    return p && locateBundledStores(p,c.radiusMiles).length>0;
  }).map(c=>`/goodwill/${c.slug}`));
  return paths.map(path=>({url:SITE_URL+path}));
}
