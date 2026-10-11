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
 for(const url of [f.url.replace('dyls1.','dyls2.'),f.url.replace('index_recommend','detail'),f.url.replace('index_recommend','master.m3u8'),f.url.replace('mbxqnb.cn/','mbxqnb.cn.invalid/')])assert.equal(runCleaner(code,url,f.body),f.body);
 for(const statusCode of [401,403,502])assert.equal(runCleaner(code,f.url,f.body,{statusCode}),f.body);
 for(const block of [{layout:'index_recommend_carousel',list:{}},{layout:'base',list:[{type:3,image:'film.jpg'}]},{layout:'index_recommend_carousel',list:[{type:'3',image:'unknown.jpg'},{type:9,image:'unknown.jpg'}]}]){
  const body=JSON.stringify({msg:'获取成功',data:[block]});assert.equal(runCleaner(code,f.url,body),body);
 }
});
