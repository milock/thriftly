/** Audit local prerender output and explicitly configured live dynamic pages. */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ORIGIN='https://www.thriftly.xyz';
const LOCALES=['en','es','zh-Hans','zh-Hant','tl','vi','ar'];
const decode=s=>s.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(_,entity)=>{
 const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
 return entity[0]==='#'?String.fromCodePoint(entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10)):named[entity.toLowerCase()];
});
function attrs(tag){
 const result={}; const input=tag.replace(/^<[^\s/>]+/,'');
 for(const m of input.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))result[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]??'');
 return result;
}
const text=s=>decode(s.replace(/<[^>]*>/g,'')).trim();
export function inspectHtml(html){
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
 const jsonld=scripts.filter(m=>attrs(`<script ${m[1]}>`).type==='application/ld+json').map(m=>{try{return {value:JSON.parse(m[2])};}catch{return {error:'invalid JSON-LD'};}});
 // Next embeds a second representation of the page in script payloads; exclude it.
 // Use separators so removal cannot join partial markup into a new tag.
 // This is audit text extraction, never an HTML sanitizer or renderable output.
 const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ');
 const tags=[...clean.matchAll(/<(?:html|meta|link|a|[a-z][\w:-]*)\b[^>]*>/gi)].map(m=>({tag:m[0].match(/^<([^\s/>]+)/)[1].toLowerCase(),a:attrs(m[0])}));
 const by=(tag,predicate=()=>true)=>tags.filter(x=>x.tag===tag&&predicate(x.a)).map(x=>x.a);
 return {html:by('html')[0]??{}, title:text(clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??''), description:by('meta',a=>a.name?.toLowerCase()==='description')[0]?.content??'', robots:by('meta',a=>a.name?.toLowerCase()==='robots')[0]?.content??'', googlebot:by('meta',a=>a.name?.toLowerCase()==='googlebot')[0]?.content??'', ogImage:by('meta',a=>a.property?.toLowerCase()==='og:image').map(a=>a.content), twitterImage:by('meta',a=>a.name?.toLowerCase()==='twitter:image').map(a=>a.content), canonical:by('link',a=>a.rel?.toLowerCase()==='canonical').map(a=>a.href), alternates:by('link',a=>a.rel?.toLowerCase()==='alternate'&&a.hreflang), h1:[...clean.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>text(m[1])), ids:new Set(tags.map(x=>x.a.id).filter(Boolean)), hrefs:by('a',a=>!!a.href).map(a=>a.href), jsonld};
}
export function localePath(path){const first=path.split('/')[1];const locale=LOCALES.includes(first)?first:'en';return {locale,base:locale==='en'?path:(path.slice(locale.length+1)||'/')};}
function localized(base,locale){return locale==='en'?base:(base==='/'?`/${locale}`:`/${locale}${base}`);}
function graph(node){if(Array.isArray(node))return node.flatMap(graph);if(!node||typeof node!=='object')return [];return [node,...Object.values(node).flatMap(graph)];}
export function evaluatePage(page,path,status=200){
 const issues=[];const {locale,base}=localePath(path); const add=(code,detail)=>issues.push({code,detail});
 if(status!==200)add('status',status); if(/(?:^|[,\s])noindex(?:$|[,\s])/i.test(page.robots))add('noindex',page.robots);
 if(/(?:^|[,\s])noindex(?:$|[,\s])/i.test(page.googlebot))add('googlebot_noindex',page.googlebot);
 if(!page.ogImage.some(Boolean))add('missing_og_image',''); if(!page.twitterImage.some(Boolean))add('missing_twitter_image','');
 const canonical=ORIGIN+(path==='/'?'':path);if(page.canonical.length!==1||page.canonical[0]!==canonical)add('canonical',{expected:canonical,actual:page.canonical});
 if(!page.title)add('missing_title','');if(/\|\s*thriftly\s*\|\s*thriftly(?:\s*$)/i.test(page.title))add('duplicate_title_suffix',page.title);
 if(!page.description.trim())add('missing_description','');if(page.h1.length!==1||!page.h1[0])add('h1',page.h1);
 if(page.html.lang!==locale||page.html.dir!==(locale==='ar'?'rtl':'ltr'))add('html_locale',{expected:locale,actual:page.html});
 const actual=Object.fromEntries(page.alternates.map(a=>[a.hreflang,a.href]));
 for(const language of [...LOCALES,'x-default']) {const alternativePath=localized(base,language==='x-default'?'en':language);const expected=ORIGIN+(alternativePath==='/'?'':alternativePath);if(actual[language]!==expected)add('alternate',{language,expected,actual:actual[language]??null});}
 if(page.alternates.length!==8)add('alternate_count',page.alternates.length);
 for(const block of page.jsonld){if(block.error){add('jsonld_parse',block.error);continue;}for(const node of graph(block.value)){
  if(node['@type']==='AggregateRating')add('jsonld_aggregate_rating','verify source');
  if(node['@type']==='GeoCoordinates'&&(!Number.isFinite(node.latitude)||!Number.isFinite(node.longitude)||Math.abs(node.latitude)>90||Math.abs(node.longitude)>180))add('jsonld_coordinates',node);
  if(node['@type']==='Store'&&!node.name)add('jsonld_store_name','');
  if(node['@type']==='ItemList'&&Array.isArray(node.itemListElement)&&typeof node.numberOfItems==='number'&&node.numberOfItems<node.itemListElement.length)add('jsonld_item_count',node.numberOfItems);
 }}
 return issues;
}
export function liveAuditOrigin(value){
 if(!value)return null;
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('SEO_AUDIT_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment.');
 return url.origin;
}
export function recognizedDynamicRoute(buildPath,routes){
 return (routes.dynamicRoutes??[]).find(route=>typeof route.regex==='string'&&new RegExp(route.regex).test(buildPath))??null;
}
export async function audit(root=process.cwd(),options={}){
 const app=join(root,'.next/server/app');const sitemap=await readFile(join(app,'sitemap.xml.body'),'utf8');const manifest=JSON.parse(await readFile(join(root,'.next/prerender-manifest.json'),'utf8'));
 const routes=JSON.parse(await readFile(join(root,'.next/routes-manifest.json'),'utf8'));
 const liveOrigin=liveAuditOrigin(options.origin??process.env.SEO_AUDIT_ORIGIN);const fetcher=options.fetcher??fetch;
 const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1]));const findings=[];const pages=new Map();const refs=[];let parsed=0,staticParsed=0,liveParsed=0;
 if(!urls.length)throw new Error('Sitemap contains no URLs.');
 const add=(path,code,detail)=>findings.push({path,code,detail});
 const seenUrls=new Set();
 for(const raw of urls){if(seenUrls.has(raw)){add(raw,'duplicate_sitemap_url','');continue;}seenUrls.add(raw);let url;try{url=new URL(raw);}catch{add(raw,'invalid_sitemap_url','');continue;}
  if(url.origin!==ORIGIN||url.search||url.hash){add(raw,'sitemap_origin_or_suffix','');continue;}
  const path=url.pathname;const {locale}=localePath(path);const buildPath=locale==='en'?`/en${path==='/'?'':path}`:path;
  const route=manifest.routes[buildPath];let html,status=200,source;
  if(route){
   try{html=await readFile(join(app,`${buildPath.slice(1)}.html`),'utf8');}catch{add(path,'missing_prerender_html',buildPath);continue;}
   status=route.initialStatus??200;source='static';
  }else{
   if(!recognizedDynamicRoute(buildPath,routes)){add(path,'missing_prerender_manifest',buildPath);continue;}
   if(!liveOrigin){add(path,'dynamic_origin_required',buildPath);continue;}
   try{
    const response=await fetcher(new URL(path,liveOrigin),{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(10000)});
    status=response.status;html=await response.text();source='live';
    if(!response.headers.get('content-type')?.toLowerCase().includes('text/html'))add(path,'live_content_type',response.headers.get('content-type')??'');
   }catch{add(path,'live_fetch_failed',buildPath);continue;}
  }
  const page=inspectHtml(html);parsed++;if(source==='static')staticParsed++;else liveParsed++;
  for(const issue of evaluatePage(page,path,status))add(path,issue.code,issue.detail);
  pages.set(path,{ids:page.ids});
  for(const href of new Set(page.hrefs)){let target;try{target=new URL(href,raw);}catch{add(path,'invalid_href',href);continue;}if(target.origin===ORIGIN&&!target.pathname.startsWith('/_next/')&&!target.pathname.startsWith('/api/'))refs.push({from:path,target:target.pathname,hash:target.hash});}
 }
 for(const ref of refs){const target=pages.get(ref.target);if(!target){const {locale}=localePath(ref.target);const key=locale==='en'?`/en${ref.target==='/'?'':ref.target}`:ref.target;if(!manifest.routes[key])add(ref.from,'internal_target_unverified',ref.target);continue;}
  if(ref.hash){let id;try{id=decodeURIComponent(ref.hash.slice(1));}catch{add(ref.from,'invalid_fragment',ref.hash);continue;}if(id&&!target.ids.has(id))add(ref.from,'missing_fragment',`${ref.target}${ref.hash}`);}
 }
 /** @type {Record<string,number>} */
 const counts={};for(const finding of findings)counts[finding.code]=(counts[finding.code]??0)+1;
 return {buildId:(await readFile(join(root,'.next/BUILD_ID'),'utf8')).trim(),scope:'Static sitemap URLs use local prerender HTML and manifest initialStatus. Recognized dynamic sitemap routes use live HTTP status and HTML from the explicitly configured SEO_AUDIT_ORIGIN. Both receive identical metadata, locale, indexability, structured-data and link checks. Internal targets absent from the sitemap are verified only against the prerender manifest.', sitemapUrls:urls.length, uniqueUrls:new Set(urls).size, htmlPagesChecked:parsed, staticHtmlPagesChecked:staticParsed, liveHtmlPagesChecked:liveParsed, liveOrigin, internalLinksChecked:refs.length, counts,findings};
}
export function auditExitCode(strict, findings){return strict&&findings.length>0?1:0;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--strict'))throw new Error('Usage: npm run audit:seo -- [--strict]');
 const result=await audit();const output=resolve('outputs/seo-build-audit.json');await mkdir(resolve('outputs'),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output,sitemapUrls:result.sitemapUrls,htmlPagesChecked:result.htmlPagesChecked,staticHtmlPagesChecked:result.staticHtmlPagesChecked,liveHtmlPagesChecked:result.liveHtmlPagesChecked,liveOrigin:result.liveOrigin,counts:result.counts},null,2));
 process.exitCode=auditExitCode(args.includes('--strict'),result.findings);
}
