import {describe,it,expect} from 'vitest';
import {classifyGoodwill,deduplicateStores} from '@/lib/store-classification';
import {parseOverpass} from '@/lib/overpass';

describe('Goodwill facility classification',()=>{
  it('excludes non-shopping facilities and unrelated Goodwill names',()=>{
    for(const tags of [
      {name:'Goodwill warehouse',building:'warehouse',shop:'charity'},
      {name:'Goodwill Corporate Office',shop:'charity'},
      {name:'Goodwill Industries parking lot',amenity:'parking'},
      {name:'Goodwill Career Solutions',shop:'charity'},
      {name:'Goodwill High School',amenity:'school'},
      {name:'Goodwill Donation Center',amenity:'recycling'},
      {name:'Goodwill'},
      {name:'Some Other Shop',shop:'charity'},
      {name:'Goodwill Store',shop:'charity','disused:shop':'charity'},
    ]) expect(classifyGoodwill(tags).publicShopping).toBe(false);
  });
  it('retains combined retail/donation stores and warehouse outlets',()=>{
    expect(classifyGoodwill({name:'Goodwill Retail, Employment & Donation Center'})).toMatchObject({facilityType:'retail',publicShopping:true});
    expect(classifyGoodwill({name:'Goodwill Distribution Center - North Outlet',building:'warehouse'})).toMatchObject({facilityType:'outlet',publicShopping:true});
    expect(classifyGoodwill({name:'Goodwill',shop:'charity'}).publicShopping).toBe(true);
  });
  it('preserves classification evidence and assigns the store time zone',()=>{
    const [s]=parseOverpass({osm3s:{timestamp_osm_base:'2026-11-03T00:00:00Z'},elements:[{type:'node',id:1,lat:40.75,lon:-73.98,tags:{name:'Goodwill',shop:'charity'}}]});
    expect(s.timezone).toBe('America/New_York');
    expect(s.sourceTags?.shop).toBe('charity');
    expect(s.provenance?.sourceUpdatedAt).toBe('2026-11-03T00:00:00Z');
    expect(s.facilityType).toBe('retail');
  });
  it('collapses same-address point/building duplicates without merging adjacent services',()=>{
    const base={name:'Goodwill',address:'1 Main St',location:{lat:40,lon:-75},facilityType:'retail' as const};
    const a=deduplicateStores([{...base,id:'node/1'},{...base,id:'way/2'},{...base,id:'node/3',facilityType:'outlet'}]);
    expect(a).toHaveLength(2);expect(a[0].sourceAliases).toEqual(['way/2']);
  });
});

describe('published shopper dataset',()=>{
  it('has time zones and excludes quarantined non-shopping destinations',async()=>{
    const {readFileSync}=await import('node:fs');
    const data=JSON.parse(readFileSync('data/goodwill-us.json','utf8'));
    const quarantined=JSON.parse(readFileSync('data/provenance/legacy-quarantine.json','utf8'));
    const ids=new Set(data.stores.map((s:{id:string})=>s.id));
    expect(data.stores.length).toBeGreaterThan(2000);
    expect(ids.size).toBe(data.stores.length);
    for(const s of data.stores){
      expect(s.timezone).toMatch(/^[A-Za-z_]+\//);
      expect(['retail','outlet','unknown']).toContain(s.facilityType);
    }
    if(data.source==='openstreetmap-legacy'){
      for(const s of quarantined.records)expect(ids.has(s.id)).toBe(false);
      expect(ids.has('way/1087204046')).toBe(false);
      expect(ids.has('node/2160251352')).toBe(false);
      expect(ids.has('node/5268865302')).toBe(true);
    } else {
      for(const s of data.stores)expect(['retail','outlet']).toContain(s.facilityType);
    }
  });
});
