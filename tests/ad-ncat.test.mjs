import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {test} from 'node:test';import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const manifest=readJSON(new URL('../universal/templates.json',import.meta.url)),t=manifest.templates.find(t=>t.id==='ncat'),sources=readJSON(new URL('./ncat-sources.json',import.meta.url)),code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
test('NCAT modern and legacy core getters reject cached ads without modifying account data',()=>{
 for(const source of sources.filter(x=>x.kind==='core')){const action=t.actions[source.action],context=vm.createContext({});vm.runInContext('var holder={'+action.pairs[0][1]+'};var '+action.pairs[1][1]+';',context);context.holder.appAdvertisements=[{id:'vodHomeAd1',items:[{url:'ad'}]}];context.holder.user={id:'preserved'};assert.equal(context.holder.getAdvertiseById('vodHomeAd1'),undefined);const key=action.pairs[1][1].split('=')[0];assert.equal(context[key]('vodHomeAd1'),false);assert.equal(context.holder.user.id,'preserved');}
});
test('NCAT dedicated units export completes with empty data and leaves announcements/init exports intact',async()=>{
 for(const source of sources.filter(x=>x.kind==='units')){const action=t.actions[source.action],context=vm.createContext({});vm.runInContext('var api={'+action.pairs[0][1]+'};',context);assert.deepEqual(JSON.parse(JSON.stringify(await context.api.so()())),{data:[]});assert.ok(action.requires.includes('/app/announcements'));assert.ok(action.requires.includes('/v2/config/units.capi'));}
});
test('NCAT shared banners ignore persisted ad arrays in all audited page chunks',()=>{
 for(const source of sources.filter(x=>x.kind==='banners'))for(const [old,next] of t.actions[source.action].pairs){const match=old.match(/^(\w+)=(\w+)\[/),context=vm.createContext({[match[2]]:{appAdvertisements:[{id:'cached-ad'}]}});vm.runInContext('var '+old+';',context);assert.equal(context[match[1]].length,1);vm.runInContext(next+';',context);assert.equal(context[match[1]].length,0);}
});
test('NCAT player selectors return no ad even when detail and native bridge would supply it',()=>{
 for(const source of sources.filter(x=>x.kind==='player'))for(const [old,next] of t.actions[source.action].pairs){assert.ok(old.includes("['ads']['find']"));assert.ok(old.includes('getAdvertiseById'));assert.ok(!old.includes('m3u8'));const context=vm.createContext({});vm.runInContext('var '+next+';',context);const key=next.split('=')[0];assert.equal(context[key]('vodStart',{ads:[{id:'vodStart',items:[{url:'ad.mp4'}]}]}),undefined);}
});
test('NCAT requires exact host, known JS families and complete source fingerprints',()=>{
 const f=readJSON(new URL('../universal/fixtures/ncat-0.json',import.meta.url));for(const url of [f.url.replace('a.napp03.com','other.napp03.com'),f.url.replace('/static/v20529/js/','/unrelated/'),f.url.replace(/[^/]+$/,'chunk-vendors.24435528.js')])assert.equal(runCleaner(code,url,f.body),f.body);
 for(const info of sources){const action=t.actions[info.action],f=readJSON(new URL('../universal/fixtures/ncat-'+(info.kind==='cache'?'cache-':'')+info.action+'.json',import.meta.url));for(const [old] of action.pairs)for(const body of [f.body.replace(old,'changed-source'),f.body+'\n'+old])assert.equal(runCleaner(code,f.url,body),body);}
});

test('NCAT port-bound rewrite and runtime match the supplied non-default endpoint',()=>{
 const f=readJSON(new URL('../universal/fixtures/ncat-0.json',import.meta.url)),conf=fs.readFileSync(new URL('../ncat/quantumult-x-snippet.conf',import.meta.url),'utf8'),patterns=conf.split('\n').filter(s=>s.startsWith('^https?://')).map(s=>new RegExp(s.split(' url ')[0]));
 for(const url of [f.url,f.url.replace(':51111','')]){assert.ok(patterns.some(p=>p.test(url)));assert.notEqual(runCleaner(code,url,f.body),f.body);}
 for(const url of [f.url.replace(':51111',':51112'),f.url.replace('a.napp03.com','b.napp03.com'),f.url.replace('/static/v20529/js/','/media/')]){assert.ok(!patterns.some(p=>p.test(url)));assert.equal(runCleaner(code,url,f.body),f.body);}
 assert.ok(conf.includes('hostname = a.napp03.com'));assert.ok(!conf.includes('hostname = a.napp03.com:51111'));
});
test('NCAT reuses mixed card cleanup while retaining genuine content and media routes',()=>{
 const context=vm.createContext({URL,URLSearchParams,location:{origin:'https://a.napp03.com:51111'}});vm.runInContext(t.jsHelpers.cards.source,context);const film={title:'film',url:'vod/detail?id=1'},media={title:'video',type:'mp4',url:'https://cdn.example/film.mp4',coverPath:'cover.jpg'},category={title:'分类',url:'channel/list?id=2'},promo={title:'promo',imagePath:'ad.jpg',url:'browser?url=https%3A%2F%2Fpromo.example%2F'};const input={blocks:[{_vod:'section2',data:[film,promo,media,category]},{_vod:'ad_home',data:'slot'}]};const out=context.__forAdmKKCleanV2(input);assert.equal(out.blocks.length,1);assert.deepEqual(Array.from(out.blocks[0].data),[film,media,category]);assert.equal(input.blocks[0].data.length,4);assert.equal(context.__forAdmKKCleanV2(out),out);
});
