import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const main=fs.readFileSync(path.join(root,'Sources/main.m'),'utf8');
// Slice one ObjC method out of main.m: from the signature to the next method.
const objcMethod=signature=>{
 const start=main.indexOf(signature);assert.ok(start>=0,`main.m must contain ${signature}`);
 const next=main.indexOf('\n- (',start+1);
 return main.slice(start,next<0?undefined:next);
};
// Slice one stall observer registration out of main.m: from the marker to the
// next failedObserver assignment. The first registration belongs to the live
// reuse branch (liveContext); the second one is the VOD/new-player branch.
const stallBlock=occurrence=>{
 let at=-1;for(let i=0;i<occurrence;i++){at=main.indexOf('addObserverForName:AVPlayerItemPlaybackStalledNotification',at+1);assert.ok(at>=0,'main.m must register the stall observer twice');}
 return main.slice(at,main.indexOf('self.failedObserver=',at));
};

test('a VOD stall waits for rebuffering instead of failing the line at once',()=>{
 const block=stallBlock(2);
 assert.ok(block.includes('checkVODStallForItem'),'VOD stall must arm the grace watchdog');
 assert.ok(!block.includes('stopNativePlayback'),'VOD stall must not tear the player down immediately');
 assert.ok(block.includes('if(live)'),'live playback in the same branch must keep failing fast on a stall');
 const watch=objcMethod('- (void)checkVODStallForItem:(AVPlayerItem*)item context:(NSString*)context {');
 assert.ok(watch.includes('5*NSEC_PER_SEC'),'the grace check must run every 5 seconds');
 assert.ok(watch.includes('vodStallChecks>=3'),'the line must fail only after 15s with no progress');
 assert.ok(watch.includes('now>owner.vodStallTime+0.5'),'playback progress must clear the watch');
 assert.ok(watch.includes('player.rate<=0'),'user pause must cancel the watch');
 assert.ok(watch.includes('@\"failed\"'),'a line stalled for 15s must still report failed');
 assert.ok(watch.includes('[owner stopNativePlayback]'),'a line stalled for 15s must still stop the player');
});

test('the stall watchdog state is reset when playback stops',()=>{
 const stop=objcMethod('- (void)stopNativePlayback {');
 assert.ok(stop.includes('vodStallWatchdogActive=NO'),'stop must clear the watchdog flag');
 assert.ok(stop.includes('vodStallTime=0'),'stop must clear the stall time');
 assert.ok(stop.includes('vodStallChecks=0'),'stop must clear the stall check count');
});

test('the live stall observer still fails fast',()=>{
 const block=stallBlock(1);
 assert.ok(block.includes('liveContext'),'the live stall observer must use the live context');
 assert.ok(block.includes('@\"failed\"'),'the live stall observer must report failed immediately');
 assert.ok(!block.includes('checkVODStallForItem'),'the live stall observer must not use the VOD grace watch');
});
