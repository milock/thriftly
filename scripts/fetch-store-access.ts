/** Optional historical neighborhood-access data. Never a store/route accessibility audit. */
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {epaPointQuery,parseEpaPointMatch} from '../lib/store-access';
const endpoint='https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query';
const stores=JSON.parse(readFileSync('data/stores-us.json','utf8')).stores as {id:string;location:{lat:number;lon:number}}[];
const cache='.cache/store-access';mkdirSync(cache,{recursive:true});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
type RecordValue={storeId:string;location:{lat:number;lon:number};score:number|null;blockGroupId:string|null;checkedAt:string;reason?:string};
const records:RecordValue[]=[];const errors:string[]=[];let index=0,complete=0;
async function worker(){while(index<stores.length){const store=stores[index++];const path=join(cache,encodeURIComponent(store.id)+'.json');let record:RecordValue|undefined;
 try{const saved=JSON.parse(readFileSync(path,'utf8')) as RecordValue;if(saved.location.lat===store.location.lat&&saved.location.lon===store.location.lon&&Date.now()-Date.parse(saved.checkedAt)<30*86400000)record=saved;}catch{}
 if(!record){const params=epaPointQuery(store.location);
  for(let attempt=0;attempt<3;attempt++){try{
   const response=await fetch(`${endpoint}?${params}`,{headers:{'User-Agent':'Thriftly/1.0 (+https://www.thriftly.xyz)'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const body=await response.json();if(body.error||!Array.isArray(body.features))throw new Error('Invalid EPA response');
   record={storeId:store.id,location:store.location,...parseEpaPointMatch(body),checkedAt:new Date().toISOString()};
   writeFileSync(path,JSON.stringify(record));break;
  }catch{if(attempt===2)errors.push(store.id);else await sleep(1000*(attempt+1));}}
  await sleep(250);
 }
 if(record)records.push(record);complete++;if(complete%100===0)console.log(`EPA spatial joins: ${complete}/${stores.length}; failed ${errors.length}`);
}}
async function main(){const metadata=await(await fetch('https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer?f=json',{signal:AbortSignal.timeout(30000)})).json();if(!String(metadata.description).includes('Census 2019'))throw new Error('EPA source vintage changed; review before relabeling cached data');await Promise.all([worker(),worker()]);if(errors.length||records.length!==stores.length)throw new Error(`EPA join incomplete: ${errors.length} failed stores; previous data preserved`);
 if(records.filter(r=>r.score!==null).length<stores.length*.9)throw new Error('EPA match coverage below90%; review source before publishing');
 records.sort((a,b)=>a.storeId.localeCompare(b.storeId));const data={generatedAt:new Date().toISOString(),source:{name:'U.S. EPA National Walkability Index',url:'https://www.epa.gov/smartgrowth/national-walkability-index-user-guide-and-methodology',queryEndpoint:endpoint,dataVintage:'2021 release; Census 2019 block groups',license:'CC0-1.0',licenseSource:'https://catalog.data.gov/dataset/walkability-index',geoidField:'GEOID20 (as named by EPA service)',scale:{min:1,max:20},method:'point-in-polygon intersection; ambiguous boundary matches left unknown',attribution:'EPA Office of Community Revitalization with Urban Design 4 Health and EPA National Geospatial Support Team',limitations:'Historical block-group walkability, not current routes, sidewalks, wheelchair access, store inventory, or store quality.'},count:records.length,matchedCount:records.filter(r=>r.score!==null).length,records};
 writeFileSync('data/store-access.json.tmp',JSON.stringify(data));renameSync('data/store-access.json.tmp','data/store-access.json');console.log(JSON.stringify({count:data.count,matched:data.matchedCount,unknown:data.count-data.matchedCount}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'EPA import failed');process.exitCode=1;});
