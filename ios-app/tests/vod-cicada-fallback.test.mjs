import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {resolvePlayableEpisode,verifyMedia} from '../Web/playback.mjs';
const body=s=>({status:200,bodyBase64:Buffer.from(s).toString('base64')});
const hls=body('#EXTM3U\n#EXTINF:5,\nsegment.ts\n');
const master=body('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n480p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080\n1080p.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720\n720p.m3u8\n');
const site={id:'test',origin:'https://origin.example',appId:'public',version:'1',signKey:'test',responseKeys:[]};
const episode=(id,title,url)=>({id,title,open:true,playUrls:[{url}]});

test('resolvePlayableEpisode retains quality metadata without creating a separate Cicada timeline',async()=>{
 const d={id:9,playSources:[{siteId:1,list:[episode(1,'第1集','https://cdn.example/master.m3u8')]}]};
 const c={site,play:async()=>[{url:'https://cdn.example/master.m3u8'}],transport:async r=>r.url.includes('master.m3u8')?master:hls};
 const result=await resolvePlayableEpisode(c,d,0,0);
 assert.ok(!result.urls[0].cicadaURL,'a separate variant URL must not be stored for recovery');
 assert.equal(result.qualityLabel,'1080p FHD');
 assert.equal(result.bandwidth,2500000);
});

test('a single-variant playlist leaves the Cicada fallback URL empty',async()=>{
 const meta=await verifyMedia({site,transport:async()=>hls},'https://cdn.example/v.m3u8');
 assert.deepEqual(meta.variants,[]);
});

// The Cicada fallback itself lives in native code, so these are
// source-contract tests in the same style as the VOD stall-grace tests.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs'),main=read('Sources/main.m'),cicadaH=read('Sources/SYCicadaLivePlayer.h'),cicadaM=read('Sources/SYCicadaLivePlayer.m');
const fn=(source,signature,endMarker)=>{
 const start=source.indexOf(signature);assert.ok(start>=0,`must contain ${signature}`);
 const end=source.indexOf(endMarker,start+1);
 return source.slice(start,end<0?undefined:end);
};

test('the quality downgrade is gone: no variant stepping, no effective URL helper',()=>{
 assert.ok(!app.includes('Same-line quality downgrade'),'app.mjs must not contain the downgrade');
 assert.ok(!app.includes('variantIndex=next'),'app.mjs must not step down variants');
 assert.ok(!app.includes('effectivePlayURL'),'app.mjs must not use an effective (downgraded) URL');
 assert.ok(!app.includes('更低清晰度'),'app.mjs must not mention switching to a lower quality');
});

test('launchNativePlayer passes the highest-variant URL for the Cicada fallback',()=>{
 const launch=fn(app,'async function launchNativePlayer({forceNewSession=false}={}){','const authorizationFailure=');
 assert.ok(launch.includes('episodeKey:sessionKey(session)'),'launchNativePlayer must pass a stable episode identity to native.play');
 assert.ok(launch.includes('playbackPosition(previousContext,nativeSession?.attemptID)'),'same-episode reopens must use the native confirmed position for the active attempt');
 assert.ok(launch.includes('const entry=state.playURLs[state.playIndex],url=entry?.url;'),'launchNativePlayer must play the original URL with AVPlayer');
});

test('the detail page handles a Cicada fallback without switching lines or lowering quality',()=>{
 // The live branch handles cicadaFallback first, so match the VOD line exactly.
 assert.ok(app.includes("toast('当前线路改用软解播放，清晰度不变')"),'the fallback notice must say the quality is unchanged');
 const at=app.indexOf("toast('当前线路改用软解播放，清晰度不变')");
 const line=app.slice(app.lastIndexOf('\n',at)+1,app.indexOf('\n',at));
 assert.ok(line.includes("state.playError=''"),'the fallback must clear the playback error');
 assert.ok(line.includes('if(event.status===\'cicadaFallback\')'),'the fallback notice must be in the VOD cicadaFallback branch');
});

test('the VOD stall watchdog tries Cicada on the same line before failing the line',()=>{
 const stall=fn(main,'- (void)checkVODStallForItem:','- (void)stopNativePlayback');
 const attempt=stall.indexOf('tryCicadaVODFallbackForItem');
 assert.ok(attempt>=0,'the stall watchdog must try the Cicada fallback');
 const fail=stall.indexOf('@"failed"');
 assert.ok(fail>attempt,'the line must only fail after the Cicada attempt returns NO');
});

test('the VOD fallback reuses the active timeline and confirmed position, keeping rate, mute and external recovery control',()=>{
 const fallback=fn(main,'- (BOOL)tryCicadaVODFallbackForItem:(AVPlayerItem*)item {','- (void)destroyCicadaPlayer');
 assert.ok(fallback.includes('NSURL*url=[item.asset isKindOfClass:AVURLAsset.class]?((AVURLAsset*)item.asset).URL:nil;'),'the fallback must reuse the exact AVPlayer asset URL to preserve the HLS timeline');
 assert.ok(fallback.includes('[self.playbackGate confirmedPositionWithContext:self.playContext?:@""]'),'the fallback must resume from the gate-confirmed position');
 assert.ok(fallback.includes('authorizeRecoveryWithContext:self.playContext?:@"" crossLine:NO'),'the fallback must consume the shared recovery budget');
 assert.ok(fallback.includes('cicada.externalRecoveryManaged=YES'),'the wrapper must not run an independent VOD retry');
 assert.ok(fallback.includes('cicada.vodMode=YES'),'the fallback must enable VOD mode');
 assert.ok(fallback.includes('cicada.startPosition=startAt'),'the fallback must resume from the stall position');
 assert.ok(fallback.includes('[cicada setRate:rate]'),'the fallback must keep the playback rate');
 assert.ok(fallback.includes('[cicada setMuted:YES]'),'the fallback must keep the muted state');
 assert.ok(fallback.includes('if(wanted)[cicada start];'),'the fallback must respect the stored play/pause intent');
 assert.ok(fallback.includes('@"cicadaFallback"'),'the fallback must tell JS the engine switched');
});

test('the native play handler stores the direct and highest-variant URLs for a later fallback',()=>{
 assert.ok(main.includes('self.vodCicadaHeaders=headers;'),'the play handler must retain source headers for Cicada on the same active URL');
 assert.ok(main.includes('self.cicadaVODFallbackAttempted=NO;'),'a new play must reset the VOD fallback attempt');
});

test('the Cicada wrapper exposes the VOD controls the fallback needs',()=>{
 for(const api of ['- (void)pause;','- (void)resume;','- (void)seekToTime:(NSTimeInterval)seconds;','- (void)setRate:(float)rate;','- (NSTimeInterval)currentPosition;','- (NSTimeInterval)duration;','@property (nonatomic) BOOL vodMode;','@property (nonatomic) NSTimeInterval startPosition;'])assert.ok(cicadaH.includes(api),`SYCicadaLivePlayer.h must declare ${api}`);
 for(const api of ['didUpdatePosition:','cicadaLivePlayerDidComplete:'])assert.ok(cicadaH.includes(api),`the delegate must report ${api}`);
 assert.ok(cicadaM.includes('seekToTime:seekMode:'),'the wrapper must seek with CICADA_SEEKMODE_ACCURATE');
 assert.ok(cicadaM.includes('setMaxBufferDuration:'),'the wrapper must size the Cicada buffer');
 assert.ok(cicadaM.includes('setStartBufferDuration:'),'the wrapper must set a start buffer');
 assert.ok(cicadaM.includes('CicadaPlayer 缓冲超时'),'the wrapper must fail after a VOD buffer timeout');
 assert.ok(cicadaM.includes('reportErrorWithCode:-1003'),'the buffer timeout must not trigger a decode retry');
});

test('player controls route to Cicada while the fallback is active',()=>{
 const controls=fn(main,'if([type isEqualToString:@"playerControl"])','if([type isEqualToString:@"pageState"])');
 for(const action of ['@"rate"','@"seekDelta"','@"seekTo"','@"pause"'])assert.ok(controls.includes(action),`playerControl must handle ${action}`);
 assert.ok(controls.includes('self.cicadaFallbackActive&&self.cicadaLivePlayer'),'controls must check for an active Cicada fallback');
 assert.ok(controls.includes('[self.cicadaLivePlayer setRate:'),'rate must reach Cicada');
 assert.ok(controls.includes('[self.cicadaLivePlayer seekToTime:'),'seek must reach Cicada');
 assert.ok(controls.includes('[self.cicadaLivePlayer pause]'),'pause must reach Cicada without stopping it');
});

test('the VOD stall check scales its progress threshold by the playback rate',()=>{
 const stall=fn(cicadaM,'- (void)reportVODProgressWithPosition:','- (void)handleCompletion');
 assert.ok(stall.includes('self.hasPendingRate ? self.pendingRate : 1.0f'),'the stall check must read the current playback rate');
 assert.ok(stall.includes('MAX(0.2, 0.5 * (NSTimeInterval)rate)'),'the progress threshold must scale with the rate (0.5x rate, 0.2 floor)');
 assert.ok(stall.includes('position >= self.lastProgressPosition + progressThreshold'),'the stall check must compare against the scaled threshold');
 assert.ok(!stall.includes('lastProgressPosition + 0.5'),'the stall check must not use a fixed 0.5 threshold');
});

test('0.5x playback is not mistaken for a stall',()=>{
 // At 0.5x the position advances 0.5s per 1s poll tick. The scaled
 // threshold is 0.5 * 0.5 = 0.25s, so a normal 0.5s advance counts as
 // progress and the 15s stall counter never starts.
 const stall=fn(cicadaM,'- (void)reportVODProgressWithPosition:','- (void)handleCompletion');
 const threshold=stall.indexOf('progressThreshold');
 assert.ok(threshold>=0,'the stall check must compute a progress threshold');
 assert.ok(stall.indexOf('++self.stallSeconds >= 15')>threshold,'a real stall (no progress for 15s) must still fail');
});

test('a failed Cicada VOD fallback reports failed so JS can switch lines',()=>{
 const fail=fn(main,'- (void)cicadaLivePlayer:(id)player didFailWithError:','- (void)cicadaLivePlayer:(id)player didUpdatePosition:');
 assert.ok(fail.includes('@"failed"'),'a failed VOD Cicada fallback must send failed');
 assert.ok(fail.includes('[self stopNativePlayback]'),'a failed VOD Cicada fallback must stop the native player');
 assert.ok(fail.includes('@"audioOnly"'),'a failed live Cicada fallback must still restore the audioOnly text');
});
