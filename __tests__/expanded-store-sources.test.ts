import {describe,it,expect} from 'vitest';
import {parseChainAtp,parseSalvation,parseOutOfCloset,isAcceptedChainSnapshot} from '@/lib/expanded-store-sources';
import type {AtpSnapshot} from '@/lib/atp-stores';
const snapshot=(properties:Record<string,string>):AtpSnapshot=>({sourceUrl:'https://example.org/source',sourceUpdatedAt:'2026-10-29T00:00:00Z',fetchedAt:'2026-11-05T00:00:00Z',sha256:'hash',runId:'run',data:{features:[{geometry:{type:'Point',coordinates:[-117.1,32.7]},properties:{ref:'123','addr:country':'US','addr:state':'CA','addr:street_address':'123 Main St',...properties}}]}});
describe('multi-brand source classification',()=>{
 it('keeps retail Savers and excludes standalone donation pins',()=>{
  expect(parseChainAtp(snapshot({shop:'second_hand',brand:'Value Village'}),'savers').stores[0].brand).toBe('Value Village');
  expect(parseChainAtp(snapshot({shop:'second_hand',ref:'CDC123'}),'savers').stores).toHaveLength(0);
  expect(parseChainAtp(snapshot({amenity:'recycling'}),'savers').stores).toHaveLength(0);
 });
 it('uses real Savers-family banners',()=>{expect(parseChainAtp(snapshot({shop:'second_hand',website:'https://stores.savers.com/ca/city/unique-thrift-store-123.html'}),'savers').stores[0].brand).toBe('Unique');});
 it('excludes Buffalo headquarters and keeps shopping outlets',()=>{
  expect(parseChainAtp(snapshot({office:'company',branch:'Tucson Headquarters'}),'buffalo-exchange').stores).toHaveLength(0);
  const store=parseChainAtp(snapshot({shop:'clothes',second_hand:'only',website:'https://buffaloexchange.com/location/buffalo-outlet-texas/'}),'buffalo-exchange').stores[0];
  expect(store.facilityType).toBe('outlet');expect(store.sourcingModel).toBe('buy-sell-trade');
 });
 it('rejects missing or out-of-range coordinates',()=>{const data=snapshot({shop:'second_hand'});data.data.features[0].geometry!.coordinates=[999,32];expect(()=>parseChainAtp(data,'savers')).toThrow();});
 it('uses Salvation Army STORE service evidence, not donation search inclusion',()=>{
  const records=[{Id:'1',LocationGUID:'store',TypeName:'STORE,DROPOFF',Name:'The Salvation Army Thrift Store',State:'CA',City:'San Diego',Latitude:32.7,Longitude:-117.1},{Id:'2',TypeName:'DROPOFF',Name:'Donation Trailer',State:'CA',Latitude:32.7,Longitude:-117.1}];
  const data={queriedAt:'2026-11-05',seedCount:1,completedCount:1,coverage:'partial',queries:{'92104':{sourceUrl:'https://satruck.org/',fetchedAt:'2026-11-05',locations:records}}};
  const result=parseSalvation(data);expect(result.stores).toHaveLength(1);expect(result.rejected).toHaveLength(1);expect(result.stores[0].id).toBe('salvation-army/store');
  expect(()=>parseSalvation({...data,seedCount:2})).toThrow();
 });
 it('quarantines conflicting Salvation Army names and collapses physical duplicates',()=>{
  const base={TypeName:'STORE,DROPOFF',Name:'The Salvation Army Thrift Store',State:'CA',City:'San Diego',Address1:'123 Main St',Zip:'92104',Latitude:32.7,Longitude:-117.1};
  const records=[{...base,Id:'1'},{...base,Id:'2'},{...base,Id:'3',Name:'Salvation Army Warehouse'},{...base,Id:'4',Name:'Thrift Store (Trailer)'}];
  const data={queriedAt:'2026-11-05',seedCount:1,completedCount:1,coverage:'partial',queries:{'92104':{sourceUrl:'https://satruck.org/',fetchedAt:'2026-11-05',locations:records}}};
  const result=parseSalvation(data);expect(result.stores).toHaveLength(1);expect(result.rejected).toHaveLength(3);expect(result.stores[0].sourceAliases).toEqual(['salvation-army/2']);
  records[1].Longitude=-117.5;expect(parseSalvation(data).stores).toHaveLength(0);
 });
 it('requires byte-identical accepted chain source for historical hold policy',()=>{
  const source={sha256:'a',runId:'1',sourceUpdatedAt:'2026-10-29'};
  expect(isAcceptedChainSnapshot(source,source)).toBe(true);
  expect(isAcceptedChainSnapshot(source,{...source,sha256:'b'})).toBe(false);
  expect(isAcceptedChainSnapshot(source)).toBe(false);
 });
 it('excludes non-store names and future openings from the OTC locator',()=>{
  const base={id:1,identifier:'shop',name:'Out of the Closet - Test',lat:32.7,lng:-117.1,country:'US',province:'CA',city:'San Diego',streetAndNumber:'123 Main St',zip:'92104'};
  const data={sourceUrl:'https://outofthecloset.org/locations/',sourceUpdatedAt:'2026-11-05',fetchedAt:'2026-11-05',locations:[base,{...base,id:2,name:'AHF Pharmacy'},{...base,id:3,futureOpeningDate:'2099-01-01'}]};
  expect(parseOutOfCloset(data).stores).toHaveLength(1);expect(parseOutOfCloset(data).rejected).toHaveLength(2);
 });
});

describe('published combined registry',()=>{
 it('preserves Goodwill inputs and publishes uniquely identified shopping destinations',async()=>{
  const {readFileSync}=await import('node:fs');
  const combined=JSON.parse(readFileSync('data/stores-us.json','utf8'));
  const original=JSON.parse(readFileSync('data/goodwill-us.json','utf8'));
  expect(new Set(combined.stores.map((s:{id:string})=>s.id)).size).toBe(combined.stores.length);
  for(const old of original.stores){const current={...combined.stores.find((s:{id:string})=>s.id===old.id)};for(const key of ['brandId','brand','sourcingModel','merchandiseScope'])delete current[key];expect(current).toEqual(old);}
  for(const store of combined.stores){expect(['retail','outlet']).toContain(store.facilityType);expect(store.street).toBeTruthy();expect(store.timezone).toMatch(/\//);expect(store.brandId).toBeTruthy();}
  expect(combined.sources.find((s:{brandId:string})=>s.brandId==='salvation-army').coverage).toContain('partial');
  expect(combined.stores.some((s:{name:string})=>/Pittsburgh salvation army warehouse|idlewild|814 Lanes|Donation Drop Box/i.test(s.name))).toBe(false);
 });
});
