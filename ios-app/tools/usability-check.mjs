import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],queries=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',r=>r.abort());
 await page.route('**/__transport',async route=>{
  const req=route.request().postDataJSON(),url=new URL(req.url),path=url.pathname;
  let data;
  if(path.endsWith('/interface.m3u')){const body='#EXTM3U x-tvg-url="https://fnipv.69574517.xyz/shiju19880215/playback.xml"\n#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="CCTV1综合" group-title="央视频",CCTV1综合\nhttps://fnipv.69574517.xyz/relay/one.m3u8\n#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="CCTV1综合备用" group-title="央视频",CCTV1综合备用\nhttps://fnipv.69574517.xyz/relay/two.m3u8\n#EXTINF:-1 tvg-id="CCTV5体育" group-title="体育",CCTV5体育\nhttp://fnipv.69574517.xyz/relay/five.m3u8\n';await route.fulfill({json:{status:200,bodyBase64:Buffer.from(body).toString('base64')}});return;}
  if(path.endsWith('/playback.xml')){const body='<tv><programme start="20261024090000 +0800" stop="20261024100000 +0800" channel="CCTV1综合"><title>综合新闻</title></programme></tv>';await route.fulfill({json:{status:200,bodyBase64:Buffer.from(body).toString('base64')}});return;}
  if(path.endsWith('.m3u8')){await route.fulfill({json:{status:200,bodyBase64:Buffer.from('#EXTM3U\n#EXTINF:5,\nsegment.ts\n').toString('base64')}});return;}
  const films=Array.from({length:12},(_,i)=>({title:'测试影片'+(i+1),url:'vod/detail?vodId='+(i+1)}));
  if(path==='/config/prod/appInit.html')data={urls:{cache:['https://test.example'],logic:['https://test.example']},vodTabs:[{type:'category',channelId:1,text:'电影'},{type:'category',channelId:2,text:'剧集'}],groups:[],channelListQuery:[1,2].map(channelId=>({channelId,items:[{query:'sort',selected:'3',data:[{id:'3',name:'最新'},{id:'1',name:'最热'}]},{query:'area',selected:'',data:[{id:'',name:'全部'},{id:'cn',name:'中国'},{id:'us',name:'美国'}]}]}))};
  else if(path==='/v5/vod/home.capi')data={blocks:[{header:{title:'精选片库',url:'specialTopic/vods?specialTopicId=12'},data:films}]};
  else if(path==='/v2/vod/specialTopic/vods.capi')data={items:url.searchParams.get('next')==='page=2'?[{title:'后续影片',url:'vod/detail?vodId=100'}]:films,next:url.searchParams.get('next')==='page=2'?'':'page=2'};
  else if(path.endsWith('/vod/channel/list.capi')){queries.push(url.searchParams);data={items:films,next:''};}
  else if(path==='/v2/vod/detail.capi')data={id:1,title:'测试影片1',channelId:2,playSources:[{siteId:1,name:'线路一',list:[{id:10,title:'第1集',open:true,playUrls:[{url:'https://test.example/a.m3u8'}]},{id:11,title:'第2集',open:true,playUrls:[{url:'https://test.example/b.m3u8'}]}]},{siteId:2,name:'线路二',list:[{id:21,title:'第2集',open:true,playUrls:[{url:'https://test.example/c.m3u8'}]},{id:20,title:'第1集',open:true,playUrls:[{url:'https://test.example/d.m3u8'}]}]}]};
  else throw Error('Unexpected '+path);
  await route.fulfill({json:{status:200,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')}});
 });
 await page.goto('http://127.0.0.1:4173/');
 await page.locator('.hero').waitFor();
 await page.locator('[data-act="hero-pick"][data-id="1"]').click();assert.match(await page.locator('.hero h1').innerText(),/测试影片2/);
 assert.equal(await page.locator('.home-section .card').count(),12);
 assert.equal(await page.locator('.shelf').evaluate(row=>row.scrollWidth>row.clientWidth),true);
 await page.locator('.shelf').evaluate(row=>row.scrollLeft=240);
 await page.locator('.home-section [data-act="collection-link"]').click();await page.locator('.collection-content .card').first().waitFor();
 assert.equal(await page.locator('.collection-content .card').count(),12);
 await page.locator('[data-act="more"]').click();await page.waitForFunction(()=>document.querySelectorAll('.collection-content .card').length===13);
 await page.locator('.collection-content .card').first().click();await page.locator('.detail-hero').waitFor();
 await page.locator('[data-act="back"]').click();assert.equal(await page.locator('.collection-content .card').count(),13);
 await page.locator('[data-act="collection-back"]').click();assert.ok(await page.locator('.shelf').evaluate(row=>row.scrollLeft)>0);
 await page.screenshot({path:'/workspace/outputs/Sanyuan-0.2.4-home.png'});
 await page.evaluate(()=>window.__cachedHomeHero=document.querySelector('.hero'));
 await page.locator('[data-act="page"][data-id="browse"]').click();await page.locator('.browse-heading').waitFor();
 await page.evaluate(()=>window.scrollTo(0,180));await page.evaluate(()=>new Promise(requestAnimationFrame));const browseY=await page.evaluate(()=>window.scrollY);
 await page.locator('[data-act="page"][data-id="home"]').click();await page.locator('.hero').waitFor();assert.equal(await page.evaluate(()=>document.querySelector('.hero')===window.__cachedHomeHero),true);
 await page.locator('[data-act="page"][data-id="browse"]').click();await page.locator('.browse-heading').waitFor();await page.evaluate(()=>new Promise(requestAnimationFrame));
 assert.ok(await page.evaluate(y=>Math.abs(window.scrollY-y)<3,browseY));
 await page.locator('[data-act="category"][data-id="1"]').click();await page.locator('.filter-chip').first().waitFor();
 await page.locator('[data-act="filter-option"][data-key="area"][data-id="cn"]').click();await page.locator('.selected-filters button').waitFor();
 assert.match(await page.locator('.selected-filters').innerText(),/中国/);
 await page.locator('[data-act="category"][data-id="2"]').click();await page.waitForFunction(()=>document.querySelector('.heading')?.textContent==='剧集'&&document.querySelectorAll('.card').length>0);
 assert.equal(await page.locator('.selected-filters').count(),0);
 await page.locator('[data-act="category"][data-id="1"]').click();await page.locator('.selected-filters button').waitFor();
 assert.match(await page.locator('.selected-filters').innerText(),/中国/);
 await page.getByLabel('海报分栏',{exact:true}).selectOption('2');assert.equal(await page.locator('html').getAttribute('data-columns'),'2');
 await page.screenshot({path:'/workspace/outputs/Sanyuan-0.2.4-filters.png'});
 await page.locator('[data-act="filters-reset"]').click();await page.waitForFunction(()=>!document.querySelector('.selected-filters')&&document.querySelectorAll('.card').length>0);
 await page.evaluate(()=>window.scrollTo(0,250));const returnY=await page.evaluate(()=>window.scrollY);
 await page.locator('.card').first().evaluate(el=>el.click());await page.locator('.route-card').first().waitFor();
 assert.ok(await page.locator('.detailtop-title').isVisible());
 await page.evaluate(()=>window.scrollTo(0,500));assert.ok(await page.locator('.detailtop').evaluate(el=>Math.abs(el.getBoundingClientRect().top)<2));
 await page.locator('[data-act="back"]').click();await page.locator('.browse-heading').waitFor();await page.evaluate(()=>new Promise(requestAnimationFrame));
 assert.ok(await page.evaluate(y=>Math.abs(window.scrollY-y)<3,returnY));
 await page.locator('.card').first().evaluate(el=>el.click());await page.locator('.route-card').first().waitFor();
 await page.locator('[data-act="episode"][data-id="1"]').click();await page.locator('#video').waitFor();
 await page.getByLabel('切换播放源',{exact:true}).selectOption('1');await page.waitForFunction(()=>document.querySelector('#video')?.src.endsWith('/c.m3u8'));
 assert.match(await page.locator('.episode.active').innerText(),/第2集/);
 await page.evaluate(()=>window.scrollTo(0,700));await page.waitForFunction(()=>document.querySelector('.playerbox')?.classList.contains('is-compact'));
 await page.waitForFunction(()=>Math.abs(document.querySelector('.playerbox')?.getBoundingClientRect().top-58)<3);
 assert.ok(await page.getByLabel('切换播放源',{exact:true}).evaluate(select=>select.getBoundingClientRect().bottom<innerHeight));
 await page.getByLabel('切换播放源',{exact:true}).selectOption('0');await page.waitForFunction(()=>document.querySelector('#video')?.src.endsWith('/b.m3u8'));
 await page.locator('#episode-list').evaluate(section=>section.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('.playerbox')?.classList.contains('is-compact'));await page.evaluate(()=>new Promise(requestAnimationFrame));
 await page.locator('.episode').first().evaluate(button=>button.scrollIntoView({block:'center',behavior:'instant'}));await page.evaluate(()=>new Promise(requestAnimationFrame));
 assert.ok(await page.locator('.episode').first().evaluate(button=>button.getBoundingClientRect().bottom<innerHeight));
 assert.ok(await page.locator('.route-card').first().evaluate(card=>card.getBoundingClientRect().height)<65);
 await page.screenshot({path:'/workspace/outputs/Sanyuan-0.2.4-lines.png'});
 await page.locator('[data-act="back"]').click();await page.locator('.browse-heading').waitFor();
 await page.locator('[data-act="page"][data-id="live"]').click();await page.locator('.live-channel-list').waitFor();
 assert.equal(await page.locator('.live-channel-row').count(),2);assert.match(await page.locator('.live-now-copy').innerText(),/CCTV1综合/);
 await page.locator('.live-channel-row').nth(1).locator('[data-act="live-channel"]').click();await page.locator('#live-video').waitFor();
 assert.match(await page.locator('.live-now-copy').innerText(),/备用/);
 await page.locator('[data-act="live-panel"][data-id="routes"]').click();assert.equal(await page.locator('.live-route').count(),2);
 await page.locator('[data-act="live-panel"][data-id="programs"]').click();await page.locator('.live-program').waitFor();assert.match(await page.locator('.live-program').innerText(),/综合新闻/);
 await page.locator('.live-program').click();assert.match(await page.locator('.live-epg-card').innerText(),/综合新闻/);
 await page.locator('[data-act="live-program-dismiss"]').first().click();
 await page.locator('[data-act="live-panel"][data-id="categories"]').click();assert.ok(await page.locator('.live-group-card').count()>=2);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'live page horizontal overflow');
 for(const width of [320,390,768,1024]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow at '+width);
 }
 assert.deepEqual(errors,[]);
 console.log('Usability passed: horizontal shelves, real section lists and pagination, sticky detail/player controls, origin-page restoration, compact route row, category filters, same-episode switching, M3U import, live channel switching, route selection, EPG and categories, 320–1024px layout.');
}finally{await browser.close();}
