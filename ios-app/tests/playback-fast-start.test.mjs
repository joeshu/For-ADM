import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {resolveFirstCandidate,resolvePlayableEpisode} from '../Web/playback.mjs';

// Startup fast-start (P1 A1): playing used to wait for two serial
// playlist fetches (master, then highest variant) before the native
// player even started — up to 16s of black screen on a slow line.
// Now the first basically-valid address plays immediately and the
// verification runs in the background, in parallel across candidates.
// A verified entry is stamped verifiedMeta so recovery can reuse it
// without verifying again.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs'),playback=read('Web/playback.mjs');
const body=s=>({status:200,bodyBase64:Buffer.from(s).toString('base64')});
const hls=body('#EXTM3U\n#EXTINF:5,\nsegment.ts\n');
const episode=(id,title,url,open=true)=>({id,title,open,playUrls:[{url}]});
const site={id:'test',origin:'https://origin.example',appId:'public',version:'1',signKey:'test',responseKeys:[]};

test('resolveFirstCandidate returns the first address without verifying it',async()=>{
 let transports=0;
 const d={id:9,playSources:[{siteId:1,name:'线路1',list:[episode(1,'第1集','https://cdn.example/a.m3u8')]}]};
 const c={site,transport:async()=>{transports++;return hls;}};
 const r=await resolveFirstCandidate(c,d,0,0);
 assert.equal(r.urls[0].url,'https://cdn.example/a.m3u8');
 assert.equal(transports,0,'the fast path must not fetch any playlist');
});

test('resolveFirstCandidate walks lines in the same order as the full resolver',async()=>{
 const first=episode(1,'第1集','https://cdn.example/empty.m3u8',false),second=episode(2,'第1集','https://cdn.example/good.m3u8',false);first.timelineId=second.timelineId='episode:1';
 const d={id:9,playSources:[{siteId:1,name:'空线路',list:[first]},{siteId:2,name:'好线路',list:[second]}]};
 const c={site,play:async p=>p.siteId===1?[]:[{url:'https://cdn.example/good.m3u8'}],transport:async()=>hls};
 const r=await resolveFirstCandidate(c,d,0,0);
 assert.equal(r.lineIndex,1);
 assert.equal(r.switched,true);
 assert.equal(r.episode.id,2);
});

test('candidate verification runs in parallel and stamps verifiedMeta',async()=>{
 const d={id:9,playSources:[{siteId:1,list:[episode(1,'第1集','https://cdn.example/a.m3u8',false)]}]};
 const seen=[];
 const c={site,play:async()=>[{url:'https://cdn.example/a.m3u8'},{url:'https://cdn.example/b.m3u8'},{url:'https://cdn.example/c.m3u8'}],transport:async r=>{seen.push(r.url);return hls;}};
 const r=await resolvePlayableEpisode(c,d,0,0);
 assert.equal(r.urls.length,3,'all three verified candidates stay available');
 assert.ok(r.urls.every(u=>u.verifiedMeta),'every verified candidate must carry verifiedMeta');
 assert.equal(r.urls[0].verifiedMeta.qualityLabel,'','a plain media playlist has no quality label');
 assert.ok(r.urls[0].verifiedMeta.warmPlaylists.length>0,'verified entries must carry their warmed playlists');
 assert.equal(seen.length,3,'all three candidates must be verified in one parallel round');
});

test('playEpisode plays the fast candidate first and verifies in the background',()=>{
 const start=app.indexOf('async function playEpisode('),end=app.indexOf('\nfunction wireVideo()',start);
 assert.ok(start>=0&&end>start,'playEpisode must exist as a bounded function');
 const playEpisode=app.slice(start,end);
 assert.ok(playEpisode.includes('resolveFirstCandidate(c,d,selected,index,signal'),'playEpisode must take the fast path first');
 const fastAt=playEpisode.indexOf('resolveFirstCandidate(c,d,selected,index,signal');
 const launchAt=playEpisode.indexOf('await launchNativePlayer({forceNewSession:!automatic})',fastAt);
 const verifyAt=playEpisode.indexOf('void verifyInBackground(c,d,selected,index,signal,epoch)');
 assert.ok(fastAt>0&&launchAt>fastAt,'the native player must start after the fast candidate, not after verification');
 assert.ok(verifyAt>launchAt,'background verification must start only after playback has started');
 assert.ok(playEpisode.includes('if(usePrefetch){'),'a prefetched (already verified) result must still skip the background round');
 assert.ok(app.includes('async function verifyInBackground('),'verifyInBackground must exist');
});

test('background verification merges results and recovers early when the playing address is dead',()=>{
 assert.ok(app.includes("const verifiedByUrl=new Map(result.urls.filter(u=>u.verifiedMeta).map(u=>[u.url,u.verifiedMeta]))"),'verified results must be merged into the playing entries by URL');
 assert.ok(app.includes("if(playing&&verifiedByUrl.has(playing.url)){render();return;}"),'a playing address that verifies must just refresh the display');
 assert.ok(app.includes("if(playing&&state.playLoading&&state.diagEngine!=='Cicada'&&recovery&&!recovery.running){"),'a dead playing address must only trigger early recovery while the first frame is still missing, no Cicada fallback is active and no recovery is already running');
 assert.ok(app.includes("await playEpisode(result.episodeIndex,{automatic:true})"),'a verified switch to another line must replay from there');
 assert.ok(app.includes("void recoverPlayback(session,'当前地址验证失败，正在尝试备用地址')"),'a dead playing address with no verified switch must enter recovery at once');
});

test('recovery reuses an already-verified candidate instead of verifying it again',()=>{
 assert.ok(app.includes('candidate.verifiedMeta?Promise.resolve('),'recovery must prefer the verified metadata');
 assert.ok(!app.includes('candidate.cicadaURL='),'the recovery path must not replace the active media URL with a different HLS timeline');
});
