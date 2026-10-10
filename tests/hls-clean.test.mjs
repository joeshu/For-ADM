import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const code=fs.readFileSync(path.join(root,'hls-video/ad-clean.js'),'utf8');
const url='https://c1.rrcdnbf1.com/video/movie.m3u8?token=abc';
function run(body,request={},response={}){let count=0,result;vm.runInNewContext(code,{$request:{url,...request},$response:{body,...response},$done:r=>{count++;result=r;},console:{log(){throw Error('Unexpected log');}}});assert.equal(count,1);return result.body===undefined?body:result.body;}
const head='#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:60\n#EXT-X-MEDIA-SEQUENCE:40\n#EXT-X-DISCONTINUITY-SEQUENCE:5\n#EXT-X-PLAYLIST-TYPE:VOD\n';
const segment=(uri,d=60)=>'#EXTINF:'+d+',\n'+uri+'\n';
const disc='#EXT-X-DISCONTINUITY\n';
const body=head+segment('seg8.ts')+disc+segment('/adjump/ad1.ts',6)+segment('https://ads.example/adjump/ad2.ts?token=ad',6)+disc+segment('seg9.ts')+segment('seg10.ts')+'#EXT-X-ENDLIST\n';
test('bounded explicit ad run removed; content, URI tokens and sequence headers preserved',()=>{
 const out=run(body);assert.equal(out,head+segment('seg8.ts')+disc+segment('seg9.ts')+segment('seg10.ts')+'#EXT-X-ENDLIST\n');assert.equal(run(out),out);
 const signed=body.replace('seg9.ts','https://cdn.example/content/seg9.ts?token=original');assert(run(signed).includes('https://cdn.example/content/seg9.ts?token=original'));
});
test('ordinary varying URI lengths, durations, domains and prefixes never infer ads',()=>{
 const normal=head+segment('seg8.ts')+disc+segment('https://secondary.example/film/seg9.ts',5)+disc+segment('other/seg10.ts')+'#EXT-X-ENDLIST\n';assert.equal(run(normal),normal);
 const mixed=body.replace('/adjump/ad1.ts','content.ts');assert.equal(run(mixed),mixed);
 for(const replacement of ['badjump/ad.ts','/adjump-old/ad.ts','/content.ts?redirect=/adjump/ad.ts']){const b=head+segment('a.ts')+disc+segment(replacement,6)+disc+segment('b.ts')+'#EXT-X-ENDLIST\n';assert.equal(run(b),b);}
});
test('encrypted, byte-range, fMP4, live, low-latency, master and unknown tags pass through',()=>{
 for(const tag of ['#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x1','#EXT-X-KEY:METHOD=AES-128,URI="key"','#EXT-X-MAP:URI="init.mp4"','#EXT-X-BYTERANGE:100@0','#EXT-X-PROGRAM-DATE-TIME:2026-10-10T00:00:00Z','#EXT-X-PART:DURATION=1,URI="part.ts"','#EXT-X-DATERANGE:ID="ad"','#EXT-X-UNKNOWN:1']){const b=body.replace(disc,tag+'\n'+disc);assert.equal(run(b),b);}
 for(const b of [body.replace('#EXT-X-ENDLIST\n',''),body.replace(':VOD',':EVENT'),body.replace('seg8.ts','seg8.m4s'),'#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100000\nvariant.m3u8\n'])assert.equal(run(b),b);
});
test('unbounded, excessive or adjacent ad runs and malformed playlists pass through',()=>{
 const cases=[head+disc+segment('/adjump/ad.ts',6)+disc+segment('normal.ts')+'#EXT-X-ENDLIST\n',head+segment('normal.ts')+disc+segment('/adjump/ad.ts',6)+'#EXT-X-ENDLIST\n',body.replace(',\n/adjump/ad1.ts',',\n/adjump/ad1.ts').replace('6,','600,'),body.replace('#EXT-X-TARGETDURATION:60','#EXT-X-TARGETDURATION:0'),body.replace('#EXTINF:6,','#EXTINF:0,'),body.replace('#EXT-X-ENDLIST\n','#EXT-X-ENDLIST\nextra.ts\n'),body.replace('#EXTINF:6,','#EXTINF:6,\n#EXTINF:6,'),body.replace('/adjump/ad1.ts','/adjump/ad1.m3u8'),body.replace(disc,disc+disc)];
 for(const b of cases)assert.equal(run(b),b);
 const excessive=head+segment('a.ts',6)+disc+segment('/adjump/ad.ts',6)+disc+segment('b.ts',6)+'#EXT-X-ENDLIST\n';assert.equal(run(excessive),excessive);
 const adjacent=head+segment('a.ts')+disc+segment('/adjump/a.ts',6)+disc+segment('/adjump/b.ts',6)+disc+segment('b.ts')+'#EXT-X-ENDLIST\n';assert.equal(run(adjacent),adjacent);
});
test('unknown hosts, wrong endpoints, failed responses and non-GET are unchanged',()=>{
 for(const candidate of ['https://c1.rrcdnbf1.com.evil.com/video/movie.m3u8','https://unrelated.com/video/movie.m3u8','https://s1.bfengbf.com/video/movie.m3u8','https://c1.rrcdnbf1.com/api/movie.m3u8','https://c1.rrcdnbf1.com/video/movie.ts'])assert.equal(run(body,{url:candidate}),body);
 for(const method of ['OPTIONS','HEAD','POST'])assert.equal(run(body,{method}),body);
 assert.equal(run(body,{}, {statusCode:403}),body);
 for(const b of [undefined,'','not HLS','#EXTM3U\n',body+'x'.repeat(2*1024*1024)])assert.equal(run(b),b);
});
test('CRLF and trailing newline preserved; generated script and rules stay synchronized',()=>{
 const crlf=body.replaceAll('\n','\r\n'),out=run(crlf);assert(out.includes('\r\n'));assert(!out.replaceAll('\r\n','').includes('\n'));assert(out.endsWith('\r\n'));assert.equal(run(out),out);
 execFileSync(process.execPath,['scripts/build-hls-clean.mjs','--check'],{cwd:root});
 const conf=fs.readFileSync(path.join(root,'hls-video/quantumult-x-snippet.conf'),'utf8');const rule=conf.split('\n').find(l=>l.startsWith('^')).split(' url ')[0];assert(new RegExp(rule).test(url));assert(!new RegExp(rule).test('https://c1.rrcdnbf1.com.evil.com/video/movie.m3u8'));assert(conf.includes('c*.rrcdnbf*.com'));
});
