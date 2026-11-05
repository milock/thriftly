import {describe,it,expect,vi} from 'vitest';
import {parseAtpStores,type AtpSnapshot} from '@/lib/atp-stores';
import {assertSourceSnapshot,isAcceptedSourceUnchanged} from '@/lib/refresh-quality';
const snapshot=(categories:string):AtpSnapshot=>({sourceUrl:'https://example.com/goodwill.geojson',sourceUpdatedAt:'2026-10-11T16:21:48Z',fetchedAt:'2026-11-04T00:00:00Z',sha256:'hash',runId:'run',data:{features:[{geometry:{type:'Point',coordinates:[-73.98,40.75]},properties:{ref:'stable-guid','addr:country':'US','addr:state':'NY','addr:city':'New York','addr:street_address':'1 Main Street',shop:'charity',store_categories:categories}}]}});
describe('ATP service categories',()=>{
 it('excludes donation-only sites despite generic charity shop tags',()=>{
  const result=parseAtpStores(snapshot('Donation Center'));
  expect(result.stores).toHaveLength(0);expect(result.review[0].facilityType).toBe('donation');
 });
 it('retains mixed retail and donations, and identifies outlets',()=>{
  expect(parseAtpStores(snapshot('Donation Center,Retail Store')).stores[0].facilityType).toBe('retail');
  const store=parseAtpStores(snapshot('Retail Store,Outlet Store')).stores[0];
  expect(store.facilityType).toBe('outlet');expect(store.timezone).toBe('America/New_York');
  expect(store.sourceTags?.store_categories).toBe('Retail Store,Outlet Store');
  expect(store.provenance?.sourceUpdatedAt).toBe('2026-10-11T16:21:48Z');
 });
 it('preserves a confidently matched legacy identity but never a warehouse identity',()=>{
  const old={id:'node/123',name:'Goodwill',street:'1 Main St',location:{lat:40.75,lon:-73.98},facilityType:'retail' as const};
  expect(parseAtpStores(snapshot('Retail Store'),[old]).stores[0].id).toBe('node/123');
  expect(parseAtpStores(snapshot('Retail Store'),[{...old,facilityType:'warehouse'}]).stores[0].id).toBe('goodwill/stable-guid');
 });
 it('rejects missing categories and non-US facilities',()=>{
  expect(parseAtpStores(snapshot('')).stores).toHaveLength(0);
  const data=snapshot('Retail Store');data.data.features[0].properties['addr:country']='CA';
  expect(parseAtpStores(data).stores).toHaveLength(0);
 });
});
describe('source freshness',()=>{
 it('requires a deliberate bounded override for a verified older release',()=>{
  vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-04T00:00:00Z'));
  try {
   const candidate={sourceUpdatedAt:'2026-10-11T16:21:48Z',sha256:'hash',runId:'run'};
   expect(isAcceptedSourceUnchanged(candidate,{...candidate,partitions:[{sha256:'hash'}]})).toBe(true);
   expect(isAcceptedSourceUnchanged(candidate,{...candidate,partitions:[{sha256:'changed'}]})).toBe(false);
   expect(()=>isAcceptedSourceUnchanged({...candidate,sourceUpdatedAt:'2026-08-01T00:00:00Z'},{...candidate,sourceUpdatedAt:'2026-08-01T00:00:00Z',partitions:[{sha256:'hash'}]})).toThrow();
   expect(()=>assertSourceSnapshot('2026-10-11T16:21:48Z')).toThrow();
   expect(()=>assertSourceSnapshot('2026-10-11T16:21:48Z',{allowHistorical:true})).not.toThrow();
   expect(()=>assertSourceSnapshot('2026-08-31T00:00:00Z',{allowHistorical:true})).toThrow();
   expect(()=>assertSourceSnapshot('2026-11-05T00:00:00Z')).toThrow();
  } finally {vi.restoreAllMocks();}
 });
});
