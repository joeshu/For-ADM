import test from 'node:test';import assert from 'node:assert/strict';import{createRequire}from'node:module';
import {resolvePlayableEpisode,matchingEpisode,verifyMedia}from'../Web/playback.mjs';import {SiteClient,ServiceError}from'../Web/site-api.mjs';
globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const body=s=>({status:200,bodyBase64:Buffer.from(s).toString('base64')}),json=x=>body(JSON.stringify(x));const hls=body('#EXTM3U\n#EXTINF:5,\nsegment.ts\n');
const episode=(id,title,url,open=true)=>({id,title,open,playUrls:[{url}]});
const site={id:'test',origin:'https://origin.example',appId:'public',version:'1',signKey:'test',responseKeys:[]};
const storage={getItem(){return null},setItem(){}};
test('A TLS failure switches to the same numbered episode and retains original request headers',async()=>{
 const first=episode(1,'第02集','https://broken.example/v.m3u8'),other=episode(2,'第2集','https://good.example/v.m3u8',false),d={id:9,playSources:[{siteId:1,name:'坏线路',list:[first]},{siteId:2,name:'好线路',list:[other]}]};let authorized=0;
 const c={site,play:async p=>{authorized++;assert.equal(p.episodeId,2);return[{url:'https://good.example/v.m3u8'}]},transport:async r=>{assert.equal(r.headers.Referer,site.origin+'/');if(r.url.includes('broken')){const e=Error('bad certificate');e.code=-1202;throw e;}return hls;}};
 const r=await resolvePlayableEpisode(c,d,0,0);assert.equal(r.lineIndex,1);assert.equal(r.episode.id,2);assert.equal(authorized,1);assert.equal(r.switched,true);
});
test('Unmatched episode titles are skipped instead of using an unrelated array index',async()=>{
 assert.equal(matchingEpisode({id:3,title:'第03集'},[{id:4,title:'第04集'}]),-1);
 assert.equal(matchingEpisode({id:3,title:'第03集'},[{id:4,title:'第3集'}]),0);
 assert.equal(matchingEpisode({id:3,title:'HD'},[{id:4,title:'正片'}],{singleMovie:true}),0);
 assert.equal(matchingEpisode({id:3,title:'HD'},[{id:4,title:'正片'}],{singleEpisodeSource:true}),0);
 assert.equal(matchingEpisode({id:3,title:'第3集'},[{id:4,title:'正片'}],{singleEpisodeSource:true}),-1);
 assert.equal(matchingEpisode({id:3,title:'预告'},[{id:4,title:'正片'}],{singleMovie:true,singleEpisodeSource:true}),-1);
 assert.equal(matchingEpisode({id:3,title:'HD'},[{id:4,title:'正片'},{id:5,title:'第2集'}],{singleEpisodeSource:true}),-1);
});
test('A real business denial is surfaced without trying a different source',async()=>{
 let checks=0;const d={id:9,playSources:[{siteId:1,list:[episode(1,'第1集','https://x.example/a.m3u8',false)]},{siteId:2,list:[episode(2,'第1集','https://y.example/a.m3u8')]}]};
 const c={site,play:async()=>{throw new ServiceError('此资源需会员',40301)},transport:async()=>{checks++;return hls;}};
 await assert.rejects(resolvePlayableEpisode(c,d,0,0),{code:40301});assert.equal(checks,0);
});
test('Expired cached URLs refresh through the service rather than changing their signatures',async()=>{
 let refresh=0;const d={id:9,playSources:[{siteId:1,list:[episode(1,'第1集','https://cdn.example/expired.m3u8')]}]};
 const c={site,play:async()=>{refresh++;return[{url:'https://cdn.example/fresh.m3u8'}]},transport:async r=>r.url.includes('expired')?{status:403}:hls};
 const r=await resolvePlayableEpisode(c,d,0,0);assert.equal(refresh,1);assert.equal(r.urls[0].url,'https://cdn.example/fresh.m3u8');
});
test('Master playlist validation checks a variant without downloading segments',async()=>{
 const requests=[];await verifyMedia({site,transport:async r=>{requests.push(r.url);return requests.length===1?body('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nvariant.m3u8\n'):hls;}},'https://cdn.example/master.m3u8');
 assert.deepEqual(requests,['https://cdn.example/master.m3u8','https://cdn.example/variant.m3u8']);
});
test('Website referrer policy and per-line headers reach master and variant requests unchanged',async()=>{
 const seen=[],headers={'User-Agent':'Source Mobile UA','X-Playback':'source-value'};
 await verifyMedia({site,transport:async r=>{seen.push(r);return seen.length===1?body('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nvariant.m3u8\n'):hls;}},'https://cdn.example/master.m3u8',undefined,headers,'no-referrer');
 assert.equal(seen.length,2);for(const r of seen)assert.deepEqual(r.headers,headers);
});
test('Resolver retains no-referrer on a website MP4 and skips broken same-episode lines',async()=>{
 const d={id:'nrLxl',channelId:1,playSources:[{siteId:'broken',list:[{id:1,title:'正片'}]},{siteId:'working',list:[{id:2,title:'HD'}]}]},seen=[];
 const c={site,play:async p=>[{url:'https://cdn.example/'+p.siteId,referrerPolicy:'no-referrer',headers:{'User-Agent':'Mobile'}}],transport:async r=>{seen.push(r);assert.equal(r.headers.Referer,undefined);return {status:r.url.endsWith('broken')?404:200};}};
 const result=await resolvePlayableEpisode(c,d,0,0);assert.equal(result.lineIndex,1);assert.equal(result.urls[0].referrerPolicy,'no-referrer');assert.equal(seen.length,2);
});
test('A manually chosen line beyond the automatic probe budget is fully usable',async()=>{
 const lines=Array.from({length:16},(_,i)=>({siteId:'line-'+i,name:'线路'+i,list:[{id:i+1,title:'第01集',open:false}]}));
 const requested=[];const c={site,play:async p=>{requested.push(p.siteId);return [{url:'https://media.example/selected.m3u8'}];},transport:async()=>hls};
 const result=await resolvePlayableEpisode(c,{id:'series',playSources:lines},12,0);
 assert.equal(result.lineIndex,12);assert.equal(result.episode.id,13);assert.deepEqual(requested,['line-12']);
});
test('Guest initialization is shared; keychain write failure does not block a valid session',async()=>{
 let guests=0,plays=0;globalThis.NativeTransport={vault:{get:async()=>null,put:async()=>{throw Error('keychain unavailable')}}};
 const c=new SiteClient(site,async r=>{if(new URL(r.url).pathname==='/user/anonymous'){guests++;return json({id:1,token:'test-only'})}plays++;return json([{url:'https://cdn.example/a.m3u8'}]);},storage);c.config={urls:{logic:['https://api.example']}};
 await Promise.all([c.play({}),c.play({})]);assert.equal(guests,1);assert.equal(plays,2);assert.ok(c.sessionWarning);delete globalThis.NativeTransport;
});
test('Only expired guests are renewed, and logged-in accounts are never replaced',async()=>{
 let guests=0,plays=0;const c=new SiteClient(site,async r=>{if(new URL(r.url).pathname==='/user/anonymous')return json({id:++guests,token:'test-only'});plays++;return plays===1?json({code:40401,message:'初始化失效'}):json([]);},storage);c.config={urls:{logic:['https://api.example']}};
 await c.play({});assert.equal(guests,2);assert.equal(plays,2);
 c.user={id:7,token:'account-token'};c.sessionKind='account';c.transport=async()=>json({code:40401,message:'请重新登录'});
 await assert.rejects(c.play({}),{code:40401});assert.equal(c.user.id,7);assert.equal(c.sessionKind,'account');
});
