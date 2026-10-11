import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readJSON,draftCode,fixtureChecks,runCleaner} from '../scripts/lib/ad-sites.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function attempt(spec,body,check){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ad-site-'));
 try{
  fs.writeFileSync(path.join(dir,'sample.txt'),body);
  fs.writeFileSync(path.join(dir,'spec.json'),JSON.stringify({...spec,sample:'sample.txt'}));
  const args=['scripts/new-ad-site.mjs','--spec',path.join(dir,'spec.json'),'--out',path.join(dir,'draft')];
  return check(dir,args);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const base={id:'fixture-new-site',url:'https://new-site.example/player.html',requires:['SITE-MARKER'],removed:['fixture-ad'],preserved:['movie.m3u8','episode-2']};
const html='<html>SITE-MARKER<div class="slot banner"><div>fixture-ad</div></div><script src="/ads.js"></script><video src="movie.m3u8"></video><a href="episode-2">next</a></html>';
test('HTML drafts support containers and script entries without enabling hosts',()=>{
 const before=fs.readFileSync(path.join(root,'universal/templates.json'),'utf8');
 for(const operation of ['container','script'])attempt({...base,kind:'html',operation,target:operation==='container'?'banner':'/ads.js',removed:operation==='container'?['fixture-ad']:['/ads.js']},html,(dir,args)=>{
  execFileSync(process.execPath,args,{cwd:root});
  const template=readJSON(path.join(dir,'draft/template.json')),fixture=readJSON(path.join(dir,'draft/fixture.json'));
  const code=draftCode(root,template);fixtureChecks(code,fixture);
  assert.equal(readJSON(path.join(dir,'draft/site.json')).status,'pending');
  assert.equal(runCleaner(code,base.url,html.replace('SITE-MARKER','OTHER')),html.replace('SITE-MARKER','OTHER'));
  assert.equal(runCleaner(code,base.url.replace('player.html','different.html'),html),html);
  assert.equal(runCleaner(code,base.url.replace('new-site.example','www.new-site.example'),html),html);
  assert.throws(()=>execFileSync(process.execPath,args,{cwd:root,stdio:'pipe'}),'Draft overwrite must fail');
 });
 assert.equal(fs.readFileSync(path.join(root,'universal/templates.json'),'utf8'),before);
});
test('JSON drafts share guarded field cleaning and preserve unfamiliar schemas',()=>{
 const body=JSON.stringify({result:true,data:{adList:['fixture-ad'],player:{url:'movie.m3u8',next:'episode-2'}},site:'SITE-MARKER'});
 attempt({...base,kind:'json',operation:'clearArray',target:'data.adList'},body,(dir,args)=>{
  execFileSync(process.execPath,args,{cwd:root});
  const code=draftCode(root,readJSON(path.join(dir,'draft/template.json')));fixtureChecks(code,readJSON(path.join(dir,'draft/fixture.json')));
  for(const changed of [body.replace('SITE-MARKER','OTHER'),body.replace('"result":true','"result":false'),body.replace('["fixture-ad"]','"fixture-ad"')])assert.equal(runCleaner(code,base.url,changed),changed);
 });
});
test('JS drafts require exact fingerprints and replacement counts',()=>{
 const body='const marker="SITE-MARKER";const ad="fixture-ad";const movie="movie.m3u8";const next="episode-2";';
 attempt({...base,kind:'js',operation:'replace',target:'const ad="fixture-ad";',replacement:'const ad=null;'},body,(dir,args)=>{
  execFileSync(process.execPath,args,{cwd:root});
  const code=draftCode(root,readJSON(path.join(dir,'draft/template.json')));fixtureChecks(code,readJSON(path.join(dir,'draft/fixture.json')));
  const changed=body+body;assert.equal(runCleaner(code,base.url,changed),changed);
  assert.equal(runCleaner(code,base.url,body.replace('SITE-MARKER','OTHER')),body.replace('SITE-MARKER','OTHER'));
 });
});
test('invalid or ineffective drafts fail before writing artifacts',()=>{
 for(const spec of [
  {...base,kind:'html',operation:'container',target:'missing'},
  {...base,kind:'html',operation:'container',target:'banner',preserved:['missing-playback']},
  {...base,kind:'html',operation:'container',target:'banner',url:'https://new-site.example/movie.m3u8'},
  {...base,kind:'html',operation:'container',target:'banner',requires:['missing-fingerprint']},
  {...base,kind:'html',operation:'container',target:'banner',id:'../../outside'},
 ])attempt(spec,html,(dir,args)=>{
  assert.throws(()=>execFileSync(process.execPath,args,{cwd:root,stdio:'pipe'}));
  assert(!fs.existsSync(path.join(dir,'draft')));
 });
});
test('a checked draft integrates through the real builder, registry and generated rules',()=>{
 attempt({...base,kind:'html',operation:'container',target:'banner'},html,(dir,args)=>{
  execFileSync(process.execPath,args,{cwd:root});
  const isolated=path.join(dir,'repo');fs.mkdirSync(isolated);
  for(const folder of ['universal','scripts'])fs.cpSync(path.join(root,folder),path.join(isolated,folder),{recursive:true});
  for(const r of readJSON(path.join(root,'universal/templates.json')).requestRules||[])for(const file of [r.sourceFile,r.upstreamScript,r.cryptoSource].filter(Boolean)){const dest=path.join(isolated,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
  const manifest=readJSON(path.join(isolated,'universal/templates.json'));
  const template=readJSON(path.join(dir,'draft/template.json'));manifest.templates.push(template);
  fs.writeFileSync(path.join(isolated,'universal/templates.json'),JSON.stringify(manifest));
  const registry=readJSON(path.join(isolated,'universal/sites.json'));
  registry.sites.push({...readJSON(path.join(dir,'draft/site.json')),template:template.id,status:'source-verified'});
  fs.writeFileSync(path.join(isolated,'universal/sites.json'),JSON.stringify(registry));
  for(const command of ['build-ad-clean.mjs','site-registry.mjs']){
   execFileSync(process.execPath,['scripts/'+command],{cwd:isolated});
   execFileSync(process.execPath,['scripts/'+command,'--check'],{cwd:isolated});
  }
  const fixture=readJSON(path.join(dir,'draft/fixture.json'));
  assert.equal(fixtureChecks(fs.readFileSync(path.join(isolated,'universal/ad-clean.js'),'utf8'),fixture),fixtureChecks(fs.readFileSync(path.join(isolated,template.output.script),'utf8'),fixture));
  const rules=fs.readFileSync(path.join(isolated,template.output.conf),'utf8').split('\n').filter(l=>l.startsWith('^')).map(l=>new RegExp(l.split(' url ')[0]));
  assert(rules.some(r=>r.test(base.url)));assert(!rules.some(r=>r.test(base.url.replace('new-site.example','www.new-site.example'))));
 });
});
