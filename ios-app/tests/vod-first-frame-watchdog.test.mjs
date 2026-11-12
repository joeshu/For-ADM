import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

// VOD first-frame watchdog (P1 A3): the worst case used to be 60s+ of
// black screen — 15s VOD stall grace, then a 20s Cicada first-frame
// watchdog, then one software-decode rebuild with another 20s watchdog,
// and only then a failure/line switch. A first-frame timeout means the
// stream is not delivering frames; rebuilding with software decode
// cannot fix that, it only doubles the wait. So the VOD fallback path
// now waits 10s for its first frame and reports a timeout straight
// away, while real decode errors keep the one software retry.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const main=read('Sources/main.m'),player=read('Sources/SYCicadaLivePlayer.m'),header=read('Sources/SYCicadaLivePlayer.h');

test('the VOD fallback uses a 10s first-frame watchdog',()=>{
 const fallback=main.slice(main.indexOf('- (BOOL)tryCicadaVODFallbackForItem:(AVPlayerItem*)item {'),main.indexOf('- (void)destroyCicadaPlayer {'));
 assert.ok(fallback.includes('cicada.firstFrameTimeout=10.0'),'the VOD fallback must set firstFrameTimeout to 10s');
 assert.ok(!fallback.includes('firstFrameTimeout=20'),'the VOD fallback must not keep the 20s default');
});

test('the default first-frame timeout stays 20s for live',()=>{
 assert.ok(player.includes('_firstFrameTimeout = 20.0;'),'the default first-frame timeout must stay 20s');
 assert.ok(header.includes('默认 20；点播回退时 main.m 改为 10'),'the header must document the VOD override');
 assert.ok(!main.slice(main.indexOf('- (BOOL)tryCicadaFallbackForItem:(AVPlayerItem*)item {'),main.indexOf('- (BOOL)tryCicadaVODFallbackForItem:(AVPlayerItem*)item {')).includes('firstFrameTimeout='),'the live fallback must not touch the timeout');
});

test('a first-frame timeout fails fast instead of rebuilding with software decode',()=>{
 assert.ok(player.includes('reportErrorWithCode:-1001 message:[NSString stringWithFormat:@"CicadaPlayer %.0f 秒内未显示首帧", owner.firstFrameTimeout] allowSoftwareRetry:NO'),'the watchdog must report the timeout without a software retry');
});

test('decode errors still get one software retry',()=>{
 assert.ok(player.includes('- (void)reportErrorWithCode:(NSInteger)code message:(NSString *)message {'),'the two-argument reporter must exist');
 assert.ok(player.includes('[self reportErrorWithCode:code message:message allowSoftwareRetry:YES];'),'the two-argument reporter must still default to allowing the software retry');
 assert.ok(player.includes('if (allowSoftwareRetry && self.enableHardwareDecoder && !self.softwareRetryDone && self.player)'),'the software retry must still happen for errors that allow it');
});
