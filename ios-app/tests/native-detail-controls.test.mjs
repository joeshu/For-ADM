import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

// Native detail controls (P1 E1/H3/H4): the native detail page had no
// progress bar (only +/-15s), no way to expand a capped synopsis, and
// no next-episode button — half the Web cockpit's functions were
// missing under the player.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs');
const main=read('Sources/main.m');
const transport=read('Web/transport.mjs');
const progress=app.slice(app.indexOf("if(event.status==='progress'"),app.indexOf('const firstFrame=event.status'));

test('native progress events update the native screen directly without a WebView round trip',()=>{
 assert.ok(progress.includes("state.playTime=Number(event.time)||0;"),'progress must record the current time');
 assert.ok(progress.includes("state.playDuration=Number(event.duration)||state.playDuration||0;"),'progress must record the duration');
 assert.ok(!transport.includes('syncProgress('),'the WebView must not relay each native progress tick back to UIKit');
 assert.ok(!main.includes('pageProgress'),'there must be no pageProgress bridge path');
 const sendPlayback=main.slice(main.indexOf('- (void)sendPlayback:'),main.indexOf('#if defined(SY_SIMULATOR_SMOKE)',main.indexOf('- (void)sendPlayback:')));
 assert.ok(sendPlayback.includes('[self.appScreen applyProgressTime:[event[@"time"] doubleValue] duration:[event[@"duration"] doubleValue]]'),'accepted native progress must update only the slider');
});

test('the native progress row shows a slider with both time labels and seeks on release',()=>{
 assert.ok(main.includes('self.progressSlider=[[UISlider alloc]initWithFrame:'),'the detail page must build a slider');
 assert.ok(main.includes('self.progressCurrentLabel=[self label:[self formatDuration:snapshotTime]'),'the current-time label must start from the snapshot');
 assert.ok(main.includes('self.progressDurationLabel=[self label:[self formatDuration:snapshotDuration]'),'the duration label must start from the snapshot');
 assert.ok(main.includes('- (void)applyProgressTime:(NSTimeInterval)time duration:(NSTimeInterval)duration {'),'progress updates must go through applyProgressTime');
 assert.ok(main.includes('if(!self.progressScrubbing&&!self.progressSeeking)self.progressSlider.value='),'a progress update must not move the thumb while dragging or seeking');
 assert.ok(main.includes('- (void)progressSliderReleased:(UISlider*)sender {'),'releasing the slider must seek');
 assert.ok(main.includes('[self.owner seekNativePlayerToTime:sender.value];'),'release must seek the player to the slider value');
 assert.ok(main.includes('- (void)seekNativePlayerToTime:(NSTimeInterval)seconds {'),'the seek must be implemented on the controller');
 assert.ok(main.includes('if(self.cicadaFallbackActive&&self.cicadaLivePlayer){\n  [self.cicadaLivePlayer seekToTime:seconds seekID:seekID];'),'a Cicada fallback must seek through Cicada with the active seek identity');
 assert.ok(main.includes('- (NSString*)formatDuration:(NSTimeInterval)seconds {'),'durations must be formatted as m:ss / h:mm:ss');
});

test('the snapshot carries play time and duration so a rebuild restores the slider',()=>{
 assert.ok(app.includes('playTime:state.playTime||0,playDuration:state.playDuration||0,summaryExpanded:!!state.summaryExpanded'), 'the detail snapshot must carry play time, duration and the summary flag');
});

test('a long synopsis can be expanded on the native detail page',()=>{
 assert.ok(main.includes('BOOL summaryExpanded=[self.state[@"summaryExpanded"] boolValue];'),'the native page must read the summary flag');
 assert.ok(main.includes('CGFloat summaryH=summaryExpanded?MAX(54,fullSummaryH):MAX(54,MIN(260,fullSummaryH));'),'an expanded synopsis must not be capped at 260pt');
 assert.ok(main.includes('if(fullSummaryH>260){SYLiveActionButton*summaryBtn=[self button:summaryExpanded?@"收起简介 ⌃":@"展开简介 ⌄" action:@"summary-toggle"'),'the toggle button must only appear when the synopsis was actually capped');
 assert.ok(app.includes("if(action==='summary-toggle'){state.summaryExpanded=!state.summaryExpanded;render();return;}"),'the toggle action must flip the flag and re-render');
});

test('the native detail page has a next-episode button in display order',()=>{
 assert.ok(main.includes('NSString*nextEpisodeId=nil;NSString*nextEpisodeTitle=nil;'),'the next episode must be computed from the selected line');
 assert.ok(main.includes('if([eps[ei][@"selected"] boolValue]&&ei+1<eps.count){nextEpisodeId=[eps[ei+1][@"index"] description];'),'the next episode must be the one after the selected one in display order');
 assert.ok(main.includes('action:@"episode" payload:@{@"id":nextEpisodeId}'),'next episode must reuse the existing episode action');
 assert.ok(main.includes('@"⏭ 下一集 · %@'), 'the button must name the next episode');
});
