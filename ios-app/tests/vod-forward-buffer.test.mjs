import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const main=fs.readFileSync(path.join(root,'Sources/main.m'),'utf8');

test('VOD keeps a deep forward buffer so slow segments do not stall playback',()=>{
 assert.ok(main.includes('preferredForwardBufferDuration=livePlayback?0:30'),'VOD forward buffer must be 30s');
 assert.ok(!main.includes('preferredForwardBufferDuration=livePlayback?0:4'),'the 4s VOD buffer must be gone');
 assert.ok(main.includes('preferredForwardBufferDuration=livePlayback?0:'),'live playback must keep a zero forward buffer');
});

test('the player waits to minimize stalling on VOD startup',()=>{
 // The new-player branch creates the AVPlayer once for live and VOD; the
 // explicit YES makes the 30s buffer actually gate the first frame instead
 // of starting on an almost-empty buffer.
 const at=main.indexOf('player.player=[AVPlayer playerWithPlayerItem:item];');
 assert.ok(at>=0,'main.m must create the player with a player item');
 const line=main.slice(at,main.indexOf('\n',at));
 assert.ok(line.includes('automaticallyWaitsToMinimizeStalling=YES'),'the player must wait to minimize stalling');
 assert.ok(!line.includes('automaticallyWaitsToMinimizeStalling=NO'),'the player must never disable stall minimization');
});
