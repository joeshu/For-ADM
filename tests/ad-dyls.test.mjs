import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
const f=readJSON(new URL('../universal/fixtures/dyls.json',import.meta.url));
test('Dyls only removes confirmed ad layout and carousel type while preserving movie data',()=>{
 const before=JSON.parse(f.body),out=runCleaner(code,f.url,f.body),after=JSON.parse(out);
 assert.equal(after.data.length,2);
 assert.deepEqual(after.data[0],{...before.data[0],list:before.data[0].list.filter(x=>x.type!==3)});
 assert.deepEqual(after.data[1],before.data[2]);
 assert.equal(after.msg,before.msg);assert.equal(runCleaner(code,f.url,out),out);
});
test('Dyls errors, malformed schemas, unknown hosts/endpoints and media remain unchanged',()=>{
 for(const body of ['not-json','{}',JSON.stringify({...JSON.parse(f.body),msg:'获取失败'}),JSON.stringify({msg:'获取成功',data:{list:[]}})])assert.equal(runCleaner(code,f.url,body),body);
 for(const url of [f.url.replace('dyls1.','dyls2.'),f.url.replace('/api/v1/movie/index_recommend','/assets/config'),f.url.replace('/api/v1/movie/index_recommend','/media/master.m3u8'),f.url.replace('mbxqnb.cn/','mbxqnb.cn.invalid/')])assert.equal(runCleaner(code,url,f.body),f.body);
 for(const statusCode of [401,403,502])assert.equal(runCleaner(code,f.url,f.body,{statusCode}),f.body);
 for(const block of [{layout:'index_recommend_carousel',list:{}},{layout:'base',list:[{type:3,image:'film.jpg'}]},{layout:'index_recommend_carousel',list:[{type:'3',image:'unknown.jpg'},{type:9,image:'unknown.jpg'}]}]){
  const body=JSON.stringify({msg:'获取成功',data:[block]});assert.equal(runCleaner(code,f.url,body),body);
 }
});

test('Dyls domain API coverage reuses known ad schema and preserves unknown responses',()=>{
 const expected=runCleaner(code,f.url,f.body);
 for(const path of ['/api/v1/movie/detail','/api/v1/movie/search','/api/v2/home/list','/api/v12/example/new']){
  const url='https://dyls1.mbxqnb.cn'+path+'?fixture=1';
  assert.equal(runCleaner(code,url,f.body),expected);
  for(const value of [{msg:'获取成功',data:{url:'https://fixture-media.example/master.m3u8?sign=keep',ads:[]}}, {msg:'获取成功',data:[{layout:'unknown_ad_layout',list:[{type:3,url:'keep'}]}]}, {msg:'登录失败',data:JSON.parse(f.body).data}]){
   const body=JSON.stringify(value);assert.equal(runCleaner(code,url,body),body);
  }
 }
 const conf=fs.readFileSync(new URL('../dyls/quantumult-x-snippet.conf',import.meta.url),'utf8');
 const pattern=conf.split('\n').find(line=>line.startsWith('^https?://')).split(' url ')[0];
 for(const url of ['https://dyls1.mbxqnb.cn/api/v1/movie/detail','https://dyls1.mbxqnb.cn/api/v2/home/list?fixture=1'])assert.ok(new RegExp(pattern).test(url));
 for(const url of ['https://dyls2.mbxqnb.cn/api/v1/movie/detail','https://dyls1.mbxqnb.cn/assets/app.js','https://dyls1.mbxqnb.cn/media/master.m3u8'])assert.ok(!new RegExp(pattern).test(url));
});
