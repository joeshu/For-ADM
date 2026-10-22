import {test} from 'node:test';import assert from 'node:assert/strict';import {cleanPlaylist} from '../Web/hls-cleaner.mjs';
const manifest=(uris,extra='')=>'#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:42\n'+extra+uris.map(uri=>'#EXTINF:10,\n'+uri+'\n').join('')+'#EXT-X-ENDLIST\n';
const regular=Array.from({length:20},(_,i)=>'film/'+i+'.ts');
test('known ad segment and duration are removed, with a boundary before content',()=>{
 const result=cleanPlaylist(manifest(['ads/UoK3btd2/0.ts',...regular]));
 assert.equal(result.removed,1);assert.equal(result.seconds,10);assert.ok(!result.body.includes('UoK3btd2'));
 assert.match(result.body,/#EXT-X-DISCONTINUITY\n#EXTINF:10,\nfilm\/0.ts/);assert.ok(result.body.includes('#EXT-X-MEDIA-SEQUENCE:42'));
});
test('normal content, stream paths, numeric IDs, domains and query strings are never ad evidence',()=>{
 const body=manifest(['/stream/123.ts','https://erlgnf.com/1787319.ts','film/0.ts?x=UoK3btd2',...regular]);assert.equal(cleanPlaylist(body).body,body);
});
test('master, live, encrypted and byte-range playlists are untouched',()=>{
 for(const body of ['#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\nchild.m3u8',manifest(['ads/UoK3btd2/0.ts',...regular]).replace('#EXT-X-ENDLIST',''),manifest(['ads/UoK3btd2/0.ts',...regular],'#EXT-X-KEY:METHOD=AES-128,URI="key"\n'),manifest(['ads/UoK3btd2/0.ts',...regular],'#EXT-X-BYTERANGE:10@0\n')])assert.equal(cleanPlaylist(body).body,body);
});
test('METHOD=NONE, maps and original discontinuities survive cleaning',()=>{
 const body=manifest(['ads/UoK3btd2/0.ts',...regular],'#EXT-X-KEY:METHOD=NONE\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-DISCONTINUITY\n');
 const result=cleanPlaylist(body);assert.equal(result.removed,1);assert.ok(result.body.includes('#EXT-X-KEY:METHOD=NONE'));assert.ok(result.body.includes('#EXT-X-MAP:URI="init.mp4"'));
});
test('uncertain or excessive matches roll back, and the switch disables all changes',()=>{
 for(const body of [manifest(['ads/UoK3btd2/0.ts','film/1.ts']),manifest([...Array(15).fill('ads/UoK3btd2/0.ts'),...regular]),'#EXTM3U\n#EXTINF:10,\n#EXTINF:10,\nfoo.ts\n#EXT-X-ENDLIST'])assert.equal(cleanPlaylist(body).body,body);
 const body=manifest(['ads/UoK3btd2/0.ts',...regular]);assert.equal(cleanPlaylist(body,{enabled:false}).body,body);
});
