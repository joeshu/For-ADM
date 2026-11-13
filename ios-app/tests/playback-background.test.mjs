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
const hardware=read('DetailPlayerStabilityKit/Sources/DetailPlayerStabilityKit/IOSHardwareSessionGuard.swift');
const runtime=read('DetailPlayerStabilityKit/Sources/DetailPlayerStabilityKit/PlaybackRuntimeBridge.swift');
const lifecycle=main.slice(main.indexOf('- (void)handleAppLifecycle:'),main.indexOf('- (void)layoutPlayer:'));

test('backgrounding pauses Cicada when picture-in-picture is not active',()=>{
 assert.ok(lifecycle.includes('if(self.cicadaFallbackActive&&self.cicadaLivePlayer&&!self.cicadaLivePlayer.paused){'),'backgrounding must only touch a playing Cicada player');
 assert.ok(lifecycle.includes('BOOL pipActive=self.nativePlayer.pictureInPicture;'),'backgrounding must check whether PiP took over first');
 assert.ok(lifecycle.includes("if(!pipActive){[self.cicadaLivePlayer pause];self.cicadaPausedForBackground=YES;}"),'without PiP the Cicada player must be paused on backgrounding');
 assert.ok(lifecycle.includes('if(self.cicadaPausedForBackground&&self.cicadaLivePlayer){self.cicadaPausedForBackground=NO;if([self.playbackGate desiredPlaybackWithContext:self.playContext?:@""])[self.cicadaLivePlayer resume];}'),'returning to the foreground must resume only a background-paused Cicada player when the user still wants playback');
 assert.ok(main.includes('self.cicadaPausedForBackground=NO;self.cicadaPausedForInterruption=NO;'),'starting a new playback must clear the pause flags');
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
 assert.ok(main.includes('self.playbackRuntime.containerView=self.detailPlayerContainer'),'the detail screen must attach its Swift container to the runtime');
 assert.ok(main.includes('[self.appScreen.detailPlayerContainer mountRenderView:player.view]'),'the existing AVPlayer renderer must mount in the Swift container');
 assert.ok(main.includes('[self.appScreen.detailPlayerContainer mountRenderView:view]'),'the Cicada fallback renderer must use the same Swift container');
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
