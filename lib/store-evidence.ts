import evidenceData from '@/data/store-evidence.json';
export const DEPARTMENTS=['furniture','books','electronics','housewares','clothing'] as const;
export type Department=typeof DEPARTMENTS[number];
export type PracticalField='parking'|'transit'|'size'|'accessibility';
type Scope={type:'store';id:string}|{type:'brand';id:string;allStoresExplicit:true};
type Common={id:string;appliesTo:Scope;observedAt:string;observationType:'source_checked';caveat?:string;sourcePublishedAt?:string};
type Claim={category:'department';field:Department;value:true;inventoryClaim:false}|{category:'practical';field:PracticalField;value:string|number|boolean;unit?:'sq_ft';comparison?:'greater_than'|'approximately'|'exact'};
type Attribution={source:{name:string;url:string;kind:'official'};verificationMethod:'official-page'|'operator-confirmation';storeVerifiedAt?:string};
export type StoreEvidence=Common&Claim&Attribution;

// Accept date-only values and ISO timestamps with an explicit timezone. Reject
// normalized impossible dates such as February 30, even when Date.parse accepts them.
function validDate(value: unknown): value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value))return false;
 const day=value.slice(0,10); const parsed=Date.parse(day);
 if(value.length>10) { const time=value.slice(11,19).split(':').map(Number); if(time[0]>23||time[1]>59||time[2]>59)return false; }
 return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===day&&Number.isFinite(Date.parse(value));
}
export function validateStoreEvidence(record:StoreEvidence,now=new Date()):boolean{
 if(!record||record.source?.kind!=='official'||typeof record.source?.name!=='string'||!record.source.name.trim())return false;
 if(record.source.kind==='official'&&!['official-page','operator-confirmation'].includes(record.verificationMethod))return false;
 if(typeof record.id!=='string'||!record.id.trim()||typeof record.appliesTo?.id!=='string'||!record.appliesTo.id.trim()||record.observationType!=='source_checked'||!validDate(record.observedAt)||Date.parse(record.observedAt)>now.getTime())return false;
 try{const url=new URL(record.source.url);if(url.protocol!=='https:'||url.username||url.password)return false;}catch{return false;}
 if(record.appliesTo.type!=='store'&&record.appliesTo.type!=='brand')return false;
 if(record.appliesTo.type==='brand'&&record.appliesTo.allStoresExplicit!==true)return false;
 if(record.category==='department')return DEPARTMENTS.includes(record.field)&&record.value===true&&record.inventoryClaim===false;
 if(record.category!=='practical')return false;
 return ['parking','transit','size','accessibility'].includes(record.field)&&(['string','boolean'].includes(typeof record.value)||(typeof record.value==='number'&&Number.isFinite(record.value)));
}
export const STORE_EVIDENCE=evidenceData.records as StoreEvidence[];
/** Curated release statements only; absence is unknown and no claim guarantees current stock. */
export function evidenceForStore(store:{id:string;brandId?:string},records:StoreEvidence[]=STORE_EVIDENCE):StoreEvidence[]{
 return records.filter(r=>validateStoreEvidence(r)&&(r.appliesTo.type==='store'?r.appliesTo.id===store.id:r.appliesTo.allStoresExplicit&&r.appliesTo.id===store.brandId));
}
/** Departments documented by official sources in the release artifact. */
export function documentedDepartments(store:{id:string;brandId?:string},records:StoreEvidence[]=STORE_EVIDENCE):Department[]{
 return [...new Set(evidenceForStore(store,records).filter(r=>r.category==='department').map(r=>r.field as Department))];
}
