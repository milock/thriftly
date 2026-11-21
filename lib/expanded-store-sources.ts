import tzLookup from 'tz-lookup';
import type {Store} from './types';
import {STATES} from './cities';
import type {AtpSnapshot} from './atp-stores';
export type ExpandedStore=Store & {brandId:string;brand:string;operator?:string;sourcingModel:'donation'|'buy-sell-trade'|'mixed'|'unknown';merchandiseScope:'general'|'fashion'|'home-improvement'|'books'|'unknown'};
const states=new Set(STATES.map(s=>s.code));
function website(value:string|undefined){if(!value)return undefined;try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.toString():undefined;}catch{return undefined;}}
function coordinate(lat:number,lon:number){return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0);}
export function parseChainAtp(snapshot:AtpSnapshot,brandId:'savers'|'buffalo-exchange'){
 const stores:ExpandedStore[]=[];const rejected:{sourceId:string;reason:string}[]=[];
 for(const feature of snapshot.data.features){
  const p=feature.properties;const ref=p.ref??'';
  if(p['addr:country']!=='US'||!states.has(p['addr:state']??'')){rejected.push({sourceId:ref,reason:'outside-us-coverage'});continue;}
  const negative=p.office||p.amenity==='recycling'||/^CDC/.test(ref)||/headquarters|donation (center|centre)|warehouse|permanently closed/i.test(`${p.branch??''} ${p.website??''}`);
  const retail=brandId==='savers'?p.shop==='second_hand':p.shop==='clothes'&&p.second_hand==='only';
  const future=p.start_date&&Date.parse(p.start_date.replaceAll('.','-'))>Date.now();
  if(negative||!retail||future){rejected.push({sourceId:ref,reason:future?'not-open-yet':'not-public-retail'});continue;}
  const [lon,lat]=feature.geometry?.coordinates??[];
  if(!ref||feature.geometry?.type!=='Point'||!coordinate(lat,lon))throw new Error(`Invalid ${brandId} identity or coordinates`);
  let brand=brandId==='buffalo-exchange'?'Buffalo Exchange':p.brand??'Savers';
  if(brandId==='savers'){if(/\/unique-thrift-store-/i.test(p.website??''))brand='Unique';if(/\/2nd(?:ave|avenue)?-thrift-store-/i.test(p.website??''))brand='2nd Ave. Thrift';}
  const full=p['addr:full'];const parts=full?.split(',').map(s=>s.trim());
  const street=p['addr:street_address']??parts?.[0];const locality=p['addr:city']??(parts&&parts.length>=3?parts.at(-2):undefined);
  const outlet=/buffalo-outlet|\boutlet\b/i.test(`${p.website??''} ${p.branch??''}`);
  stores.push({id:`${brandId}/${ref}`,name:outlet?'Buffalo Outlet':brand,brandId,brand,operator:brandId==='savers'?'Savers Value Village':'Buffalo Exchange',sourcingModel:brandId==='savers'?'donation':'buy-sell-trade',merchandiseScope:brandId==='savers'?'general':'fashion',facilityType:outlet?'outlet':'retail',location:{lat,lon},timezone:tzLookup(lat,lon),street,locality,region:p['addr:state'],address:full??[street,locality,p['addr:state'],p['addr:postcode']].filter(Boolean).join(', '),website:website(p.website),phone:p.phone,openingHours:p.opening_hours,sourceTags:Object.fromEntries(Object.entries(p).filter((e):e is [string,string]=>typeof e[1]==='string')),provenance:{source:`alltheplaces-${brandId}`,sourceId:ref,sourceUrl:snapshot.sourceUrl,sourceUpdatedAt:snapshot.sourceUpdatedAt,fetchedAt:snapshot.fetchedAt,classificationBasis:`${p.shop};second_hand=${p.second_hand??''};source-excludes-donation-only`}});
 }
 return {stores,rejected};
}
export interface SalvationSnapshot {queriedAt:string;seedCount:number;completedCount:number;coverage:string;queries:Record<string,{sourceUrl:string;fetchedAt:string;locations:Record<string,unknown>[]}>}
export function parseSalvation(snapshot:SalvationSnapshot){
 if(snapshot.completedCount!==snapshot.seedCount)throw new Error('Incomplete Salvation Army geographic fetch');
 const stores=new Map<string,ExpandedStore>();const rejected=new Map<string,{sourceId:string;reason:string}>();
 for(const query of Object.values(snapshot.queries))for(const raw of query.locations){
  const p=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v==null?'':String(v)]));const ref=p.LocationGUID||p.Id;
  const types=p.TypeName.split(',').map(s=>s.trim().toUpperCase());
  const shoppingName=/\b(store|shop|thrift|outlet)\b/i.test(p.Name.replace(/s t o r e/ig,'store'));
  if(!shoppingName||!types.includes('STORE')||!states.has(p.State)||/permanently closed|trailer|drop off only|drop-off only/i.test(`${p.Name} ${p.Hours}`)||(/warehouse|distribution|office|headquarters/i.test(p.Name)&&!/outlet|\bretail\b|\bthrift store\b/i.test(p.Name))){rejected.set(ref,{sourceId:ref,reason:'not-public-retail'});continue;}
  const lat=Number(raw.Latitude),lon=Number(raw.Longitude);if(!ref||!coordinate(lat,lon))throw new Error('Invalid Salvation Army store identity/coordinates');
  const name=p.Name||'The Salvation Army Thrift Store';
  const store:ExpandedStore={id:`salvation-army/${ref}`,name,brandId:'salvation-army',brand:'The Salvation Army',operator:'The Salvation Army',sourcingModel:'donation',merchandiseScope:'general',facilityType:/\boutlet\b/i.test(name)?'outlet':'retail',location:{lat,lon},timezone:tzLookup(lat,lon),street:[p.Address1,p.Address2].filter(Boolean).join(' '),locality:p.City,region:p.State,address:[p.Address1,p.Address2,p.City,p.State,p.Zip].filter(Boolean).join(', '),website:website(p.Website)||'https://satruck.org/ThriftStore/',phone:p.ContactPhone||undefined,sourceTags:{TypeName:p.TypeName,Type:p.Type,storeHoursDescription:p.Hours},provenance:{source:'official-salvation-army-locator',sourceId:ref,sourceUrl:query.sourceUrl,sourceUpdatedAt:query.fetchedAt,fetchedAt:query.fetchedAt,classificationBasis:'official TypeName contains STORE plus explicit retail name; conflicts quarantined'}};
  stores.set(store.id,store);
 }
 const groups=new Map<string,ExpandedStore[]>();
 for(const store of stores.values()){const key=(store.address??'').toLowerCase().replace(/[^a-z0-9]/g,'');groups.set(key,[...(groups.get(key)??[]),store]);}
 const unique:ExpandedStore[]=[];
 for(const group of groups.values()){
  group.sort((a,b)=>a.id.localeCompare(b.id));const first=group[0];
  if(group.some(s=>Math.abs(s.location.lat-first.location.lat)>.001||Math.abs(s.location.lon-first.location.lon)>.0015)){for(const s of group)rejected.set(s.id,{sourceId:s.provenance!.sourceId,reason:'conflicting-coordinates-for-same-address'});continue;}
  first.sourceAliases=group.slice(1).map(s=>s.id);
  for(const s of group.slice(1))rejected.set(s.id,{sourceId:s.provenance!.sourceId,reason:'duplicate-address-and-coordinate'});
  unique.push(first);
 }
 return {stores:unique,rejected:[...rejected.values()]};
}
export interface ClosetSnapshot {sourceUrl:string;sourceUpdatedAt:string;fetchedAt:string;locations:{id:number;identifier:string;name:string;lat:number;lng:number;country:string;province:string;city:string;streetAndNumber:string;zip:string;phone?:string;openingHours?:{dayOfWeek:number;from1?:string;to1?:string;from2?:string;to2?:string}[];futureOpeningDate?:string|null}[]}
export function parseOutOfCloset(snapshot:ClosetSnapshot){
 const stores:ExpandedStore[]=[];const rejected:{sourceId:string;reason:string}[]=[];
 for(const p of snapshot.locations){
  if(p.country!=='US'||!states.has(p.province)||!/^Out of the Closet\b/i.test(p.name)||/office|warehouse|permanently closed/i.test(p.name)||(p.futureOpeningDate&&Date.parse(p.futureOpeningDate)>Date.now())){rejected.push({sourceId:String(p.id),reason:'not-open-us-retail'});continue;}
  if(!p.id||!coordinate(p.lat,p.lng))throw new Error('Invalid Out of the Closet coordinates/ID');
  const days=['Mo','Tu','We','Th','Fr','Sa','Su'];
  const hours=(p.openingHours??[]).flatMap(h=>{const day=days[h.dayOfWeek-1];if(!day||!/^\d\d:\d\d$/.test(h.from1??'')||!/^\d\d:\d\d$/.test(h.to1??''))return [];return [`${day} ${h.from1}-${h.to1}${h.from2&&h.to2?`,${h.from2}-${h.to2}`:''}`];}).join('; ');
  stores.push({id:`out-of-the-closet/${p.id}`,name:p.name,brandId:'out-of-the-closet',brand:'Out of the Closet',operator:'AIDS Healthcare Foundation',sourcingModel:'donation',merchandiseScope:'general',facilityType:'retail',location:{lat:p.lat,lon:p.lng},timezone:tzLookup(p.lat,p.lng),street:p.streetAndNumber,locality:p.city,region:p.province,address:[p.streetAndNumber,p.city,p.province,p.zip].join(', '),website:snapshot.sourceUrl,phone:p.phone,openingHours:hours||undefined,sourceTags:{operatorIdentifier:p.identifier,sourceContext:'official Out of the Closet thrift-store locator'},provenance:{source:'official-out-of-the-closet-locator',sourceId:String(p.id),sourceUrl:snapshot.sourceUrl,sourceUpdatedAt:snapshot.sourceUpdatedAt,fetchedAt:snapshot.fetchedAt,classificationBasis:'operator-specific thrift store locator; excludes future openings/non-store names'}});
 }
 return {stores,rejected};
}

/** Only byte-identical, already accepted ATP snapshots may use the 45-day hold window. */
export function isAcceptedChainSnapshot(candidate:{sha256:string;sourceUpdatedAt:string;runId:string},accepted?:{sha256?:string;sourceUpdatedAt?:string;runId?:string}){
 return !!accepted&&candidate.sha256===accepted.sha256&&candidate.sourceUpdatedAt===accepted.sourceUpdatedAt&&candidate.runId===accepted.runId;
}
