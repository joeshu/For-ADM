import test from 'node:test';
import assert from 'node:assert/strict';
import {parseM3U,parseXMLTV,channelAlternates} from '../Web/live.mjs';

test('parses M3U metadata, groups, relative URLs and keeps insecure entries disabled',()=>{
 const source='#EXTM3U x-tvg-url="https://guide.example/guide.xml"\n'+
  '#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="中央电视台一套" tvg-logo="/logos/cctv.png" group-title="央视频",CCTV1综合\n'+
  'relay/cctv1.m3u8\n'+
  '#EXTINF:-1 group-title="测试, 分组",Quoted, Channel\nhttp://media.example/live.m3u8\n';
 const parsed=parseM3U(source,'https://list.example/lists/main.m3u');
 assert.equal(parsed.epgUrl,'https://guide.example/guide.xml');
 assert.deepEqual(parsed.groups,['央视频','测试, 分组']);
 assert.equal(parsed.channels[0].name,'中央电视台一套');
 assert.equal(parsed.channels[0].logo,'https://list.example/logos/cctv.png');
 assert.equal(parsed.channels[0].url,'https://list.example/lists/relay/cctv1.m3u8');
 assert.equal(parsed.channels[0].secure,true);
 assert.equal(parsed.channels[1].name,'Quoted, Channel');
 assert.equal(parsed.channels[1].secure,false);
});

test('matches secure alternate relays by TVG identity',()=>{
 const channels=parseM3U('#EXTM3U\n'+
  '#EXTINF:-1 tvg-id="one" group-title="A",One\nhttps://a.example/one.m3u8\n'+
  '#EXTINF:-1 tvg-id="one" group-title="B",One backup\nhttps://b.example/one.m3u8\n'+
  '#EXTINF:-1 tvg-id="one" group-title="C",One insecure\nhttp://c.example/one.m3u8\n',
  'https://list.example/list.m3u').channels;
 assert.deepEqual(channelAlternates(channels,channels[0]).map(channel=>channel.index),[0,1]);
});

test('parses XMLTV offsets, entities and current channel programs',()=>{
 const xml='<tv><programme start="20261024090000 +0800" stop="20261024100000 +0800" channel="CCTV1综合"><title>新闻 &amp; 焦点</title></programme>'+
  '<programme start="20261024090000 +0800" stop="20261024100000 +0800" channel="other"><title>不匹配</title></programme></tv>';
 const rows=parseXMLTV(xml,'CCTV1综合');
 assert.equal(rows.length,1);
 assert.equal(rows[0].title,'新闻 & 焦点');
 assert.equal(new Date(rows[0].start).toISOString(),'2026-10-24T01:00:00.000Z');
});

test('rejects malformed playlists and non-HTTPS EPG endpoints',()=>{
 assert.throws(()=>parseM3U('not a playlist','https://list.example/a.m3u'),/有效的 M3U/);
 const parsed=parseM3U('#EXTM3U x-tvg-url="http://guide.example/guide.xml"\n#EXTINF:-1,One\nhttps://media.example/live.m3u8','https://list.example/list.m3u');
 assert.equal(parsed.epgUrl,'');
});
