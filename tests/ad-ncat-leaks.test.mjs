import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {test} from 'node:test';import {readJSON,runCleaner} from '../scripts/lib/ad-sites.mjs';
const manifest=readJSON(new URL('../universal/templates.json',import.meta.url)),t=manifest.templates.find(t=>t.id==='ncat'),code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
function cleaner(){const c=vm.createContext({URL,URLSearchParams,location:{origin:'https://a.napp03.com:51111'}});vm.runInContext(t.jsHelpers.cards.source,c);return c.__forAdmKKCleanV2;}
test('NCAT double-encoded and movie-labelled promo cards no longer bypass the predicate',()=>{
 const clean=cleaner(),keep=[{title:'film',type:'movie',url:'vod/detail?id=1'},{title:'normal video',type:'video',url:'video/detail?id=2'},{text:'本周国剧',url:'channel/list?id=3'},{title:'media',type:'mp4',coverPath:'cover.jpg',url:'https://cdn.example/file.mp4?sign=untouched'}],ads=[{title:'PG',type:'movie',url:'https://promo.example/'},{title:'promo',type:'video',coverPath:'ad.jpg',url:'https://promo.example/landing'},{text:'promo',url:'browser?url=https%253A%252F%252Fpromo.example%252F'},{title:'promo',url:'web?url=https%253A%252F%252Fpromo.example%252F'}];
 const input=[...keep,...ads],out=clean(input);assert.deepEqual(Array.from(out),keep);assert.equal(input.length,8);assert.equal(clean(out),out);
});
test('NCAT banner roots and prearranged post wrappers use the same removal decision',()=>{
 const clean=cleaner(),movie={title:'film',url:'vod/detail?id=1'},ad={title:'promo',coverPath:'ad.jpg',url:'https://promo.example/'},normalPost={post:{title:'film review',url:'article/detail?id=1'},top:0,column:0,style:{}};
 const input={banners:{data:[ad,movie]},blocks:[{_vod:'section3',data:[{text:'promo',url:'web?url=https%253A%252F%252Fpromo.example%252F'},movie]}],account:{id:'keep'}};const out=clean(input);assert.deepEqual(Array.from(out.banners.data),[movie]);assert.deepEqual(Array.from(out.blocks[0].data),[movie]);assert.equal(out.account,input.account);assert.deepEqual(Array.from(clean([{post:ad,top:100,column:1},normalPost])),[normalPost]);
});
test('NCAT HTML versions only main application entries and is safe on repeated processing',()=>{
 const f=readJSON(new URL('../universal/fixtures/ncat-cache-html.json',import.meta.url)),out=runCleaner(code,f.url,f.body);assert.ok(/app\.e102418a\.js\?for_adm=ncat-v3-[a-f0-9]{12}/.test(out));assert.ok(/app-legacy\.97e2a46b\.js\?for_adm=ncat-v3-[a-f0-9]{12}/.test(out));assert.ok(out.includes('src="static/v20529/js/chunk-vendors.84c6a5a8.js"'));assert.equal(runCleaner(code,f.url,out),out);assert.equal(runCleaner(code,f.url,f.body,{statusCode:403}),f.body);
assert.ok(code.includes('for_adm=ncat-v3-'));assert.ok(!code.includes('__ADM_CACHE_REVISION__'));
});
test('NCAT revision query is confined to script chunk resolution and never appended to media URLs',()=>{
 const sources=readJSON(new URL('./ncat-sources.json',import.meta.url));for(const info of sources.filter(x=>x.kind==='cache')){const f=readJSON(new URL('../universal/fixtures/ncat-cache-'+info.action+'.json',import.meta.url)),out=runCleaner(code,f.url,f.body);assert.ok(/\.js\?for_adm=ncat-v3-[a-f0-9]{12}/.test(out));assert.ok(out.includes('fixture-film.m3u8?sign=keep'));assert.equal(runCleaner(code,f.url,out),out);}
});

test('ncat homepage 精彩应用 entry is removed even when it opens an internal aggregation route',()=>{const clean=cleaner(),keep=[{text:'本周国剧',url:'channel/list?id=1'},{title:'精彩应用',url:'vod/detail?id=2'},{text:'精彩应用'}],ads=[{text:'精彩应用',url:'apps'},{text:'精彩应用',url:'web?url=https%3A%2F%2Fapps.example%2F'},{text:'精彩应用',url:'https://apps.example/'}],input=[...keep,...ads];assert.deepEqual(Array.from(clean(input)),keep);assert.equal(input.length,6);});
