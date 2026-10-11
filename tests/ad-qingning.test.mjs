import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolveParserProfile} from '../scripts/lib/parser-profiles.mjs';
import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
const manifest=readJSON(new URL('../universal/templates.json',import.meta.url));
const template=resolveParserProfile(manifest.templates.find(t=>t.id==='qingning-player'),manifest);
const fixtures=[0,1].map(i=>readJSON(new URL('../universal/fixtures/qingning-player-'+i+'.json',import.meta.url)));
test('Qingning preserves playback, errors and ending while error click cannot open promotion',()=>{
 for(const fixture of fixtures){
  const out=runCleaner(code,fixture.url,fixture.body);const script=out.match(/<script>([\s\S]*?)<\/script>/)[1];
  let sources=0,plays=0,ends=0,opens=0,click;
  const context=vm.createContext({window:{open(){opens++;}},dialogContent:[{addEventListener(event,fn){assert.equal(event,'click');click=fn;}}],nextEpisode(){ends++;},videojs:(id,options,ready)=>{
   assert.equal(id,'video');const callbacks={};ready.call({src(url){assert.equal(url,'https://fixture-media.example/master.m3u8?sign=keep&t=123');sources++;},play(){plays++;},on(event,fn){callbacks[event]=fn;}});
   callbacks.error();click();callbacks.ended();
  }});vm.runInContext(script,context);assert.equal(sources,1);assert.equal(plays,1);assert.equal(ends,1);assert.equal(opens,0);
 }
});
test('Qingning missing/duplicate script features and unrelated hosts or paths preserve original response',()=>{
 for(let i=0;i<fixtures.length;i++){
  const f=fixtures[i],action=template.actions[i];
  for(const feature of action.scriptRequires){const body=f.body.replace(feature,'changed');assert.equal(runCleaner(code,f.url,body),body);}
  const call=action.pairs[0][0];const body=f.body.replace(call,call+';'+call);assert.equal(runCleaner(code,f.url,body),body);
  for(const target of [f.url.replace('/api/publicApi.php','/api/other.php'),f.url.replace('.com/','.com.invalid/'),f.url.replace('/api/publicApi.php','/master.m3u8')])assert.equal(runCleaner(code,target,f.body),f.body);
  for(const statusCode of [403,502])assert.equal(runCleaner(code,f.url,f.body,{statusCode}),f.body);
 }
});
