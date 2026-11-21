/** Public store facts only. ATP published CC0 extracts and the official SA locator. */
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {isAcceptedChainSnapshot} from '../lib/expanded-store-sources';
import {assertSourceSnapshot} from '../lib/refresh-quality';
import {ATP_MAX_AGE_DAYS,failureReason,recordSourceHealth} from '../lib/source-health';
const dir=join(process.cwd(),'.cache/expanded');mkdirSync(dir,{recursive:true});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function json(url:string){const u=new URL(url);if(u.protocol!=='https:'||!['data.alltheplaces.xyz','alltheplaces-data.openaddresses.io','satruck.org','locator.uberall.com'].includes(u.hostname))throw new Error('Unexpected source host');const r=await fetch(url,{redirect:'error',headers:{'User-Agent':'Thriftly/1.0 (+https://www.thriftly.xyz)'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(`Source HTTP ${r.status}`);return r.json();}
function save(name:string,value:unknown){const path=join(dir,name);writeFileSync(path+'.tmp',JSON.stringify(value));renameSync(path+'.tmp',path);}
const ATP_SPIDERS={savers_ca_us:'savers',buffalo_exchange_us:'buffalo-exchange'} as const;
/** Newest successful release per spider. One spider's gap never blocks another. */
async function atp(){
 const history=await json('https://data.alltheplaces.xyz/runs/history.json');
 const runs=history.filter((r:{output_url?:string;stats_url?:string})=>r.output_url&&r.stats_url).slice(-6).reverse();
 const stats=new Map<string,{results:{spider:string;errors?:number;features?:number}[]}>();
 for(const [spider,brandId] of Object.entries(ATP_SPIDERS)){
  try{
   let accepted;try{accepted=JSON.parse(readFileSync('data/stores-us.json','utf8')).sources.find((s:{brandId:string})=>s.brandId===brandId);}catch{}
   let saved=false;let reason='no successful release in the latest six';
   for(const run of runs){
    if(!stats.has(run.run_id)){try{stats.set(run.run_id,await json(run.stats_url));}catch{continue;}}
    const result=stats.get(run.run_id)!.results.find(r=>r.spider===spider);
    if(!result||result.errors||!result.features)continue;
    const sourceUrl=new URL(`output/${spider}.geojson`,run.output_url).toString();
    const data=await json(sourceUrl);const stamp=data.dataset_attributes?.['spider:collection_time'];
    const sourceUpdatedAt=stamp?.endsWith('Z')?stamp:stamp+'Z';
    const sha256=createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const unchanged=isAcceptedChainSnapshot({sha256,sourceUpdatedAt,runId:run.run_id},accepted);
    try{assertSourceSnapshot(sourceUpdatedAt,{maxAgeDays:ATP_MAX_AGE_DAYS,allowHistorical:unchanged||process.env.ALLOW_HISTORICAL_STORE_SOURCE==='1'});}
    catch{reason=`newest successful release ${run.run_id} is older than ${ATP_MAX_AGE_DAYS} days`;break;}
    if(data.features.length!==result.features){reason=`feature count mismatch in ${run.run_id}`;continue;}
    save(`${spider}-snapshot.json`,{sourceUrl,sourceUpdatedAt,fetchedAt:new Date().toISOString(),runId:run.run_id,sha256,data});
    console.log(`${spider}: ${data.features.length} raw, collected ${sourceUpdatedAt}`);
    recordSourceHealth({source:brandId,status:unchanged?'unchanged':'refreshed',sourceUpdatedAt});saved=true;break;
   }
   if(!saved)throw new Error(reason);
  }catch(error){
   // build-expanded-stores keeps this brand's last accepted records.
   recordSourceHealth({source:brandId,status:'failed',reason:failureReason(error)});
  }
 }
}
async function salvation(){
 const original=JSON.parse(readFileSync('data/goodwill-us.json','utf8'));
 const cells=new Map<string,string>();
 for(const s of original.stores){const zip=s.sourceTags?.['addr:postcode'];if(/^\d{5}/.test(zip??''))cells.set(`${Math.floor(s.location.lat/1.5)},${Math.floor(s.location.lon/1.5)}`,zip.slice(0,5));}
 const zips=[...new Set(cells.values())].sort();
 let prior:{queriedAt?:string;queries?:Record<string,unknown>}={};try{prior=JSON.parse(readFileSync(join(dir,'salvation-army-snapshot.json'),'utf8'));}catch{}
 const queries:Record<string,unknown>=prior.queriedAt&&Date.now()-Date.parse(prior.queriedAt)<86400000?Object.fromEntries(Object.entries(prior.queries??{}).filter(([zip])=>zips.includes(zip))):{};
 let fetched=0;
 for(const zip of zips){
  if(queries[zip])continue;
  const sourceUrl=`https://satruck.org/apiservices/pickup/donategoods/locations?Type=3&ZipCode=${zip}&otid=0`;
  let response;
  for(let attempt=0;attempt<3;attempt++){try{response=await json(sourceUrl);if(!response.Success||!Array.isArray(response.RetVal?.Locations))throw new Error('Invalid SA response');break;}catch(error){if(attempt===2)throw error;await sleep(2000*(attempt+1));}}
  // Strip HTML and individual contact information before even caching.
  const locations=response.RetVal.Locations.map((r:Record<string,unknown>)=>Object.fromEntries(['Id','LocationGUID','Latitude','Longitude','Name','Address1','Address2','City','State','Zip','Type','TypeName','Website','Hours','ContactPhone'].map(k=>[k,r[k]])));
  queries[zip]={sourceUrl,fetchedAt:new Date().toISOString(),locations};fetched++;
  save('salvation-army-snapshot.json',{source:'official-salvation-army-locator',coverage:'partial-geographic-queries',queriedAt:new Date().toISOString(),seedCount:zips.length,completedCount:Object.keys(queries).length,queries});
  if(fetched%25===0)console.log(`Salvation Army: ${Object.keys(queries).length}/${zips.length} geographic queries`);
  await sleep(1000);
 }
 console.log(`Salvation Army: ${Object.keys(queries).length} completed geographic queries; national completeness not established`);
}
async function outOfCloset(){
 const sourceUrl='https://outofthecloset.org/locations/';
 const html=await (await fetch(sourceUrl,{signal:AbortSignal.timeout(45000)})).text();
 const publicWidgetId=html.match(/id="store-finder-widget" data-key="([^"]+)"/)?.[1];
 if(!publicWidgetId)throw new Error('Out of the Closet locator changed');
 await sleep(10000); // respect the operator's crawl delay
 const data=await json(`https://locator.uberall.com/api/storefinders/${publicWidgetId}/locations/all`);
 if(!Array.isArray(data.response?.locations)||data.response.locations.length<15)throw new Error('Incomplete Out of the Closet source');
 const fields=['id','identifier','name','lat','lng','country','province','city','streetAndNumber','zip','phone','openingHours','futureOpeningDate'];
 const locations=data.response.locations.map((p:Record<string,unknown>)=>Object.fromEntries(fields.map(k=>[k,p[k]])));
 const fetchedAt=new Date().toISOString();save('out-of-the-closet-snapshot.json',{sourceUrl,sourceUpdatedAt:fetchedAt,fetchedAt,locations});
 console.log(`Out of the Closet: ${locations.length} official locator records`);
}
/** Each source fails on its own. The build step decides whether last-good data covers it. */
async function main(){
 const part=process.env.STORE_FETCH_PART;
 const parts:[string,string,()=>Promise<void>][]=[['atp','savers',atp],['salvation','salvation-army',salvation],['out-of-the-closet','out-of-the-closet',outOfCloset]];
 for(const [name,source,run] of parts){
  if(part&&part!==name)continue;
  try{await run();if(name!=='atp')recordSourceHealth({source,status:'refreshed',sourceUpdatedAt:new Date().toISOString()});}
  catch(error){
   const reason=failureReason(error);
   if(name==='atp')for(const brandId of Object.values(ATP_SPIDERS))recordSourceHealth({source:brandId,status:'failed',reason});
   else recordSourceHealth({source,status:'failed',reason});
  }
 }
}
main();
