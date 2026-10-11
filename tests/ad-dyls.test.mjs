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
test('Dyls entry skips cached landing ads and keeps login/details state',async()=>{
 const {default:vm}=await import('node:vm');const f=readJSON(new URL('../universal/fixtures/dyls-index-js.json',import.meta.url));
 const cached={data:{start:[{data:{image:'fixture-old-cache-ad.jpg'}}]}};const dispatched=[];
 const context=vm.createContext({r:()=>()=>{},n:()=>({openAuthModel:false,openLoginModel:true,openSignupModel:false,panding:true,isShowingDetails:true}),N:{useState:fn=>[fn()]},Tt:()=>cached,re:value=>({type:'landing',value})});
 vm.runInContext(runCleaner(code,f.url,f.body),context);assert.equal(context.vt(cached),null);
 context.fixtureLandingEffect(cached,value=>dispatched.push(value.value));assert.deepEqual(dispatched,[false]);
 const model=context.mn();assert.equal(model.panding,false);assert.equal(model.login,true);assert.equal(model.details,true);assert.equal(context.fixturePlayer(),'fixture-player-preserved');
});
test('Dyls shared ad exports return no grids or loaders and preserve unrelated service exports',async()=>{
 const {default:vm}=await import('node:vm');
 for(const name of ['helper','newads']){
  const f=readJSON(new URL('../universal/fixtures/dyls-'+name+'-js.json',import.meta.url)),out=runCleaner(code,f.url,f.body);
  const context=vm.createContext({});vm.runInContext(out.replace(/export\{([^}]+)\};/,(_,bindings)=>'globalThis.fixtureExports={'+bindings.split(',').map(x=>{const [local,alias]=x.split(' as ');return alias+':'+local;}).join(',')+'};'),context);
  const exports=context.fixtureExports;
  if(name==='newads'){for(const section of ['search_input_under','player_episode_up','other-page']){assert.equal(exports.t({section}),null);assert.equal(exports.n({items:[{data:{image:'old-cache.jpg'}}]}),null);}}
  else{const hook=exports.a();assert.equal(hook.isLoading,false);assert.equal(hook.isFetching,false);assert.equal(hook.error,null);assert.deepEqual(JSON.parse(JSON.stringify(await exports.t())),{msg:'获取成功',data:{}});assert.deepEqual(JSON.parse(JSON.stringify(await hook.refetchAds())),{msg:'获取成功',data:{}});assert.equal(exports.n(),'fixture-header-topics');assert.equal(exports.o(),'fixture-header-hook');assert.equal(exports.r(),'fixture-header-reset');assert.equal(exports.s(),'fixture-notifications');const value={film:'preserved'};assert.equal(exports.i(value),value);}
 }
});
test('Dyls JS rejects missing/duplicate markers and unrelated module families',()=>{
 const manifest=readJSON(new URL('../universal/templates.json',import.meta.url)),t=manifest.templates.find(t=>t.id==='dyls');
 for(const [i,name] of ['index','helper','newads'].entries()){
  const f=readJSON(new URL('../universal/fixtures/dyls-'+name+'-js.json',import.meta.url)),action=t.actions[i];
  for(const marker of action.requires){const body=f.body.replace(marker,'changed-marker');assert.equal(runCleaner(code,f.url,body),body);}
  for(const [old] of action.pairs){for(const body of [f.body.replace(old,'changed-source'),f.body+'\n'+old])assert.equal(runCleaner(code,f.url,body),body);}
  for(const url of [f.url.replace('dyls1.','dyls2.'),f.url.replace(/\/assets\/[^/]+$/,'/assets/player-B4L3j5Ck.js')])assert.equal(runCleaner(code,url,f.body),f.body);
  for(const statusCode of [403,502])assert.equal(runCleaner(code,f.url,f.body,{statusCode}),f.body);
 }
});
