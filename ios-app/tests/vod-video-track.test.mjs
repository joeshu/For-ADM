import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

// VOD zero-video-track detection (P1 J1): live playback already
// inspected the video tracks after ReadyToPlay, but VOD never did —
// a stream with only an audio track (e.g. a Migu H.265 TS stream)
// played black-screen-with-sound forever, currentTime advancing, the
// stall watchdog never firing.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs');
const main=read('Sources/main.m');
const vod=main.slice(main.indexOf('- (void)inspectVODVideoTracksForItem:'),main.indexOf('// ---------- Cicada'));

test('a VOD item is inspected for video tracks when it becomes ready',()=>{
 assert.ok(main.includes("if(self.nativeItem.status==1){[self sendPlayback:@{@\"context\":self.playContext?:@\"\",@\"status\":@\"ready\"}];if([self.playContext hasPrefix:@\"live:\"])[self inspectLiveVideoTracksForItem:self.nativeItem];else [self inspectVODVideoTracksForItem:self.nativeItem context:self.playContext?:@\"\"];}"),'ReadyToPlay must inspect VOD tracks exactly like live tracks');
 assert.ok(main.includes('- (void)inspectVODVideoTracksForItem:(AVPlayerItem*)item context:(NSString*)context {'),'the VOD inspection must exist as its own method');
 assert.ok(vod.includes("[asset loadTracksWithMediaType:AVMediaTypeVideo completionHandler:"),'the inspection must load the video tracks');
 assert.ok(vod.includes("if(!item||item!=self.nativeItem||[self.playContext hasPrefix:@\"live:\"]||self.vodTrackInspectionItem==item)return;"),'the inspection must run once per item and never for live');
 assert.ok(vod.includes('self.vodTrackInspectionItem=item;'),'the inspected item must be recorded');
 assert.ok(main.includes('self.liveTrackInspectionItem=nil;self.vodTrackInspectionItem=nil;'),'a new play must clear the VOD inspection guard');
});

test('a VOD stream with no video track falls back to Cicada first, and only then reports audio-only',()=>{
 assert.ok(vod.includes('if(error||tracks.count>0)return;'),'an error or any video track must leave playback alone');
 assert.ok(vod.includes('if([owner tryCicadaVODFallbackForItem:current])return;'),'zero video tracks must try the same-line Cicada fallback first');
 assert.ok(vod.includes('[owner sendPlayback:@{@"context":context,@"status":@"audioOnly",@"error":@"这条点播流没有可识别的视频轨道"}];'),'only a failed Cicada fallback must report audioOnly');
});

test('the app records a VOD audio-only stream without switching lines',()=>{
 assert.ok(app.includes("if(event.status==='audioOnly'){recordDiag('audioOnly','无视频轨道，当前仅播放声音');toast('该视频没有可识别的视频轨道，仅播放声音');render();}"),'the VOD branch must record and show audioOnly');
 const handler=app.slice(app.indexOf("if(event.status==='audioOnly'){recordDiag('audioOnly','无视频轨道，当前仅播放声音');"));
 assert.ok(!handler.slice(0,handler.indexOf('render();}')).includes('recoverPlayback'),'audioOnly must not trigger a line switch');
});
