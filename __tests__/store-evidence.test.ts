import {describe,it,expect} from 'vitest';
import {STORE_EVIDENCE,evidenceForStore,documentedDepartments,validateStoreEvidence,type StoreEvidence} from '@/lib/store-evidence';
import {applyFilters,DEFAULT_FILTERS} from '@/lib/filters';
import type {ScoredStore} from '@/lib/types';
describe('store evidence provenance',()=>{
 it('keeps checked sources distinct from in-person verification and live inventory',()=>{for(const r of STORE_EVIDENCE){expect(validateStoreEvidence(r)).toBe(true);expect(r.observationType).toBe('source_checked');expect('storeVerifiedAt'in r).toBe(false);if(r.category==='department')expect(r.inventoryClaim).toBe(false);}});
 it('does not infer furniture sales from accepted furniture donations',()=>{expect(documentedDepartments({id:'savers/1191',brandId:'savers'})).toEqual(['clothing','books','housewares','electronics']);});
 it('does not spread one store claim to its chain',()=>{expect(evidenceForStore({id:'savers/other',brandId:'savers'})).toEqual([]);});
 it('requires a dated visit for shopper evidence',()=>{const official=STORE_EVIDENCE[0];const report={...official,source:{...official.source,kind:'shopper'},verificationMethod:'shopper-visit'} as StoreEvidence;expect(validateStoreEvidence(report)).toBe(false);});
 it('does not turn service animal policy into wheelchair access',()=>{const r=evidenceForStore({id:'savers/1191'}).find(r=>r.field==='accessibility');expect(r?.value).toContain('service animals');expect(r?.caveat).toContain('does not verify');});
 it('limits historical size evidence to retail floor area',()=>{const r=STORE_EVIDENCE.find(r=>r.field==='size');expect(r?.value).toBe(15000);expect(r?.caveat).toContain('135,000');});
});


describe('curated shopper department evidence',()=>{
 const official=STORE_EVIDENCE.find(r=>r.category==='department')!;
 const visit={...official,id:'reviewed-shopper-visit',appliesTo:{type:'store',id:'test/shopper-only'},source:{name:'Thriftly shopper',url:'https://example.com/review',kind:'shopper'},verificationMethod:'shopper-visit',visitedAt:'2026-11-01',observedAt:'2026-11-02T12:00:00Z'} as StoreEvidence;
 const now=new Date('2026-11-07T00:00:00Z');
 it('includes a dated curated shopper observation without asserting current inventory',()=>{
  expect(validateStoreEvidence(visit,now)).toBe(true);
  expect(documentedDepartments({id:visit.appliesTo.id},[visit])).toEqual([visit.field]);
  expect(visit.category==='department' && visit.inventoryClaim).toBe(false);
 });
 it('includes a curated shopper observation in department search',()=>{
  const store={id:visit.appliesTo.id,name:'test',location:{lat:0,lon:0},distanceMiles:1,score:{total:70,factors:{},catchment:{tractCount:0,population:0}}} as ScoredStore;
  STORE_EVIDENCE.push(visit);
  try { expect(applyFilters([store],{...DEFAULT_FILTERS,departments:[visit.field as 'clothing']})).toEqual([store]); }
  finally { STORE_EVIDENCE.pop(); }
 });
 it('rejects missing, impossible, future, or out-of-order visit and observation dates',()=>{
  const invalid=[{visitedAt:undefined},{visitedAt:'2026-02-30'},{visitedAt:'2026-11-08'}, {visitedAt:'2026-11-03'}, {observedAt:'2026-02-30'}, {observedAt:'2026-11-08'}, {observedAt:'2026-11-02T24:00:00Z'}];
  for(const patch of invalid)expect(validateStoreEvidence({...visit,...patch} as StoreEvidence,now)).toBe(false);
  expect(documentedDepartments({id:visit.appliesTo.id},[{...visit,visitedAt:undefined} as unknown as StoreEvidence])).toEqual([]);
 });
 it('rejects unsafe source URLs, invalid scopes and nonfinite practical values',()=>{
  expect(validateStoreEvidence({...visit,source:{...visit.source,url:'https://user:pass@example.com/'} } as StoreEvidence,now)).toBe(false);
  expect(validateStoreEvidence({...visit,source:{...visit.source,url:'http://example.com/'} } as StoreEvidence,now)).toBe(false);
  expect(validateStoreEvidence({...visit,appliesTo:{type:'other',id:'x'}} as unknown as StoreEvidence,now)).toBe(false);
  expect(validateStoreEvidence({...visit,category:'practical',field:'size',value:Infinity} as StoreEvidence,now)).toBe(false);
 });
});
