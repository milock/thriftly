import tzLookup from 'tz-lookup';
import type {Store} from '@/lib/types';
import {deduplicateStores} from '@/lib/store-classification';
import {STATES} from '@/lib/cities';
import {goodwillCoordinateReviewReason} from '@/lib/store-coordinate-integrity';

interface Feature {properties:Record<string,string|undefined>;geometry?:{type:string;coordinates:number[]}}
export interface AtpSnapshot {sourceUrl:string; sourceUpdatedAt:string; fetchedAt:string; sha256:string; runId:string; attempts?:unknown[];data:{features:Feature[]}}

/** ATP applies shop=charity to all Goodwill facilities: ONLY service categories establish retail. */
export function parseAtpStores(snapshot:AtpSnapshot, previous:Store[]=[]):{stores:Store[];review:Store[];matched:number}{
 const allowedStates=new Set(STATES.map(s=>s.code));const stores:Store[]=[];const review:Store[]=[];let matched=0;const claimedIds=new Set<string>();
 const normalize=(x:string|undefined)=>(x??'').toLowerCase().replace(/\b(street|avenue|road|drive|boulevard|north|south|east|west)\b/g,v=>({street:'st',avenue:'ave',road:'rd',drive:'dr',boulevard:'blvd',north:'n',south:'s',east:'e',west:'w'}[v]!)).replace(/[^a-z0-9]/g,'');
 for(const feature of snapshot.data.features){
  const p=feature.properties;const coordinates=feature.geometry?.coordinates;
  if(p['addr:country']!=='US'||!allowedStates.has(p['addr:state']??''))continue;
  if(feature.geometry?.type!=='Point'||!coordinates||!Number.isFinite(coordinates[0])||!Number.isFinite(coordinates[1])||Math.abs(coordinates[0])>180||Math.abs(coordinates[1])>90)throw new Error('Invalid ATP shopping coordinate');
  const [lon,lat]=coordinates;const categories=(p.store_categories??'').split(',').map(x=>x.trim());
  const outlet=categories.includes('Outlet Store');
  const retail=categories.includes('Retail Store')||categories.includes('Specialty Retail');
  const facilityType:Store['facilityType']=outlet?'outlet':retail?'retail':categories.includes('Donation Center')?'donation':categories.some(c=>/Career|Staffing/.test(c))?'services':'unknown';
  const street=p['addr:street_address'];const region=p['addr:state'];const locality=p['addr:city'];
  const sourceId=p.ref;if(!sourceId)throw new Error('ATP Goodwill record lacks stable operator record ID');
  // Match only affirmative shopping sites. Nearby warehouse/donation records must not lend identity.
  const candidates=(retail||outlet)?previous.filter(s=>!claimedIds.has(s.id)&&s.facilityType!=='warehouse'&&s.facilityType!=='office'&&s.facilityType!=='services'&&s.facilityType!=='donation'&&
    Math.abs(s.location.lat-lat)<0.001 && Math.abs(s.location.lon-lon)<0.0013 &&
    ((normalize(street)&&normalize(street)===normalize(s.street)) ||
     (p.phone&&normalize(p.phone)===normalize(s.phone)) ||
     (Math.abs(s.location.lat-lat)<0.0002&&Math.abs(s.location.lon-lon)<0.0003))):[];
  const exact=previous.find(s=>!claimedIds.has(s.id)&&s.provenance?.source==='alltheplaces-goodwill'&&s.provenance.sourceId===sourceId);
  const old=exact??(candidates.length===1?candidates[0]:undefined);if(old){matched++;claimedIds.add(old.id);}
  const store:Store={id:old?.id??`goodwill/${sourceId}`,name:outlet?'Goodwill Outlet':categories.includes('Specialty Retail')?'Goodwill Specialty Retail':'Goodwill',
    location:{lat,lon},street,address:[street,locality,region,p['addr:postcode']].filter(Boolean).join(', '),locality,region,phone:p.phone,
    website:p.website??p['operator:website'],timezone:tzLookup(lat,lon),facilityType,
    sourceAliases:old?[...new Set([`goodwill/${sourceId}`,...(old.sourceAliases??[])])]:undefined,
    sourceTags:Object.fromEntries(Object.entries(p).filter((entry):entry is [string,string]=>typeof entry[1]==='string')),
    provenance:{source:'alltheplaces-goodwill',sourceId,sourceUrl:snapshot.sourceUrl,sourceUpdatedAt:snapshot.sourceUpdatedAt,fetchedAt:snapshot.fetchedAt,classificationBasis:`operator-services:${categories.join(',')||'missing'}`}};
  const coordinateReview=goodwillCoordinateReviewReason(store);
  if(coordinateReview)store.sourceTags={...store.sourceTags,coordinateReviewReason:coordinateReview};
  if((retail||outlet)&&!coordinateReview)stores.push(store);else review.push(store);
 }
 return {stores:deduplicateStores(stores),review,matched};
}
