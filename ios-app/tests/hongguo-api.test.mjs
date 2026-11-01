import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HongguoClient,parseHongguoRouterData} from '../Web/hongguo-api.mjs';

const origin='https://hongguoduanju.com',sid='7690961604636052505',vids=['7690963410778868761','7690963562042248217','7690963468219845657'];
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
  const url=new URL(request.url);requests.push({url:url.href,method:request.method});
  if(url.pathname==='/')return response(page({'page':{isSuccess:true,mBannerList:[movie(sid,'首页红果短剧')],homeSections:[{tab_type:'human',tab_name:'热播短剧',video_list:[movie(sid,'红果测试短剧')]}]}}));
  if(url.pathname.startsWith('/category/'))return response(categoryPage(url.pathname+url.search));
  if(url.pathname==='/detail')return response(page({'detail_page':{isSuccess:true,seriesDetail:{series_id:sid,series_name:'红果测试短剧',series_cover:'https://image.example/detail.jpg',series_intro:'简介',episode_cnt:12,accessible_episode_cnt:3,episode_right_text:'全12集',vid_list:vids,tags:['都市','爱情'],celebrities:[{nickname:'演员甲'}]},seriesSocialInfo:{rating:8.2}}}));
  if(url.pathname.startsWith('/player/')){
   const id=url.pathname.split('/').at(-1),available=id===vids[0];
   if(id===vids[2])return response('',404);
   return response(page({'player_(series_id)/page':{isSuccess:true,protectedPlayback:true,series_id:sid,vid:id,publicVideoSeo:available?{available:true,seriesId:sid,itemId:id,width:360,height:640,durationSeconds:90}:null}}));
  }
  if(url.pathname.startsWith('/video/public/'))return response('',200,{'Content-Type':'video/mp4'});
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

test('Hongguo search uses public home/category catalog and detail only returns publicly available preview episodes',async()=>{
 const {client}=createClient();const results=await client.search('红果测试');assert.ok(results.items.some(item=>item.title==='红果测试短剧'));assert.equal(results.next,'');
 const detail=await client.detail(sid);assert.equal(detail.title,'红果测试短剧');assert.equal(detail.actors[0],'演员甲');assert.equal(detail.playSources[0].total,3);
 const episodes=await client.episodes(sid,detail.playSources[0]);assert.deepEqual(episodes.map(item=>item.id),[vids[0]]);assert.equal(detail.playSources[0].total,1);assert.equal(episodes[0].open,true);assert.match(episodes[0].playUrls[0].url,/\/video\/public\/.+\/360p\.mp4$/);
 const playback=await client.play({vodId:sid,siteId:'hongguo-public',episodeId:vids[0]});assert.equal(playback.playUrls[0].url,episodes[0].playUrls[0].url);
 await assert.rejects(client.play({vodId:sid,siteId:'hongguo-public',episodeId:vids[1]}),/没有提供此集的公开试看资源/);
});
