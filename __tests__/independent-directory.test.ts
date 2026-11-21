import {afterEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {matchesBrands,parseStoreFilterIds} from '@/lib/brands';
import {applyFilters,DEFAULT_FILTERS} from '@/lib/filters';
import type {ScoredStore} from '@/lib/types';
import * as locate from '@/lib/locate';
import sitemap from '@/app/sitemap';
import {GET} from '@/app/api/stores/route';
import {BrandNavigation} from '@/components/city/brand-navigation';
import {CityStores} from '@/components/city/city-stores';
import {getCity} from '@/lib/cities';
import {generateMetadata,generateStaticParams} from '@/app/[locale]/independent-thrift-stores/[slug]/page';
vi.mock('next-intl',()=>({useTranslations:()=>((key:string)=>key),useLocale:()=> 'en'}));
vi.mock('@/components/city/ranked-stores',()=>({RankedStores:()=>null}));
vi.mock('next-intl/server',()=>({getTranslations:async()=>((key:string)=>key),setRequestLocale:()=>{}}));
vi.mock('@/i18n/navigation',()=>({Link:({href,children,...props}:{href:string;children:React.ReactNode})=>createElement('a',{href,...props},children)}));
const independent:ScoredStore={id:'independent/test',name:'Independent',operatorType:'independent',location:{lat:32.72,lon:-117.16},distanceMiles:1,score:{total:70,factors:{} as ScoredStore['score']['factors'],catchment:{tractCount:0,population:0}}};
const goodwill:ScoredStore={...independent,id:'goodwill/test',name:'Goodwill',operatorType:'chain',brandId:'goodwill'};
afterEach(()=>vi.restoreAllMocks());
describe('independent store pilot',()=>{
 it('round trips URL selection and combines independent and chain filters without Goodwill fallback',()=>{
  const url=new URL('https://example.test/search?brands=independent,goodwill,independent');const ids=parseStoreFilterIds(url.searchParams.get('brands'));
  expect(ids).toEqual(['goodwill','independent']);expect(new URLSearchParams({brands:ids.join(',')}).get('brands')).toBe('goodwill,independent');
  expect(matchesBrands(independent,['goodwill'])).toBe(false);expect(matchesBrands(independent,['independent'])).toBe(true);
  expect(applyFilters([independent,goodwill],{...DEFAULT_FILTERS,brandIds:['goodwill']}).map(s=>s.id)).toEqual(['goodwill/test']);
  expect(applyFilters([independent,goodwill],{...DEFAULT_FILTERS,brandIds:['independent']}).map(s=>s.id)).toEqual(['independent/test']);
  expect(applyFilters([independent,goodwill],{...DEFAULT_FILTERS,brandIds:ids})).toHaveLength(2);
 });
 it('accepts the independent API selector and rejects unknown selectors',async()=>{
  const search=vi.spyOn(locate,'locateStores').mockResolvedValue([independent]);
  const valid=await GET(new Request('http://localhost/api/stores?lat=32.72&lon=-117.16&brands=independent'));
  expect(valid.status).toBe(200);expect((await valid.json()).stores.map((s:ScoredStore)=>s.id)).toEqual(['independent/test']);
  expect(search).toHaveBeenCalledWith({lat:32.72,lon:-117.16},25,['independent']);
  expect((await GET(new Request('http://localhost/api/stores?lat=32.72&lon=-117.16&brands=independent,bogus'))).status).toBe(400);
 });
 it('links independent pilot only where the route and listed data exist',async()=>{
  vi.spyOn(locate,'locateBundledStores').mockReturnValue([independent,goodwill]);
  const sd=renderToStaticMarkup(await BrandNavigation({city:getCity('san-diego-ca')!,active:'independent-thrift-stores'}));
  expect(sd).toContain('href="/independent-thrift-stores/san-diego-ca"');expect(sd).toContain('aria-current="page"');
  const la=renderToStaticMarkup(await BrandNavigation({city:getCity('los-angeles-ca')!,active:'thrift-stores'}));expect(la).not.toContain('/independent-thrift-stores/');
  expect(sitemap().some(entry=>entry.url==='https://www.thriftly.xyz/independent-thrift-stores/san-diego-ca')).toBe(true);
  expect(sitemap().some(entry=>entry.url==='https://www.thriftly.xyz/independent-thrift-stores/los-angeles-ca')).toBe(false);
  vi.mocked(locate.locateBundledStores).mockReturnValue([goodwill]);
  const empty=renderToStaticMarkup(await BrandNavigation({city:getCity('san-diego-ca')!,active:'independent-thrift-stores'}));
  expect(empty).not.toContain('/independent-thrift-stores/');
  expect(sitemap().some(entry=>entry.url==='https://www.thriftly.xyz/independent-thrift-stores/san-diego-ca')).toBe(false);
 });
 it('serves the four scored pilot records without a chain timestamp or Goodwill leakage',async()=>{
  const center={lat:32.7157,lon:-117.1611};
  const rows=locate.locateBundledStores(center,15,['independent']);
  expect(rows.map(s=>s.id).sort()).toEqual(['independent/father-joes-hillcrest','independent/home-start','independent/humble-heart-ocean-beach','independent/safari-seconds']);
  expect(rows.every(s=>s.operatorType==='independent'&&s.score.catchment.tractCount>0&&s.verification?.method==='official-website-review')).toBe(true);
  expect(locate.locateBundledStores(center,15,['goodwill']).some(s=>s.operatorType==='independent')).toBe(false);
  expect(locate.datasetGeneratedAt(['independent'])).toBeNull();
  expect(locate.datasetGeneratedAt(['independent','goodwill'])).toBeNull();
  expect(locate.datasetGeneratedAt([])).toBeNull();
  const response=await GET(new Request('http://localhost/api/stores?lat=32.7157&lon=-117.1611&radius=15&brands=independent'));
  expect(response.status).toBe(200);const result=await response.json();expect(result.stores).toHaveLength(4);expect(result.generatedAt).toBeNull();
  const all=await GET(new Request('http://localhost/api/stores?lat=32.7157&lon=-117.1611&radius=15'));
  expect((await all.json()).generatedAt).toBeNull();
 });
 it('omits source-updated copy when the source date is unknown',()=>{
  const html=renderToStaticMarkup(createElement(CityStores,{initial:[independent],cityName:'San Diego',lat:32.7,lon:-117.1,radiusMiles:15,brandIds:['independent'],generatedAt:null}));
  expect(html).not.toContain('sourceUpdated');expect(html).toContain('refresh');
 });
 it('restricts prerendering and metadata to San Diego',async()=>{
  expect(generateStaticParams()).toEqual([{slug:'san-diego-ca'}]);
  await expect(generateMetadata({params:Promise.resolve({locale:'en',slug:'los-angeles-ca'})})).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
 });
});
