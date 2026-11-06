/** Rebuild the combined registry without modifying the preserved Goodwill dataset. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {parseChainAtp,parseSalvation,parseOutOfCloset,isAcceptedChainSnapshot,type ExpandedStore} from '../lib/expanded-store-sources';
import {fetchCountyDemographics} from '../lib/census';
import {tractsWithinRadius,aggregateCatchment} from '../lib/catchment';
import {computeGoodsScore} from '../lib/scoring';
import {CATCHMENT_RADIUS_MILES} from '../lib/reference-ranges';
import type {ScoredStore,TractCentroid,TractDemographics} from '../lib/types';
import {assertSourceSnapshot} from '../lib/refresh-quality';
import {applyStoreCoordinateCorrection,goodwillCoordinateReviewReason,type StoreCoordinateCorrection} from '../lib/store-coordinate-integrity';
try{for(const line of readFileSync('.env.local','utf8').split('\n')){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}}catch{}
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const cache='.cache/expanded';const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const goodwill=read('data/goodwill-us.json');
 const corrections=new Map((read('data/provenance/store-coordinate-corrections.json') as StoreCoordinateCorrection[]).map(correction=>[correction.id,correction]));
 const correctedBaseIds=new Set<string>();
 const base:ScoredStore[]=(goodwill.stores as ScoredStore[]).filter(s=>!goodwillCoordinateReviewReason(s)).map(store=>{
  const corrected=applyStoreCoordinateCorrection(store,corrections.get(store.id));
  if(corrected!==store)correctedBaseIds.add(store.id);
  return {...corrected,brandId:'goodwill',brand:'Goodwill',sourcingModel:'donation',merchandiseScope:'general'};
 });
 const sources=[];const added:ExpandedStore[]=[];const exclusions=[];
 for(const [spider,brandId]of [['savers_ca_us','savers'],['buffalo_exchange_us','buffalo-exchange']] as const){
  const snapshot=read(join(cache,spider+'-snapshot.json'));
  const accepted=existsSync('data/stores-us.json')?read('data/stores-us.json').sources.find((s:{brandId:string})=>s.brandId===brandId):undefined;
  assertSourceSnapshot(snapshot.sourceUpdatedAt,{allowHistorical:isAcceptedChainSnapshot(snapshot,accepted)||process.env.ALLOW_HISTORICAL_STORE_SOURCE==='1'});
  const parsed=parseChainAtp(snapshot,brandId);added.push(...parsed.stores);exclusions.push({brandId,records:parsed.rejected});
  sources.push({brandId,source:'alltheplaces',sourceUrl:snapshot.sourceUrl,sourceUpdatedAt:snapshot.sourceUpdatedAt,fetchedAt:snapshot.fetchedAt,runId:snapshot.runId,sha256:snapshot.sha256,license:'CC0-1.0',rawCount:snapshot.data.features.length,publicCount:parsed.stores.length,rejectedCount:parsed.rejected.length,coverage:'published-chain-extract; nationwide completeness unverified'});
 }
 const sa=read(join(cache,'salvation-army-snapshot.json'));assertSourceSnapshot(sa.queriedAt);
 const parsed=parseSalvation(sa);added.push(...parsed.stores);exclusions.push({brandId:'salvation-army',records:parsed.rejected});
 sources.push({brandId:'salvation-army',source:'official-salvation-army-locator',sourceUrl:'https://satruck.org/ThriftStore/',sourceUpdatedAt:sa.queriedAt,fetchedAt:sa.queriedAt,publicCount:parsed.stores.length,rejectedCount:parsed.rejected.length,queryCount:sa.completedCount,coverage:'partial-geographic-queries; nearest10 perZIP; not national completeness'});
 const closet=read(join(cache,'out-of-the-closet-snapshot.json'));assertSourceSnapshot(closet.sourceUpdatedAt);
 const closetParsed=parseOutOfCloset(closet);added.push(...closetParsed.stores);exclusions.push({brandId:'out-of-the-closet',records:closetParsed.rejected});
 sources.push({brandId:'out-of-the-closet',source:'official-out-of-the-closet-locator',sourceUrl:closet.sourceUrl,sourceUpdatedAt:closet.sourceUpdatedAt,fetchedAt:closet.fetchedAt,publicCount:closetParsed.stores.length,rejectedCount:closetParsed.rejected.length,coverage:'official current locator; national completeness not independently established'});
 for(let i=0;i<added.length;i++)added[i]=applyStoreCoordinateCorrection(added[i],corrections.get(added[i].id));
 if(!added.length||new Set([...base,...added].map(s=>s.id)).size!==base.length+added.length)throw new Error('Empty or duplicate store IDs');
 const previous:ScoredStore[]=existsSync('data/stores-us.json')?read('data/stores-us.json').stores:[];
 const prior=new Map(previous.map(s=>[s.id,s]));
 const reusable=(s:Pick<ScoredStore,'id'|'location'>)=>{const old=prior.get(s.id);return old&&old.location.lat===s.location.lat&&old.location.lon===s.location.lon&&old.score?.catchment.tractCount>0?old:undefined;};
 const centroids:TractCentroid[]=readdirSync('data/tract-centroids').filter(f=>f.endsWith('.json')).flatMap(f=>read(join('data/tract-centroids',f)));
 const scoringInputs=[...base.filter(s=>correctedBaseIds.has(s.id)),...added];
 const catchments=scoringInputs.map(s=>reusable(s)?[]:tractsWithinRadius(s.location,centroids,CATCHMENT_RADIUS_MILES));
 const counties=[...new Set(catchments.flatMap(c=>c.map(t=>t.centroid.geoid.slice(0,5))))];
 const demographics=new Map<string,TractDemographics>();const failed:string[]=[];let idx=0,completed=0;
 const countyDir=join(cache,'census-acs-2022');mkdirSync(countyDir,{recursive:true});
 console.log(`Scoring ${added.length} new-chain records and ${correctedBaseIds.size} corrected Goodwill pins across ${counties.length} counties`);
 const worker=async()=>{while(idx<counties.length){const county=counties[idx++];let list:TractDemographics[]|undefined;
  const path=join(countyDir,county+'.json');try{const saved=read(path);if(Date.now()-Date.parse(saved.fetchedAt)<30*86400000)list=saved.data;}catch{}
  if(!list)for(let attempt=0;attempt<3;attempt++){try{list=await fetchCountyDemographics(county.slice(0,2),county.slice(2));if(!list.length)throw new Error('Empty county');writeFileSync(path,JSON.stringify({fetchedAt:new Date().toISOString(),data:list}));break;}catch{list=undefined;await sleep(1000*(attempt+1));}}
  if(!list)failed.push(county);else for(const d of list)demographics.set(d.geoid,d);
  completed++;if(completed%100===0)console.log(`Census counties: ${completed}/${counties.length}`);await sleep(100);
 }};await Promise.all(Array.from({length:4},worker));if(failed.length)throw new Error(`Incomplete Census scoring: ${failed.length} failed counties`);
 const scored=scoringInputs.map((s,i):ScoredStore=>({...s,distanceMiles:0,score:reusable(s)?.score??computeGoodsScore(aggregateCatchment(catchments[i].flatMap(t=>{const demo=demographics.get(t.centroid.geoid);return demo?[{demo,distanceMiles:t.distanceMiles}]:[]})))}));
 const rescoredGoodwill=new Map(scored.slice(0,correctedBaseIds.size).map(store=>[store.id,store]));
 const stores=[...base.map(store=>rescoredGoodwill.get(store.id)??store),...scored.slice(correctedBaseIds.size)];
 for(const brandId of ['savers','buffalo-exchange','salvation-army','out-of-the-closet']){const count=added.filter(s=>s.brandId===brandId).length;const old=previous.filter(s=>(s as ExpandedStore).brandId===brandId).length;if(count<Math.max(1,old*.9))throw new Error(`Coverage regression for ${brandId}`);}
 const generatedAt=new Date().toISOString();const sourceUpdatedAt=[goodwill.sourceUpdatedAt??goodwill.generatedAt,...sources.map(s=>s.sourceUpdatedAt)].sort()[0];
 const payload={generatedAt,sourceUpdatedAt,source:'multi-source-thrift-registry',count:stores.length,sources:[{brandId:'goodwill',source:goodwill.source,sourceUpdatedAt:goodwill.sourceUpdatedAt,publicCount:base.length,coverage:'validated Goodwill dataset with documented location corrections and quarantines'},...sources],stores};
 mkdirSync('data/provenance',{recursive:true});writeFileSync('data/provenance/expanded-store-sources.json',JSON.stringify({generatedAt,sourceUpdatedAt,sources:payload.sources,exclusions},null,2)+'\n');
 writeFileSync('data/stores-us.json.tmp',JSON.stringify(payload));renameSync('data/stores-us.json.tmp','data/stores-us.json');
 console.log(JSON.stringify({count:stores.length,brands:Object.fromEntries(payload.sources.map(s=>[s.brandId,s.publicCount])),scored:stores.filter(s=>s.score.catchment.tractCount>0).length,sourceUpdatedAt}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Build failed');process.exitCode=1;});
