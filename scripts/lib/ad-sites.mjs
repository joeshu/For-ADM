import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {exactHostPattern} from './host-pattern.mjs';
import assert from 'node:assert/strict';
export const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export const escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function runCleaner(code,url,body,response={}) {
 let calls=0,result;
 vm.runInNewContext(code,{$request:{url},$response:{body,...response},$done:r=>{calls++;result=r;},console:{log(){throw Error('Unexpected runtime log');}}},{timeout:2000});
 assert.equal(calls,1,'$done must be called once');
 return result.body===undefined?body:result.body;
}
export function fixtureChecks(code,fixture) {
 assert(fixture.removed?.length,'At least one removal assertion is required');
 assert(fixture.preserved?.length,'At least one playback preservation assertion is required');
 for(const s of [...fixture.removed,...fixture.preserved])assert(typeof s==='string'&&s&&fixture.body.includes(s),'Assertion must exist in original sample');
 const out=runCleaner(code,fixture.url,fixture.body);
 for(const s of fixture.removed)assert(!out.includes(s),'Advertisement remains: '+s);
 for(const s of fixture.preserved)assert(out.includes(s),'Protected content changed: '+s);
 assert.equal(runCleaner(code,fixture.url,out),out,'Cleaner must be idempotent');
 const unknown=new URL(fixture.url);unknown.hostname+='.invalid';
 assert.equal(runCleaner(code,unknown.href,fixture.body),fixture.body,'Unknown host must pass through');
 for(const statusCode of [403,502])assert.equal(runCleaner(code,fixture.url,fixture.body,{statusCode}),fixture.body,'Error response must pass through');
 return out;
}
export function draftCode(root,template) {
 const engine=fs.readFileSync(path.join(root,'universal/src/engine.js'),'utf8');
 assert.equal(template.adapter,'declarative');
 const runtime={...template,bindings:template.bindings.map(b=>{
  assert.equal(b.domains.type,'exact');
  return {host:exactHostPattern(b.domains.names),routes:b.routes};
 })};
 return '(function(){'+engine+'\nadmRun('+JSON.stringify([runtime])+',{declarative:cleanDeclarative});})();';
}
