import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

// Stall detection without the notification (P1 B2) + manual line switch
// (P1 B3). AVPlayerItemPlaybackStalledNotification does not fire for
// every freeze — a hung proxy playlist request can hold the picture
// still forever with no recovery. The 5s time observer is the second
// net: when VOD time stops advancing while the player is still playing,
// the same 15s stall grace is armed. And when the user can see the line
// is slow, the cockpit offers an immediate escape instead of waiting
// for the grace to run out.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs'),main=read('Sources/main.m');
const observer=main.slice(main.indexOf('self.timeObserver=[player.player addPeriodicTimeObserverForInterval'));

test('the time observer tracks VOD progress for stall detection',()=>{
 assert.ok(main.includes('@property(nonatomic) double lastVODProgressTime;'),'the controller must track the last seen VOD progress time');
 assert.ok(main.includes('self.lastVODProgressTime=-1;\n    self.timeObserver='),'the progress baseline must reset when a new observer is created');
 assert.ok(main.includes('self.lastVODProgressTime=-1;'),'stopping playback must reset the progress baseline');
 assert.ok(observer.includes('strongOwner.lastVODProgressTime=seconds;'),'each tick with advancing time must refresh the baseline');
});

test('unmoved VOD time arms the same stall grace as the notification',()=>{
 assert.ok(observer.includes('if(!livePlayback){'),'the observer stall check must be VOD-only');
 assert.ok(observer.includes('observerPlayer.rate>0'),'a paused player must not count as stalled');
 assert.ok(observer.includes('seconds>=strongOwner.lastVODProgressTime-0.05&&seconds<=strongOwner.lastVODProgressTime+0.5'),'only time that neither advances nor jumps counts as unmoved (a seek jumps)');
 assert.ok(observer.includes('BOOL nearEnd='),'time near the end must not count as stalled');
 assert.ok(observer.includes('(observerTotal-seconds)<2'),'the near-end window must be the last 2 seconds');
 assert.ok(observer.includes('strongOwner.vodStallTime=strongOwner.lastVODProgressTime;strongOwner.vodStallChecks=0;strongOwner.vodStallWatchdogActive=YES;[strongOwner checkVODStallForItem:strongOwner.nativeItem context:strongOwner.playContext?:@""];'),'an unmoved tick must arm the stall watchdog from the last progress time');
 assert.ok(observer.includes('if(strongOwner.cicadaFallbackActive)return;'),'the check must stay off while Cicada is playing (it has its own stall timeout)');
});

test('the manual switch action skips the current address and line, then recovers',()=>{
 assert.ok(app.includes("if(action==='player-switch-line'){"),'a player-switch-line action must exist');
 assert.ok(app.includes("state.playRecovery.failedURLs.add(state.playURLs[state.playIndex]?.url);"),'a manual switch must mark the current address failed');
 assert.ok(app.includes("state.playRecovery.failedLines.add(state.line);"),'a manual switch must mark the current line failed');
 assert.ok(app.includes("void recoverPlayback(session,'用户手动换线');"),'a manual switch must run the normal recovery flow');
});
