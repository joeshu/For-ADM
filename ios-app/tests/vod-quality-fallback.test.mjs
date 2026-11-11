import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {resolvePlayableEpisode,verifyMedia} from '../Web/playback.mjs';
const body=s=>({status:200,bodyBase64:Buffer.from(s).toString('base64')});
const hls=body('#EXTM3U\n#EXTINF:5,\nsegment.ts\n');
const master=body('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n480p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080\n1080p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720\n720p.m3u8\n');
const site={id:'test',origin:'https://origin.example',appId:'public',version:'1',signKey:'test',responseKeys:[]};
const episode=(id,title,url)=>({id,title,open:true,playUrls:[{url}]});

test('resolvePlayableEpisode keeps the master variants on the checked entry, highest first',async()=>{
 const d={id:9,playSources:[{siteId:1,list:[episode(1,'第1集','https://cdn.example/master.m3u8')]}]};
 const c={site,play:async()=>[{url:'https://cdn.example/master.m3u8'}],transport:async r=>r.url.includes('master.m3u8')?master:hls};
 const result=await resolvePlayableEpisode(c,d,0,0);
 const entry=result.urls[0];
 assert.deepEqual(entry.variants.map(v=>v.label),['1080p FHD','720p HD','480p']);
 assert.equal(entry.variantIndex,0);
 assert.equal(result.qualityLabel,'1080p FHD');
 assert.equal(result.bandwidth,2500000);
});

test('a single-variant playlist carries no variants, so there is nothing to downgrade to',async()=>{
 const meta=await verifyMedia({site,transport:async()=>hls},'https://cdn.example/v.m3u8');
 assert.deepEqual(meta.variants,[]);
 assert.equal(meta.qualityLabel,'');
});

// The downgrade itself lives in app.mjs (recoverPlayback), which needs a DOM
// to run, so these are source-contract tests in the same style as the VOD
// stall-grace tests: the behavior is pinned to the code that implements it.
const root=fileURLToPath(new URL('../',import.meta.url));
const app=fs.readFileSync(path.join(root,'Web/app.mjs'),'utf8');
const fn=(signature,endMarker)=>{
 const start=app.indexOf(signature);assert.ok(start>=0,`app.mjs must contain ${signature}`);
 const end=app.indexOf(endMarker,start+1);
 return app.slice(start,end<0?undefined:end);
};

test('recoverPlayback downgrades to a lower variant of the same line before switching addresses or lines',()=>{
 const recover=fn("async function recoverPlayback(session,message=''){","native.onPlaybackEvent=event=>{");
 const downgrade=recover.indexOf('Same-line quality downgrade');
 assert.ok(downgrade>=0,'recoverPlayback must contain the same-line quality downgrade');
 const candidateLoop=recover.indexOf('for(let index=0;index<Math.min(state.playURLs.length,4);index++){');
 assert.ok(candidateLoop>0,'recoverPlayback must still try other addresses after the downgrade');
 assert.ok(downgrade<candidateLoop,'the downgrade must run before trying other addresses');
 assert.ok(recover.includes('entry?.variants?.length>1'),'the downgrade must need more than one variant');
 assert.ok(recover.includes('entry.variantIndex=next'),'the downgrade must advance to the next lower variant');
 assert.ok(recover.includes('当前清晰度缓冲跟不上'),'the downgrade must tell the user the quality dropped');
 assert.ok(recover.includes("state.playQualityLabel=target.label"),'the downgrade must update the displayed quality label');
});

test('launchNativePlayer and the web video element play the selected variant, not the master',()=>{
 const launch=fn('async function launchNativePlayer(){','const authorizationFailure=');
 assert.ok(launch.includes('effectivePlayURL(entry)'),'launchNativePlayer must play the effective (possibly downgraded) URL');
 assert.ok(app.includes('const activeURL=effectivePlayURL(state.playURLs[state.playIndex])'),'the rendered video element must use the effective URL too');
 assert.ok(app.includes('function effectivePlayURL(entry)'),'app.mjs must define the effective URL helper');
 assert.ok(app.includes('entry?.variants?.[entry.variantIndex]?.href'),'the helper must pick the selected variant href');
});
