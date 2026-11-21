import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parse,TYPE, type MessageFormatElement} from '@formatjs/icu-messageformat-parser';
import {locales,localizedPath} from '@/i18n/routing';
import {pageMetadata,languageAlternates,SITE_URL} from '@/lib/seo';

function flatten(o:Record<string,unknown>,prefix=''):Record<string,string>{
 return Object.fromEntries(Object.entries(o).flatMap(([k,v])=>typeof v==='string'?[[prefix+k,v]]:Object.entries(flatten(v as Record<string,unknown>,prefix+k+'.'))));
}
function args(ast:MessageFormatElement[]):string[]{
 const names=new Set<string>();
 for(const x of ast){
  if(x.type!==TYPE.literal&&x.type!==TYPE.pound) names.add(x.value);
  if(x.type===TYPE.select||x.type===TYPE.plural) for(const o of Object.values(x.options)) for(const n of args(o.value)) names.add(n);
  if(x.type===TYPE.tag) for(const n of args(x.children)) names.add(n);
 }
 return [...names].sort();
}
describe('locale contract',()=>{
 for(const namespace of ['ui','pages']) it(`${namespace} catalogs preserve every key and ICU argument`,()=>{
  const en=flatten(JSON.parse(readFileSync(`messages/${namespace}/en.json`,'utf8')));
  for(const locale of locales){
   const catalog=flatten(JSON.parse(readFileSync(`messages/${namespace}/${locale}.json`,'utf8')));
   expect(Object.keys(catalog).sort(),locale).toEqual(Object.keys(en).sort());
   for(const [key,value] of Object.entries(catalog)){
    expect(value.trim(),`${locale}:${key}`).not.toBe('');
    expect(args(parse(value)),`${locale}:${key}`).toEqual(args(parse(en[key])));
   }
  }
 });
 it('keeps English URLs stable and produces reciprocal self-canonical locales',()=>{
  const path='/goodwill/los-angeles-ca'; const alternatives=languageAlternates(path);
  expect(localizedPath(path,'en')).toBe(path);
  for(const locale of locales){
   const m=pageMetadata('Title','Description',path,true,locale);
   expect(m.alternates?.canonical).toBe(localizedPath(path,locale));
   expect(m.alternates?.languages).toEqual(alternatives);
   expect(alternatives[locale]).toBe(SITE_URL+localizedPath(path,locale));
  }
  expect(alternatives['x-default']).toBe(SITE_URL+path);
 });
 it('does not advertise noindex guides as hreflang destinations',()=>{
  expect(pageMetadata('Title','Description','/goodwill/empty',false,'ar').alternates?.languages).toBeUndefined();
 });
});
