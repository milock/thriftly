/** Consume published CC0 files only. Never run the upstream Goodwill scraper. */
import {mkdirSync,writeFileSync,renameSync,readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {assertSourceSnapshot,isAcceptedSourceUnchanged} from '../lib/refresh-quality';
interface Run {run_id:string;output_url?:string;stats_url?:string;start_time:string;end_time?:string}
const historyUrl='https://data.alltheplaces.xyz/runs/history.json';
function permitted(url:string){const u=new URL(url);if(u.protocol!=='https:'||!['data.alltheplaces.xyz','alltheplaces-data.openaddresses.io'].includes(u.hostname))throw new Error('Unexpected ATP download host');return url;}
async function get(url:string){const response=await fetch(permitted(url),{headers:{'User-Agent':'Thriftly/1.0 (+https://www.thriftly.xyz)'},signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`ATP HTTP ${response.status}`);return response;}
async function main(){
 const history=await (await get(historyUrl)).json() as Run[];
 const attempts:{runId:string;features:number;errors:number}[]=[];
 for(const run of history.filter(r=>r.output_url&&r.stats_url).slice(-6).reverse()){
  const stats=await (await get(run.stats_url!)).json();
  const result=stats.results?.find((r:{spider:string})=>r.spider==='goodwill');
  attempts.push({runId:run.run_id,features:result?.features??0,errors:result?.errors??1});
  if(!result||result.features<1000||result.errors)continue;
  const url=new URL('output/goodwill.geojson',run.output_url).toString();
  const text=await (await get(url)).text();const data=JSON.parse(text);
  const rawStamp=data.dataset_attributes?.['spider:collection_time'];
  const sourceUpdatedAt=rawStamp ? (rawStamp.endsWith('Z')||/[+-]\d\d:\d\d$/.test(rawStamp)?rawStamp:rawStamp+'Z') : undefined;
  const sha256=createHash('sha256').update(text).digest('hex');
  let accepted;try{accepted=JSON.parse(readFileSync(join(process.cwd(),'data/provenance/goodwill-sources.json'),'utf8'));}catch{/* first import */}
  if(sourceUpdatedAt && isAcceptedSourceUnchanged({sourceUpdatedAt,sha256,runId:run.run_id},accepted)){
    console.warn(`::warning::ATP source unchanged since ${sourceUpdatedAt}; retained accepted dataset. Newer failed runs: ${attempts.filter(a=>a.errors||!a.features).length}. No new store verification occurred.`);
    if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'changed=false\n');
    return;
  }
  assertSourceSnapshot(sourceUpdatedAt,{allowHistorical:process.env.ALLOW_HISTORICAL_STORE_SOURCE==='1'});
  if(!Array.isArray(data.features)||data.features.length!==result.features)throw new Error('ATP feature count mismatch');
  const dir=join(process.cwd(),'.cache/atp');mkdirSync(dir,{recursive:true});
  const file=join(dir,'goodwill.json');
  writeFileSync(file+'.tmp',JSON.stringify({source:'alltheplaces-goodwill',license:'CC0-1.0',sourceUrl:url,sourceUpdatedAt,fetchedAt:new Date().toISOString(),sha256,runId:run.run_id,attempts,data}));renameSync(file+'.tmp',file);
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'changed=true\n');
  console.log(JSON.stringify({runId:run.run_id,sourceUpdatedAt,features:data.features.length,skippedFailedRuns:attempts.filter(a=>a.errors||!a.features).map(a=>a.runId)}));return;
 }
 throw new Error('No successful Goodwill source in the latest six ATP releases');
}
main().catch(e=>{console.error(e instanceof Error?e.message:'ATP refresh failed');process.exitCode=1;});
