import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

// Parallel recovery verification + line-trial status (P1 C1). Recovery
// used to re-verify every candidate address one by one (up to 8s each)
// with only the playError line as feedback, so a fully dead line took
// 20–40s of silent switching. Candidates are now verified two at a
// time, known-dead addresses are skipped via failedURLs, already
// verified ones are reused via verifiedMeta, and the player shows
// which line is being tried.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs');
const recovery=app.slice(app.indexOf('async function recoverPlayback'),app.indexOf('native.onPlaybackEvent='));

test('candidate addresses are verified two at a time',()=>{
 assert.ok(recovery.includes('for(let base=0;base<candidates.length;base+=2){'),'candidates must be processed in batches of two');
 assert.ok(recovery.includes('const batch=candidates.slice(base,base+2);'),'each batch must hold at most two candidates');
 assert.ok(recovery.includes('await Promise.all(batch.map('),'each batch must verify its candidates in parallel');
 assert.ok(recovery.includes('candidate.verifiedMeta?Promise.resolve('),'already-verified candidates must not be re-verified');
});

test('known-dead addresses are skipped, not re-verified',()=>{
 assert.ok(recovery.includes("if(!candidate?.url||recovery.failedURLs.has(candidate.url))continue;"),'addresses in failedURLs must be skipped');
 assert.ok(recovery.includes('recovery.failedURLs.add(candidate.url);candidates.push({index,candidate});'),'tried addresses must be recorded as failed before verifying');
});

test('the first verified candidate wins and playback resumes from it',()=>{
 assert.ok(recovery.includes('state.playIndex=index;'),'the winning candidate must become the current address');
 assert.ok(recovery.includes("state.playError='';state.playStatus='';"),'a verified candidate must clear the recovery status');
 assert.ok(recovery.includes("if(native.native())await launchNativePlayer();"),'a verified candidate must resume native playback');
});

test('line trials show their number while switching',()=>{
 assert.ok(recovery.includes('let lineTries=0;'),'line attempts must be counted');
 assert.ok(recovery.includes("lineTries++;"),'each tried line must bump the counter');
 assert.ok(recovery.includes("state.playStatus='正在试第 '+lineTries+' 条线路…';"),'the status must name the line being tried');
 assert.ok(recovery.includes('state.playLoadingText=state.playStatus;'),'the native loading indicator must show the same trial status');
});

test('giving up clears the loading indicator',()=>{
 assert.ok(recovery.includes("recovery.running=false;state.playLoading=false;state.playError='当前播放线路中断"),'giving up must stop the loading indicator');
 assert.ok(recovery.includes("state.playLoading=false;state.playError='原站返回了权限或账号限制"),'an authorization failure must also stop the loading indicator');
});
