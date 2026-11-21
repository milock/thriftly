import {describe, expect, it} from 'vitest';
import {inspectHtml,evaluatePage,localePath,auditExitCode} from '../scripts/audit-seo-build.mjs';
const origin='https://www.thriftly.xyz';
const locales=['en','es','zh-Hans','zh-Hant','tl','vi','ar'];
function example(){return `<!doctype html><html lang="en" dir="ltr"><head><title>A &amp; B | Thriftly</title><meta name="description" content="A description"><meta name="robots" content="index, follow"><meta name="googlebot" content="index, follow"><meta property="og:image" content="https://example.com/og.png"><meta name="twitter:image" content="https://example.com/twitter.png"><link rel="canonical" href="${origin}/savers">${[...locales,'x-default'].map(l=>`<link rel="alternate" hreflang="${l}" href="${origin}${l==='en'||l==='x-default'?'':`/${l}`}/savers">`).join('')}</head><body><h1>A &amp; B</h1><a href="/savers#info">More</a><div id="info"></div><script type="application/ld+json">{"@type":"Store","name":"Shop"}</script><script>"<h1>payload</h1>"</script></body></html>`;}
describe('build SEO audit',()=>{
 it('extracts rendered SSR and validates locale metadata',()=>{const page=inspectHtml(example());expect(page.h1).toEqual(['A & B']);expect(page.title).toBe('A & B | Thriftly');expect(evaluatePage(page,'/savers')).toEqual([]);expect(page.ids.has('info')).toBe(true);expect(localePath('/zh-Hans/savers')).toEqual({locale:'zh-Hans',base:'/savers'});});
 it('flags crawler directives, missing social images, duplicate suffix and malformed JSON-LD',()=>{const html=example().replace('A &amp; B | Thriftly','A | Thriftly | Thriftly').replace('name="googlebot" content="index, follow"','name="googlebot" content="noindex, follow"').replace('<meta property="og:image" content="https://example.com/og.png">','').replace('<meta name="twitter:image" content="https://example.com/twitter.png">','').replace('{"@type":"Store","name":"Shop"}','{bad}').replace('lang="en"','lang="es"');const codes=evaluatePage(inspectHtml(html),'/savers').map((x:{code:string})=>x.code);for(const code of ['googlebot_noindex','missing_og_image','missing_twitter_image','duplicate_title_suffix','jsonld_parse','html_locale'])expect(codes).toContain(code);});
 it('sets a failing exit code only for strict mode with findings',()=>{expect(auditExitCode(false,[{}])).toBe(0);expect(auditExitCode(true,[])).toBe(0);expect(auditExitCode(true,[{}])).toBe(1);});
});

import {afterEach,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {audit,liveAuditOrigin,recognizedDynamicRoute} from '../scripts/audit-seo-build.mjs';
const temporary: string[]=[];
const searchPaths=locales.map(locale=>locale==='en'?'/search':`/${locale}/search`);
async function mixedBuild(extraPath?:string){
 const root=await mkdtemp(join(tmpdir(),'thriftly-seo-audit-'));temporary.push(root);
 const app=join(root,'.next/server/app');await mkdir(join(app,'en'),{recursive:true});
 await writeFile(join(app,'sitemap.xml.body'),`<urlset>${['/savers',...searchPaths,...(extraPath?[extraPath]:[])].map(path=>`<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`);
 await writeFile(join(app,'en/savers.html'),example().replace('</body>','<a href="/search#info">Search</a></body>'));
 await writeFile(join(root,'.next/prerender-manifest.json'),JSON.stringify({routes:{'/en/savers':{initialStatus:200}}}));
 await writeFile(join(root,'.next/routes-manifest.json'),JSON.stringify({dynamicRoutes:[{page:'/[locale]/search',regex:'^/([^/]+?)/search(?:/)?$'}]}));
 await writeFile(join(root,'.next/BUILD_ID'),'fixture-build');return root;
}
function liveExample(path:string){
 const {locale}=localePath(path);
 return example().replaceAll('/savers','/search').replace(`href="${origin}/search"`,`href="${origin}${path}"`).replace('lang="en" dir="ltr"',`lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}"`);
}
afterEach(async()=>{await Promise.all(temporary.splice(0).map(path=>rm(path,{recursive:true,force:true})));vi.unstubAllEnvs();});
describe('mixed static and live SEO audit',()=>{
 it('checks all seven recognized live locales with the same metadata rules and resolves search links',async()=>{
  const root=await mixedBuild();
  const fetcher=vi.fn(async(url:URL)=>new Response(liveExample(url.pathname),{status:200,headers:{'content-type':'text/html; charset=utf-8'}}));
  const result=await audit(root,{origin:'https://127.0.0.1:3107',fetcher});
  expect(result.findings).toEqual([]);expect(result.staticHtmlPagesChecked).toBe(1);expect(result.liveHtmlPagesChecked).toBe(7);expect(result.htmlPagesChecked).toBe(8);
  expect(fetcher.mock.calls.map(call=>call[0].pathname)).toEqual(searchPaths);
  expect(fetcher.mock.calls.every(call=>call[0].origin==='https://127.0.0.1:3107')).toBe(true);
  expect(fetcher).toHaveBeenCalledWith(expect.any(URL),expect.objectContaining({redirect:'manual',cache:'no-store'}));
 });
 it('does not replace missing live configuration with a production request or silently exempt search',async()=>{
  const root=await mixedBuild();vi.stubEnv('SEO_AUDIT_ORIGIN','');const fetcher=vi.fn();
  const result=await audit(root,{fetcher});
  expect(fetcher).not.toHaveBeenCalled();expect(result.counts.dynamic_origin_required).toBe(7);expect(result.counts.internal_target_unverified).toBe(1);
  expect(auditExitCode(true,result.findings)).toBe(1);
 });
 it('reports live HTTP failures and noindex directives without weakening static checks',async()=>{
  const root=await mixedBuild('/not-built');
  const fetcher=vi.fn(async(url:URL)=>new Response(url.pathname==='/ar/search'?liveExample(url.pathname).replace('name="robots" content="index, follow"','name="robots" content="noindex, follow"'):liveExample(url.pathname),{status:url.pathname==='/es/search'?404:200,headers:{'content-type':'text/html'}}));
  const result=await audit(root,{origin:'http://127.0.0.1:3108',fetcher});
  expect(result.findings).toContainEqual({path:'/es/search',code:'status',detail:404});
  expect(result.findings.some((finding:{path:string;code:string})=>finding.path==='/ar/search'&&finding.code==='noindex')).toBe(true);
  expect(result.findings).toContainEqual({path:'/not-built',code:'missing_prerender_manifest',detail:'/en/not-built'});
  expect(fetcher).toHaveBeenCalledTimes(7);
 });
 it('records connection failures and accepts only explicit HTTP origins',async()=>{
  const root=await mixedBuild();const result=await audit(root,{origin:'http://127.0.0.1:3108',fetcher:vi.fn().mockRejectedValue(new Error('network failure'))});
  expect(result.counts.live_fetch_failed).toBe(7);expect(result.liveHtmlPagesChecked).toBe(0);
  expect(liveAuditOrigin(undefined)).toBeNull();
  for(const value of ['file:///tmp/page','https://user:password@example.com','https://example.com/path','https://example.com/?query=1'])expect(()=>liveAuditOrigin(value)).toThrow();
  expect(recognizedDynamicRoute('/en/missing',{dynamicRoutes:[{regex:'^/[^/]+/search$'}]})).toBeNull();
 });
});
