import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
const manifest=readJSON(new URL('../universal/templates.json',import.meta.url));
const template=manifest.templates.find(t=>t.id==='qlplayer');
const fixture=readJSON(new URL('../universal/fixtures/qlplayer.json',import.meta.url));
test('QLPlayer advertising enabled still takes original resolution branch and registers no pause ads',async()=>{
 const out=runCleaner(code,fixture.url,fixture.body);
 let resolves=0,played=0,bindings=0;
 const context=vm.createContext({playerConfig:{ads:{pre_roll:{enabled:true},pause:{enabled:true}}},resolveVideo:async()=>{resolves++;return {url:'fixture-media',type:'video'};},initPlayer:(url,type)=>{assert.equal(url,'fixture-media');assert.equal(type,'video');played++;},showError:()=>assert.fail('Playback error'),closePauseAd:()=>assert.fail('Unexpected ad handler')});
 vm.runInContext(out,context);
 await context.init();
 context.bindAds({on(){bindings++;}});
 assert.equal(resolves,1);assert.equal(played,1);assert.equal(bindings,0);
});
test('QLPlayer requires every fingerprint and both replacement counts, with strict response boundaries',()=>{
 for(const marker of template.actions[0].requires){const body=fixture.body.replace(marker,'changed');assert.equal(runCleaner(code,fixture.url,body),body);}
 for(const [original] of template.actions[0].pairs){
  for(const body of [fixture.body.replace(original,'if (changed) {'),fixture.body+'\n// '+original])assert.equal(runCleaner(code,fixture.url,body),body);
 }
 for(const target of [fixture.url.replace('svip.','other.'),fixture.url.replace('player.js','auth.js'),fixture.url.replace('player.js','hls.min.js'),fixture.url.replace('/assets/player.js','/?url=movie'),fixture.url+'.invalid'])assert.equal(runCleaner(code,target,fixture.body),fixture.body);
 for(const statusCode of [403,502])assert.equal(runCleaner(code,fixture.url,fixture.body,{statusCode}),fixture.body);
 assert.equal(runCleaner(code,fixture.url,fixture.body,{headers:{'Content-Type':'text/html'}}),fixture.body);
 assert.notEqual(runCleaner(code,fixture.url+'?v=next',fixture.body),fixture.body);
});
