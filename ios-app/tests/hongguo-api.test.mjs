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
function createClient(){
 const requests=[],storage={getItem(){return null;},setItem(){}};
 const transport=async request=>{
  const url=new URL(request.url);requests.push({url:url.href,method:request.method,body:request.body});
  if(url.pathname==='/')return response(page({'page':{isSuccess:true,mBannerList:[movie(sid,'首页红果短剧')],homeSections:[{tab_type:'human',tab_name:'热播短剧',video_list:[movie(sid,'红果测试短剧')]}]}}));
  if(url.pathname.startsWith('/category/'))return response(categoryPage(url.pathname+url.search));
  if(url.pathname==='/detail')return response(page({'detail_page':{isSuccess:true,seriesDetail:{series_id:sid,series_name:'红果测试短剧',series_cover:'https://image.example/detail.jpg',series_intro:'简介',episode_cnt:4,accessible_episode_cnt:3,episode_right_text:'全4集',vid_list:vids,tags:['都市','爱情'],celebrities:[{nickname:'演员甲'}]},seriesSocialInfo:{rating:8.2}}}));
  if(url.pathname==='/api/video/protected/play-info'){
   const body=JSON.parse(request.body);
   if(body.item_id===vids[3])return response(JSON.stringify({error:'protected_playback_unavailable'}),403,{'Content-Type':'application/json'});
   return response(JSON.stringify({play_info:{main_url:'https://v26-hgweb.qznovelvod.com/video/'+body.item_id+'.mp4?sig=test',backup_url:'https://v11-hgweb.qznovelvod.com/video/'+body.item_id+'.mp4?sig=test'},base_resp:{StatusCode:0,StatusMessage:''}}),200,{'Content-Type':'application/json'});
  }
  throw Error('Unexpected Hongguo request: '+url.href);
 };
 return {client:new HongguoClient({id:'hongguo',provider:'hongguo',origin},transport,storage),requests};
}

test('Hongguo SSR extraction validates bounded JSON and maps homepage/category records',async()=>{
 const parsed=parseHongguoRouterData(page({page:{isSuccess:true}}));assert.ok(parsed.loaderData.page);
 assert.throws(()=>parseHongguoRouterData('<html>empty</html>'),/没有返回目录数据/);
 const {client,requests}=createClient();const home=await client.home();assert.equal(client.config.vodTabs.length,4);assert.equal(home.blocks.length,2);assert.equal(home.blocks[1].header.title,'热播短剧');assert.equal(home.blocks[1].data[0].url,'vod/detail?vodId='+sid);
 const first=await client.channel(1,{},'page=1');assert.equal(first.items[0].title,'红果测试短剧');assert.equal(first.next,'page=2');assert.equal(client.config.channelListQuery[0].items[0].data[1].id,'romance');
 const filtered=await client.channel(1,{topic:'romance'},'page=2');assert.equal(filtered.items[0].title,'第二页影片');assert.equal(filtered.next,'');
 assert.ok(requests.some(row=>row.url.includes('/category/real-drama/romance?page=2')));
});

test('Hongguo search keeps full episode lists and uses the official anonymous play-info endpoint',async()=>{
 const {client}=createClient();const results=await client.search('红果测试');assert.ok(results.items.some(item=>item.title==='红果测试短剧'));assert.equal(results.next,'');
 const detail=await client.detail(sid);assert.equal(detail.title,'红果测试短剧');assert.equal(detail.actors[0],'演员甲');assert.equal(detail.playSources[0].total,vids.length);
 const episodes=await client.episodes(sid,detail.playSources[0]);assert.deepEqual(episodes.map(item=>item.id),vids);assert.equal(detail.playSources[0].total,vids.length);assert.equal(episodes.length,4);
 const playback=await client.play({vodId:sid,siteId:'hongguo-official',episodeId:vids[1]});assert.equal(playback.playUrls.length,2);assert.match(playback.playUrls[0].url,/v26-hgweb\.qznovelvod\.com/);assert.equal(playback.playUrls[0].headers.Referer,origin+'/player/'+sid+'/'+vids[1]);
 await assert.rejects(client.play({vodId:sid,siteId:'hongguo-official',episodeId:vids[3]}),/红果网页播放器没有返回此集地址/);
});
