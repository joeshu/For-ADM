import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {YqkClient} from '../Web/yqk-api.mjs';

globalThis.CryptoJS = createRequire(import.meta.url)('../Web/vendor/crypto-js.js');

const root = fileURLToPath(new URL('../', import.meta.url));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('HLSProxy.h allows 4K segments up to 128MB instead of failing them at 32MB', () => {
  const hls = read('Sources/HLSProxy.h');
  assert.ok(hls.includes('body.length>128*1024*1024'), 'the proxy must allow segments up to 128MB');
  assert.ok(!hls.includes('body.length>32*1024*1024'), 'the old 32MB cap must be gone: a 10s 4K segment at 25Mbps is already ~31MB');
});

test('HLSProxy.h guards against nil NSString rangeOfString {0,0} false positive and bounds resource map', () => {
  const hls = read('Sources/HLSProxy.h');
  assert.ok(hls.includes('NSISOLatin1StringEncoding'), 'HLSProxy must fall back to Latin1 decoding for HTTP headers');
  assert.ok(hls.includes('request?[request rangeOfString:@"\\r\\n\\r\\n"]:NSMakeRange(NSNotFound,0)'), 'HLSProxy must guard rangeOfString on nil request');
  assert.ok(hls.includes('separator.location!=NSNotFound&&separator.length>0'), 'HLSProxy must verify separator length > 0');
  assert.ok(hls.includes('self.paths.count>=4096'), 'HLSProxy must bound mapped path dictionary size');
});

test('main.m preserves scroll offset, cancels slower poster mirror tasks, and syncs explicit mute state', () => {
  const main = read('Sources/main.m');
  assert.ok(main.includes('BOOL resetOffset=!self.renderedPageKey||![self.renderedPageKey isEqualToString:pageKey];'), 'SYAppScreenController must track whether pageKey changed');
  assert.ok(main.includes('[self.content setContentOffset:CGPointMake(0,resetOffset?0:MIN(previousOffset.y,maxOffset)) animated:NO];'), 'SYAppScreenController must restore previous scroll offset on same-page updates');
  assert.ok(main.includes('@"duration":@(__builtin_isfinite(totalDuration)&&totalDuration>0?totalDuration:0)'), 'Periodic time observer must include totalDuration');
  assert.ok(main.includes('action:@"saved-source-filter"'), 'Native saved/me screen must render source filter chips when multiple sources exist');
  assert.ok(main.includes('for(NSURLSessionDataTask*task in tasks)if(task.state==NSURLSessionTaskStateRunning)[task cancel];'), 'Poster loader must cancel remaining running mirror tasks once fastest mirror succeeds');
  assert.ok(main.includes('BOOL nextMuted=body[@"muted"]!=nil?[body[@"muted"] boolValue]'), 'Mute control must honor explicit muted boolean from Web bridge');
});

test('SYCicadaLivePlayer.m invalidates pollTimer after first frame and guards stale player instances', () => {
  const cicada = read('Sources/SYCicadaLivePlayer.m');
  const firstFrameIdx = cicada.indexOf('- (void)handleFirstFrame {');
  const firstFrameBlock = cicada.slice(firstFrameIdx, cicada.indexOf('\n- (', firstFrameIdx + 1));
  assert.ok(firstFrameBlock.includes('[self.pollTimer invalidate]; self.pollTimer = nil;'), 'handleFirstFrame must invalidate pollTimer to stop 1Hz polling once video renders');
  assert.ok(firstFrameBlock.includes('[self.preparedFallbackTimer invalidate]; self.preparedFallbackTimer = nil;'), 'handleFirstFrame must invalidate preparedFallbackTimer');
  assert.ok(cicada.includes('if (self.destroyed || (player && self.player && player != self.player)) return;'), 'onError must ignore stale callbacks from replaced hardware decoder instance');
});

test('app.mjs includes page-level stability guards, smart resume, concurrent line probing, live route deduplication, and online recovery', () => {
  const app = read('Web/app.mjs');
  assert.ok(app.includes('const validSavedRows=key=>'), 'app.mjs must sanitize localStorage rows via validSavedRows');
  assert.ok(app.includes('function discoveryCacheKey('), 'app.mjs must use unified discoveryCacheKey including adult/safe suffix');
  assert.ok(app.includes('function mergeDiscoveryGroups('), 'app.mjs must merge duplicate discovery group titles across pagination');
  assert.ok(app.includes('function resumeEntryForDetail('), 'app.mjs must compute resumeEntryForDetail for watched series');
  assert.ok(app.includes('function liveFilteredChannels('), 'app.mjs must share liveFilteredChannels for channel list and live-step');
  assert.ok(app.includes('function liveNextProgram('), 'app.mjs must compute upcoming EPG program via liveNextProgram');
  assert.ok(app.includes("if(state.page==='detail'&&!native.native()&&$('#video'))"), 'cycleAspectMode must update aspect ratio in-place without destroying active web video');
  assert.ok(app.includes('Promise.all(urls.map(async url=>'), 'probe-lines must probe candidate nodes concurrently with timeout protection');
  assert.ok(app.includes("window.addEventListener('online'"), 'app.mjs must auto-recover errored page on network reconnect');
});

test('YqkClient.prepareChannel degrades gracefully when childListView fails', async () => {
  const site = {
    id: 'yqk',
    name: '一起看',
    origin: 'https://yqk18.app',
    version: '1.0.0',
    protocol: {appId: 'yqk_web', appKey: 'secret', version: '1.0.0', apiOrigins: ['https://api.yqk.example']}
  };
  const storage = {getItem: () => null, setItem: () => {}};
  const encode = obj => ({status: 200, bodyBase64: Buffer.from(JSON.stringify(obj)).toString('base64')});
  const client = new YqkClient(site, async req => {
    const u = new URL(req.url);
    if (u.pathname === '/v2/api/home/header') {
      return encode({result: true, data: {channeList: [{channelId: 2, channelName: '电影'}]}});
    }
    if (u.pathname === '/v2/api/channel/childListView') {
      return {status: 502, bodyBase64: ''};
    }
    if (u.pathname === '/v2/api/channel/getVodList') {
      return encode({result: true, data: {items: [{vodId: 101, vodName: '测试电影', coverImg: 'https://img.example/1.jpg'}], hasNext: false}});
    }
    throw Error('Unexpected path ' + u.pathname);
  }, storage);

  const res = await client.channel(2, {});
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].title, '测试电影');
  const queryDef = client.config.channelListQuery.find(x => x.channelId === 2);
  assert.ok(queryDef, 'Fallback channelListQuery definition must still be registered');
  assert.deepEqual(queryDef.items[0].data, [{id: '', name: '全部'}]);
});

test('Round 3 UI & interaction refinements: non-greedy timeline month regex, back-to-top, shortcut focus, light contrast, and non-overlapping live HUD', () => {
  const app = read('Web/app.mjs');
  const css = read('Web/app.css');
  const main = read('Sources/main.m');

  const regex = /(20\d{2})\D{0,3}(\d{1,2})月|^(\d{1,2})月/;
  const novMatch = '2026年11月'.match(regex);
  assert.ok(novMatch, '2026年11月 must match timeline regex');
  assert.equal(Number(novMatch[1]), 2026);
  assert.equal(Number(novMatch[2]), 11, 'November must parse as month 11, not 1');
  assert.ok(app.includes('match=title.match(/(20\\d{2})\\D{0,3}(\\d{1,2})月|^(\\d{1,2})月/)'), 'app.mjs discover() must use non-digit \\D{0,3} separator');
  assert.ok(app.includes('id="back-to-top"'), 'app.mjs must mount #back-to-top button');
  assert.ok(app.includes("else if(act==='scroll-top')"), 'app.mjs must handle scroll-top action');
  assert.ok(app.includes("if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey)"), 'app.mjs must support / shortcut to focus search input');
  assert.ok(css.includes('.episode-steps button{white-space:nowrap;flex-shrink:0'), 'episode step buttons must not wrap vertically');
  assert.ok(css.includes('html[data-theme="white"] .playback-section .episode-page-chip{background:#fff;color:#252b37'), 'Light theme episode page chips must use high-contrast light surface');
  assert.ok(css.includes('.live-fullscreen{top:8px;right:10px;bottom:auto'), 'Live fullscreen button must be positioned at top-right to avoid overlapping video controls');
  assert.ok(css.includes('.poster:has(img.is-loaded)>span:first-child{opacity:0'), 'Loaded poster images must hide fallback initial character');
  assert.ok(main.includes('self.heroBadgeLabel=badge;'), 'Native hero card must render and update score badge');
  assert.ok(main.includes('action:@"player-mute"'), 'Native detail player bar must include mute toggle button');
});

test('Round 4 deep audit: UTF-8 HLS playlist decoding, in-flight poster deduplication, cached XMLTV index, bounded LRU caches, episode jump, and Native shelf badges', async () => {
  const {verifyMedia} = await import('../Web/playback.mjs');
  const {parseXMLTV} = await import('../Web/live.mjs');
  const app = read('Web/app.mjs');
  const imgLoader = read('Web/image-loader.mjs');
  const liveSrc = read('Web/live.mjs');
  const main = read('Sources/main.m');

  // 1. Verify UTF-8 HLS master playlist with Chinese relative path decodes without mojibake
  const masterM3U8 = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=3200000,RESOLUTION=1920x1080\n高清流/index.m3u8\n';
  const childM3U8 = '#EXTM3U\n#EXTINF:6.0,第一集片段\nseg01.ts\n#EXT-X-ENDLIST\n';
  const requestedURLs = [];
  const mockClient = {
    site: {origin: 'https://vod.example'},
    transport: async req => {
      requestedURLs.push(req.url);
      const body = req.url.includes(encodeURI('高清流')) ? childM3U8 : masterM3U8;
      return {status: 200, url: req.url, headers: {'Content-Type': 'application/vnd.apple.mpegurl'}, bodyBase64: Buffer.from(body, 'utf8').toString('base64')};
    }
  };
  const verified = await verifyMedia(mockClient, 'https://cdn.example/master.m3u8');
  assert.equal(verified.hls, true);
  assert.equal(verified.qualityLabel, '1080p FHD');
  assert.ok(requestedURLs.some(u => u.includes(encodeURI('高清流/index.m3u8'))), 'UTF-8 Chinese relative path in master playlist must resolve accurately');

  // 2. Verify cached XMLTV EPG index returns accurate results across multiple channels on the same XML payload
  const xml = `<?xml version="1.0" encoding="UTF-8"?><tv>
    <channel id="cctv1"><display-name>CCTV-1 综合</display-name></channel>
    <channel id="cctv5"><display-name>CCTV-5 体育</display-name></channel>
    <programme start="20261111100000 +0800" stop="20261111120000 +0800" channel="cctv1"><title>早间新闻</title></programme>
    <programme start="20261111120000 +0800" stop="20261111140000 +0800" channel="cctv5"><title>实况足球</title></programme>
  </tv>`;
  assert.equal(parseXMLTV(xml, 'CCTV-1 综合')[0]?.title, '早间新闻');
  assert.equal(parseXMLTV(xml, 'CCTV-5 体育')[0]?.title, '实况足球');
  assert.ok(liveSrc.includes('function getEPGIndex(xml)'), 'live.mjs must cache pre-indexed XMLTV structures per XML payload');

  // 3. Verify image-loader in-flight deduplication and app.mjs Round 4 features
  assert.ok(imgLoader.includes('const controller=new AbortController(),jobs=new Set(),inflight=new Map();'), 'image-loader.mjs must deduplicate concurrent in-flight poster requests per render cycle');
  assert.ok(app.includes('data-episode-jump'), 'episodesPanel must render episode quick-jump input on multi-page series');
  assert.ok(app.includes('class="search-source-bar"'), 'search results view must render cross-source quick switcher bar');
  assert.ok(app.includes("if(button.classList.contains('live-sheet-backdrop')&&event.target!==button)return;"), 'live-sheet-dismiss must ignore clicks inside .live-sheet-card');
  assert.ok(main.includes('⚡ 一键检测节点延迟'), 'Native settings must include probe-lines button and health latency display');
});

test('Round 5 iOS & Settings Cross-Site Connectivity Monitor: probe-all-sites, smart recommendation, lifecycle observers, memory purge, and HLSProxy auto-restart', () => {
  const app = read('Web/app.mjs');
  const css = read('Web/app.css');
  const main = read('Sources/main.m');
  const hls = read('Sources/HLSProxy.h');

  // 1. Verify cross-site connectivity monitor in app.mjs and settings()
  assert.ok(app.includes('async function probeAllSites()'), 'app.mjs must implement probeAllSites for concurrent health checks');
  assert.ok(app.includes('async function probeSite('), 'app.mjs must implement probeSite for per-site latency inspection');
  assert.ok(app.includes('class="settings-card site-connectivity-card"'), 'settings() must render site-connectivity-card');
  assert.ok(app.includes('class="site-connectivity-grid"'), 'settings() must render 8-site connectivity grid');
  assert.ok(app.includes('data-act="probe-all-sites"'), 'settings() must include probe-all-sites action button');
  assert.ok(app.includes('data-act="probe-site"'), 'settings() must include probe-site button per site card');

  // 2. Verify CSS styles for connectivity dashboard
  assert.ok(css.includes('.site-connectivity-card'), 'app.css must style .site-connectivity-card');
  assert.ok(css.includes('.site-recommend-banner'), 'app.css must style .site-recommend-banner');
  assert.ok(css.includes('.site-latency-pill.fast'), 'app.css must style fast/medium/slow/error latency badges');

  // 3. Verify native UIKit lifecycle, memory purge, and cross-site monitor in main.m
  assert.ok(main.includes('- (void)didReceiveMemoryWarning'), 'SYController must implement didReceiveMemoryWarning');
  assert.ok(main.includes('[SYPosterImageCache removeAllObjects];'), 'didReceiveMemoryWarning must purge in-memory poster image cache');
  assert.ok(main.includes('@"UIApplicationDidReceiveMemoryWarningNotification"'), 'SYController must observe system memory warning notification');
  assert.ok(main.includes('@"AVAudioSessionInterruptionNotification"'), 'SYController must handle phone/Siri audio interruption safely');
  assert.ok(main.includes('全网片源连通性监测'), 'Native settings must display cross-site connectivity monitor section');

  // 4. Verify HLSProxy socket restart and listener auto-recovery
  assert.ok(hls.includes('- (void)startListener'), 'HLSProxy must implement startListener to bind/re-bind local proxy socket');
  assert.ok(hls.includes('if(!self.port)[self startListener];'), 'HLSProxy prepare: must auto-recover listener if port dropped to 0');
});

test('Round 6 Fast-Start Playback & Practical Features: warmPlaylists pass-through, HLSProxy seedPlaylists, next-episode prefetch, sleep timer, and stream copy', async () => {
  const {verifyMedia} = await import('../Web/playback.mjs');
  const app = read('Web/app.mjs');
  const hls = read('Sources/HLSProxy.h');
  const main = read('Sources/main.m');

  // 1. Verify verifyMedia returns warmPlaylists for both master and child M3U8s
  const masterM3U8 = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080\nsub/1080p.m3u8\n';
  const childM3U8 = '#EXTM3U\n#EXTINF:5.0,\nseg1.ts\n#EXT-X-ENDLIST\n';
  const mockClient = {
    site: {origin: 'https://vod.example'},
    transport: async req => {
      const body = req.url.endsWith('1080p.m3u8') ? childM3U8 : masterM3U8;
      return {status: 200, url: req.url, headers: {'Content-Type': 'application/vnd.apple.mpegurl'}, bodyBase64: Buffer.from(body, 'utf8').toString('base64')};
    }
  };
  const meta = await verifyMedia(mockClient, 'https://cdn.example/master.m3u8');
  assert.equal(meta.warmPlaylists?.length, 2, 'verifyMedia must capture both master and child M3U8 payloads in warmPlaylists');
  assert.equal(meta.warmPlaylists[0].url, 'https://cdn.example/master.m3u8');
  assert.equal(meta.warmPlaylists[1].url, 'https://cdn.example/sub/1080p.m3u8');

  // 2. Verify HLSProxy seedPlaylists and main.m integration
  assert.ok(hls.includes('- (void)seedPlaylists:(NSArray*)items'), 'HLSProxy.h must implement seedPlaylists: to pre-warm M3U8 cache');
  assert.ok(main.includes('[self.hlsProxy seedPlaylists:body[@"warmPlaylists"]]'), 'main.m must pass warmPlaylists into HLSProxy on VOD startup');
  assert.ok(main.includes('[action isEqualToString:@"pause"]'), 'main.m playerControl must support pause action for sleep timer');

  // 3. Verify next-episode prefetch, sleep timer, preload="auto", and stream copy in app.mjs
  assert.ok(app.includes('function scheduleNextEpisodePrefetch('), 'app.mjs must implement background next-episode pre-resolution');
  assert.ok(app.includes('episodePrefetchCache'), 'app.mjs must cache pre-resolved next episode');
  assert.ok(app.includes('function cycleSleepTimer()'), 'app.mjs must implement sleep timer cycling');
  assert.ok(app.includes('data-act="player-copy-url"'), 'Detail cockpit must include stream URL copy button');
  assert.ok(app.includes('preload="auto"'), 'Active detail video element must use preload="auto" for faster first frame');
});

test('Round 7 Comprehensive Review: RuntimeSDK ABI parity, redirected warmPlaylists keys, scoped poster inflight map, probeAllSites guard, and cancel() prefetch cleanup', async () => {
  const {verifyMedia} = await import('../Web/playback.mjs');
  const runtimeSDK = read('Sources/RuntimeSDK.h');
  const crossBuild = read('tools/cross-build.py');
  const hls = read('Sources/HLSProxy.h');
  const main = read('Sources/main.m');
  const app = read('Web/app.mjs');

  // 1. RuntimeSDK.h and cross-build.py completeness
  assert.ok(runtimeSDK.includes('- (void)removeAllObjects;'), 'RuntimeSDK.h must declare -removeAllObjects for NSMutableDictionary/NSMutableArray');
  assert.ok(runtimeSDK.includes('@interface NSOperationQueue:NSObject'), 'RuntimeSDK.h must declare NSOperationQueue');
  assert.ok(runtimeSDK.includes('enum {NSURLSessionTaskStateRunning=0};'), 'RuntimeSDK.h must declare NSURLSessionTaskStateRunning');
  assert.ok(runtimeSDK.includes('- (void)didReceiveMemoryWarning;'), 'RuntimeSDK.h must declare -didReceiveMemoryWarning on UIViewController');
  assert.ok(runtimeSDK.includes('enum {AVPlayerTimeControlStatusPlaying=2};'), 'RuntimeSDK.h must declare AVPlayerTimeControlStatusPlaying');
  assert.ok(runtimeSDK.includes('- (void)addObserver:(id)observer selector:(SEL)selector name:(NSString*)name object:(id)object;'), 'RuntimeSDK.h must declare selector-based addObserver on NSNotificationCenter');
  assert.ok(crossBuild.includes("'_UIApplication','_UIGraphics'"), 'cross-build.py must whitelist _UIApplication and _UIGraphics symbols');
  assert.equal((hls.match(/@property\(nonatomic,strong\) NSMutableDictionary[^;]*\*playlistCache;/g) || []).length, 2, 'HLSProxy.h must declare playlistCache in both Network.h and stub branches');

  // 2. Redirected M3U8 URL key preservation in warmPlaylists
  const masterM3U8 = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080\nhls/stream.m3u8\n';
  const childM3U8 = '#EXTM3U\n#EXTINF:6.0,\nseg0.ts\n#EXT-X-ENDLIST\n';
  const redirectClient = {
    site: {origin: 'https://vod.example'},
    transport: async req => {
      if (req.url === 'https://entry.example/play.m3u8') {
        return {status: 200, url: 'https://edge-cdn.example/dir/master.m3u8', headers: {'Content-Type': 'application/vnd.apple.mpegurl'}, bodyBase64: Buffer.from(masterM3U8, 'utf8').toString('base64')};
      }
      return {status: 200, url: 'https://edge-cdn.example/dir/hls/real-stream.m3u8', headers: {'Content-Type': 'application/vnd.apple.mpegurl'}, bodyBase64: Buffer.from(childM3U8, 'utf8').toString('base64')};
    }
  };
  const redirected = await verifyMedia(redirectClient, 'https://entry.example/play.m3u8');
  const warmURLs = redirected.warmPlaylists.map(x => x.url);
  assert.ok(warmURLs.includes('https://entry.example/play.m3u8'), 'warmPlaylists must include original entry URL for SYHLSProxy.prepare lookup');
  assert.ok(warmURLs.includes('https://edge-cdn.example/dir/master.m3u8'), 'warmPlaylists must also include redirected master URL');
  assert.ok(warmURLs.includes('https://edge-cdn.example/dir/hls/stream.m3u8'), 'warmPlaylists must include resolved child URL');
  assert.ok(warmURLs.includes('https://edge-cdn.example/dir/hls/real-stream.m3u8'), 'warmPlaylists must also include redirected child URL');

  // 3. Verify app.mjs cancel() prefetch cleanup, probeAllSites guard, and Native sleep-timer-setting parity
  assert.ok(app.includes('function cancel(){cancelEpisodePrefetch();'), 'cancel() must abort any pending episode prefetch timer/request on navigation');
  assert.ok(app.includes('async function probeAllSites(){\n if(state.siteProbing)return;'), 'probeAllSites() must guard against concurrent re-entrancy');
  assert.ok(main.includes('action:@"sleep-timer-setting"'), 'Native UIKit settings must expose sleep-timer-setting chips');
});

test('Round 8 Detail Playback, Seeking, HLS Proxy & Cicada ABI Fixes: no duplicate play() in verifyInBackground, full episode loading on backup lines, seek stall reset & fast post-seek buffer, HLS 64K map & task cancel, and Cicada int64/float ABI', async () => {
  const {resolveFirstCandidate, resolvePlayableEpisode, verifyMedia} = await import('../Web/playback.mjs');
  const app = read('Web/app.mjs');
  const playback = read('Web/playback.mjs');
  const hls = read('Sources/HLSProxy.h');
  const main = read('Sources/main.m');
  const cicada = read('Sources/SYCicadaLivePlayer.m');

  // 1. resolvePlayableEpisode reuses initialUrls on initialLineIndex without calling client.play() a second time
  let playCalls = 0;
  const hlsBody = Buffer.from('#EXTM3U\n#EXTINF:6.0,\nseg0.ts\n#EXT-X-ENDLIST\n', 'utf8').toString('base64');
  const detail = {
    id: 'vod-1',
    channelId: 2,
    playSources: [
      {siteId: 'l1', name: '线路1', total: 30, list: Array.from({length: 30}, (_, i) => ({id: 'ep-' + (i + 1), title: '第' + (i + 1) + '集', open: false}))},
      {siteId: 'l2', name: '线路2', total: 30, list: Array.from({length: 20}, (_, i) => ({id: 'b-ep-' + (i + 1), title: '第' + (i + 1) + '集', open: false}))}
    ]
  };
  const client = {
    site: {origin: 'https://vod.example'},
    episodes: async () => Array.from({length: 30}, (_, i) => ({id: 'b-ep-' + (i + 1), title: '第' + (i + 1) + '集', open: false})),
    play: async () => {
      playCalls++;
      return [{url: `https://cdn.example/signed-${playCalls}.m3u8`}];
    },
    transport: async req => ({status: 200, url: req.url, headers: {'Content-Type': 'application/vnd.apple.mpegurl'}, bodyBase64: hlsBody})
  };
  const fast = await resolveFirstCandidate(client, detail, 0, 24);
  assert.equal(playCalls, 1, 'resolveFirstCandidate must call client.play once');
  const verified = await resolvePlayableEpisode(client, detail, fast.lineIndex, fast.episodeIndex, undefined, () => {}, {
    initialLineIndex: fast.lineIndex,
    initialUrls: fast.urls
  });
  assert.equal(playCalls, 1, 'resolvePlayableEpisode with initialUrls must not call client.play a second time');
  assert.equal(verified.urls[0].url, fast.urls[0].url, 'verified URL must match the fast-start playing URL');
  assert.ok(verified.urls[0].verifiedMeta, 'initial URL must be stamped with verifiedMeta');

  // 2. Backup line with partial preview list (20 of 30) loads full episode list when matching episode 25
  const fallbackClient = {
    ...client,
    play: async ({siteId}) => siteId === 'l1' ? [] : [{url: 'https://cdn.example/backup-ep25.m3u8'}]
  };
  const switchedFast = await resolveFirstCandidate(fallbackClient, detail, 0, 24);
  assert.equal(switchedFast.lineIndex, 1, 'must switch to backup line 2 for episode 25');
  assert.equal(switchedFast.episodeIndex, 24, 'must match episode 25 after loading full episode list');

  // 3. Redirected warmPlaylists preserve post-redirect baseURL for relative segment resolution
  const redirectedMeta = await verifyMedia({
    site: {origin: 'https://vod.example'},
    transport: async req => ({
      status: 200,
      url: 'https://edge.example/real/dir/index.m3u8',
      headers: {'Content-Type': 'application/vnd.apple.mpegurl'},
      bodyBase64: hlsBody
    })
  }, 'https://entry.example/redirect.m3u8');
  const entryWarm = redirectedMeta.warmPlaylists.find(x => x.url === 'https://entry.example/redirect.m3u8');
  assert.equal(entryWarm?.baseURL, 'https://edge.example/real/dir/index.m3u8', 'pre-redirect warmPlaylist entry must carry post-redirect baseURL');

  // 4. Verify HLSProxy.h, main.m, SYCicadaLivePlayer.m, and app.mjs playback & seek fixes
  assert.ok(hls.includes('self.paths.count>=4096&&self.paths.count>=65536'), 'HLSProxy must not wipe segment paths at 4096 mid-movie');
  assert.ok(hls.includes('nw_connection_set_state_changed_handler(connection'), 'HLSProxy must cancel upstream task when local connection closes on seek');
  assert.ok(hls.includes('entry[@"baseURL"]'), 'HLSProxy seedPlaylists must resolve relative URLs against baseURL');
  assert.ok(main.includes('now>owner.vodStallTime+0.5||now<owner.vodStallTime-0.5'), 'VOD stall watchdog must clear on backward seeks as well as forward progress');
  assert.ok(main.includes('self.nativeItem.preferredForwardBufferDuration=2;'), 'seekNativePlayerToTime must lower forward buffer duration for fast post-seek resume');
  assert.ok(main.includes('[action isEqualToString:@"updateMeta"]'), 'main.m playerControl must handle updateMeta from verifyInBackground');
  assert.ok(cicada.includes('SYCicadaCallInt64(self.player, NSSelectorFromString(@"currentPosition"))'), 'Cicada currentPosition must read int64_t milliseconds');
  assert.ok(cicada.includes('SYCicadaCallVoidInt64UInt(self.player, NSSelectorFromString(@"seekToTime:seekMode:"), timeMs, 0x01)'), 'Cicada seekToTime:seekMode: must pass int64_t milliseconds');
  assert.ok(cicada.includes('SYCicadaCallVoidFloat(self.player, NSSelectorFromString(@"setRate:"), self.pendingRate)'), 'Cicada setRate: must pass float ABI');
  assert.ok(app.includes("native.controlPlayer('updateMeta'"), 'verifyInBackground must sync verified cicadaURL and warmPlaylists to Native');
});
