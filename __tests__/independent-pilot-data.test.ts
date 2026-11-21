import {describe,it,expect} from 'vitest';
import pilot from '@/data/independent-san-diego.json';
import registry from '@/data/stores-us.json';
import {hasOnlineVerification,parseIndependentStores} from '@/lib/independent-stores';
import type {ExpandedStore} from '@/lib/expanded-store-sources';
import {documentedDepartments} from '@/lib/store-evidence';

const source={stores:pilot.stores as ExpandedStore[]};
describe('curated San Diego pilot',()=>{
 it('publishes the reviewed local shops unchanged through the combined registry',()=>{
  const parsed=parseIndependentStores(source);
  expect(parsed).toHaveLength(4);
  for(const record of parsed){
   const published=registry.stores.find(store=>store.id===record.id);
   expect(published).toMatchObject(record);
   expect(published?.score.catchment.tractCount).toBeGreaterThan(0);
  }
 });
 it('does not turn retrieval dates into verification',()=>{
  expect(hasOnlineVerification({provenance:source.stores[0].provenance})).toBe(false);
  expect(hasOnlineVerification(source.stores[0],0)).toBe(false);
  expect(hasOnlineVerification({...source.stores[0],verification:{...source.stores[0].verification!,sourceUrls:['javascript:alert(1)']}})).toBe(false);
 });
 it('fails closed for donation-only, duplicate, unreviewed or geographically wrong records',()=>{
  const store=source.stores[0];
  for(const patch of [{facilityType:'donation'},{verification:undefined},{operatorType:'chain'},{location:{lat:40,lon:-73}},{website:'javascript:alert(1)'},{street:'Office'}]){
   expect(()=>parseIndependentStores({stores:[{...store,...patch} as ExpandedStore]})).toThrow();
  }
  expect(()=>parseIndependentStores({stores:[store,store]})).toThrow();
 });
 it('keeps contradictory hours unknown and excludes closed shops and the Safari office',()=>{
  expect(source.stores.find(store=>store.brandId==='home-start')?.openingHours).toBeUndefined();
  expect(source.stores.find(store=>store.brandId==='safari-seconds')?.street).toBe('6533 El Cajon Blvd');
  expect(source.stores.some(store=>/rock thrift|auntie helen|5952/i.test(`${store.name} ${store.address}`))).toBe(false);
 });
 it('only filters by the departments documented for each individual shop',()=>{
  expect(documentedDepartments(source.stores.find(store=>store.brandId==='home-start')!)).toEqual(expect.arrayContaining(['clothing','furniture','housewares','electronics']));
  expect(documentedDepartments(source.stores.find(store=>store.brandId==='humble-heart-ocean-beach')!)).toEqual(['clothing']);
 });
});
