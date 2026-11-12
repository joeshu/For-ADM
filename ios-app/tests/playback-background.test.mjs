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
const lifecycle=main.slice(main.indexOf('- (void)handleAudioInterruption:'),main.indexOf('- (void)layoutPlayer:'));

test('backgrounding pauses Cicada when picture-in-picture is not active',()=>{
 assert.ok(lifecycle.includes('if(self.cicadaFallbackActive&&self.cicadaLivePlayer&&!self.cicadaLivePlayer.paused){'),'backgrounding must only touch a playing Cicada player');
 assert.ok(lifecycle.includes('BOOL pipActive=self.nativePlayer.pictureInPicture;'),'backgrounding must check whether PiP took over first');
 assert.ok(lifecycle.includes("if(!pipActive){[self.cicadaLivePlayer pause];self.cicadaPausedForBackground=YES;}"),'without PiP the Cicada player must be paused on backgrounding');
 assert.ok(lifecycle.includes('if(self.cicadaPausedForBackground&&self.cicadaLivePlayer){self.cicadaPausedForBackground=NO;[self.cicadaLivePlayer resume];}'),'returning to the foreground must resume only a background-paused Cicada player');
 assert.ok(main.includes('self.cicadaPausedForBackground=NO;self.cicadaPausedForInterruption=NO;'),'starting a new playback must clear the pause flags');
});

test('an audio interruption pauses and resumes Cicada as well as AVPlayer',()=>{
 assert.ok(lifecycle.includes("if(self.cicadaFallbackActive&&self.cicadaLivePlayer&&!self.cicadaLivePlayer.paused){[self.cicadaLivePlayer pause];self.cicadaPausedForInterruption=YES;}"),'an interruption must pause a playing Cicada player');
 assert.ok(lifecycle.includes('if((options&1)&&self.cicadaPausedForInterruption&&self.cicadaLivePlayer){self.cicadaPausedForInterruption=NO;[self.cicadaLivePlayer resume];}'),'the interruption ending must resume only the player the interruption paused');
 assert.ok(cicadaH.includes('@property (nonatomic, readonly) BOOL paused;'),'the controller must be able to read whether Cicada is paused');
});

test('the sleep timer is driven by a native timer, not the WebView interval',()=>{
 assert.ok(app.includes('sleepTimerEndAt:state.sleepTimerEndAt||0,'),'the snapshot must carry the sleep-timer deadline to native');
 assert.ok(main.includes('[self updateSleepTimerWithMode:self.pageSnapshot[@"sleepTimerMode"] endAt:[self.pageSnapshot[@"sleepTimerEndAt"] doubleValue]];'),'every snapshot must re-arm the native timer');
 assert.ok(main.includes('- (void)updateSleepTimerWithMode:(NSString*)mode endAt:(NSTimeInterval)endAt {'),'the native timer must be scheduled from the snapshot');
 assert.ok(main.includes('self.sleepTimer=[NSTimer scheduledTimerWithTimeInterval:(endAt-now)/1000 repeats:NO block:'),'the native timer must fire at the absolute deadline');
 assert.ok(main.includes("if(![mode isKindOfClass:NSString.class]||[mode isEqualToString:@\"off\"]||[mode isEqualToString:@\"episode\"])return;"),'episode mode must not arm a time-based timer');
 assert.ok(main.includes('- (void)fireSleepTimer {'),'the timer must have a fire handler');
 assert.ok(main.includes('if(self.cicadaFallbackActive&&self.cicadaLivePlayer&&![self.playContext hasPrefix:@"live:"])[self.cicadaLivePlayer pause];'),'firing must pause Cicada the same way the JS pause does');
 assert.ok(main.includes('[self sendPageAction:@"sleep-timer-fired" payload:@{}];'),'firing must tell JS to clear the timer state');
 assert.ok(app.includes("if(action==='sleep-timer-fired'){if(state.sleepTimerMode==='off')return;state.sleepTimerMode='off';state.sleepTimerEndAt=0;"),'the JS side must clear the timer state idempotently');
});
