import {describe,it,expect} from 'vitest';
import {epaPointQuery,parseEpaPointMatch,normalizeWalkability,accessForStore} from '@/lib/store-access';
describe('historical EPA access signal',()=>{
 it('queries containing polygons using store coordinates rather than nearest centroids',()=>{const q=epaPointQuery({lat:32.7,lon:-117.1});expect(q.get('spatialRel')).toBe('esriSpatialRelIntersects');expect(q.get('geometryType')).toBe('esriGeometryPoint');expect(JSON.parse(q.get('geometry')!)).toEqual({x:-117.1,y:32.7,spatialReference:{wkid:4326}});});
 it('requires exactly one polygon and a sane source score',()=>{expect(parseEpaPointMatch({features:[{attributes:{NatWalkInd:18,GEOID20:'060730001001'}}]})).toEqual({score:18,blockGroupId:'060730001001'});expect(parseEpaPointMatch({features:[]})).toMatchObject({score:null,reason:'no-containing-block-group'});expect(parseEpaPointMatch({features:[{attributes:{}},{attributes:{}}]})).toMatchObject({score:null,reason:'ambiguous-boundary-match'});expect(parseEpaPointMatch({features:[{attributes:{NatWalkInd:999,GEOID20:'060730001001'}}]}).score).toBeNull();});
 it('normalizes only valid values, never converting unknown to poor access',()=>{expect(normalizeWalkability(1)).toBe(0);expect(normalizeWalkability(20)).toBe(100);expect(normalizeWalkability(null)).toBeNull();expect(normalizeWalkability(0)).toBeNull();});
 it('invalidates a join after location changes',()=>{const record={storeId:'test',location:{lat:32.7,lon:-117.1},score:18,blockGroupId:'060730001001',checkedAt:'2026-11-06'};expect(accessForStore({id:'test',location:record.location},[record])).toEqual(record);expect(accessForStore({id:'test',location:{lat:40,lon:-75}},[record])).toBeUndefined();});
});

describe('published nationwide access join',()=>{
 it('covers the exact current store coordinates with valid scores or explicit unknowns',async()=>{
  const {readFileSync}=await import('node:fs');
  const stores=JSON.parse(readFileSync('data/stores-us.json','utf8')).stores;
  const access=JSON.parse(readFileSync('data/store-access.json','utf8'));
  expect(access.count).toBe(stores.length);expect(access.records).toHaveLength(stores.length);
  expect(new Set(access.records.map((r:{storeId:string})=>r.storeId)).size).toBe(stores.length);
  expect(access.source.dataVintage).toContain('2021');expect(access.source.license).toBe('CC0-1.0');
  expect(access.matchedCount).toBeGreaterThan(stores.length*.9);
  for(const store of stores){const record=accessForStore(store,access.records);expect(record).toBeDefined();if(record!.score===null)expect(record!.reason).toBeTruthy();else{expect(record!.score).toBeGreaterThanOrEqual(1);expect(record!.score).toBeLessThanOrEqual(20);expect(record!.blockGroupId).toMatch(/^\d{12}$/);}}
 });
});
