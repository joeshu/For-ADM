import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];let playlistRequests=0,redirectRequests=0,epgRequests=0;
 await page.addInitScript(()=>localStorage.setItem('sanyuan:livePlaylistURL','http://118.190.200.12:8767/all.m3u'));
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**',route=>route.abort());
 await page.route('**/__transport',async route=>{
  const request=route.request().postDataJSON(),url=new URL(request.url),path=url.pathname;
  let data;
  if(path.endsWith('/redirect.m3u')){redirectRequests++;const playlist='#EXTM3U x-tvg-url="../guide.xml"\n#EXTINF:-1 tvg-id="redirected" group-title="重定向测试",相对地址频道\n../streams/live.m3u8\n';await route.fulfill({json:{status:200,url:'https://cdn.example/lists/final.m3u',bodyBase64:Buffer.from(playlist).toString('base64')}});return;}
  if(path.endsWith('/all.m3u')){playlistRequests++;const playlist='#EXTM3U x-tvg-url="http://118.190.200.12:8767/playback.xml"\n'+
   '#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="CCTV1综合" group-title="央视频",CCTV1综合\nhttps://fnipv.69574517.xyz/relay/one.m3u8\n'+
   '#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="CCTV1综合备用" group-title="央视频",CCTV1综合备用\nhttps://fnipv.69574517.xyz/relay/two.m3u8\n'+
   '#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="CCTV1综合 HTTP" group-title="央视频",CCTV1综合 HTTP\nhttp://118.190.200.12:8767/relay/three.m3u8\n'+
   '#EXTINF:-1 tvg-id="CCTV5体育" group-title="体育",CCTV5体育\nhttp://fnipv.69574517.xyz/relay/five.m3u8\n';
   await route.fulfill({json:{status:200,bodyBase64:Buffer.from(playlist).toString('base64')}});return;}
  if(path.endsWith('/slow.m3u')||path.endsWith('/fast.m3u')){const name=path.endsWith('/slow.m3u')?'慢列表':'快列表',playlist=`#EXTM3U\n#EXTINF:-1 tvg-id="race" group-title="竞态检查",${name}\nhttps://fnipv.69574517.xyz/race.m3u8\n`;await route.fulfill({json:{status:200,bodyBase64:Buffer.from(playlist).toString('base64')}});return;}
  if(path.endsWith('/playback.xml')){epgRequests++;const title=epgRequests===1?'综合新闻':'更新后的新闻';const xml=`<tv><programme start="20261024090000 +0800" stop="20261024100000 +0800" channel="CCTV1综合"><title>${title}</title><sub-title>早间新闻</sub-title><desc>节目说明示例</desc><category>新闻</category></programme></tv>`;await route.fulfill({json:{status:200,bodyBase64:Buffer.from(xml).toString('base64')}});return;}
  if(path.endsWith('.m3u8')){await route.fulfill({json:{status:200,bodyBase64:Buffer.from('#EXTM3U\n#EXTINF:5,\nsegment.ts\n').toString('base64')}});return;}
  const movies=Array.from({length:4},(_,index)=>({title:'测试影片'+(index+1),url:'vod/detail?vodId='+(index+1)}));
  if(path==='/config/prod/appInit.html')data={urls:{cache:['https://test.example'],logic:['https://test.example']},vodTabs:[{type:'category',channelId:1,text:'电影'}],groups:[],channelListQuery:[]};
  else if(path==='/v5/vod/home.capi')data={blocks:[{header:{title:'精选片库'},data:movies}]};
  else if(path.endsWith('/vod/channel/list.capi'))data={items:movies,next:''};
  else throw Error('Unexpected '+path);
  await route.fulfill({json:{status:200,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')}});
 });
 await page.goto('http://127.0.0.1:4173/');await page.locator('.hero').waitFor();
 await page.locator('[data-act="page"][data-id="live"]').click();await page.locator('.live-channel-list').waitFor();assert.equal(playlistRequests,1);
 await page.reload();await page.locator('.hero').waitFor();await page.locator('[data-act="page"][data-id="live"]').click();await page.waitForFunction(()=>document.querySelectorAll('.live-channel-row').length===4);assert.equal(playlistRequests,1,'saved M3U should load locally without re-fetching');
 assert.equal(await page.locator('.live-channel-row').count(),4);assert.match(await page.locator('.live-top-title').innerText(),/CCTV1综合/);
 assert.equal(await page.locator('.live-pinned').evaluate(element=>getComputedStyle(element).position),'sticky');
 assert.equal(await page.locator('.live-top-actions button').count(),3);
 await page.locator('[data-act="live-channel-info"]').click();assert.match(await page.locator('.live-sheet-card').innerText(),/节目单 ID/);await page.locator('[data-act="live-sheet-dismiss"]').last().click();
 await page.locator('.live-channel-row').nth(1).locator('[data-act="live-channel"]').click();await page.locator('#live-video').waitFor();assert.match(await page.locator('.live-now-copy').innerText(),/备用/);
 await page.locator('[data-act="live-panel"][data-id="routes"]').click();assert.match(await page.locator('.live-panel-tabs').innerText(),/1\/3 线路/);
 await page.locator('.live-route').nth(2).click();assert.match(await page.locator('.live-sheet-card').innerText(),/HTTP · 未加密/);await page.locator('[data-act="live-route-system"]').click();
 await page.locator('[data-act="live-panel"][data-id="programs"]').click();await page.locator('.live-program').waitFor();assert.match(await page.locator('.live-program').innerText(),/综合新闻/);
 await page.locator('.live-program-footer [data-act="live-epg-refresh"]').click();await page.waitForFunction(()=>document.querySelector('.live-program')?.innerText.includes('更新后的新闻'));assert.equal(epgRequests,2,'refresh should download the latest EPG instead of reparsing cached XML');
 await page.locator('.live-program-footer [data-act="live-epg-info"]').click();assert.match(await page.locator('.live-sheet-card').innerText(),/EPG 来源/);await page.locator('[data-act="live-sheet-dismiss"]').last().click();
 await page.locator('.live-program').click();assert.match(await page.locator('.live-sheet-card').innerText(),/节目说明示例/);await page.locator('[data-act="live-sheet-dismiss"]').last().click();
 await page.locator('[data-act="live-panel"][data-id="categories"]').click();assert.ok(await page.locator('.live-group-card').count()>=2);
 await page.locator('.live-group-card').filter({hasText:'体育'}).click();await page.locator('[data-act="live-panel"][data-id="channels"]').click();
 assert.match(await page.locator('.live-channel-row').innerText(),/HTTP · 未加密/);assert.equal(await page.locator('.live-channel-main').isDisabled(),false);
 await page.evaluate(()=>{const original=window.NativeTransport.saveLiveCache.bind(window.NativeTransport);window.__slowLiveSaveStarted=false;window.NativeTransport.saveLiveCache=(url,text,baseURL)=>{const saved=original(url,text,baseURL);return url.endsWith('/slow.m3u')?new Promise(resolve=>{window.__slowLiveSaveStarted=true;saved.then(()=>{window.__releaseSlowLiveSave=()=>resolve({ok:true});});}):saved;};window.NativeLiveAction('live-import','https://list.example/slow.m3u');});
 await page.waitForFunction(()=>window.__slowLiveSaveStarted);await page.evaluate(()=>window.NativeLiveAction('live-import','https://list.example/fast.m3u'));await page.waitForFunction(()=>document.querySelector('.live-top-title')?.innerText.includes('快列表'));await page.evaluate(()=>window.__releaseSlowLiveSave());await page.waitForTimeout(100);assert.match(await page.locator('.live-top-title').innerText(),/快列表/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sanyuan:liveCache')).url),'https://list.example/fast.m3u');
 await page.evaluate(()=>window.NativeLiveAction('live-import','https://list.example/redirect.m3u'));await page.waitForFunction(()=>{const state=window.NativeLiveSnapshot();return state.channelInfo?.url==='https://cdn.example/streams/live.m3u8'&&state.epgUrl==='https://cdn.example/guide.xml';});assert.equal(redirectRequests,1,'relative stream and EPG URLs should use the final redirected playlist URL');
 await page.reload();await page.locator('.hero').waitFor();await page.locator('[data-act="page"][data-id="live"]').click();await page.waitForFunction(()=>window.NativeLiveSnapshot().channelInfo?.url==='https://cdn.example/streams/live.m3u8');assert.equal(redirectRequests,1,'restored M3U should retain its redirect base without re-fetching');
 for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'live overflow at '+width);}
 await page.locator('[data-act="live-back"]').click();await page.locator('.hero').waitFor();
 assert.deepEqual(errors,[]);console.log('Live UI passed: arbitrary HTTP M3U import, local restore without re-fetch, stale-import race isolation, unencrypted route playback, pinned layout, favorites/actions, channel metadata, EPG network refresh, dates/details, and responsive widths.');
}finally{await browser.close();}
