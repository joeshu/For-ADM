import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

// Background / interruption / sleep timer (P1 I1/I2/I3): Cicada fallback
// playback kept playing in the background with no PiP and no way to
// stop it from outside; an incoming call only paused AVPlayer; and the
// sleep timer was a 5s JS interval in the hidden WKWebView, which iOS
// suspends in the background, so "pause in 15 minutes" could be late
// or never happen.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs');
const main=read('Sources/main.m');
const cicadaH=read('Sources/SYCicadaLivePlayer.h');
const cicadaM=read('Sources/SYCicadaLivePlayer.m');
const hardware=read('DetailPlayerStabilityKit/Sources/DetailPlayerStabilityKit/IOSHardwareSessionGuard.swift');
const runtime=read('DetailPlayerStabilityKit/Sources/DetailPlayerStabilityKit/PlaybackRuntimeBridge.swift');
const lifecycle=main.slice(main.indexOf('- (void)handleAppLifecycle:'),main.indexOf('- (void)layoutPlayer:'));

test('backgrounding pauses Cicada when picture-in-picture is not active',()=>{
 assert.ok(lifecycle.includes('if(wants&&self.cicadaFallbackActive&&self.cicadaLivePlayer&&!self.cicadaLivePlayer.paused){'),'backgrounding must pause only a playing Cicada player while playback is still wanted');
 assert.ok(lifecycle.includes('BOOL pipActive=self.nativePlayer.pictureInPicture;'),'backgrounding must check whether PiP took over first');
 assert.ok(lifecycle.includes("if(!pipActive){[self.cicadaLivePlayer pause];self.cicadaPausedForBackground=YES;}"),'without PiP the Cicada player must be paused on backgrounding');
 const active=lifecycle.slice(lifecycle.indexOf('UIApplicationDidBecomeActiveNotification'));
 assert.ok(active.includes('if(self.cicadaPausedForBackground&&self.cicadaLivePlayer){'),'Cicada resume must wait until the app is active');
 assert.ok(active.includes('if(!self.cicadaPausedForInterruption&&[self.playbackGate desiredPlaybackWithContext:self.playContext?:@""])[self playbackRuntimeRequestPlay:self.playbackRuntime];'),'foreground resume must preserve manual and interruption pauses and update the runtime');
 const play=main.slice(main.indexOf('- (void)playbackRuntimeRequestPlay:'),main.indexOf('- (void)playbackRuntime:(SYPlaybackRuntimeBridge*)runtime requestPauseManually:'));
 assert.ok(play.indexOf('self.cicadaPausedForBackground||UIApplication.sharedApplication.applicationState==UIApplicationStateBackground')<play.indexOf('[self.cicadaLivePlayer resume]'),'an interruption ending in the background must not restart Cicada');
 assert.ok(main.includes('if(wanted&&UIApplication.sharedApplication.applicationState!=UIApplicationStateBackground)[cicada start];'),'a fallback created in the background must follow the same pause policy');
 assert.ok(main.includes('self.cicadaPausedForBackground=NO;self.cicadaPausedForInterruption=NO;'),'starting a new playback must clear the pause flags');
});

test('native buffering callbacks reach the current detail session without changing playback intent',()=>{
 const intent=main.slice(main.indexOf('if(context==&SYPlaybackIntent)'),main.indexOf('if(context==&SYVODRendererDisplayReady)'));
 const waiting=intent.slice(intent.indexOf('AVPlayerTimeControlStatusWaitingToPlayAtSpecifiedRate'));
 assert.ok(waiting.includes('[self sendPlayback:@{@"context":self.playContext,@"status":@"buffering"}]'),'AVPlayer waiting must enter the context/attempt event gate');
 assert.ok(!waiting.includes('setWantsToPlay'),'waiting is observed playback state, not a manual pause');
 const buffering=main.slice(main.indexOf('- (void)cicadaLivePlayer:(id)player bufferingChanged:'),main.indexOf('- (void)cicadaLivePlayer:(id)player didCompleteSeek:'));
 assert.ok(buffering.includes('player!=self.cicadaLivePlayer||!self.cicadaFallbackActive'),'a replaced Cicada decoder cannot change the current session');
 assert.ok(buffering.includes('self.cicadaLivePlayer.paused||self.cicadaPausedForBackground||!wants'),'loading-end cannot clear manual or background pause');
 assert.ok(buffering.includes('[self sendPlayback:'),'Cicada buffering must use the same context/attempt event gate');
 const report=cicadaM.slice(cicadaM.indexOf('- (void)reportBuffering:'),cicadaM.indexOf('- (void)onSeekEnd:'));
 assert.ok(report.includes('self.generation != generation')&&report.includes('player != self.player'),'queued buffering events must reject old decoder generations');
 assert.ok(report.includes('if (self.buffering == buffering) return;'),'SDK event and selector duplicates must be coalesced');
 assert.ok(cicadaM.includes('eventType == 4 || eventType == 5'),'the verified SDK loading events must be connected');
});

test('an audio interruption pauses and resumes Cicada as well as AVPlayer',()=>{
 assert.ok(hardware.includes('coordinator.pause(manual: false)'),'the hardware guard must pause without changing the manual playback intent');
 assert.ok(hardware.includes('wasPlayingBeforeInterruption && shouldResume && !coordinator.userManuallyPaused'),'resume must require an interruption-resume option and unchanged user intent');
 assert.ok(runtime.includes('runtime.delegate?.playbackRuntimeRequestPlay(runtime)'),'the coordinator must route resume to the current native engine');
 assert.ok(main.includes('if(self.cicadaFallbackActive&&self.cicadaLivePlayer){')&&main.includes('[self.cicadaLivePlayer pause]'),'the native bridge must pause Cicada during an interruption');
 assert.ok(main.includes('[self.cicadaLivePlayer resume]')&&main.includes('[self.nativePlayer.player play]'),'the native bridge must resume the active Cicada or AVPlayer engine');
 assert.ok(main.includes('self.cicadaPausedForInterruption=self.cicadaFallbackActive&&self.cicadaLivePlayer!=nil;'),'the bridge must preserve Cicada interruption state');
 assert.ok(cicadaH.includes('@property (nonatomic, readonly) BOOL paused;'),'the controller must be able to read whether Cicada is paused');
});

test('the Swift stability runtime is connected to the detail player and bounded preloader',()=>{
 const container=read('DetailPlayerStabilityKit/Sources/DetailPlayerStabilityKit/DetailPlayerContainerView.swift');
 assert.ok(main.includes('self.playbackRuntime=[SYPlaybackRuntimeBridge new];self.playbackRuntime.delegate=self'),'SYController must own and delegate to the Swift runtime');
 assert.ok(main.includes('self.owner.playbackRuntime.containerView=self.detailPlayerContainer'),'the detail screen must attach its Swift container to the runtime');
 assert.ok(main.includes('[self.appScreen.detailPlayerContainer mountRenderView:self.nativePlayer.view]'),'the existing AVPlayer renderer must mount in the Swift container');
 assert.ok(main.includes('[self.detailPlayerContainer mountRenderView:self.owner.cicadaLivePlayer.playerView]'),'the Cicada fallback renderer must use the same Swift container');
 assert.ok(runtime.includes('value.externallyManagedRecovery = true'),'the coordinator must not compete with the existing bounded recovery gate');
 assert.ok(hardware.includes('while preloadOrder.count >= 2'),'the hardware guard must bound retained next-episode assets');
 assert.ok(app.includes('native.preloadEpisode(cacheKey,nextCandidate.url,mediaHeaders(c,nextCandidate))'),'the Web prefetch result must warm the native hardware guard with its headers');
 assert.ok(container.includes('public func mountRenderView(_ renderView: UIView)'),'the container must provide a stable renderer mount point');
});

test('the sleep timer is driven by a native timer, not the WebView interval',()=>{
 assert.ok(app.includes('sleepTimerEndAt:state.sleepTimerEndAt||0,'),'the snapshot must carry the sleep-timer deadline to native');
 assert.ok(main.includes('[self updateSleepTimerWithMode:self.pageSnapshot[@"sleepTimerMode"] endAt:[self.pageSnapshot[@"sleepTimerEndAt"] doubleValue]];'),'every snapshot must re-arm the native timer');
 assert.ok(main.includes('- (void)updateSleepTimerWithMode:(NSString*)mode endAt:(NSTimeInterval)endAt {'),'the native timer must be scheduled from the snapshot');
 assert.ok(main.includes('self.sleepTimer=[NSTimer scheduledTimerWithTimeInterval:(endAt-now)/1000 repeats:NO block:'),'the native timer must fire at the absolute deadline');
 assert.ok(main.includes("if(![mode isKindOfClass:NSString.class]||[mode isEqualToString:@\"off\"]||[mode isEqualToString:@\"episode\"])return;"),'episode mode must not arm a time-based timer');
 assert.ok(main.includes('- (void)fireSleepTimer {'),'the timer must have a fire handler');
 assert.ok(main.includes('if(![self.playContext hasPrefix:@"live:"]&&self.playbackRuntime.hasActiveSession)[self.playbackRuntime pauseManually];'),'firing must route detail pauses through the Swift session coordinator');
 assert.ok(main.includes('[self sendPageAction:@"sleep-timer-fired" payload:@{}];'),'firing must tell JS to clear the timer state');
 assert.ok(app.includes("if(action==='sleep-timer-fired'){if(state.sleepTimerMode==='off')return;state.sleepTimerMode='off';state.sleepTimerEndAt=0;"),'the JS side must clear the timer state idempotently');
});
