import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {test} from 'node:test';import {readJSON,runCleaner} from '../scripts/lib/ad-sites.mjs';
const manifest=readJSON(new URL('../universal/templates.json',import.meta.url)),template=manifest.templates.find(t=>t.id==='kkapp'),code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8'),sources=readJSON(new URL('./kkapp-sources.json',import.meta.url));
function helper(){const c=vm.createContext({URL,URLSearchParams,location:{origin:'https://a.kkapp06.com'}});vm.runInContext(template.jsHelpers.cards.source,c);return c.__forAdmKKCleanV2;}
test('KKAPP mixed promo lists retain movies, categories, valid media and unknown shapes',()=>{
 const clean=helper(),keep=[{title:'film',url:'vod/detail?id=1',coverPath:'movie.jpg'},{title:'本周国剧',url:'channel/list?id=2'},{title:'same site',url:'https://a.kkapp06.com/shorts/detail?id=3'},{title:'backup site',url:'https://www.kkys14.com/vod/detail?id=4'},{title:'media',type:'mp4',url:'https://cdn.example/film.mp4',coverPath:'cover.jpg'},{title:'unknown',url:'unrecognized:thing'},{url:'https://cdn.example/master.m3u8?sign=keep'},{type:2,title:'post',url:'video/detail?id=5'}];
 const ads=[{title:'promo',url:'https://promo.example/landing'},{title:'promo',url:'web?url=https%3A%2F%2Fpromo.example%2F'},{title:'promo',url:'browser?urls=https%3A%2F%2Fpromo.example%2F%7Chttps%3A%2F%2Fpromo2.example%2F'},{type:'ad_mp4',url:'https://cdn.example/ad.mp4'},{_vod:'ad_home',data:'vodHomeAd1'}];
 const original=[...keep,...ads],out=clean(original);assert.deepEqual(Array.from(out),keep);assert.equal(original.length,keep.length+ads.length);assert.equal(clean(out),out);assert.equal(clean({unknown:original}).unknown,original);
});
test('KKAPP nested block filtering updates carousel/entry/grid data and preserves headers and source lists',()=>{
 const clean=helper(),movie={title:'normal',url:'vod/detail?id=1'},ad={title:'PG电子',imagePath:'ad.jpg',url:'https://promo.example/'};
 const input={header:{title:'好片推荐',url:'vod/list'},blocks:[{_vod:'section3',cols:5,data:[ad,movie]},{_vod:'section2',cols:3,data:[movie,ad]},{_vod:'ad_home2',data:'slot'}],account:{id:'keep'}};
 const out=clean(input);assert.equal(out.blocks.length,2);assert.deepEqual(Array.from(out.blocks[0].data),[movie]);assert.deepEqual(Array.from(out.blocks[1].data),[movie]);assert.equal(out.header,input.header);assert.equal(out.account,input.account);assert.equal(input.blocks[0].data.length,2);assert.equal(clean(out),out);
});
test('KKAPP helpers inject once only after a complete card modification; unchanged modules get no helper',()=>{
 for(const info of sources.filter(x=>x.kind==='cards')){const f=readJSON(new URL('../universal/fixtures/kkapp-cards-'+info.action+'.json',import.meta.url));const out=runCleaner(code,f.url,f.body);assert.equal(out.split(template.jsHelpers.cards.marker).length-1,1);assert.equal(runCleaner(code,f.url,out),out);const action=template.actions[info.action],bad=f.body.replace(action.pairs[0][0],'source-changed');assert.equal(runCleaner(code,f.url,bad),bad);}
 const f=readJSON(new URL('../universal/fixtures/kkapp-0.json',import.meta.url));assert.ok(!runCleaner(code,f.url,f.body).includes(template.jsHelpers.cards.marker));
});
test('KKAPP announced domains share JS interception but unknown domains and media remain outside rules',()=>{
 const f=readJSON(new URL('../universal/fixtures/kkapp-0.json',import.meta.url));for(const host of [...template.bindings[0].domains.names,'kkys01.com','www.kkys14.com','kkys99.com','www.kkys123.com'])assert.notEqual(runCleaner(code,f.url.replace('a.kkapp06.com',host),f.body),f.body);
 for(const host of ['www.kkysabc.com','other.kkys14.com','unknown.kkapp06.com','www.kekys.com.invalid'])assert.equal(runCleaner(code,f.url.replace('a.kkapp06.com',host),f.body),f.body);
 const conf=fs.readFileSync(new URL('../kkapp/quantumult-x-snippet.conf',import.meta.url),'utf8'),patterns=conf.split('\n').filter(s=>s.startsWith('^https?://')).map(s=>new RegExp(s.split(' url ')[0])),re={test:url=>patterns.some(p=>p.test(url))};
 for(const host of [...template.bindings[0].domains.names,'kkys01.com','www.kkys14.com','kkys99.com','www.kkys123.com'])assert.ok(re.test(f.url.replace('a.kkapp06.com',host)));assert.ok(!re.test('https://www.kekys.com/film.m3u8'));
});

test('kkapp homepage 精彩应用 entry is removed even when it opens an internal aggregation route',()=>{const clean=helper(),keep=[{text:'本周国剧',url:'channel/list?id=1'},{title:'精彩应用',url:'vod/detail?id=2'},{text:'精彩应用'}],ads=[{text:'精彩应用',url:'apps'},{text:'精彩应用',url:'web?url=https%3A%2F%2Fapps.example%2F'},{text:'精彩应用',url:'https://apps.example/'}],input=[...keep,...ads];assert.deepEqual(Array.from(clean(input)),keep);assert.equal(input.length,6);});
