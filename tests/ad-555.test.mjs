import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
const manifest=readJSON(new URL('../universal/templates.json',import.meta.url));
const template=manifest.templates.find(t=>t.id==='555-movie');
const html=readJSON(new URL('../universal/fixtures/555-movie.json',import.meta.url));
const js=readJSON(new URL('../universal/fixtures/555-movie-js.json',import.meta.url));
function execute(source){
 let appended=0,reads=0;const document={},window={};
 const $=target=>target===document?{ready(fn){fn();}}:{data(){reads++;return Buffer.from(JSON.stringify({1:{name:'fixture-ad'}})).toString('base64');},append(){appended++;}};
 vm.runInNewContext(source,{$,document,window,atob:v=>Buffer.from(v,'base64').toString()});
 return {appended,reads,player:window.fixturePlayer()};
}
test('555 core JS disables only promotion initialization and preserves player function',()=>{
 assert.deepEqual(execute(js.body),{appended:1,reads:1,player:'player-preserved'});
 const out=runCleaner(code,js.url,js.body);
 assert.deepEqual(execute(out),{appended:0,reads:0,player:'player-preserved'});
 assert.equal(out,js.body.replace(template.actions.at(-1).pairs[0][0],template.actions.at(-1).pairs[0][1]));
});
test('555 requires exact CDN path, complete fingerprints and one replacement occurrence',()=>{
 const action=template.actions.at(-1);
 for(const feature of action.requires){const body=js.body.replace(feature,'changed-feature');assert.equal(runCleaner(code,js.url,body),body);}
 const old=action.pairs[0][0], duplicate=js.body.replace(old,old+old);
 assert.equal(runCleaner(code,js.url,duplicate),duplicate);
 for(const url of [js.url.replace('5217868f','otherfile'),js.url.replace('eliteres.fanruan.com','other.example'),js.url.replace('.js?','.m3u8?')])assert.equal(runCleaner(code,url,js.body),js.body);
 for(const statusCode of [403,502])assert.equal(runCleaner(code,js.url,js.body,{statusCode}),js.body);
});
test('555 HTML covers registered aliases and article/play routes without widening unknown hosts',()=>{
 for(const host of ['wu5mv.com','www.wu5mv.com','5dy4.vip','www.5dy4.vip','5dy987.vip','55dy1.top','www.55dy98.top','555k2.com','555k91.com','555k58.com','www.555k999.com','55kp8.com','www.55kp123.com'])for(const route of ['/','/index/home.html','/vodplay/800530-13-1.html','/arttype/5.html','/artdetail-23529.html']){
  const out=runCleaner(code,'https://'+host+route+'?utm_source=fixture',html.body);
  for(const v of html.removed)assert.ok(!out.includes(v));
  for(const v of html.preserved)assert.ok(out.includes(v));
 }
 for(const guard of template.actions[0].requires){const body=html.body.replace(guard,'changed-feature');assert.equal(runCleaner(code,html.url,body),body);}
 for(const url of ['https://5dya.vip/','https://555k.com/','https://55kp8.net/','https://55kp8.com.invalid/','https://5dy4.vip.invalid/','https://5dy4.vip/media/master.m3u8'])assert.equal(runCleaner(code,url,html.body),html.body);
});

test('555 numbered subscriptions include MITM families and preserve ordinary publication markup',()=>{
 const conf=fs.readFileSync(new URL('../555-movie/quantumult-x-snippet.conf',import.meta.url),'utf8');
 for(const host of ['5dy*.vip','www.5dy*.vip','55dy*.top','www.55dy*.top','555k*.com','www.555k*.com','55kp*.com','www.55kp*.com'])assert.ok(conf.includes(host));
 const publication='<html><h1>555电影发布页</h1><a href="https://5dy4.vip/">主域名</a><a href="https://555k91.com/">备用网址</a><a href="https://55kp8.com/">备用网址</a></html>';
 assert.equal(runCleaner(code,'https://55dy1.top/',publication),publication);
 for(const host of ['5dyevil.vip','55dy-test.top','555ka.com','55kp-app.com'])assert.equal(runCleaner(code,'https://'+host+'/',html.body),html.body);
});
