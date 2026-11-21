/** Consume published CC0 files only. Never run the upstream Goodwill scraper. */
import {mkdirSync,writeFileSync,renameSync,readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {assertSourceSnapshot,isAcceptedSourceUnchanged} from '../lib/refresh-quality';
import {ATP_MAX_AGE_DAYS,failureReason,recordSourceHealth,retentionStatus} from '../lib/source-health';
interface Run {run_id:string;output_url?:string;stats_url?:string;start_time:string;end_time?:string}
const historyUrl='https://data.alltheplaces.xyz/runs/history.json';
function permitted(url:string){const u=new URL(url);if(u.protocol!=='https:'||!['data.alltheplaces.xyz','alltheplaces-data.openaddresses.io'].includes(u.hostname))throw new Error('Unexpected ATP download host');return url;}
async function get(url:string){const response=await fetch(permitted(url),{headers:{'User-Agent':'Thriftly/1.0 (+https://www.thriftly.xyz)'},signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`ATP HTTP ${response.status}`);return response;}
function output(changed:boolean){if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`changed=${changed}\n`);}
function acceptedSource(){try{return JSON.parse(readFileSync(join(process.cwd(),'data/provenance/goodwill-sources.json'),'utf8'));}catch{return undefined;/* first import */}}
/** Keep serving the accepted Goodwill dataset; never block the other sources. */
function retain(reason:string){
 const accepted=acceptedSource();
 if(!accepted?.sourceUpdatedAt)throw new Error(`No accepted Goodwill dataset to retain: ${reason}`);
 recordSourceHealth({source:'goodwill',status:retentionStatus(accepted.sourceUpdatedAt),sourceUpdatedAt:accepted.sourceUpdatedAt,reason});
 output(false);
}
async function main(){
 const history=await (await get(historyUrl)).json() as Run[];
 const attempts:{runId:string;features:number;errors:number}[]=[];
 const accepted=acceptedSource();
 for(const run of history.filter(r=>r.output_url&&r.stats_url).slice(-6).reverse()){
  let stats;try{stats=await (await get(run.stats_url!)).json();}catch(error){attempts.push({runId:run.run_id,features:0,errors:1});console.warn(`ATP stats unavailable for ${run.run_id}: ${failureReason(error)}`);continue;}
  const result=stats.results?.find((r:{spider:string})=>r.spider==='goodwill');
  attempts.push({runId:run.run_id,features:result?.features??0,errors:result?.errors??1});
  if(!result||result.features<1000||result.errors)continue;
  const url=new URL('output/goodwill.geojson',run.output_url).toString();
  const text=await (await get(url)).text();const data=JSON.parse(text);
  const rawStamp=data.dataset_attributes?.['spider:collection_time'];
  const sourceUpdatedAt=rawStamp ? (rawStamp.endsWith('Z')||/[+-]\d\d:\d\d$/.test(rawStamp)?rawStamp:rawStamp+'Z') : undefined;
  const sha256=createHash('sha256').update(text).digest('hex');
  let unchanged=false;
  if(sourceUpdatedAt){try{unchanged=isAcceptedSourceUnchanged({sourceUpdatedAt,sha256,runId:run.run_id},accepted);}catch{unchanged=true;/* identical but past the 45-day hold */}}
  if(unchanged){
    const failed=attempts.filter(a=>a.errors||!a.features).length;
    console.warn(`::warning::ATP source unchanged since ${sourceUpdatedAt}; retained accepted dataset. Newer failed runs: ${failed}. No new store verification occurred.`);
    recordSourceHealth({source:'goodwill',status:failed?retentionStatus(sourceUpdatedAt):'unchanged',sourceUpdatedAt,reason:failed?`All the Places Goodwill spider failed in the ${failed} newest releases`:undefined});
    output(false);return;
  }
  try{assertSourceSnapshot(sourceUpdatedAt,{maxAgeDays:ATP_MAX_AGE_DAYS,allowHistorical:process.env.ALLOW_HISTORICAL_STORE_SOURCE==='1'});}
  catch{return retain(`newest successful release ${run.run_id} is older than ${ATP_MAX_AGE_DAYS} days`);}
  if(!Array.isArray(data.features)||data.features.length!==result.features){console.warn(`ATP feature count mismatch in ${run.run_id}`);continue;}
  const dir=join(process.cwd(),'.cache/atp');mkdirSync(dir,{recursive:true});
  const file=join(dir,'goodwill.json');
  writeFileSync(file+'.tmp',JSON.stringify({source:'alltheplaces-goodwill',license:'CC0-1.0',sourceUrl:url,sourceUpdatedAt,fetchedAt:new Date().toISOString(),sha256,runId:run.run_id,attempts,data}));renameSync(file+'.tmp',file);
  recordSourceHealth({source:'goodwill',status:'refreshed',sourceUpdatedAt});
  output(true);
  console.log(JSON.stringify({runId:run.run_id,sourceUpdatedAt,features:data.features.length,skippedFailedRuns:attempts.filter(a=>a.errors||!a.features).map(a=>a.runId)}));return;
 }
 retain('no successful Goodwill extract in the latest six All the Places releases');
}
main().catch(e=>{
 const reason=failureReason(e);
 try{retain(reason);}catch{recordSourceHealth({source:'goodwill',status:'failed',reason});console.error(reason);process.exitCode=1;}
});
