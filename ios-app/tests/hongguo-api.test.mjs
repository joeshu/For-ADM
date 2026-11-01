import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HongguoClient,parseHongguoRouterData} from '../Web/hongguo-api.mjs';

const origin='https://hongguoduanju.com',sid='7690961604636052505',vids=['7690963410778868761','7690963562042248217','7690963468219845657','7690963512345678901'];
const page=data=>'<html><script>window._ROUTER_DATA = '+JSON.stringify({loaderData:data})+';</script></html>';
const response=(text,status=200,headers={})=>({status,headers,bodyBase64:Buffer.from(text).toString('base64')});
const movie=(id,title)=>({series_id:id,series_name:title,series_cover:'https://image.example/'+id+'.jpg',episode_cnt:12,episode_right_text:'全12集',tags:['都市','爱情']});
function categoryPage(path){
 const selected=path.includes('/romance'),pageNumber=Number(new URL('https://hongguoduanju.com'+path).searchParams.get('page')||1);
 const list=pageNumber===2?[movie('7690961604636052506','第二页影片')]:selected?[movie('7690961604636052507','爱情分类影片')]:[movie(sid,'红果测试短剧')];
 return page({'category_$':{isSuccess:true,query:{page:pageNumber},selectorList:[{items:[{selector_item_id:'romance',show_name:'爱情'}]}],recommendList:list,pagination:{pageNum:pageNumber,totalPages:2}}});
}
function createClient({episodeList=vids,publicVideoSeo}={}){
 const requests=[],storage={getItem(){return null;},setItem(){}};
 const transport=async request=>{
  const url=new URL(request.url);requests.push({url:url.href,method:request.method,body:request.body});
  if(url.pathname==='/')return response(page({'page':{isSuccess:true,mBannerList:[movie(sid,'首页红果短剧')],homeSections:[{tab_type:'human',tab_name:'热播短剧',video_list:[movie(sid,'红果测试短剧')]}]}}));
  if(url.pathname.startsWith('/category/'))return response(categoryPage(url.pathname+url.search));
  if(url.pathname==='/detail')return response(page({'detail_page':{isSuccess:true,seriesDetail:{series_id:sid,series_name:'红果测试短剧',series_cover:'https://image.example/detail.jpg',series_intro:'简介',episode_cnt:4,accessible_episode_cnt:3,episode_right_text:'全4集',vid_list:episodeList,tags:['都市','爱情'],celebrities:[{nickname:'演员甲'}]},seriesSocialInfo:{rating:8.2}}}));
  if(url.pathname.startsWith('/player/')){
   const videoId=url.pathname.split('/').at(-1);
   return response(page({'player_(series_id)/(vid)/page':{isSuccess:true,protectedPlayback:true,publicVideoSeo:publicVideoSeo??{available:videoId===vids[0],seriesId:sid,itemId:videoId,width:360,height:640,durationSeconds:108.331},video_player_info:{format:'dash',kid:'fixture-kid',main_url:'https://v11-hgweb.qznovelvod.com/video/media-video-avc1/?mime_type=video_mp4',audio:{main_url:'https://v11-hgweb.qznovelvod.com/video/media-audio/'}}}}));
  }
  throw Error('Unexpected Hongguo request: '+url.href);
 };
 return {client:new HongguoClient({id:'hongguo',provider:'hongguo',origin},transport,storage),requests};
}

test('Hongguo SSR extraction validates bounded JSON and maps homepage/category records',async()=>{
 const parsed=parseHongguoRouterData(page({page:{isSuccess:true}}));assert.ok(parsed.loaderData.page);
 const globalThisRouter=parseHongguoRouterData('<script>globalThis._ROUTER_DATA = '+JSON.stringify({loaderData:{page:{}}})+';</script>');assert.ok(globalThisRouter.loaderData.page);
 assert.throws(()=>parseHongguoRouterData('<html>empty</html>'),/没有返回目录数据/);
 const {client,requests}=createClient();const home=await client.home();assert.equal(client.config.vodTabs.length,4);assert.equal(home.blocks.length,2);assert.equal(home.blocks[1].header.title,'热播短剧');assert.equal(home.blocks[1].data[0].url,'vod/detail?vodId='+sid);
 const first=await client.channel(1,{},'page=1');assert.equal(first.items[0].title,'红果测试短剧');assert.equal(first.next,'page=2');assert.equal(client.config.channelListQuery[0].items[0].data[1].id,'romance');
 const filtered=await client.channel(1,{topic:'romance'},'page=2');assert.equal(filtered.items[0].title,'第二页影片');assert.equal(filtered.next,'');
 assert.ok(requests.some(row=>row.url.includes('/category/real-drama/romance?page=2')));
});

test('Hongguo restores the original public video while preserving the complete episode list',async()=>{
 const {client,requests}=createClient();const results=await client.search('红果测试');assert.ok(results.items.some(item=>item.title==='红果测试短剧'));assert.equal(results.next,'');
 const detail=await client.detail(sid);assert.equal(detail.title,'红果测试短剧');assert.equal(detail.actors[0],'演员甲');assert.equal(detail.playSources[0].total,vids.length);
 const episodes=await client.episodes(sid,detail.playSources[0]);assert.deepEqual(episodes.map(item=>item.id),vids);assert.equal(detail.playSources[0].total,vids.length);assert.equal(episodes.length,4);
 assert.match(detail.playbackNotice,/非完整剧集/);assert.doesNotMatch(detail.playSources[0].name,/720P/);
 const playback=await client.play({vodId:sid,siteId:'hongguo-official',episodeId:vids[0]});assert.equal(playback.playUrls.length,1);assert.equal(playback.playUrls[0].url,origin+'/video/public/'+vids[0]+'/360p.mp4');assert.equal(playback.playUrls[0].headers.Referer,origin+'/player/'+sid+'/'+vids[0]);assert.equal(playback.playUrls[0].preview,true);
 await assert.rejects(client.play({vodId:sid,siteId:'hongguo-official',episodeId:vids[3]}),error=>error.code==='HONGGUO_OFFICIAL_REQUIRED'&&/公开试看/.test(error.message));
 assert.ok(!requests.some(row=>row.url.includes('/api/video/protected/')),'encrypted DASH must not be treated as a directly playable MP4');
});

test('Hongguo never guesses public media URLs for a different episode or a protected-only player',async()=>{
 for(const publicVideoSeo of [{available:false,seriesId:sid,itemId:vids[0]},{available:true,seriesId:sid,itemId:vids[1]},{available:true,seriesId:'111',itemId:vids[0]}]){
  const {client,requests}=createClient({publicVideoSeo});
  await assert.rejects(client.play({vodId:sid,siteId:'hongguo-official',episodeId:vids[0]}),error=>error.code==='HONGGUO_OFFICIAL_REQUIRED');
  assert.ok(requests.every(request=>new URL(request.url).hostname==='hongguoduanju.com'));
 }
});

test('Hongguo accepts official episode object variants, removes duplicate IDs, and keeps every valid episode',async()=>{
 const episodeList=[vids[0],{vid:vids[1]},{video_id:vids[1]},{item_id:vids[2]},'bad-id'];
 const {client}=createClient({episodeList}),detail=await client.detail(sid),episodes=await client.episodes(sid,detail.playSources[0]);
 assert.deepEqual(episodes.map(item=>item.id),vids.slice(0,3));
 assert.equal(detail.playSources[0].total,3);
});

test('Hongguo unavailable player pages offer the official App without guessing a media URL or retrying a 404',async()=>{
 const {client}=createClient(),original=client.transport;let playerCalls=0;
 client.transport=async request=>{if(new URL(request.url).pathname.startsWith('/player/')){playerCalls++;return response('Not found',404);}return original(request);};
 await assert.rejects(client.play({vodId:sid,siteId:'hongguo-official',episodeId:vids[3]}),error=>error.code==='HONGGUO_OFFICIAL_REQUIRED');
 assert.equal(playerCalls,1);
});

test('Hongguo does not cache an invalid SSR response, so a later request can recover',async()=>{
 const {client}=createClient();let homeCalls=0;
 const original=client.transport;
 client.transport=async request=>{
  if(new URL(request.url).pathname==='/'){
   homeCalls++;
   if(homeCalls===1)return response('<html>temporary edge error</html>',200);
  }
  return original(request);
 };
 await assert.rejects(client.home(),/没有返回目录数据/);
 assert.equal(client.lastDiagnostics.ok,false);
 await client.home();
 assert.equal(homeCalls,2,'failed parsing responses must not enter the page cache');
 assert.equal(client.lastDiagnostics.ok,true);
});

test('Hongguo retries 5xx responses, records the SSR contract, and avoids retrying access denials',async()=>{
 const {client,requests}=createClient();let homeAttempts=0;
 const original=client.transport;
 client.transport=async request=>{
  if(new URL(request.url).pathname==='/'){
   homeAttempts++;
   if(homeAttempts===1)return response('upstream unavailable',503);
  }
  return original(request);
 };
 await client.home();
 assert.equal(homeAttempts,2);
 assert.equal(client.lastDiagnostics.kind,'home');
 assert.equal(client.lastDiagnostics.routeKey,'page');
 assert.equal(client.lastDiagnostics.cached,false);
 const detail=await client.detail(sid);let playerAttempts=0;
 client.transport=async request=>{if(new URL(request.url).pathname.startsWith('/player/')){playerAttempts++;return response('Forbidden',403);}return original(request);};
 const before=playerAttempts;
 await assert.rejects(client.play({vodId:sid,siteId:detail.playSources[0].siteId,episodeId:vids[3]}),error=>error.code===403);
 const after=playerAttempts;
 assert.equal(after-before,1,'official 403 denials must not be retried');
});

test('Hongguo empty or changed detail contracts fail clearly instead of showing a broken empty detail',async()=>{
 const {client}=createClient();
 const original=client.transport;
 client.transport=async request=>{
  if(new URL(request.url).pathname==='/detail')return response(page({'detail_page':{isSuccess:true,seriesDetail:{series_id:sid,series_name:'空剧集',vid_list:[]}}}));
  return original(request);
 };
 await assert.rejects(client.detail(sid),/未返回有效剧集列表/);
 assert.equal(client.lastDiagnostics.ok,false);
});

test('Hongguo manual refresh clears cached pages and episode details',async()=>{
 const {client,requests}=createClient();
 await client.detail(sid);await client.detail(sid);
 assert.equal(requests.filter(item=>item.url.includes('/detail?')).length,1);
 client.clearCache();
 await client.detail(sid);
 assert.equal(requests.filter(item=>item.url.includes('/detail?')).length,2);
});
