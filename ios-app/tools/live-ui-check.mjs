import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**',route=>route.abort());
 await page.route('**/__transport',async route=>{
  const request=route.request().postDataJSON(),url=new URL(request.url),path=url.pathname;
  let data;
  if(path.endsWith('/interface.m3u')){const playlist='#EXTM3U x-tvg-url="https://fnipv.69574517.xyz/shiju19880215/playback.xml"\n'+
   '#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="CCTV1综合" group-title="央视频",CCTV1综合\nhttps://fnipv.69574517.xyz/relay/one.m3u8\n'+
   '#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="CCTV1综合备用" group-title="央视频",CCTV1综合备用\nhttps://fnipv.69574517.xyz/relay/two.m3u8\n'+
   '#EXTINF:-1 tvg-id="CCTV5体育" group-title="体育",CCTV5体育\nhttp://fnipv.69574517.xyz/relay/five.m3u8\n';
   await route.fulfill({json:{status:200,bodyBase64:Buffer.from(playlist).toString('base64')}});return;}
  if(path.endsWith('/playback.xml')){const xml='<tv><programme start="20261024090000 +0800" stop="20261024100000 +0800" channel="CCTV1综合"><title>综合新闻</title><sub-title>早间新闻</sub-title><desc>节目说明示例</desc><category>新闻</category></programme></tv>';await route.fulfill({json:{status:200,bodyBase64:Buffer.from(xml).toString('base64')}});return;}
  if(path.endsWith('.m3u8')){await route.fulfill({json:{status:200,bodyBase64:Buffer.from('#EXTM3U\n#EXTINF:5,\nsegment.ts\n').toString('base64')}});return;}
  const movies=Array.from({length:4},(_,index)=>({title:'测试影片'+(index+1),url:'vod/detail?vodId='+(index+1)}));
  if(path==='/config/prod/appInit.html')data={urls:{cache:['https://test.example'],logic:['https://test.example']},vodTabs:[{type:'category',channelId:1,text:'电影'}],groups:[],channelListQuery:[]};
  else if(path==='/v5/vod/home.capi')data={blocks:[{header:{title:'精选片库'},data:movies}]};
  else if(path.endsWith('/vod/channel/list.capi'))data={items:movies,next:''};
  else throw Error('Unexpected '+path);
  await route.fulfill({json:{status:200,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')}});
 });
 await page.goto('http://127.0.0.1:4173/');await page.locator('.hero').waitFor();
 await page.locator('[data-act="page"][data-id="live"]').click();await page.locator('.live-channel-list').waitFor();
 assert.equal(await page.locator('.live-channel-row').count(),2);assert.match(await page.locator('.live-top-title').innerText(),/CCTV1综合/);
 assert.equal(await page.locator('.live-pinned').evaluate(element=>getComputedStyle(element).position),'sticky');
 assert.equal(await page.locator('.live-top-actions button').count(),3);
 await page.locator('[data-act="live-channel-info"]').click();assert.match(await page.locator('.live-sheet-card').innerText(),/节目单 ID/);await page.locator('[data-act="live-sheet-dismiss"]').last().click();
 await page.locator('.live-channel-row').nth(1).locator('[data-act="live-channel"]').click();await page.locator('#live-video').waitFor();assert.match(await page.locator('.live-now-copy').innerText(),/备用/);
 await page.locator('[data-act="live-panel"][data-id="routes"]').click();assert.match(await page.locator('.live-panel-tabs').innerText(),/2\/2 线路/);
 await page.locator('.live-route').nth(1).click();assert.match(await page.locator('.live-sheet-card').innerText(),/自动硬件解码/);await page.locator('[data-act="live-route-system"]').click();
 await page.locator('[data-act="live-panel"][data-id="programs"]').click();await page.locator('.live-program').waitFor();assert.match(await page.locator('.live-program').innerText(),/综合新闻/);
 await page.locator('.live-program-footer [data-act="live-epg-info"]').click();assert.match(await page.locator('.live-sheet-card').innerText(),/EPG 来源/);await page.locator('[data-act="live-sheet-dismiss"]').last().click();
 await page.locator('.live-program').click();assert.match(await page.locator('.live-sheet-card').innerText(),/节目说明示例/);await page.locator('[data-act="live-sheet-dismiss"]').last().click();
 await page.locator('[data-act="live-panel"][data-id="categories"]').click();assert.ok(await page.locator('.live-group-card').count()>=2);
 await page.locator('.live-group-card').filter({hasText:'体育'}).click();await page.locator('[data-act="live-panel"][data-id="channels"]').click();
 assert.match(await page.locator('.live-channel-row').innerText(),/HTTP · 已停用/);
 for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'live overflow at '+width);}
 await page.locator('[data-act="live-back"]').click();await page.locator('.hero').waitFor();
 assert.deepEqual(errors,[]);console.log('Live UI passed: pinned playback/header/tabs, return, favorites/actions, channel metadata, channel switching, route actions, EPG dates/details, and responsive widths.');
}finally{await browser.close();}
