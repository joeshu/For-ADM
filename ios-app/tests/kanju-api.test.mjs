import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {KanjuClient} from '../Web/kanju-api.mjs';
import {categories,collectMovies,homeSections} from '../Web/model.mjs';

globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const site={id:'kanju-test',origin:'https://kanju.example',provider:'kanju',protocol:{signingKey:'fixture-signing-key',apiOrigins:['https://kanju.example','https://fallback.example'],clientName:'fixture-client',clientVersion:'1',buildVersion:'fixture-build',protocolVersion:'fixture-protocol'}};
const storage=()=>{const map=new Map();return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
const response=(data,status=200)=>({status,headers:{},bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')});
const longId='av_'+('catalog-long-id-'.repeat(7));
const episodeId=n=>'av_episode_'+n;
const token=n=>'av_token_'+n;
const option=(key,label,params)=>({key,label,params,enabled:true});
const runtime={catalog_ui:{channels:[{key:'recommend',label:'AI找剧'},{key:'updates',label:'最近更新'},{key:'series',label:'电视剧'},{key:'movie',label:'电影'}],catalogs:[
 {kind:'series',default_sort:'heat_desc',rows:[
  {key:'genre',label:'类型',all_label:'全部类型',options:[option('古装','古装',{genre:'古装'})]},
  {key:'area',label:'地区',all_label:'全部地区',options:[option('中国大陆','中国大陆',{area:'中国大陆'})]},
  {key:'year',label:'年份',all_label:'全部年份',options:[option('2026','2026',{year:'2026'})]},
  {key:'sort',label:'排序',all_label:'最热',options:[option('heat_desc','最热',{sort:'heat_desc'}),option('updated_desc','最新',{sort:'updated_desc'})]}
 ]},
 {kind:'movie',default_sort:'updated_desc',rows:[]}
]}};
const card=(id=longId,title='测试剧')=>({id,title,content_kind:'series',poster_url:'https://posters.example/poster.jpg',genres:['古装'],remarks:'更新中'});
const lineOptions=()=>[
 {id:'direct-id',provider_id:'direct-provider',play_from:'direct-main',label:'直连主线',url:'https://media.example/main.m3u8',url_kind:'m3u8',resolved:true,resolve_required:false,resolve_mode:'direct',minimum_user_level:0,selected:true},
 {id:'direct-alt-id',provider_id:'direct-provider-alt',play_from:'direct-alt',label:'直连备用',url:'https://media.example/alternate.m3u8',url_kind:'m3u8',resolved:true,minimum_user_level:0,preference_weight:10},
 {id:'ticket-id',provider_id:'official-provider',play_from:'official-main',label:'官方解析',url:'resolve://fixture-ticket',url_kind:'resolve_ticket',resolved:false,resolve_required:true,resolve_mode:'parse',minimum_user_level:0},
 {id:'vip-id',provider_id:'vip-provider',play_from:'vip',label:'会员线路',url:'resolve://vip-ticket',url_kind:'resolve_ticket',minimum_user_level:1}
];
const seriesDetail=()=>({id:longId,variant_id:longId,selected_variant_id:longId,title:'测试剧详情',content_kind:'series',poster_url:'https://posters.example/detail.jpg',description:'原生详情测试',year:2026,area:'中国大陆',language:'普通话',genres:['古装'],actors:['测试演员'],variants:[{id:longId,title:'第一季',selected:true,has_playback:true}]});

function fixture(handler,{origins=site.protocol.apiOrigins}={}){
 const calls=[],store=storage(),testSite={...site,protocol:{...site.protocol,apiOrigins:origins}};
 const transport=async request=>{
  if(request.signal?.aborted)throw new DOMException('请求取消','AbortError');
  const url=new URL(request.url),method=request.method||'GET',headers=Object.fromEntries(Object.entries(request.headers||{}).map(([key,value])=>[key.toLowerCase(),value])),body=request.body?JSON.parse(request.body):undefined;
  const row={url,method,headers,body,request};calls.push(row);
  assert.match(String(headers['x-ai-movie-timestamp']),/^\d+$/);
  assert.match(String(headers['x-ai-movie-nonce']),/^[a-f0-9]{32}$/i);
  assert.equal(headers['client-name'],'fixture-client');
  const canonical=[method,url.pathname+url.search,headers['x-ai-movie-timestamp'],headers['x-ai-movie-nonce']].join('\n');
  assert.equal(headers['x-ai-movie-signature'],crypto.createHmac('sha256',testSite.protocol.signingKey).update(canonical).digest('hex'));
  assert.equal(headers.cookie,undefined);
  return handler(row,calls);
 };
 return {client:new KanjuClient(testSite,transport,store),calls,store};
}

test('Kanju adapter signs exact paths and exposes only server-provided categories and filters',async()=>{
 const {client,calls}=fixture(()=>response(runtime)),config=await client.bootstrap();
 assert.deepEqual(categories(config).map(item=>item.name),['最近更新','电视剧','电影']);
 assert.deepEqual(config.vodTabs.map(item=>item.channelId),[9,2,1]);
 const filter=config.channelListQuery.find(item=>item.channelId===2).items;
 assert.ok(filter.find(item=>item.query==='class').data.some(item=>item.id==='古装'));
 assert.ok(filter.find(item=>item.query==='area').data.some(item=>item.id==='中国大陆'));
 assert.equal(calls.length,1);assert.equal(calls[0].url.pathname,'/v1/runtime/bootstrap');
});

test('Kanju homepage preserves native sections and More routes use safe server parameters',async()=>{
 const {client,calls}=fixture(row=>{
  if(row.url.pathname==='/v1/runtime/bootstrap')return response(runtime);
  if(row.url.pathname==='/v1/feed/home')return response({sections:[
   {id:'section-hot',title:'大家都在看',browse:{path:'/v1/browse/catalog',method:'GET',params:{kind:'series',sort:'heat_desc',hot_list_key:'safe-key',unexpected:'discard'}},cards:[card()]},
   {id:'section-movie',title:'电影热播',cards:[{...card('av_movie','测试电影'),content_kind:'movie'}]}
  ]});
  if(row.url.pathname==='/v1/browse/catalog')return response({cards:[card('av_more','更多结果')],pagination:{page:1,has_more:false}});
  throw Error('Unexpected endpoint '+row.url.pathname);
 });
 const home=await client.home(),sections=homeSections(home);
 assert.deepEqual(sections.map(item=>item.title),['大家都在看','电影热播']);
 assert.ok(sections[0].items[0].id.startsWith('kj_'));
 assert.ok(sections[0].route);assert.equal(sections[0].items[0].id.length,35);
 const more=await client.collection(sections[0].route);
 assert.equal(collectMovies(more.items)[0].title,'更多结果');
 const query=calls.at(-1).url.searchParams;
 assert.equal(query.get('hot_list_key'),'safe-key');assert.equal(query.has('unexpected'),false);
});

test('Kanju latest, category filters, search and continuation are source-native',async()=>{
 const {client,calls}=fixture(row=>{
  if(row.url.pathname==='/v1/runtime/bootstrap')return response(runtime);
  if(row.url.pathname==='/v1/browse/catalog'){
   const page=Number(row.url.searchParams.get('page')||1);
   return response({cards:[card('av_page_'+page,'第'+page+'页')],pagination:{page,has_more:page===1,next_page:2,total:2}});
  }
  throw Error('Unexpected endpoint '+row.url.pathname);
 });
 const latest=await client.channel(9),next=await client.channel(9,{},latest.next);
 assert.equal(latest.items[0].title,'第1页');assert.equal(next.items[0].title,'第2页');
 const category=await client.channel(2,{class:'古装',area:'中国大陆',year:'2026',sort:'updated_desc',ignored:'x'});
 const request=calls.find(row=>row.url.pathname==='/v1/browse/catalog'&&row.url.searchParams.get('kind')==='series');
 assert.equal(request.url.searchParams.get('genre'),'古装');assert.equal(request.url.searchParams.get('area'),'中国大陆');
 assert.equal(request.url.searchParams.get('year'),'2026');assert.equal(request.url.searchParams.get('sort'),'updated_desc');assert.equal(request.url.searchParams.has('ignored'),false);
 await client.search(' 流浪地球 ');
 assert.equal(calls.at(-1).url.searchParams.get('q'),'流浪地球');assert.equal(calls.at(-1).url.searchParams.get('intent'),'catalog_search');
 assert.equal(category.items.length,1);
});

test('Kanju detail assembles complete pagination, direct and ticket routes without persisting tokens',async()=>{
 const {client,calls,store}=fixture(row=>{
  if(row.url.pathname==='/v1/runtime/bootstrap')return response(runtime);
  if(row.url.pathname==='/v1/catalog/'+longId+'/detail')return response(seriesDetail());
  if(row.url.pathname==='/v1/catalog/'+longId+'/episodes'){
   const offset=Number(row.url.searchParams.get('offset')||0),count=offset===0?24:12;
   return response({variant_id:longId,episodes:Array.from({length:count},(_,index)=>({id:episodeId(offset+index+1),token:token(offset+index+1),display_name:'第'+(offset+index+1)+'集'})),episode_pagination:{offset,limit:200,total_count:36,has_more:offset===0}});
  }
  if(row.url.pathname.startsWith('/v1/playback/resolve/')){const n=Number(row.url.pathname.split('/').pop().replace('av_token_',''));return response({current_episode:{id:episodeId(n)},line_options:lineOptions()});}
  throw Error('Unexpected endpoint '+row.url.pathname);
 });
 const detail=await client.detail(client.id(longId));
 assert.equal(detail.playSources[0].siteId,'auto');assert.equal(detail.playSources[0].list.length,36);
 assert.equal(detail.playSources.at(-1).name,'官方解析');assert.equal(detail.playSources.filter(source=>source.name==='会员线路').length,0);
 assert.equal(detail.playSources[0].list.at(-1).id,episodeId(36));assert.ok(detail.seasons.some(item=>item.selected));
 assert.equal(store.map.get('sanyuan:kanju-test:ids').includes('av_token_'),false);
 assert.deepEqual(calls.filter(row=>row.url.pathname.endsWith('/episodes')).map(row=>Number(row.url.searchParams.get('offset'))),[0,24,0]);
});

test('Kanju play refreshes the exact episode, returns HTTPS-only media and resolves a ticket only when selected',async()=>{
 const {client,calls}=fixture(row=>{
  if(row.url.pathname==='/v1/runtime/bootstrap')return response(runtime);
  if(row.url.pathname==='/v1/catalog/'+longId+'/detail')return response(seriesDetail());
  if(row.url.pathname==='/v1/catalog/'+longId+'/episodes'){
   const offset=Number(row.url.searchParams.get('offset')||0),count=offset===0?24:12;
   return response({variant_id:longId,episodes:Array.from({length:count},(_,index)=>({id:episodeId(offset+index+1),token:token(offset+index+1),display_name:'第'+(offset+index+1)+'集'})),episode_pagination:{offset,limit:200,total_count:36,has_more:offset===0}});
  }
  if(row.url.pathname.startsWith('/v1/playback/resolve/')&&row.method==='GET'){const n=Number(row.url.pathname.split('/').pop().replace('av_token_',''));return response({current_episode:{id:episodeId(n)},line_options:lineOptions()});}
  if(row.url.pathname==='/v1/playback/resolve-line'){
   assert.equal(row.method,'POST');assert.deepEqual(row.body,{ticket:'fixture-ticket'});assert.equal(row.url.searchParams.get('view'),'compact');
   return response({line:{url:'https://media.example/official.m3u8',url_kind:'m3u8',resolved:true}});
  }
  throw Error('Unexpected endpoint '+row.url.pathname);
 });
 const detail=await client.detail(client.id(longId)),episode=detail.playSources[0].list.at(-1),direct=detail.playSources.find(source=>source.name==='直连主线'),ticket=detail.playSources.find(source=>source.name==='官方解析');
 const directResult=await client.play({vodId:detail.id,siteId:direct.siteId,episodeId:episode.id});
 assert.equal(directResult.playUrls[0].url,'https://media.example/main.m3u8');assert.equal(directResult.playUrls[0].headers.Cookie,undefined);
 const auto=await client.play({vodId:detail.id,siteId:'auto',episodeId:episode.id});assert.equal(auto.playUrls.length,2);
 const ticketResult=await client.play({vodId:detail.id,siteId:ticket.siteId,episodeId:episode.id});assert.equal(ticketResult.playUrls[0].url,'https://media.example/official.m3u8');
 assert.equal(calls.filter(row=>row.url.pathname==='/v1/playback/resolve-line').length,1);
 assert.ok(calls.some(row=>row.url.pathname==='/v1/playback/resolve/av_token_36'));
 assert.equal(calls.some(row=>String(row.url).includes('fixture-ticket')),false);
});

test('Kanju retries a failed API origin but does not retry signature or permission denials',async()=>{
 let primaryCalls=0,fallbackCalls=0;
 const {client}=fixture(row=>{
  if(row.url.hostname==='kanju.example'){primaryCalls++;return response({error:'temporarily unavailable'},503);}
  fallbackCalls++;return response(runtime);
 });
 assert.equal((await client.bootstrap()).vodTabs.length,3);assert.equal(primaryCalls,1);assert.equal(fallbackCalls,1);
 let denied=0;const {client:deniedClient}=fixture(()=>{denied++;return response({error:{message:'denied'}},403);});
 await assert.rejects(deniedClient.bootstrap(),error=>error.code===403);assert.equal(denied,1);
});
