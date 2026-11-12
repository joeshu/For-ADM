import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  lineHealthKey,
  lineHealthScore,
  recordLineOutcome,
  orderLinesByHealth,
  computeResumeStartAt,
  shouldAutoSkipOutro,
} from '../Web/player-controller.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('line health scoring ranks fast reliable lines above recently failed lines', () => {
  let health = {};
  const slowLine = {siteId: 's1', name: '慢线'};
  const fastLine = {siteId: 's2', name: '快线'};
  const brokenLine = {siteId: 's3', name: '坏线'};

  health = recordLineOutcome(health, 'kkapp', slowLine, {ok: true, latencyMs: 3200});
  health = recordLineOutcome(health, 'kkapp', fastLine, {ok: true, latencyMs: 180});
  health = recordLineOutcome(health, 'kkapp', fastLine, {ok: true, latencyMs: 220});
  health = recordLineOutcome(health, 'kkapp', brokenLine, {ok: false});

  assert.ok(
    lineHealthScore(health, 'kkapp', fastLine) > lineHealthScore(health, 'kkapp', slowLine),
    'faster & higher-success line must outrank slower line'
  );
  assert.ok(
    lineHealthScore(health, 'kkapp', slowLine) > lineHealthScore(health, 'kkapp', brokenLine),
    'working line must outrank recently failed line'
  );

  const lines = [
    {siteId: 's0', name: '当前线'},
    brokenLine,
    slowLine,
    fastLine,
    {siteId: 's4', name: '试看线', preview: true},
  ];
  const ordered = orderLinesByHealth(lines, 0, '', health, 'kkapp', []);
  assert.equal(ordered[0], 0, 'explicitly selected line must stay first');
  assert.equal(ordered[1], 3, 'healthy fast line must be ranked first among backups');
  assert.ok(!ordered.includes(4), 'preview lines must be excluded from backup order');
  assert.equal(lineHealthKey('kkapp', fastLine), 'kkapp:s2');
});

test('computeResumeStartAt resets finished episodes to 0 and preserves active mid-episode resume', () => {
  assert.equal(computeResumeStartAt({preview: true, time: 120, duration: 2400}), 0);
  assert.equal(computeResumeStartAt({preview: false, time: 2396, duration: 2400}), 0);
  assert.equal(computeResumeStartAt({preview: false, time: 640, duration: 2400}), 640);
  assert.equal(computeResumeStartAt({preview: false, time: 0, duration: 2400}), 0);
});

test('shouldAutoSkipOutro triggers only on full-length non-preview episodes within threshold', () => {
  assert.equal(shouldAutoSkipOutro({preview: true, outroSkipped: false, autoNext: true, skipOutroSeconds: 90, duration: 2400, currentTime: 2350}), false);
  assert.equal(shouldAutoSkipOutro({preview: false, outroSkipped: true, autoNext: true, skipOutroSeconds: 90, duration: 2400, currentTime: 2350}), false);
  assert.equal(shouldAutoSkipOutro({preview: false, outroSkipped: false, autoNext: false, skipOutroSeconds: 90, duration: 2400, currentTime: 2350}), false);
  assert.equal(shouldAutoSkipOutro({preview: false, outroSkipped: false, autoNext: true, skipOutroSeconds: 90, duration: 500, currentTime: 450}), false);
  assert.equal(shouldAutoSkipOutro({preview: false, outroSkipped: false, autoNext: true, skipOutroSeconds: 90, duration: 2400, currentTime: 2200}), false);
  assert.equal(shouldAutoSkipOutro({preview: false, outroSkipped: false, autoNext: true, skipOutroSeconds: 90, duration: 2400, currentTime: 2320}), true);
});

test('Phase 1-3 architecture: dedicated HLSProxy queue & prefetch, incremental detail updates, AirPlay, SYMediaEngine, and offline cache', () => {
  const hls = read('Sources/HLSProxy.h');
  const main = read('Sources/main.m');
  const cicadaH = read('Sources/SYCicadaLivePlayer.h');
  const mediaEngineH = read('Sources/SYMediaEngine.h');
  const offlineH = read('Sources/SYOfflineCache.h');
  const app = read('Web/app.mjs');

  assert.ok(hls.includes('dispatch_queue_create("com.joeshu.sanyuan.hlsproxy",DISPATCH_QUEUE_SERIAL)'), 'HLSProxy must run on a dedicated serial queue');
  assert.ok(hls.includes('- (void)prefetchLookaheadFromPath:(NSString*)path'), 'HLSProxy must support look-ahead segment prefetching');
  assert.ok(hls.includes('retriesLeft:head?0:1'), 'HLSProxy must retry transient segment fetch errors once');
  assert.ok(main.includes('- (BOOL)applyDetailFastState:(NSDictionary*)next'), 'SYAppScreenController must support incremental detail updates');
  assert.ok(main.includes('self.routePicker=[[AVRoutePickerView alloc]initWithFrame:'), 'SYAppScreenController must expose AirPlay route picker in playerHost');
  assert.ok(main.includes('#import "SYMediaEngine.h"') && main.includes('#import "SYOfflineCache.h"'), 'main.m must integrate SYMediaEngine and SYOfflineCache');
  assert.ok(mediaEngineH.includes('@protocol SYMediaEngine <NSObject>'), 'SYMediaEngine.h must define unified engine protocol');
  assert.ok(cicadaH.includes('<SYMediaEngine>'), 'SYCicadaLivePlayer must conform to SYMediaEngine');
  assert.ok(offlineH.includes('@interface SYOfflineCacheManager : NSObject'), 'SYOfflineCache.h must define SYOfflineCacheManager');
  assert.ok(app.includes("if(shouldAutoSkipOutro({preview:false,outroSkipped:nativeSession.outroSkipped"), 'Native playback progress must honor auto-skip outro');
  assert.ok(app.includes("recordLineOutcome(state.lineHealth,state.site,curLine"), 'app.mjs must record line health outcomes');
  assert.ok(app.includes("act==='player-offline-cache'"), 'app.mjs must support offline episode caching action');
});
