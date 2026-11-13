import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
// Slice one else-if branch out of native.onPlaybackEvent in app.mjs: from the
// status marker to the next else-if (or the end of the live branch).
const liveBranch=(app,status)=>{
 const start=app.indexOf(`event.status==='${status}'`);assert.ok(start>=0,`app.mjs must handle ${status}`);
 const next=app.indexOf("else if(event.status===",start+1);
 return app.slice(start,next<0?app.indexOf("if(event.status==='progress'&&state.playURLs",start):next);
};
// Slice one ObjC method out of main.m: from the signature to the next method.
const objcMethod=(main,signature)=>{
 const start=main.indexOf(signature);assert.ok(start>=0,`main.m must contain ${signature}`);
 const next=main.indexOf('\n- (',start+1);
 return main.slice(start,next<0?undefined:next);
};
const watchdogReset=branch=>{
 assert.ok(branch.includes('state.livePlaybackProgressAt=Date.now()'),'branch must reset the progress watchdog baseline');
 assert.ok(branch.includes('state.liveLastPlaybackTime=null'),'branch must clear the last playback time');
};

test('app.mjs shows the Cicada fallback attempt without switching lines',()=>{
 const app=read('Web/app.mjs'),branch=liveBranch(app,'cicadaFallback');
 assert.ok(branch.includes('正在尝试软解播放，当前线路保持不变…'),'cicadaFallback must show the soft-decode attempt');
 assert.ok(branch.includes('state.liveVideoReady=false'),'cicadaFallback must clear the video-ready flag');
 assert.ok(!branch.includes('handleLivePlaybackFailure'),'cicadaFallback must never switch lines');
 watchdogReset(branch);
});

test('app.mjs shows Cicada soft decoding once the first frame arrives',()=>{
 const app=read('Web/app.mjs'),branch=liveBranch(app,'cicadaVideoReady');
 assert.ok(branch.includes('正在用软解播放'),'cicadaVideoReady must show soft decoding');
 assert.ok(branch.includes('state.liveVideoReady=true'),'cicadaVideoReady must set the video-ready flag');
 assert.ok(branch.includes('state.liveRendererRetry=0'),'cicadaVideoReady must clear the renderer retry count');
 assert.ok(branch.includes("codec:'hevc'"),'cicadaVideoReady must label the HEVC stream as hevc');
 assert.ok(branch.includes('event.width&&event.height'),'cicadaVideoReady must only set the format when both dimensions arrive');
 assert.ok(!branch.includes('handleLivePlaybackFailure'),'cicadaVideoReady must never switch lines');
 watchdogReset(branch);
});

test('app.mjs resets the watchdog baseline when audioOnly comes back',()=>{
 const app=read('Web/app.mjs'),branch=liveBranch(app,'audioOnly');
 assert.ok(branch.includes('该线路没有可识别的视频轨道'),'audioOnly copy must stay unchanged');
 watchdogReset(branch);
});

test('main.m falls back to Cicada on audioOnly and restores AVPlayer audio on Cicada failure',()=>{
 const main=read('Sources/main.m');
 assert.ok(main.includes('tryCicadaFallbackForItem'),'main.m must wire the Cicada fallback entry');
 assert.ok(main.includes('destroyCicadaPlayer'),'main.m must wire the Cicada teardown');
 assert.ok(main.includes('@\"cicadaFallback\"'),'main.m must send the cicadaFallback status');
 assert.ok(main.includes('@\"cicadaVideoReady\"'),'main.m must send the cicadaVideoReady status');
 const inspect=objcMethod(main,'- (void)inspectLiveVideoTracksForItem:(AVPlayerItem*)item {');
 assert.ok(inspect.includes('[owner tryCicadaFallbackForItem:current]'),'audioOnly must try Cicada before reporting no video track');
 assert.ok(inspect.includes('@\"audioOnly\"'),'track inspection must still report audioOnly when Cicada is unavailable');
 const failure=objcMethod(main,'cicadaLivePlayer:(id)player didFailWithError:');
 assert.ok(failure.includes('[self destroyCicadaPlayer]'),'Cicada failure must tear the Cicada player down');
 assert.ok(failure.includes('@\"audioOnly\"'),'Cicada failure must fall back to the audioOnly status');
 assert.ok(!failure.includes('handleLivePlaybackFailure'),'Cicada failure must not switch lines');
});

test('main.m releases the Cicada player on stop and on every new play, and pauses progress while it is active',()=>{
 const main=read('Sources/main.m');
 const stop=objcMethod(main,'- (void)stopNativePlayback {');
 assert.ok(stop.includes('[self destroyCicadaPlayer]'),'stopNativePlayback must destroy the Cicada player');
 assert.ok(main.includes('[self destroyCicadaPlayer];self.cicadaFallbackAttempted=NO'),'a new play must destroy the Cicada player and reset the attempt flag');
 const observerStart=main.indexOf('addPeriodicTimeObserverForInterval');
 assert.ok(observerStart>=0,'main.m must install the periodic time observer');
 const observer=main.slice(observerStart,main.indexOf('self.endObserver=',observerStart));
 assert.ok(observer.includes('if(strongOwner.cicadaFallbackActive)return;'),'the time observer must not send progress while Cicada is active');
 assert.ok(observer.includes('@\"progress\"'),'the time observer must still send progress for AVPlayer playback');
});

test('SYCicadaLivePlayer talks to the SDK only through runtime reflection',()=>{
 const header=read('Sources/SYCicadaLivePlayer.h'),impl=read('Sources/SYCicadaLivePlayer.m');
 for(const source of [header,impl]){
  assert.ok(!/^\s*#import\s*[<"]CicadaSDK\.h[>"]/m.test(source),'must not import CicadaSDK.h');
  assert.ok(!/\bCicada(Player|Config|UrlSource)\s*\*/.test(source),'must not declare CicadaPlayer/CicadaConfig/CicadaUrlSource types');
  assert.ok(!/@interface\s+Cicada(Player|Config|UrlSource)\b/.test(source),'must not redeclare SDK classes');
 }
 assert.ok(impl.includes('NSClassFromString'),'SDK classes must be looked up with NSClassFromString');
 assert.ok(impl.includes('@"CicadaPlayer"'),'the CicadaPlayer class must be resolved by name at runtime');
 assert.ok(impl.includes('networkTimeout * 1000'),'network timeout seconds must be converted to SDK milliseconds (x1000)');
 assert.ok(impl.includes('setScalingMode:'),'scaling mode must be passed to the SDK');
 assert.ok(impl.includes('mode = 0')&&impl.includes('mode = 1')&&impl.includes('mode = 2'),'scaling must map 0/1/2 (fill/fit/fill-aspect)');
 assert.ok(impl.includes('softwareRetryDone'),'a hardware-decode failure must retry once in software');
 assert.ok(impl.includes('setNetworkRetryCount:'),'the SDK retry count must be configured');
 assert.ok(impl.includes('_firstFrameTimeout = 20.0'),'the first-frame watchdog must default to 20 seconds');
});

test('Cicada frameworks are bundled for device builds and excluded from the simulator build',()=>{
 assert.ok(fs.existsSync(path.join(root,'Frameworks/CicadaPlayerSDK.framework/CicadaPlayerSDK')),'CicadaPlayerSDK binary must exist');
 assert.ok(fs.existsSync(path.join(root,'Frameworks/alivcffmpeg.framework/alivcffmpeg')),'alivcffmpeg binary must exist');
 const macos=read('tools/build-macos.sh');
 assert.ok(macos.includes('-framework CicadaPlayerSDK'),'device build must link CicadaPlayerSDK');
 assert.ok(macos.includes('-Xlinker -rpath -Xlinker @executable_path/Frameworks'),'device build must set the Frameworks rpath');
 const cross=read('tools/cross-build.py');
 assert.ok(cross.includes("'-framework','CicadaPlayerSDK'"),'cross build must link CicadaPlayerSDK');
 assert.ok(cross.includes("app/'Frameworks'"),'cross build must embed frameworks into the .app bundle');
 const smoke=read('tools/simulator-smoke.sh');
 assert.ok(smoke.includes('Sources/SYCicadaLivePlayer.m'),'simulator smoke must still compile SYCicadaLivePlayer.m');
 assert.ok(!smoke.includes('-framework CicadaPlayerSDK'),'simulator smoke must not link CicadaPlayerSDK');
});
