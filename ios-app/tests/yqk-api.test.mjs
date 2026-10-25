import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {YqkClient} from '../Web/yqk-api.mjs';
import {ServiceError} from '../Web/site-api.mjs';
import {resolvePlayableEpisode} from '../Web/playback.mjs';
globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const source=(id='yqk')=>({id,provider:'yqk',origin:'https://'+id+'.example',protocol:{appId:'public-'+id,appKey:'public-key-'+id,version:'1.2',apiOrigins:['https://api.example','https://backup.example']}});
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),map};};
const encoded=(data,status=200)=>({status,bodyBase64:Buffer.from(typeof data==='string'?data:JSON.stringify({result:true,data})).toString('base64')});
const film=id=>({vodId:id,vodName:'电影'+id,coverImg:'https://images.example/'+id+'.jpg',flags:'2026 / 科幻片 / 中国',score:'8.0',iconList:[],remark:'高清'});
const detail={vodId:7,vodName:'测试影片',coverImg:'https://images.example/7.jpg',year:2026,areaName:'中国',intro:'简介',tagList:['科幻'],actorList:[{vodWorkerName:'演员'}],playerList:[{vodPlayerKind:4,playerName:'线路A',totalEpCount:2,epList:[{epId:81,epName:'第1集'},{epId:82,epName:'第2集'}]},{vodPlayerKind:5,playerName:'线路B',totalEpCount:1,epList:[{epId:91,epName:'第1集'}]}]};
function harness(custom={},site=source()){
 const calls=[],store=storage();
 const transport=async r=>{const u=new URL(r.url);calls.push(r);if(u.pathname==='/js/baseUrlList.js')return encoded('var baseApiList=["https://api.example","https://backup.example"];');if(u.pathname==='/public.m3u8')return encoded('#EXTM3U\n#EXTINF:5,\nseg.ts\n');
  const p=JSON.parse(r.body);const handler=custom[u.pathname];if(handler)return handler(p,r);
  if(u.pathname==='/v2/api/home/header')return encoded({channeList:[{channelId:2,channelName:'电影'},{channelId:5,channelName:'体育'}]});
  if(u.pathname==='/v2/api/vodInfo/index')return encoded(detail);
  throw Error('Unexpected path '+u.pathname);
 };
 return {client:new YqkClient(site,transport,store),calls,store};
}
test('YQK and QNTV sign their own public parameters, isolate storage, and renew request IDs',()=>{
 const store=storage(),a=new YqkClient(source('yqk'),()=>{},store),b=new YqkClient(source('qntv'),()=>{},store);
 const req=a.buildRequest('https://api.example','/test',{keyword:'中文 & x',empty:''}),body=JSON.parse(req.body),copy={...body};delete copy.sign;
 const input=Object.keys(copy).sort().filter(k=>copy[k]!=='').map(k=>k+'='+copy[k]+'&').join('')+'appKey='+a.protocol.appKey;
 assert.equal(body.sign,createHash('md5').update(input).digest('hex'));assert.equal(body.reqDomain,'yqk.example');
 assert.equal(JSON.parse(b.buildRequest('https://api.example','/test').body).appId,'public-qntv');
 assert.notEqual(body.requestId,JSON.parse(a.buildRequest('https://api.example','/test').body).requestId);
 assert.notEqual(a.device.id,b.device.id);assert.ok(store.map.has('sanyuan:yqk:device'));assert.ok(store.map.has('sanyuan:qntv:device'));
});
test('Bootstrap uses configured API origins directly and keeps sports category 5 non-adult',async()=>{
 const {client,calls}=harness();const cfg=await client.bootstrap();assert.equal(cfg.supportsAccount,false);assert.deepEqual(cfg.adultChannelIds,[]);
 assert.deepEqual(cfg.vodTabs.map(x=>[x.channelId,x.isAdult]),[[2,false],[5,false]]);
 assert.ok(calls.some(call=>new URL(call.url).pathname==='/v2/api/home/header'));assert.equal(calls.some(call=>new URL(call.url).pathname==='/js/baseUrlList.js'),false);assert.equal(client.user,null);
});
test('Cached YQK API origin is reused immediately and home content starts alongside bootstrap',async()=>{
 const calls=[],store=storage();store.setItem('sanyuan:yqk:apiOrigins',JSON.stringify(['https://api.example']));
 let releaseHeader;const headerGate=new Promise(resolve=>releaseHeader=resolve);
 const transport=async request=>{const path=new URL(request.url).pathname;calls.push(path);if(path==='/v2/api/home/header'){await headerGate;return encoded({channeList:[{channelId:2,channelName:'电影'}]});}if(path==='/v2/api/home/body')return encoded({vodTopicList:[]});throw Error('Unexpected '+path);};
 const client=new YqkClient(source(),transport,store),pending=client.home();await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(calls.includes('/v2/api/home/header'));assert.ok(calls.includes('/v2/api/home/body'));assert.equal(calls.includes('/js/baseUrlList.js'),false);
 releaseHeader();await pending;
});
test('Category uses source parent/child IDs and opaque cursor; search carries its own cursor',async()=>{
 const {client,calls}=harness({
  '/v2/api/channel/childListView':()=>encoded({childChannelList:[{channelId:9,channelName:'科幻片'}]}),
  '/v2/api/channel/getVodList':p=>encoded({items:[film(p.nextVal?2:1)],hasNext:!p.nextVal,nextVal:p.nextVal?'':'opaque&next=2'}),
  '/v1/api/search/search':p=>encoded({items:[film(9)],hasNext:true,nextVal:'search-cursor'}),
 });
 const one=await client.channel(2,{childChannelId:'9'}),two=await client.channel(2,{childChannelId:'9'},one.next);assert.equal(one.next,'opaque&next=2');assert.equal(two.next,'');assert.notEqual(one.items[0].url,two.items[0].url);
 const posts=[...new Map(calls.filter(x=>new URL(x.url).pathname==='/v2/api/channel/getVodList').map(x=>{const body=JSON.parse(x.body);return [body.nextVal||'',body];})).values()].sort((a,b)=>Number(a.nextVal!=='')-Number(b.nextVal!==''));
 assert.equal(posts[0].parentChannelId,2);assert.equal(posts[0].childChannelId,'9');assert.equal(posts[0].nextVal,'');assert.equal(posts[1].nextVal,'opaque&next=2');
 assert.equal(client.config.channelListQuery[0].items[0].data[1].id,'9');
 const search=await client.search('测试','specific-search-cursor');assert.equal(search.next,'search-cursor');assert.equal(JSON.parse(calls.at(-1).body).nextVal,'specific-search-cursor');
});
test('Home emits only film/topic rows, and topic more uses verified pageIndex contract',async()=>{
 const {client,calls}=harness({
  '/v2/api/home/body':()=>encoded({adList:[{title:'广告'}],vodTopicList:[{vodTopicId:77,topicName:'专题',coverImg:'https://images.example/topic.jpg',vodList:[film(7)]}]}),
  '/v1/api/vodTopic/getVodList':p=>encoded({items:[film(p.pageIndex)],totalPages:3,pageIndex:p.pageIndex}),
 });
 const h=await client.home();assert.equal(h.blocks.length,1);assert.equal(h.blocks[0].header.url,'specialTopic/vods?specialTopicId=77');assert.equal(h.blocks[0].data[0].imageURL,'https://images.example/7.jpg');
 const a=await client.collection({kind:'topic',id:'77'}),b=await client.collection({kind:'topic',id:'77'},a.next);assert.equal(a.next,'page=2');assert.equal(b.next,'page=3');
 const p=JSON.parse(calls.filter(x=>new URL(x.url).pathname==='/v1/api/vodTopic/getVodList').at(-1).body);assert.equal(p.pageIndex,2);assert.equal(p.pageSize,18);assert.equal(p.vodTopicId,77);assert.equal(p.nextVal,undefined);
});
test('Episode resolution/play requests use correct distinct fields and the selected line',async()=>{
 const {client,calls}=harness({
  '/v2/api/vodInfo/epDetail':p=>encoded([{vodResolution:720,canPlay:false,defaultSelect:true},{vodResolution:480,showName:'标清',canPlay:true}]),
  '/v2/api/vodInfo/playUrl':()=>encoded({playUrl:'https://media.example/a.m3u8'}),
 });
 const d=await client.detail(7);const eps=await client.episodes(7,d.playSources[1]);assert.deepEqual(eps.map(e=>e.id),[91]);
 const play=await client.play({vodId:7,siteId:d.playSources[1].siteId,episodeId:91});assert.equal(play.playUrls[0].headers.Referer,'https://yqk.example/');
 const params=calls.filter(x=>['/v2/api/vodInfo/epDetail','/v2/api/vodInfo/playUrl'].includes(new URL(x.url).pathname)).map(x=>({path:new URL(x.url).pathname,body:JSON.parse(x.body)}));assert.equal(params.find(x=>x.path.endsWith('/epDetail')).body.vodEpId,91);assert.equal(params.find(x=>x.path.endsWith('/epDetail')).body.epId,undefined);assert.equal(params.find(x=>x.path.endsWith('/playUrl')).body.epId,91);assert.equal(params.find(x=>x.path.endsWith('/playUrl')).body.vodResolution,480);
 await assert.rejects(client.play({vodId:7,siteId:d.playSources[0].siteId,episodeId:91}),/未找到对应选集/);
});
test('Unplayable resolutions never request restricted URLs; explicit server denials are fatal',async()=>{
 const {client,calls}=harness({'/v2/api/vodInfo/epDetail':()=>encoded([{vodResolution:1080,canPlay:false}])});
 const d=await client.detail(7);await assert.rejects(client.play({vodId:7,siteId:d.playSources[0].siteId,episodeId:81}),e=>!(e instanceof ServiceError)&&/不提供可播放清晰度/.test(e.message));
 assert.equal(calls.filter(r=>r.url.includes('playUrl')).length,0);
 const deny=harness({'/v2/api/home/body':()=>({status:200,bodyBase64:Buffer.from(JSON.stringify({result:false,operateCode:10001,msg:'请登录'})).toString('base64')})});
 await assert.rejects(deny.client.home(),ServiceError);assert.ok(deny.calls.filter(r=>r.url.includes('/home/body')).length<=3);assert.equal(deny.client.user,null);
});
test('A metadata-only app line can be skipped for a guest-playable line of the same episode',async()=>{
 const {client,calls}=harness({
  '/v2/api/vodInfo/epDetail':p=>encoded([{vodResolution:480,showName:'标清',canPlay:p.vodEpId===91}]),
  '/v2/api/vodInfo/playUrl':()=>encoded({playUrl:'https://media.example/public.m3u8'}),
 });
 const d=await client.detail(7),result=await resolvePlayableEpisode(client,d,0,0);
 assert.equal(result.lineIndex,1);assert.equal(result.episode.id,91);
 const playCalls=calls.filter(r=>r.url.includes('/vodInfo/playUrl'));assert.ok(playCalls.length>=1&&playCalls.length<=3);assert.equal(JSON.parse(playCalls[0].body).epId,91);
});
test('Aborting a late network result prevents publication and does not try another API origin',async()=>{
 const controller=new AbortController(),{client,calls}=harness({'/v2/api/home/body':()=>{controller.abort();return encoded({vodTopicList:[]});}});
 await client.bootstrap();const before=calls.length;await assert.rejects(client.home(controller.signal),e=>e.name==='AbortError');assert.ok(calls.length>before&&calls.length<=before+3);
});
test('Only network/format failures try another API base',async()=>{
 let n=0;const {client,calls}=harness({'/v2/api/home/body':()=>{n++;if(n===1)return {status:502,bodyBase64:''};return encoded({vodTopicList:[]});}});
 await client.home();assert.ok(n>=2&&n<=3);assert.ok(['https://api.example','https://backup.example'].includes(client.preferred.cache));assert.ok(calls.some(call=>new URL(call.url).pathname==='/v2/api/home/body'));
});
