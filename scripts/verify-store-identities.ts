/** Free identity upkeep after each refresh, with no Google API calls:
 * 1. carry confirmed Google identities through small source edits;
 * 2. corroborate listings against OpenStreetMap shops of the same brand. */
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {carryForwardConfirmations,confirmedPlaceIds,parseGooglePlaceRegistry} from '../lib/google-place-registry';
import {BLOCKING_GOOGLE_REASONS,corroborateStores,parseCorroborationRegistry,type OsmSnapshot} from '../lib/osm-corroboration';
import {ageDays} from '../lib/source-health';
import type {Store} from '../lib/types';

const read=(path:string)=>JSON.parse(readFileSync(resolve(path),'utf8'));
const OSM_MAX_AGE_DAYS=21;
function atomicJson(path:string,value:unknown){const target=resolve(path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target+'.tmp',JSON.stringify(value,null,2)+'\n');renameSync(target+'.tmp',target);}

function main(){
 const args=process.argv.slice(2);const previousPath=args[args.indexOf('--previous')+1];
 const current:Store[]=read('data/stores-us.json').stores;
 const previous:Store[]=args.includes('--previous')&&previousPath&&existsSync(previousPath)?read(previousPath).stores:[];

 const registry=parseGooglePlaceRegistry(read('data/google-place-ids.json'));
 const {registry:next,carried}=carryForwardConfirmations(registry,previous,current);
 if(carried.length){atomicJson('data/google-place-ids.json',next);}
 atomicJson('data/provenance/google-place-carry-forward.json',{version:1,checkedAt:new Date().toISOString(),count:carried.length,records:carried});
 console.log(`Google identities carried through small edits: ${carried.length}`);

 const osmPath='.cache/osm/thrift-us.json';
 let osm:OsmSnapshot|undefined;try{if(existsSync(osmPath))osm=read(osmPath);}catch{}
 if(!osm||ageDays(osm.osmBase)>OSM_MAX_AGE_DAYS){console.warn('::warning::No current OpenStreetMap snapshot; kept existing corroborations (each still requires an unchanged listing).');return;}
 let blocked=new Set<string>();
 try{blocked=new Set(read('data/provenance/google-place-match-review.json').decisions.filter((d:{reason:string})=>BLOCKING_GOOGLE_REASONS.has(d.reason)).map((d:{storeId:string})=>d.storeId));}catch{}
 const records=corroborateStores(current,osm.elements,{blocked});
 const existing=parseCorroborationRegistry(existsSync('data/store-corroborations.json')?read('data/store-corroborations.json'):null);
 const previousIds=new Set(existing.records.map(r=>r.storeId));
 atomicJson('data/store-corroborations.json',{version:1,source:'openstreetmap',license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',osmBase:osm.osmBase,records});
 const confirmed=confirmedPlaceIds(current,next);
 console.log(JSON.stringify({corroborated:records.length,newlyPublic:records.filter(r=>!confirmed.has(r.storeId)).length,added:records.filter(r=>!previousIds.has(r.storeId)).length,dropped:[...previousIds].filter(id=>!records.some(r=>r.storeId===id)).length,blockedByGoogle:blocked.size}));
}
main();
