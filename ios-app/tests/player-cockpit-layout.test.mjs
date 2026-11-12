import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

// The cockpit under the detail player must never truncate its labels:
// the 2026-11-12 user screenshot showed every cockpit button cut off with
// an ellipsis ("↺ -1…", "跳过…", "↻ +…", "画面…", "🔊 …") and the rate
// row running off the right edge ("1.5×" half visible). These are
// source-contract tests: buttons wrap to visible rows with short labels,
// and the rate selector is a fitting five-button row, not a hidden scroll.
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('Web/app.mjs'),css=read('Web/app.css');

test('cockpit controls wrap instead of scrolling horizontally',()=>{
 const rule=css.match(/\.cockpit-controls\{[^}]*\}/)?.[0]||'';
 assert.ok(rule.includes('flex-wrap:wrap'),'cockpit-controls must wrap');
 assert.ok(!rule.includes('overflow-x:auto'),'cockpit-controls must not hide buttons behind a horizontal scroll');
 assert.ok(!css.includes('.cockpit-controls::-webkit-scrollbar'),'no hidden-scrollbar rule for the cockpit');
});

test('cockpit buttons use short directional seek labels',()=>{
 assert.ok(app.includes('>↺ -15s</button>'),'seek-back label must read ↺ -15s');
 assert.ok(app.includes('>↻ +15s</button>'),'seek-forward label must read ↻ +15s');
 assert.ok(app.includes('>跳过片头</button>'),'skip-intro label must be the short 跳过片头, not 跳过片头 +90s');
 assert.ok(!app.includes('跳过片头 +${state.skipIntroSeconds}s'),'the long skip-intro label must be gone');
});

test('the cycle-rate button is replaced by a visible rate row',()=>{
 assert.ok(!app.includes('player-cycle-rate'),'the cycle-rate button must be gone');
 assert.ok(!app.includes('cockpit-rate"'),'the cockpit-rate class must be gone');
 assert.ok(app.includes('class="cockpit-rates"'),'a cockpit-rates row must exist under the controls');
 assert.ok(app.includes('[0.75,1,1.25,1.5,2].map(rate=>`<button type="button" class="cockpit-rate-btn'),'the rate row must offer 0.75/1/1.25/1.5/2');
 assert.ok(app.includes('data-act="playback-rate-btn"'),'rate buttons must reuse the live playback-rate-btn action');
});

test('rate buttons share the row equally so none runs off-screen',()=>{
 const rule=css.match(/\.cockpit-rate-btn\{[^}]*\}/)?.[0]||'';
 assert.ok(rule.includes('flex:1'),'rate buttons must share the row width');
 assert.ok(rule.includes('min-width:0'),'rate buttons must be allowed to shrink to fit');
 assert.ok(rule.includes('text-overflow:ellipsis'),'a too-long rate label must ellipsize inside its own button, not push the row off-screen');
 const active=css.match(/\.cockpit-rate-btn\.active\{[^}]*\}/)?.[0]||'';
 assert.ok(active.length>0,'the active rate button must have a distinct active style');
 assert.ok(css.includes('html[data-theme="white"] .detail-content .cockpit-rate-btn.active'),'the active rate button must be visible in the white theme too');
});

test('no cockpit button label is long enough to truncate at phone width',()=>{
 const cockpit=app.slice(app.indexOf('<div class="cockpit-controls">'),app.indexOf('<div class="cockpit-telemetry">'));
 const plain=cockpit.replace(/\$\{[^}]*\}/g,'');
 const labels=[...plain.matchAll(/>([^<>]+)<\/button>/g)].map(m=>m[1].trim()).filter(Boolean);
 assert.ok(labels.length>=7,`expected at least 7 cockpit labels, got ${labels.length}: ${labels.join(' | ')}`);
 for(const label of labels)assert.ok(label.length<=8,`cockpit label too long to fit without truncation: ${label}`);
});

// The detail page the user actually sees is the NATIVE screen
// (SYAppScreenController in Sources/main.m), not the Web cockpit above:
// the 2026-11-12 screenshot showed the same two defects there — five
// truncated buttons ("↺ -1…", "跳过…", "↻ +…", "画面…", "🔊 …") and a
// rate row running off-screen. These are source-contract tests on main.m.
const main=read('Sources/main.m');
const detailCockpit=(()=>{
 const start=main.indexOf('if([self.state[@"playURLs"] count]>0){');
 assert.ok(start>=0,'native detail cockpit must exist');
 return main.slice(start,main.indexOf('[self addFeaturePoster:m',start));
})();

test('native cockpit splits into two rows instead of five squeezed buttons',()=>{
 assert.ok(detailCockpit.includes('CGFloat fourth=(w-50)/4.0;'),'first row must be four buttons at (w-50)/4');
 assert.ok(!detailCockpit.includes('CGFloat fifth=(w-56)/5.0;\n   SYLiveActionButton*rw='),'the five-button single row must be gone');
 assert.ok(detailCockpit.includes('CGFloat half=(w-40)/2.0;'),'second row must be two half-width buttons');
});

test('native cockpit buttons shrink instead of truncating',()=>{
 const shrink=(detailCockpit.match(/adjustsFontSizeToFitWidth=YES/g)||[]).length;
 assert.ok(shrink>=5,`expected 4 control buttons plus the rate loop with adjustsFontSizeToFitWidth, got ${shrink}`);
});

test('native rate row is five equal fixed buttons, not addChips',()=>{
 assert.ok(!detailCockpit.includes('addChips:@[@{@"name":@"0.75×"'),'the rate row must not use addChips (its width formula overflows the screen)');
 assert.ok(detailCockpit.includes('CGFloat fifth=(w-56)/5.0;NSString*selectedRate='),'the rate row must be five equal buttons at (w-56)/5');
 assert.ok(detailCockpit.includes('rateBtn.frame=CGRectMake(16+ri*(fifth+6),y,fifth,38)'),'rate buttons must tile the full width with 6pt gaps');
 assert.ok(detailCockpit.includes('if([rateItem[@"id"] isEqualToString:selectedRate])'),'the active rate must be highlighted like a selected chip');
});

test('native cockpit second row adds the sleep timer next to mute',()=>{
 assert.ok(detailCockpit.includes('action:@"player-sleep-timer"'),'sleep timer button must exist in the native cockpit');
 assert.ok(detailCockpit.includes('self.state[@"sleepTimerMode"]'),'sleep label must read the synced sleepTimerMode');
 assert.ok(detailCockpit.includes('@"🌙 播完本集"'),'episode sleep mode must show 播完本集');
 assert.ok(detailCockpit.includes('@"🔇 已静音":@"🔊 声音"'),'mute label must still reflect playerMuted');
});
