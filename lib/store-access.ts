/** EPA's historical neighborhood indicator is separate from store/route accessibility. */
export interface StoreAccessRecord {storeId:string;location:{lat:number;lon:number};score:number|null;blockGroupId:string|null;checkedAt:string;reason?:string}
export const EPA_ACCESS_SOURCE={name:'U.S. EPA National Walkability Index',url:'https://www.epa.gov/smartgrowth/national-walkability-index-user-guide-and-methodology',dataVintage:'2021 release; Census 2019 block groups'} as const;
export function epaPointQuery(location:{lat:number;lon:number}):URLSearchParams{
 if(!Number.isFinite(location.lat)||!Number.isFinite(location.lon)||Math.abs(location.lat)>90||Math.abs(location.lon)>180)throw new Error('Invalid store coordinates');
 return new URLSearchParams({f:'json',geometry:JSON.stringify({x:location.lon,y:location.lat,spatialReference:{wkid:4326}}),geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'GEOID20,NatWalkInd',returnGeometry:'false'});
}
export function parseEpaPointMatch(body:{error?:unknown;features?:{attributes:{NatWalkInd?:unknown;GEOID20?:unknown}}[]}):Pick<StoreAccessRecord,'score'|'blockGroupId'|'reason'>{
 if(body.error||!Array.isArray(body.features))throw new Error('Invalid EPA response');
 if(body.features.length!==1)return {score:null,blockGroupId:null,reason:body.features.length>1?'ambiguous-boundary-match':'no-containing-block-group'};
 const {NatWalkInd:score,GEOID20:geoid}=body.features[0].attributes;
 if(typeof score!=='number'||!Number.isFinite(score)||score<1||score>20||!/^\d{12}$/.test(String(geoid)))return {score:null,blockGroupId:null,reason:'invalid-source-score-or-geoid'};
 return {score,blockGroupId:String(geoid)};
}
export function normalizeWalkability(score:number|null):number|null{return score!==null&&Number.isFinite(score)&&score>=1&&score<=20?(score-1)/19*100:null;}
/** Ignore stale coordinate joins after a store moves. Missing evidence stays unknown. */
export function accessForStore(store:{id:string;location:{lat:number;lon:number}},records:StoreAccessRecord[]):StoreAccessRecord|undefined{
 return records.find(r=>r.storeId===store.id&&r.location.lat===store.location.lat&&r.location.lon===store.location.lon);
}
