import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

// Native loading/buffering indicator (P1 A2/H5): the detail player is a
// plain black playerHost, so startup buffering (30s forward buffer) and
// the Cicada fallback rebuild both look like a hang. A spinner + status
// line inside playerHost, driven by the snapshot's playLoading flag,
// makes the wait visible. The flag is set when native playback starts,
// kept while the Cicada fallback is being built, and cleared on the
// first frame, on failure, or when the episode ends.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs'),main=read('Sources/main.m');

test('JS tracks the loading state and sends it in the detail snapshot',()=>{
 assert.ok(app.includes("playLoading:false,playLoadingText:''"),'state must track the loading flag and text');
 assert.ok(app.includes('playLoading:!!state.playLoading,playLoadingText:state.playLoadingText||'), 'the detail snapshot must carry the loading flag and text');
});

test('starting native playback turns the indicator on',()=>{
 assert.ok(app.includes("state.playLoading=true;state.playLoadingText='正在加载播放器…'"),'launchNativePlayer must turn the indicator on before playing');
});

test('playback events drive the indicator off and on',()=>{
 assert.ok(app.includes("if(firstFrame) {state.playLoading=false;"),'the first frame must turn the indicator off');
 assert.ok(app.includes("state.playLoading=true;state.playLoadingText='正在尝试软解播放…'"),'a Cicada fallback must keep the indicator on with fallback text');
 assert.ok(app.includes("if(event.status==='failed'){state.playLoading=false;"),'a failure must turn the indicator off before recovery runs');
 assert.ok(app.includes("if(event.status==='ended'){state.playLoading=false;"),'the end of an episode must turn the indicator off');
});

test('native creates the spinner and label inside the player host',()=>{
 assert.ok(main.includes('@property(nonatomic,strong) UIActivityIndicatorView*loadingSpinner;'),'the app screen must own a loading spinner');
 assert.ok(main.includes('@property(nonatomic,strong) UILabel*loadingLabel;'),'the app screen must own a loading label');
 assert.ok(main.includes('[[UIActivityIndicatorView alloc]initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleLarge]'),'the spinner must be a large activity indicator');
 assert.ok(main.includes('[self.playerHost addSubview:self.loadingSpinner]'),'the spinner must live inside playerHost');
 assert.ok(main.includes('[self.playerHost addSubview:self.loadingLabel]'),'the label must live inside playerHost');
});

test('the indicator follows the snapshot flag and stays above the player view',()=>{
 assert.ok(main.includes('- (void)layoutPlayerLoadingIndicator'),'a layout method for the indicator must exist');
 assert.ok(main.includes('BOOL loading=([self.state[@"playLoading"] boolValue]||self.owner.playbackRuntime.isShowingLoading)&&!self.playerHost.hidden;'),'the indicator must reflect both Web state and Swift coordinator buffering');
 assert.ok(main.includes('[self.state[@"playLoadingText"]'),'the label must read its text from the snapshot');
 assert.ok(main.includes('[self.playerHost bringSubviewToFront:self.loadingSpinner];'),'the spinner must be brought above the player view');
 assert.ok(main.includes('[self.playerHost bringSubviewToFront:self.loadingLabel];'),'the label must be brought above the player view');
 assert.ok(main.includes('[self layoutPlayerLoadingIndicator];'),'layout must refresh the indicator when the player host is framed');
 assert.ok(main.includes('[self.appScreen layoutPlayerLoadingIndicator];return;}'),'layoutPlayer must refresh the indicator after attaching the player view');
});
