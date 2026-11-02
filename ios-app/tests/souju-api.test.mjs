import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {SoujuClient} from '../Web/souju-api.mjs';
import {categories,collectMovies,homeSections} from '../Web/model.mjs';

globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const site={id:'souju-test',origin:'https://souju.example',provider:'souju',protocol:{signingKey:'public-fixture-signing-key'}};
const storage=()=>{const map=new Map();return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
const response=(data,status=200,headers={})=>({status,headers,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')});
const kinds=[['movie','电影'],['series','电视剧'],['anime','动漫'],['variety','综艺'],['short_drama','短剧']];
const option=(key,label,params)=>({key,label,params,enabled:true});
const runtime={object:'runtime.bootstrap',version:1,catalog_ui:{channels:[{key:'recommend',label:'AI找剧'},...kinds.map(([key,label])=>({key,label}))],catalogs:kinds.map(([kind])=>({kind,default_sort:'heat_desc',rows:[
 {key:'genre',label:'分类',all_label:'全部分类',clear_params:['genre'],options:[option('赛博悬疑','赛博悬疑',{genre:'赛博悬疑'})]},
 {key:'area',label:'地区',all_label:'全部地区',clear_params:['area'],options:[option('中国大陆','中国大陆',{area:'中国大陆'})]},
 {key:'year',label:'年份',all_label:'全部年份',clear_params:['year'],options:[option('2026','2026',{year:'2026'})]},
 {key:'sort',label:'排序',all_label:'默认排序',clear_params:['sort'],options:[option('updated_desc','最近更新',{sort:'updated_desc'}),option('heat_desc','热度优先',{sort:'heat_desc'})]}
 ]}))}};
const card=(id='av_title',title='测试剧')=>({id,title,poster_url:'https://posters.example/'+id+'.jpg',content_kind:'series',year:2026,genres:['赛博悬疑'],area:'中国大陆',remarks:'更新中',availability:{playable:true}});
const ep=(n,token='av_token'+n)=>({id:'av_ep'+n,token,display_name:'第'+n+'集',title:'第'+n+'集'});
const episodePage=(episodes,total=episodes.length,hasMore=false,offset=0)=>({variant_id:'av_title',episodes,episode_pagination:{offset,total_count:total,has_more:hasMore}});
const detail=()=>({...card(),description:'测试简介',variants:[{id:'av_title',title:'测试剧',has_playback:true},{id:'av_season2',title:'测试剧第二季',season_label:'第二季',has_playback:true}]});
const direct=(episode=ep(1),lines)=>({object:'playback.resolve',current_episode:episode,line_options:lines||[{id:'direct-a',playback_source_id:'direct-a',provider_id:'direct-a',display_label:'直连A',url:'https://media.example/main.m3u8',url_kind:'m3u8',resolved:true,resolve_required:false,minimum_user_level:0}]});
const playURLs=value=>Array.isArray(value)?value:value.playUrls;

function fixture(handler,{config=runtime}={}){
 const calls=[],store=storage();
 const transport=async request=>{
  if(request.signal?.aborted)throw new DOMException('请求取消','AbortError');
  const url=new URL(request.url),method=request.method||'GET',headers=Object.fromEntries(Object.entries(request.headers||{}).map(([key,value])=>[key.toLowerCase(),value]));
  const path=url.pathname+url.search,body=request.body?JSON.parse(request.body):undefined;
  const row={url,path,method,headers,body,request};calls.push(row);
  if(url.pathname!=='/v1/runtime/bootstrap'||headers['x-ai-movie-signature']){
   assert.match(String(headers['x-ai-movie-timestamp']),/^\d+$/);
   assert.match(String(headers['x-ai-movie-nonce']),/^[a-f0-9]{32}$/i);
   const canonical=[method,path,headers['x-ai-movie-timestamp'],headers['x-ai-movie-nonce']].join('\n');
   assert.equal(headers['x-ai-movie-signature'],crypto.createHmac('sha256',site.protocol.signingKey).update(canonical).digest('hex'));
  }
  if(url.pathname==='/v1/runtime/bootstrap')return response(config);
  if(url.pathname==='/v1/users/anonymous'){
   assert.equal(method,'POST');assert.match(String(body?.anonymous_id),/^web_[A-Za-z0-9_-]+$/);
   return response({expires_at:new Date(Date.now()+3600000).toISOString()},201,{'Set-Cookie':'ai_movie_session=; Path=/v1; Max-Age=0, ai_movie_session=; Path=/; Max-Age=0, ai_movie_session=fixture-session; Path=/; Secure; HttpOnly'});
  }
  assert.equal(headers.cookie,'ai_movie_session=fixture-session');
  return handler(row,calls);
 };
 return {client:new SoujuClient(site,transport,store),calls,store};
}

test('Souju uses public web signing and runtime taxonomy with source-defined filter options',async()=>{
 const {client,calls}=fixture(()=>response({cards:[],pagination:{has_more:false}}));
 const config=await client.bootstrap();
 assert.deepEqual(categories(config).map(item=>item.id),[1,2,3,4,6]);
 const filters=config.channelListQuery.find(item=>Number(item.channelId)===1)?.items||[];
 assert.ok(filters.find(item=>item.query==='class')?.data.some(item=>item.id==='赛博悬疑'));
 await client.channel(1,{class:'赛博悬疑',area:'中国大陆',year:'2026',sort:'updated_desc',unexpected:'ignored'});
 const request=calls.find(item=>item.url.pathname==='/v1/browse/catalog');
 assert.equal(request.url.searchParams.get('kind'),'movie');
 assert.equal(request.url.searchParams.get('genre'),'赛博悬疑');
 assert.equal(request.url.searchParams.get('area'),'中国大陆');
 assert.equal(request.url.searchParams.get('year'),'2026');
 assert.equal(request.url.searchParams.get('sort'),'updated_desc');
 assert.equal(request.url.searchParams.has('unexpected'),false);
});

test('Souju does not expose a category absent from its runtime catalog',async()=>{
 const {client}=fixture(()=>response({cards:[],pagination:{has_more:false}}));
 const config=await client.bootstrap();
 assert.deepEqual(categories(config).map(item=>item.name),['电影','电视剧','动漫','综艺','短剧']);
 assert.equal(config.channelListQuery.some(item=>Number(item.channelId)===7),false);
});

test('Souju keeps original homepage sections and a working source-specific More route',async()=>{
 const {client,calls}=fixture(row=>row.url.pathname==='/v1/feed/home'?response({object:'home.feed',sections:[
  {id:'movies-hot',title:'电影热播',cards:[card('av_first','电影一')],browse:{type:'catalog_browse_request',label:'更多电影热播',method:'GET',path:'/v1/browse/catalog',params:{hot_list_key:'movie_hot',limit:'20'},page:1,limit:20}},
  {id:'series-new',title:'国产新剧',cards:[card('av_second','剧集二')]}
 ]}):response({cards:[card('av_more','更多影片')],pagination:{has_more:false,page:1,limit:20}}));
 const sections=homeSections(await client.home());
 assert.deepEqual(sections.map(item=>item.title),['电影热播','国产新剧']);
 assert.equal(sections[0].items[0].id,'av_first');assert.ok(sections[0].route);
 const more=await client.collection(sections[0].route);
 assert.equal(collectMovies(more.items)[0].id,'av_more');
 assert.equal(calls.at(-1).url.searchParams.get('hot_list_key'),'movie_hot');
});

test('Souju category and title search use server continuation and preserve distinct pages',async()=>{
 const {client,calls}=fixture(row=>{
  const page=Number(row.url.searchParams.get('page')||1);
  return response({cards:[card('av_page'+page)],pagination:{page,limit:1,has_more:page===1,...page===1?{next_page:2}:{}}});
 });
 const first=await client.channel(2),second=await client.channel(2,{},first.next);
 assert.ok(first.next);assert.equal(second.next,'');assert.notEqual(collectMovies(first.items)[0].id,collectMovies(second.items)[0].id);
 await client.search(' 流浪地球 ');
 const last=calls.at(-1).url.searchParams;assert.equal(last.get('q'),'流浪地球');assert.equal(last.get('intent'),'catalog_search');
});

test('Souju assembles all 194 episodes and keeps other seasons outside automatic source recovery',async()=>{
 const {client,calls}=fixture(row=>{
  if(row.url.pathname==='/v1/catalog/av_title')return response(detail());
  if(row.url.pathname.endsWith('/episodes')){const offset=Number(row.url.searchParams.get('offset'));return response(episodePage(Array.from({length:offset===0?100:94},(_,i)=>ep(offset+i+1)),194,offset===0,offset));}
  if(row.url.pathname.startsWith('/v1/playback/resolve/'))return response(direct(ep(1)));
  throw Error('Unexpected '+row.path);
 });
 const result=await client.detail('av_title');
 const episodes=result.playSources[0].list;
 assert.ok(result.playSources.length>=1);assert.equal(episodes.length,194);assert.equal(new Set(episodes.map(item=>item.id)).size,194);assert.ok(result.playSources.every(item=>item.list.every(episode=>episodes.some(other=>other.id===episode.id))));
 assert.equal(episodes[100].id,'av_ep101');assert.equal(episodes.at(-1).id,'av_ep194');assert.ok(result.seasons.some(item=>item.id==='av_season2'));
 assert.deepEqual(calls.filter(item=>item.url.pathname.endsWith('/episodes')).slice(0,2).map(item=>Number(item.url.searchParams.get('offset'))),[0,100]);
});

test('Souju rejects incomplete episode totals and nonadvancing episode pagination',async()=>{
 for(const mode of ['incomplete','repeated']){
  const {client,calls}=fixture(row=>row.url.pathname.endsWith('/episodes')?response(episodePage([ep(1)],2,mode==='repeated',Number(row.url.searchParams.get('offset')))):response(detail()));
  await assert.rejects(client.detail('av_title'),/分集|选集|数量|完整|分页/);
  assert.ok(calls.filter(item=>item.url.pathname.endsWith('/episodes')).length<5);
 }
});

test('Souju refreshes the exact episode page and only returns direct HTTPS media without session headers',async()=>{
 let secondPageReads=0;
 const {client,calls}=fixture(row=>{
  if(row.url.pathname==='/v1/catalog/av_title')return response(detail());
  if(row.url.pathname.endsWith('/episodes')){
   const offset=Number(row.url.searchParams.get('offset'));if(offset===100)secondPageReads++;
   return response(episodePage(offset===0?Array.from({length:100},(_,i)=>ep(i+1)):[ep(101,secondPageReads===1?'av_oldtoken':'av_freshtoken')],101,offset===0,offset));
  }
  if(row.url.pathname==='/v1/playback/resolve/av_token1')return response(direct(ep(1)));
  assert.equal(row.url.pathname,'/v1/playback/resolve/av_freshtoken');
  return response(direct(ep(101),[
   {id:'good',display_label:'直连高清',url:'https://media.example/good.m3u8',resolved:true,headers:{Referer:'https://source.example/',Cookie:'private',Authorization:'private',Bad:'bad\r\nheader'},userAgent:'fixture-player'},
   {id:'duplicate',url:'https://media.example/good.m3u8',resolved:true},
   {id:'http',url:'http://media.example/clear.m3u8',resolved:true},
   {id:'restricted',url:'https://media.example/vip.m3u8',minimum_user_level:1,resolved:true},
   {id:'parser',url:'resolve://private-ticket',resolve_required:true,resolve_mode:'parse'},
   {id:'unresolved',url:'https://media.example/not-ready.m3u8',resolved:false}
  ]));
 });
 const result=await client.detail('av_title'),line=result.playSources[0];
 const urls=playURLs(await client.play({vodId:result.id,siteId:line.siteId,episodeId:'av_ep101'}));
 assert.equal(urls.length,1);assert.equal(urls[0].url,'https://media.example/good.m3u8');assert.equal(urls[0].headers.Referer,'https://source.example/');assert.equal(urls[0].headers['User-Agent'],'fixture-player');
 assert.equal(urls[0].headers.Cookie,undefined);assert.equal(urls[0].headers.Authorization,undefined);assert.equal(urls[0].headers.Bad,undefined);
 assert.equal(secondPageReads,2);assert.equal(calls.filter(item=>item.url.pathname.includes('/resolve-line')).length,0);
});

test('Souju rejects a playback bundle for another episode',async()=>{
 let resolves=0;const {client}=fixture(row=>row.url.pathname.endsWith('/episodes')?response(episodePage([ep(1)])):row.url.pathname.startsWith('/v1/playback/resolve/')?response(direct(ep(++resolves===1?1:2))):response(detail()));
 const result=await client.detail('av_title');
 await assert.rejects(client.play({vodId:result.id,siteId:result.playSources[0].siteId,episodeId:'av_ep1'}),/分集|选集|匹配|其他集/);
});

test('Souju a manually selected direct provider stays on that provider and does not silently substitute another',async()=>{
 let missing=false;const lines=[
  {id:'a',playback_source_id:'a',provider_id:'provider-a',display_label:'主线A',url:'https://media.example/a.m3u8',resolved:true},
  {id:'b',playback_source_id:'b',provider_id:'provider-b',display_label:'备用B',url:'https://media.example/b.m3u8',resolved:true}
 ];
 const {client}=fixture(row=>row.url.pathname.endsWith('/episodes')?response(episodePage([ep(1)])):row.url.pathname.startsWith('/v1/playback/resolve/')?response(direct(ep(1),missing?lines.slice(0,1):lines)):response(detail()));
 const result=await client.detail('av_title'),selected=result.playSources.find(line=>line.name.includes('备用B'));assert.ok(selected);
 const params={vodId:result.id,siteId:selected.siteId,episodeId:'av_ep1'},urls=playURLs(await client.play(params));assert.equal(urls.length,1);assert.equal(urls[0].url,'https://media.example/b.m3u8');
 missing=true;await assert.rejects(client.play(params),/线路|来源|可用|提供/);
});

test('Souju long film IDs reopen through the persisted registry while long episode IDs retain exact identity',async()=>{
 const rawID='av_'+('title'.repeat(28)),rawEpisode='av_'+('episode'.repeat(20)),token='av_ephemeral_token';
 const {client,store,calls}=fixture(row=>{
  if(row.url.pathname==='/v1/feed/home')return response({object:'home.feed',sections:[{id:'long-title',title:'长标识片单',cards:[card(rawID)]}]});
  if(row.url.pathname==='/v1/catalog/'+rawID)return response({...card(rawID),variants:[]});
  if(row.url.pathname==='/v1/catalog/'+rawID+'/episodes')return response({variant_id:rawID,episodes:[{id:rawEpisode,token,display_name:'第1集'}],episode_pagination:{offset:0,total_count:1,has_more:false}});
  if(row.url.pathname==='/v1/playback/resolve/'+token)return response(direct({id:rawEpisode}));
  throw Error('Unexpected '+row.path);
 });
 const movie=homeSections(await client.home())[0].items[0];assert.ok(movie.id.length<=80);assert.match(movie.id,/^sj_/);
 const reopened=new SoujuClient(site,client.transport,store),result=await reopened.detail(movie.id);assert.equal(result.id,movie.id);assert.ok(calls.some(item=>item.url.pathname==='/v1/catalog/'+rawID));
 const line=result.playSources[0],episode=line.list[0];assert.equal(episode.id,rawEpisode);
 const urls=playURLs(await reopened.play({vodId:result.id,siteId:line.siteId,episodeId:episode.id}));assert.equal(urls[0].url,'https://media.example/main.m3u8');
 assert.equal([...store.map.values()].some(value=>String(value).includes(token)),false);
});

test('Souju renews an expired visitor session once while keeping the same anonymous identity',async()=>{
 let attempts=0;
 const {client,calls}=fixture(()=>++attempts===1?response({error:{code:'session_expired',message:'Session expired'}},401):response({cards:[card()],pagination:{has_more:false}}));
 await client.search('测试');
 const guests=calls.filter(item=>item.url.pathname==='/v1/users/anonymous');assert.equal(guests.length,2);assert.equal(guests[0].body.anonymous_id,guests[1].body.anonymous_id);assert.equal(attempts,2);
});

test('Souju concurrent content loads share one normal anonymous session',async()=>{
 const {client,calls}=fixture(()=>response({cards:[card()],pagination:{has_more:false}}));
 await Promise.all([client.channel(1),client.search('测试'),client.channel(2)]);
 assert.equal(calls.filter(item=>item.url.pathname==='/v1/users/anonymous').length,1);
 assert.equal(calls.filter(item=>item.url.pathname==='/v1/runtime/bootstrap').length,1);
});

test('Souju quota, signature and rate-limit denials never create new visitor identities or parser requests',async()=>{
 for(const [status,code]of [[402,'playback_token_insufficient'],[401,'invalid_request_signature'],[429,'rate_limit_exceeded']]){
  const {client,calls}=fixture(()=>response({error:{code,message:'Denied'}},status));
  await assert.rejects(client.search('测试'));
  assert.equal(calls.filter(item=>item.url.pathname==='/v1/users/anonymous').length,1);
  assert.equal(calls.filter(item=>item.url.pathname==='/v1/browse/catalog').length,1);
  assert.equal(calls.some(item=>item.url.pathname.includes('/resolve-line')),false);
 }
});

test('Souju cancellation before bootstrap issues no requests',async()=>{
 const {client,calls}=fixture(()=>{throw Error('Unexpected network');}),aborter=new AbortController();aborter.abort();
 await assert.rejects(client.bootstrap(aborter.signal),error=>error.name==='AbortError');assert.equal(calls.length,0);
});

test('Souju forwards cancellation to an in-flight content request without retrying',async()=>{
 let started;const ready=new Promise(resolve=>started=resolve);
 const {client,calls}=fixture(row=>new Promise((_resolve,reject)=>{started();row.request.signal.addEventListener('abort',()=>reject(new DOMException('请求取消','AbortError')),{once:true});}));
 const aborter=new AbortController(),pending=client.search('测试','page=1',aborter.signal);await ready;aborter.abort();
 await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(calls.filter(item=>item.url.pathname==='/v1/browse/catalog').length,1);
});
