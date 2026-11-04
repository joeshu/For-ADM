import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const CryptoJS=require('../ios-app/Web/vendor/crypto-js.js');
const names=['kkapp','ncat','happ','yqk','qntv','dyls','souju','kanju'];
const subscription=JSON.parse(fs.readFileSync(path.join(here,'For-ADM.fwd'),'utf8'));
assert.equal(subscription.widgets.length,names.length,'the unified subscription lists all eight standalone widgets');
const makeContext=(id,respond)=>{
  const values=new Map();
  const Widget={
    http:{get:(url,options)=>respond('GET',url,options),post:(url,body,options)=>respond('POST',url,{...options,body}),request:(options)=>respond(options.method||'GET',options.url,options)},
    storage:{get:async key=>values.get(key),set:async(key,value)=>values.set(key,value),remove:async key=>values.delete(key)},
    log:()=>{}
  };
  const context={Widget,CryptoJS,console,setTimeout,clearTimeout,Promise,Date,Math,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,atob,btoa,Buffer,process,AbortController,URL,URLSearchParams};
  context.globalThis=context;
  vm.runInNewContext(fs.readFileSync(path.join(here,id+'.js'),'utf8'),context,{filename:id+'.js',timeout:10000});
  return context;
};

for(const id of names){
  const source=fs.readFileSync(path.join(here,id+'.js'),'utf8');
  const context=makeContext(id,async()=>{throw Error('unexpected network call');});
  const subscriptionEntry=subscription.widgets.find(widget=>widget.id==='joeshu.'+id);
  assert.equal(context.WidgetMetadata.id,'joeshu.'+id,id+' has a source-scoped identity');
  assert.ok(subscriptionEntry,id+' is present in the importable subscription');
  assert.equal(subscriptionEntry.version,context.WidgetMetadata.version,id+' subscription version matches its script');
  assert.equal(subscriptionEntry.url,'https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/'+id+'.js',id+' uses a direct raw GitHub URL');
  assert.equal(typeof context.loadDetail,'function',id+' exposes detail lookup');
  assert.equal(typeof context.loadResource,'function',id+' exposes CCTVHost loadResource');
  assert.ok(context.WidgetMetadata.modules.some(module=>module.type==='stream'&&module.functionName==='loadResource'),id+' registers a playback resource module');
  await assert.rejects(context.loadResource({link:'https://invalid.example/episode'}),/请选择|分集|影片|站点|资源|链接/);
  if(id==='qntv'){
    assert.match(source,/qntv\.v1\./,'QNTV stores its visitor state independently');
    assert.doesNotMatch(source,/yqk\.v2\./,'QNTV does not share YQK storage');
    assert.match(source,/0576435a23b94990806ca98e54f95adf/,'QNTV uses its own app ID');
  }
  if(id==='yqk')assert.match(source,/yqk\.v2\./,'YQK retains its own storage namespace');
  if(id==='kanju'){
    assert.ok(source.includes("site:'https://ai.kanju25.com'"),'Kanju uses its current site origin');
    assert.ok(source.includes("SOUJU.site+'/player/'"),'Kanju generates player links from its independent origin');
    assert.doesNotMatch(source,/kanju3\.com/,'Kanju does not retain its stale site origin');
    assert.match(source,/kanju\.aiQuota/,'Kanju quota state is isolated from Souju');
  }
}

for(const id of ['kkapp','ncat','happ']){
  const site=JSON.parse(fs.readFileSync(path.join(here,'../ios-app/Web/sites.json'),'utf8')).find(item=>item.id===id);
  const calls=[];
  const context=makeContext(id,async(method,url,options={})=>{
    calls.push({method,url,options});
    if(url.includes('/config/prod/appInit.html'))return {statusCode:200,data:{data:{urls:{cache:[site.origin],logic:[site.origin]},groups:[{id:'vod1',url:[{domain:'https://img.example/vod1'}]}]}}};
    if(url.includes('/v2/vod/detail.capi'))return {statusCode:200,data:{data:{id:'movie-1',title:'测试影片',imagePath:'/poster.webp',imageGroup:'vod1',playSources:[{siteId:'line-a',name:'主线路',episodeVodId:'season-1',list:[{id:'ep-1',title:'第1集'}]}]}}};
    if(url.includes('/user/anonymous'))return {statusCode:200,data:{data:{id:'guest-1',token:'guest-token'}}};
    if(url.includes('/vod/episodePlayUrl'))return {statusCode:200,data:{data:{playUrls:[{name:'主线路',url:'https://media.example/master.m3u8',headers:{'User-Agent':'fixture'}}]}}};
    throw Error('unexpected endpoint '+url);
  });
  const detail=await context.loadDetail(site.origin+'/__cctvhost__/'+id+'/vod?id=movie-1');
  assert.equal(detail.episodeItems.length,1,id+' exposes the selected episode in its detail view');
  assert.equal(detail.coverUrl,'https://img.example/vod1/poster.webp',id+' resolves a source CDN poster group');
  assert.match(detail.episodeItems[0].link,/siteId=line-a/,id+' keeps the selected source route in the episode link');
  const link=site.origin+'/__cctvhost__/'+id+'/episode?vodId=movie-1&siteId=line-a&episodeId=ep-1';
  const resources=await context.loadResource({link});
  assert.equal(resources.length,1,id+' returns one validated media resource');
  assert.equal(resources[0].url,'https://media.example/master.m3u8');
  assert.equal(resources[0].playerType,'app');
  assert.equal(resources[0].customHeaders['User-Agent'],'fixture');
  assert.ok(calls.some(call=>call.url.includes('/user/anonymous')),id+' obtains a source-local guest session');
  assert.ok(calls.some(call=>call.url.includes('/vod/episodePlayUrl')),id+' calls its own play endpoint');
}

for(const id of ['kkapp','ncat','happ']){
  const site=JSON.parse(fs.readFileSync(path.join(here,'../ios-app/Web/sites.json'),'utf8')).find(item=>item.id===id);
  const context=makeContext(id,async(method,url)=>{
    if(url.includes('/config/prod/appInit.html'))return {statusCode:200,data:{data:{urls:{cache:[site.origin],logic:[site.origin]}}}};
    if(url.includes('/v2/vod/detail.capi'))return {statusCode:200,data:{data:{id:'movie-1',title:'测试影片',playSources:[{siteId:'locked',name:'登录线路',needLogin:true,list:[{id:'ep-1',title:'第1集'}]}]}}};
    throw Error('locked route must fail closed');
  });
  await assert.rejects(context.loadResource({link:site.origin+'/episode?vodId=movie-1&siteId=locked&episodeId=ep-1'}),/所选线路|访客可用|失败/);
}

{
  const calls=[];
  const context=makeContext('dyls',async(method,url,options={})=>{
    calls.push({method,url,options});
    if(url.includes('/app/config'))return {statusCode:200,data:{data:{movie_screen:{filter:[]},index_top_nav:[{id:1,name:'电影'}]}}};
    if(url.includes('/movie/detail'))return {statusCode:200,data:{data:{id:'m-1',name:'测试电影',type_name:'电影',play_from:[{code:'line-a',name:'公开线路',list:[{episode_id:'e-1',episode_name:'正片',play_url:'https://media.example/movie.m3u8',ready_to_play:true}]}]}}};
    if(url.includes('/movie_addr/list'))return {statusCode:200,data:{data:[{episode_id:'e-1',episode_name:'正片',play_url:'https://media.example/movie.m3u8',ready_to_play:true}]}};
    throw Error('unexpected Dyls endpoint '+url);
  });
  assert.equal(typeof context.JSEncrypt,'function','Dyls bundles the RSA helper');
  const resources=await context.loadResource({link:'https://dyls1.mbxqnb.cn/__cctvhost__/dyls/episode?vodId=m-1&siteId=line-a&episodeId=e-1'});
  assert.equal(resources.length,1);
  assert.equal(resources[0].url,'https://media.example/movie.m3u8');
  assert.equal(resources[0].customHeaders.Referer,undefined,'Dyls does not invent a media Referer');
  assert.ok(calls.some(call=>call.url.includes('signature=')),'Dyls signs the original request pack');
}

console.log('CCTVHost source contracts and mock playback paths passed for all eight sources.');
