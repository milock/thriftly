import {describe,it,expect} from 'vitest';
import {STORE_EVIDENCE,evidenceForStore,documentedDepartments,validateStoreEvidence,type StoreEvidence} from '@/lib/store-evidence';
describe('store evidence provenance',()=>{
 it('keeps checked sources distinct from in-person verification and live inventory',()=>{for(const r of STORE_EVIDENCE){expect(validateStoreEvidence(r)).toBe(true);expect(r.observationType).toBe('source_checked');expect('storeVerifiedAt'in r).toBe(false);if(r.category==='department')expect(r.inventoryClaim).toBe(false);}});
 it('does not infer furniture sales from accepted furniture donations',()=>{expect(documentedDepartments({id:'savers/1191',brandId:'savers'})).toEqual(['clothing','books','housewares','electronics']);});
 it('does not spread one store claim to its chain',()=>{expect(evidenceForStore({id:'savers/other',brandId:'savers'})).toEqual([]);});
 it('rejects non-official evidence',()=>{const official=STORE_EVIDENCE[0];const report={...official,source:{...official.source,kind:'shopper'},verificationMethod:'shopper-visit'} as unknown as StoreEvidence;expect(validateStoreEvidence(report)).toBe(false);});
 it('does not turn service animal policy into wheelchair access',()=>{const r=evidenceForStore({id:'savers/1191'}).find(r=>r.field==='accessibility');expect(r?.value).toContain('service animals');expect(r?.caveat).toContain('does not verify');});
 it('limits historical size evidence to retail floor area',()=>{const r=STORE_EVIDENCE.find(r=>r.field==='size');expect(r?.value).toBe(15000);expect(r?.caveat).toContain('135,000');});
});


describe('evidence validation',()=>{
 const official=STORE_EVIDENCE.find(r=>r.category==='department')!;
 const now=new Date('2026-11-07T00:00:00Z');
 it('rejects impossible and future observation dates',()=>{
  for(const observedAt of ['2026-02-30','2026-11-08','2026-11-02T24:00:00Z']) expect(validateStoreEvidence({...official,observedAt},now)).toBe(false);
 });
 it('rejects unsafe source URLs, invalid scopes and nonfinite practical values',()=>{
  expect(validateStoreEvidence({...official,source:{...official.source,url:'https://user:pass@example.com/'}},now)).toBe(false);
  expect(validateStoreEvidence({...official,source:{...official.source,url:'http://example.com/'}},now)).toBe(false);
  expect(validateStoreEvidence({...official,appliesTo:{type:'other',id:'x'}} as unknown as StoreEvidence,now)).toBe(false);
  expect(validateStoreEvidence({...official,category:'practical',field:'size',value:Infinity} as StoreEvidence,now)).toBe(false);
 });
});
