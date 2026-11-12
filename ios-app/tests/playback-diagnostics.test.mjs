import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

// Playback diagnostics (P1 K1 + K2): every playback event is recorded into
// a 20-entry on-device log. The detail page shows a one-line summary
// (quality · engine · line · last event) under the cockpit, and the
// settings page links to a full "播放诊断" page with copy/clear. The log
// lives in JS state (persisted to localStorage) and reaches the native
// screen through nativePageSnapshot, so no new native storage is needed.
// These are source-contract tests: the log must be recorded at the event
// sites, surfaced in the snapshot, and rendered natively.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs'),main=read('Sources/main.m');

test('diagnostics log lives in state and is persisted',()=>{
 assert.ok(app.includes("diagnostics:read('diagnostics',[])"),'state must load the diagnostics log from storage');
 assert.ok(app.includes("write('diagnostics',state.diagnostics)"),'recordDiag must persist the log');
 assert.ok(app.includes(".slice(0,20)"),'the log must be capped at the latest 20 entries');
 assert.ok(app.includes("diagEngine:'AVPlayer'"),'the current engine must be tracked in state');
});

test('recordDiag captures the playback context of each event',()=>{
 assert.ok(app.includes('function recordDiag(kind,detail'), 'recordDiag must exist');
 assert.ok(app.includes("kindLabel:diagKindLabels[kind]"),'each entry must carry a readable Chinese event label');
 assert.ok(app.includes("state.detail?.playSources?.[state.line]?.name"),'entries must record the current line name');
 assert.ok(app.includes("quality:overrides.quality??(state.playQualityLabel||'')"),'entries must record the current quality label');
 assert.ok(app.includes("engine:overrides.engine??(state.diagEngine||'AVPlayer')"),'entries must record the engine in use');
 assert.ok(app.includes("if(native.native())native.syncPage(nativePageSnapshot());"),'recording an event must sync the native screen');
});

test('the detail snapshot carries the K1 diagnostic line',()=>{
 assert.ok(app.includes('diagLine:diagLine()'),'the detail snapshot must include diagLine');
 assert.ok(app.includes('function diagLine(){'),'diagLine must exist');
 assert.ok(app.includes("state.playQualityLabel?state.playQualityLabel+' · ':''"),'the line must start with the quality label');
 assert.ok(app.includes("(state.diagEngine||'AVPlayer')"),'the line must name the engine');
 assert.ok(app.includes("最近："),'the line must show the most recent event');
});

test('the snapshot has a diagnostics page branch',()=>{
 assert.ok(app.includes("if(state.page==='diagnostics'){") ,'a diagnostics snapshot branch must exist');
 assert.ok(app.includes("title:'播放诊断',diagnostics:state.diagnostics||[]"),'the diagnostics snapshot must carry the log array');
});

test('navigation to the diagnostics page is allowed in both handlers',()=>{
 const nativeAction=app.match(/window\.NativePageAction=\(action,payload=\{\}\)=>\{[^]*?if\(action==='page'&&!\[(.*?)\]\.includes/)?.[1]||'';
 assert.ok(nativeAction.includes("'diagnostics'"),'NativePageAction must allow page diagnostics');
 const clickAction=app.match(/else if\(act==='page'\|\|act==='account'\)\{if\(act==='page'&&!\[(.*?)\]\.includes/)?.[1]||'';
 assert.ok(clickAction.includes("'diagnostics'"),'the click handler must allow page diagnostics');
 assert.ok(app.includes("state.page==='diagnostics'?diagnosticsView()"),'render must show the diagnostics view for the diagnostics page');
 assert.ok(app.includes('function diagnosticsView(){'),'diagnosticsView must exist');
});

test('diagnostics copy and clear actions exist',()=>{
 assert.ok(app.includes("if(action==='diagnostics-copy')"),'a diagnostics-copy action must exist');
 assert.ok(app.includes('native.copyText(diagnosticsText())'),'copy must send the formatted log through the native copy bridge');
 assert.ok(app.includes("if(action==='diagnostics-clear')"),'a diagnostics-clear action must exist');
 assert.ok(app.includes("state.diagnostics=[];write('diagnostics',[]);"),'clear must empty the log in state and storage');
 assert.ok(app.includes("data-act=\"diagnostics-copy\""),'the Web diagnostics view must offer copy');
 assert.ok(app.includes("data-act=\"diagnostics-clear\""),'the Web diagnostics view must offer clear');
 assert.ok(app.includes('data-act="page" data-id="diagnostics">查看诊断日志</button>'),'the Web settings page must link to the diagnostics page');
});

test('playback events are recorded at the VOD event sites',()=>{
 assert.ok(app.includes("state.playLoading=false;recordDiag('ready','首帧已出')"),'VOD ready must be recorded and turn the loading indicator off');
 assert.ok(app.includes("state.diagEngine='Cicada';state.playLoading=true;state.playLoadingText='正在尝试软解播放…';state.playError='';"),'a Cicada fallback must flip the engine and keep the loading indicator on');
 assert.ok(app.includes("recordDiag('cicada','卡顿后改用软解，清晰度不变')"),'a VOD Cicada fallback must be recorded');
 assert.ok(app.includes("if(event.status==='failed'){state.playLoading=false;recordDiag('failed',event.error||'播放器无法读取当前线路')"),'a VOD failure must be recorded before recovery runs');
 assert.ok(app.includes("if(event.status==='ended'){state.playLoading=false;recordDiag('ended','本集播完')"),'a VOD end must be recorded');
});

test('playback events are recorded at the live event sites',()=>{
 assert.ok(app.includes("recordDiag('ready','直播已连接',{title:liveChannel()?.name||'直播'})"),'live ready must be recorded');
 assert.ok(app.includes("recordDiag('audioOnly','无视频轨道',{title:liveChannel()?.name||'直播'})"),'live audio-only must be recorded');
 assert.ok(app.includes("recordDiag('cicada','改用软解',{title:liveChannel()?.name||'直播'})"),'a live Cicada fallback must be recorded');
 assert.ok(app.includes("recordDiag('cicadaReady','软解出画面',{title:liveChannel()?.name||'直播'})"),'live Cicada first frame must be recorded');
 assert.ok(app.includes("recordDiag('failed','AVPlayer 未输出画面',{title:liveChannel()?.name||'直播'})"),'a live renderer failure must be recorded');
});

test('play starts and line switches are recorded',()=>{
 assert.ok(app.includes("state.diagEngine='AVPlayer';state.playLoading=true;state.playLoadingText='正在加载播放器…';recordDiag('play','开始播放');"),'each native play must reset the engine, turn the loading indicator on, and record the start');
 assert.ok(app.includes("recordDiag('switch','切换到'"),'a line switch during recovery must be recorded');
 assert.ok(app.includes("recordDiag('failed',lastError||'已尝试全部备用地址和线路')"),'giving up after all lines must be recorded');
});

test('native detail page shows the K1 diagnostic line under the cockpit',()=>{
 assert.ok(main.includes('NSString*diagLineText=[self.state[@"diagLine"]'),'the detail branch must read diagLine from the snapshot');
 assert.ok(main.includes('[self label:diagLineText size:12 bold:NO color:[self muted]]'),'the diagnostic line must render as a small muted label');
 assert.ok(main.includes('diagH=MIN(34,MAX(16,diagLabel.frame.size.height))'),'the diagnostic line must be height-capped at two lines');
});

test('native diagnostics page renders the log with copy and clear',()=>{
 assert.ok(main.includes('else if([page isEqualToString:@"diagnostics"])'),'a native diagnostics page branch must exist');
 assert.ok(main.includes('[self addHeading:@"播放诊断" y:y]'),'the diagnostics page must have its heading');
 assert.ok(main.includes('action:@"diagnostics-copy"'),'the diagnostics page must offer copy');
 assert.ok(main.includes('action:@"diagnostics-clear"'),'the diagnostics page must offer clear');
 assert.ok(main.includes('NSArray*diagEntries=[self.state[@"diagnostics"]'),'the diagnostics page must read the log array from the snapshot');
 assert.ok(main.includes('entry[@"kindLabel"]'),'each row must show the readable event label');
 assert.ok(main.includes('暂无播放记录，播放一次视频后这里会显示事件时间线'),'the empty state must explain when entries appear');
});

test('native navigation reaches the diagnostics page and back',()=>{
 assert.ok(main.includes('action:@"page" data:@{@"id":@"diagnostics"}'),'settings must link to the diagnostics page');
 assert.ok(main.includes('[page isEqualToString:@"diagnostics"]?@{@"id":@"me"}:@{}'),'the diagnostics back button must return to 我的');
 assert.ok(main.includes('self.bottomBar.hidden=detail||[self.state[@"page"] isEqualToString:@"collection"]||[self.state[@"page"] isEqualToString:@"diagnostics"]'),'the bottom bar must be hidden on the diagnostics page');
 assert.ok(main.includes('([page isEqualToString:@"saved"]||[page isEqualToString:@"settings"]||[page isEqualToString:@"diagnostics"])'),'the 我的 tab must stay selected on the diagnostics page');
});
