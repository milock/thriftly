/** Public store facts only. ATP published CC0 extracts and the official SA locator. */
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {isAcceptedChainSnapshot} from '../lib/expanded-store-sources';
import {assertSourceSnapshot} from '../lib/refresh-quality';
const dir=join(process.cwd(),'.cache/expanded');mkdirSync(dir,{recursive:true});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function json(url:string){const u=new URL(url);if(u.protocol!=='https:'||!['data.alltheplaces.xyz','alltheplaces-data.openaddresses.io','satruck.org','locator.uberall.com'].includes(u.hostname))throw new Error('Unexpected source host');const r=await fetch(url,{redirect:'error',headers:{'User-Agent':'Thriftly/1.0 (+https://www.thriftly.xyz)'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(`Source HTTP ${r.status}`);return r.json();}
function save(name:string,value:unknown){const path=join(dir,name);writeFileSync(path+'.tmp',JSON.stringify(value));renameSync(path+'.tmp',path);}
async function atp(){
 const history=await json('https://data.alltheplaces.xyz/runs/history.json');
 const runs=history.filter((r:{output_url?:string;stats_url?:string})=>r.output_url&&r.stats_url).slice(-6).reverse();
 for(const spider of ['savers_ca_us','buffalo_exchange_us']){
  let found=false;
  for(const run of runs){
   const stats=await json(run.stats_url);const result=stats.results.find((r:{spider:string})=>r.spider===spider);
   if(!result||result.errors||!result.features)continue;
   const sourceUrl=new URL(`output/${spider}.geojson`,run.output_url).toString();
   const data=await json(sourceUrl);const stamp=data.dataset_attributes?.['spider:collection_time'];
   const sourceUpdatedAt=stamp?.endsWith('Z')?stamp:stamp+'Z';
   const sha256=createHash('sha256').update(JSON.stringify(data)).digest('hex');
   let accepted;try{accepted=JSON.parse(readFileSync('data/stores-us.json','utf8')).sources.find((s:{brandId:string})=>s.brandId===(spider==='savers_ca_us'?'savers':'buffalo-exchange'));}catch{}
   const unchanged=isAcceptedChainSnapshot({sha256,sourceUpdatedAt,runId:run.run_id},accepted);
   assertSourceSnapshot(sourceUpdatedAt,{allowHistorical:unchanged||process.env.ALLOW_HISTORICAL_STORE_SOURCE==='1'});
   if(unchanged&&Date.now()-Date.parse(sourceUpdatedAt)>7*86400000)console.warn(`::warning::${spider} source unchanged since ${sourceUpdatedAt}; this poll does not mean new store verification.`);
   if(data.features.length!==result.features)throw new Error(`${spider} feature count mismatch`);
   save(`${spider}-snapshot.json`,{sourceUrl,sourceUpdatedAt,fetchedAt:new Date().toISOString(),runId:run.run_id,sha256,data});
   console.log(`${spider}: ${data.features.length} raw, collected ${sourceUpdatedAt}`);found=true;break;
  }
  if(!found)throw new Error(`No successful source: ${spider}`);
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
async function main(){const part=process.env.STORE_FETCH_PART;if(!part||part==='atp')await atp();if(!part||part==='salvation')await salvation();if(!part||part==='out-of-the-closet')await outOfCloset();}
main().catch(e=>{console.error(e instanceof Error?e.message:'Store fetch failed');process.exitCode=1;});
