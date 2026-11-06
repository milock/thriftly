import {it,expect,vi,afterEach} from 'vitest';
import * as locate from '@/lib/locate';
afterEach(()=>vi.restoreAllMocks());
import sitemap from '@/app/sitemap';
import {pageMetadata,SITE_URL} from '@/lib/seo';
import {generateMetadata} from '@/app/[locale]/goodwill/[slug]/page';
vi.mock('@/i18n/navigation',()=>({Link:()=>null,useRouter:()=>({}),usePathname:()=>'/'}));
vi.mock('next-intl/server',()=>({setRequestLocale:()=>{},getTranslations:async()=>((key:string)=>key)}));

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
  expect(m.title).toEqual({absolute: 'City title | Thriftly'});
  expect(m.openGraph?.title).toBe('City title | Thriftly');
  expect(m.twitter?.title).toBe('City title | Thriftly');
  expect(m.twitter?.description).toBe('City description');
});
it('does not apply the layout suffix twice to an already branded title',()=>{
  const m=pageMetadata('Find thrift stores | Thriftly','Search nearby shops','/search');
  expect(m.title).toEqual({absolute:'Find thrift stores | Thriftly'});
  expect(m.openGraph?.title).toBe('Find thrift stores | Thriftly');
});
it('keeps city-specific share art and supplies a branded fallback for new directory pages',()=>{
  expect(pageMetadata('Goodwill NYC','Description','/goodwill/new-york-ny',true,'es').openGraph?.images).toEqual([
    expect.objectContaining({url:SITE_URL+'/es/goodwill/new-york-ny/opengraph-image/0',alt:'Goodwill NYC'})
  ]);
  expect(pageMetadata('Savers','Description','/savers',true,'es').openGraph?.images).toEqual([
    expect.objectContaining({url:SITE_URL+'/es/opengraph-image/0',alt:'Thriftly'})
  ]);
});
it('noindexes uncovered cities but keeps covered cities indexable',async()=>{
  const empty=vi.spyOn(locate,'locateBundledStores').mockReturnValue([]);
  expect((await generateMetadata({params:Promise.resolve({slug:'phoenix-az',locale:'en'})})).robots).toMatchObject({index:false,follow:true});
  empty.mockRestore();
  expect((await generateMetadata({params:Promise.resolve({slug:'los-angeles-ca',locale:'en'})})).robots).toMatchObject({index:true,follow:true});
});
