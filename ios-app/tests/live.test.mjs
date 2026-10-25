import test from 'node:test';
import assert from 'node:assert/strict';
import {parseM3U,parseM3UIncremental,parseXMLTV,channelAlternates,indexChannelAlternates,nextUntriedRouteIndex} from '../Web/live.mjs';

test('parses M3U metadata, groups, relative URLs and labels insecure entries',()=>{
 const source='#EXTM3U x-tvg-url="https://guide.example/guide.xml"\n'+
  '#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="中央电视台一套" tvg-logo="/logos/cctv.png" group-title="央视频",CCTV1综合\n'+
  'relay/cctv1.m3u8\n'+
  '#EXTINF:-1 group-title="测试, 分组",Quoted, Channel\nhttp://media.example/live.m3u8\n';
 const parsed=parseM3U(source,'https://list.example/lists/main.m3u');
 assert.equal(parsed.epgUrl,'https://guide.example/guide.xml');
 assert.deepEqual(parsed.groups,['央视频','测试, 分组']);
 assert.equal(parsed.channels[0].name,'中央电视台一套');
 assert.equal(parsed.channels[0].tvgName,'中央电视台一套');
 assert.equal(parsed.channels[0].logo,'https://list.example/logos/cctv.png');
 assert.equal(parsed.channels[0].url,'https://list.example/lists/relay/cctv1.m3u8');
 assert.equal(parsed.channels[0].secure,true);
 assert.equal(parsed.channels[1].name,'Quoted, Channel');
 assert.equal(parsed.channels[1].secure,false);
});

test('matches HTTPS and HTTP alternate relays by TVG identity',()=>{
 const channels=parseM3U('#EXTM3U\n'+
  '#EXTINF:-1 tvg-id="one" group-title="A",One\nhttps://a.example/one.m3u8\n'+
  '#EXTINF:-1 tvg-id="one" group-title="B",One backup\nhttps://b.example/one.m3u8\n'+
  '#EXTINF:-1 tvg-id="one" group-title="C",One insecure\nhttp://c.example/one.m3u8\n',
  'https://list.example/list.m3u').channels;
 assert.deepEqual(channelAlternates(channels,channels[0]).map(channel=>channel.index),[0,1,2]);
});

test('automatic live failover checks earlier routes after a manual route fails',()=>{
 const routes=[{url:'https://one.example/live.m3u8'},{url:'https://two.example/live.m3u8'},{url:'https://three.example/live.m3u8'}];
 assert.equal(nextUntriedRouteIndex(routes,new Set([routes[2].url])),0);
 assert.equal(nextUntriedRouteIndex(routes,new Set([routes[0].url,routes[1].url])),2);
 assert.equal(nextUntriedRouteIndex(routes,new Set(routes.map(route=>route.url))),-1);
});

test('large M3U imports parse incrementally and preindex all alternate routes',async()=>{
 const rows=Array.from({length:800},(_,i)=>'#EXTINF:-1 tvg-id="station-'+(i%4)+'" group-title="Group '+(i%4)+'",Channel '+i+'\nhttps://cdn.example/'+i+'.m3u8').join('\n');
 const source='#EXTM3U x-tvg-url="https://guide.example/guide.xml"\n'+rows;
 let timerFired=false;const timer=new Promise(resolve=>setTimeout(()=>{timerFired=true;resolve();},0));
 const incremental=await parseM3UIncremental(source,'https://list.example/live.m3u',{batchLines:100});await timer;
 assert.equal(timerFired,true);assert.deepEqual(incremental,parseM3U(source,'https://list.example/live.m3u'));
 const index=indexChannelAlternates(incremental.channels),routes=channelAlternates(incremental.channels,incremental.channels[12],index);
 assert.equal(routes.length,200);assert.equal(routes[0].index,0);assert.ok(routes.some(channel=>channel.index===12));
});

test('incremental M3U parsing honors cancellation between batches',async()=>{
 const controller=new AbortController(),rows=Array.from({length:800},(_,i)=>'#EXTINF:-1,Channel '+i+'\nhttps://cdn.example/'+i+'.m3u8').join('\n');
 const parsing=parseM3UIncremental('#EXTM3U\n'+rows,'https://list.example/live.m3u',{signal:controller.signal,batchLines:100});
 setTimeout(()=>controller.abort(),0);
 await assert.rejects(parsing,{name:'AbortError'});
});

test('parses XMLTV offsets, entities and current channel programs',()=>{
 const xml='<tv><programme start="20261024090000 +0800" stop="20261024100000 +0800" channel="CCTV1综合"><title>新闻 &amp; 焦点</title><sub-title>早间新闻</sub-title><desc>今日资讯 &lt;摘要&gt;</desc><category>新闻</category></programme>'+
  '<programme start="20261024090000 +0800" stop="20261024100000 +0800" channel="other"><title>不匹配</title></programme></tv>';
 const rows=parseXMLTV(xml,'CCTV1综合');
 assert.equal(rows.length,1);
 assert.equal(rows[0].title,'新闻 & 焦点');
 assert.equal(rows[0].subtitle,'早间新闻');
 assert.equal(rows[0].description,'今日资讯 <摘要>');
 assert.deepEqual(rows[0].categories,['新闻']);
 assert.equal(new Date(rows[0].start).toISOString(),'2026-10-24T01:00:00.000Z');
});

test('rejects malformed playlists and accepts HTTP or HTTPS EPG endpoints',()=>{
 assert.throws(()=>parseM3U('not a playlist','https://list.example/a.m3u'),/有效的 M3U/);
 const parsed=parseM3U('#EXTM3U x-tvg-url="http://guide.example/guide.xml"\n#EXTINF:-1,One\nhttps://media.example/live.m3u8','https://list.example/list.m3u');
 assert.equal(parsed.epgUrl,'http://guide.example/guide.xml');
 const arbitrary=parseM3U('#EXTM3U\n#EXTINF:-1,One\nhttp://any-host.example:8080/tv/one.m3u8','http://another-host.example/list.m3u');
 assert.equal(arbitrary.channels[0].secure,false);assert.equal(arbitrary.channels[0].url,'http://any-host.example:8080/tv/one.m3u8');
 const imported=parseM3U('#EXTM3U x-tvg-url="guide.xml"\n#EXTINF:-1,One\nchannel.m3u8','http://118.190.200.12:8767/all.m3u');
 assert.equal(imported.epgUrl,'http://118.190.200.12:8767/guide.xml');assert.equal(imported.channels[0].url,'http://118.190.200.12:8767/channel.m3u8');
});
