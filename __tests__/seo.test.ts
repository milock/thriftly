import {it,expect,vi,afterEach} from 'vitest';
import * as locate from '@/lib/locate';
afterEach(()=>vi.restoreAllMocks());
import sitemap from '@/app/sitemap';
import {pageMetadata,SITE_URL} from '@/lib/seo';
import {generateMetadata} from '@/app/goodwill/[slug]/page';

it('excludes empty city pages and invented modification dates from the sitemap',()=>{
  const entries=sitemap(); const urls=entries.map(x=>x.url);
  const empty=vi.spyOn(locate,'locateBundledStores').mockReturnValue([]);
  expect(sitemap().some(x=>x.url===SITE_URL+'/goodwill/phoenix-az')).toBe(false);
  empty.mockRestore();
  expect(urls).toContain(SITE_URL+'/goodwill/los-angeles-ca');
  expect(urls).toContain(SITE_URL+'/goodwill/los-angeles-ca/outlets');
  expect(urls).toContain(SITE_URL+'/how-we-score');
  expect(new Set(urls).size).toBe(urls.length);
  expect(entries.every(x=>x.lastModified===undefined)).toBe(true);
});
it('keeps city-specific identity in canonical, Open Graph and Twitter',()=>{
  const m=pageMetadata('City title','City description','/goodwill/example');
  expect(m.alternates?.canonical).toBe('/goodwill/example');
  expect(m.openGraph?.title).toBe('City title | Thriftly');
  expect(m.twitter?.title).toBe('City title | Thriftly');
  expect(m.twitter?.description).toBe('City description');
});
it('noindexes uncovered cities but keeps covered cities indexable',async()=>{
  const empty=vi.spyOn(locate,'locateBundledStores').mockReturnValue([]);
  expect((await generateMetadata({params:Promise.resolve({slug:'phoenix-az'})})).robots).toMatchObject({index:false,follow:true});
  empty.mockRestore();
  expect((await generateMetadata({params:Promise.resolve({slug:'los-angeles-ca'})})).robots).toMatchObject({index:true,follow:true});
});
