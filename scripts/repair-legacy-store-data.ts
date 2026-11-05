/** Reversible cleanup for the pre-classification snapshot; never claims fresh source data. */
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import tzLookup from 'tz-lookup';
import {classifyGoodwill,deduplicateStores} from '../lib/store-classification';
import type {ScoredStore} from '../lib/types';

const file=join(process.cwd(),'data/goodwill-us.json');
const data=JSON.parse(readFileSync(file,'utf8')) as {generatedAt:string; sourceUpdatedAt?:string; stores:ScoredStore[]; [key:string]:unknown};
if(data.source && data.source !== 'openstreetmap-legacy') throw new Error('Legacy repair must not overwrite a newer classified source');
const sourceUpdatedAt=data.sourceUpdatedAt ?? data.generatedAt;
const kept:ScoredStore[]=[];const rejected:ScoredStore[]=[];
for(const original of data.stores){
  const classification=classifyGoodwill(original.sourceTags ?? {name:original.name});
  const sourceTags=original.sourceTags;
  const store:ScoredStore={...original,timezone:tzLookup(original.location.lat,original.location.lon),facilityType:classification.facilityType,
    provenance:{source:'openstreetmap-legacy',sourceId:original.id,sourceUrl:`https://www.openstreetmap.org/${original.id}`,sourceUpdatedAt,
      classificationBasis:classification.basis==='no-positive-retail-evidence' ? 'legacy-unverified-retail' : classification.basis}};
  if(!classification.publicShopping && classification.basis!=='no-positive-retail-evidence')rejected.push(store);
  else kept.push({...store,...(sourceTags ? {sourceTags}: {})});
}
const publicStores=deduplicateStores(kept) as ScoredStore[];
const dir=join(process.cwd(),'data/provenance');mkdirSync(dir,{recursive:true});
const reviewFile=join(dir,'legacy-quarantine.json');
let prior:ScoredStore[]=[];try{prior=JSON.parse(readFileSync(reviewFile,'utf8')).records ?? [];}catch{/* first repair */}
const records=[...new Map([...prior,...rejected].map(s=>[s.id,s])).values()];
writeFileSync(reviewFile,JSON.stringify({sourceUpdatedAt,reviewedAt:new Date().toISOString(),note:'Quarantined from shopper results pending affirmative public-retail evidence; not a claim of permanent closure.',count:records.length,records},null,2)+'\n');
writeFileSync(file+'.tmp',JSON.stringify({...data,sourceUpdatedAt,processedAt:new Date().toISOString(),source:'openstreetmap-legacy',count:publicStores.length,stores:publicStores}));
renameSync(file+'.tmp',file);
console.log(JSON.stringify({sourceUpdatedAt,publicStores:publicStores.length,newlyQuarantined:rejected.length,quarantinedTotal:records.length,missingTimezone:publicStores.filter(s=>!s.timezone).length}));
