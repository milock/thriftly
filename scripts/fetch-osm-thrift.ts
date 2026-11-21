/** One weekly Overpass query for second-hand shops in the US, used only to
 * corroborate operator-sourced listings. ODbL data; the site attributes OSM.
 * A failure keeps the last snapshot and never blocks the refresh. */
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {assertCurrentOverpass} from '../lib/overpass';
import {OSM_KEPT_TAGS,type OsmShop,type OsmSnapshot} from '../lib/osm-corroboration';
import {failureReason,recordSourceHealth,retentionStatus} from '../lib/source-health';

const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.openstreetmap.fr/api/interpreter'];
const QUERY=`[out:json][timeout:900][maxsize:1073741824];
area["ISO3166-1"="US"][admin_level=2]->.us;
(
  nwr["shop"~"^(charity|second_hand)$"](area.us);
  nwr["shop"~"^(clothes|furniture|books|variety_store|department_store)$"]["second_hand"~"^(only|yes)$"](area.us);
);
out center tags;`;
const MIN_ELEMENTS=2000;
const dir=join(process.cwd(),'.cache/osm');const file=join(dir,'thrift-us.json');
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

interface Element {type:string;id:number;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>}
export function toSnapshot(body:{elements?:Element[];osm3s?:{timestamp_osm_base?:string};remark?:string},fetchedAt=new Date().toISOString()):OsmSnapshot{
 assertCurrentOverpass(body);
 const elements:OsmShop[]=(body.elements??[]).flatMap(el=>{
  const lat=el.lat??el.center?.lat,lon=el.lon??el.center?.lon;
  if(!['node','way','relation'].includes(el.type)||!Number.isSafeInteger(el.id)||lat==null||lon==null||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return [];
  const tags=Object.fromEntries(OSM_KEPT_TAGS.flatMap(k=>typeof el.tags?.[k]==='string'?[[k,el.tags[k].slice(0,200)]]:[]));
  return [{id:`${el.type}/${el.id}`,lat,lon,tags}];
 });
 if(elements.length<MIN_ELEMENTS)throw new Error(`Overpass returned only ${elements.length} shops`);
 return {source:'openstreetmap-overpass',license:'ODbL-1.0',osmBase:body.osm3s!.timestamp_osm_base!,fetchedAt,elements};
}

async function main(){
 let lastError:unknown;
 for(const endpoint of ENDPOINTS){
  for(let attempt=0;attempt<2;attempt++){
   try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Thriftly/1.0 (+https://www.thriftly.xyz)'},body:`data=${encodeURIComponent(QUERY)}`,signal:AbortSignal.timeout(960000)});
    if(!response.ok)throw new Error(`Overpass HTTP ${response.status}`);
    const snapshot=toSnapshot(await response.json());
    mkdirSync(dir,{recursive:true});writeFileSync(file+'.tmp',JSON.stringify(snapshot));renameSync(file+'.tmp',file);
    console.log(`OpenStreetMap: ${snapshot.elements.length} second-hand shops, data as of ${snapshot.osmBase}`);
    recordSourceHealth({source:'openstreetmap',status:'refreshed',sourceUpdatedAt:snapshot.osmBase});
    return;
   }catch(error){lastError=error;console.warn(`Overpass attempt failed: ${failureReason(error)}`);await sleep(30000*(attempt+1));}
  }
 }
 let previous:OsmSnapshot|undefined;try{if(existsSync(file))previous=JSON.parse(readFileSync(file,'utf8'));}catch{}
 recordSourceHealth({source:'openstreetmap',status:previous?retentionStatus(previous.osmBase):'retained-last-good',sourceUpdatedAt:previous?.osmBase,reason:`${failureReason(lastError)}; corroborations from earlier weeks still apply`});
}
if(process.argv[1]?.endsWith('fetch-osm-thrift.ts'))main();
