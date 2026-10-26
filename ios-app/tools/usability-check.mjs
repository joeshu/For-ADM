import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 let failNextHome=false;
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],queries=[];
 await page.exposeFunction('failNextHomeRequest',()=>{failNextHome=true;});
 await page.addInitScript(()=>{localStorage.setItem('sanyuan:liveFavorites',JSON.stringify(['removed-channel-from-old-playlist']));localStorage.setItem('sanyuan:favorites',JSON.stringify([{key:'kkapp:77',siteId:'kkapp',movie:{id:'77',title:'收藏测试影片',labels:[]},updated:2}]));localStorage.setItem('sanyuan:history',JSON.stringify([{key:'kkapp:78',siteId:'kkapp',movie:{id:'78',title:'记录测试影片',labels:[]},episodeTitle:'第3集',updated:1}]));/* This smoke checks player layout; the separate playback UI test covers media failures. Chromium cannot play the mocked HLS response. */const add=HTMLMediaElement.prototype.addEventListener;HTMLMediaElement.prototype.addEventListener=function(type,...args){if(this instanceof HTMLVideoElement&&type==='error')return;return add.call(this,type,...args);};HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',r=>r.abort());
 await page.route('**/__transport',async route=>{
  const req=route.request().postDataJSON(),url=new URL(req.url),path=url.pathname;
  if(url.hostname==='img.example'){await route.fulfill({json:{status:200,bodyBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII='}});return;}
  let data;
  if(path.endsWith('/interface.m3u')){const body='#EXTM3U x-tvg-url="https://fnipv.69574517.xyz/shiju19880215/playback.xml"\n#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="CCTV1综合" group-title="央视频",CCTV1综合\nhttps://fnipv.69574517.xyz/relay/one.m3u8\n#EXTINF:-1 tvg-id="CCTV1综合" tvg-name="CCTV1综合备用" group-title="央视频",CCTV1综合备用\nhttps://fnipv.69574517.xyz/relay/two.m3u8\n#EXTINF:-1 tvg-id="CCTV5体育" group-title="体育",CCTV5体育\nhttp://fnipv.69574517.xyz/relay/five.m3u8\n';await route.fulfill({json:{status:200,bodyBase64:Buffer.from(body).toString('base64')}});return;}
  if(path.endsWith('/playback.xml')){const body='<tv><programme start="20261024090000 +0800" stop="20261024100000 +0800" channel="CCTV1综合"><title>综合新闻</title></programme></tv>';await route.fulfill({json:{status:200,bodyBase64:Buffer.from(body).toString('base64')}});return;}
  if(path.endsWith('.m3u8')){await route.fulfill({json:{status:200,bodyBase64:Buffer.from('#EXTM3U\n#EXTINF:5,\nsegment.ts\n').toString('base64')}});return;}
  if(path==='/v5/vod/home.capi'&&failNextHome){failNextHome=false;await route.abort();return;}
  const films=Array.from({length:12},(_,i)=>({title:'测试影片'+(i+1),url:'vod/detail?vodId='+(i+1),imagePath:`poster-${i+1}.jpg`,imageGroup:1})),longFilms=Array.from({length:20},(_,i)=>({title:'第二栏目影片'+(i+1),url:'vod/detail?vodId='+(i+201),imagePath:`poster-${i+201}.jpg`,imageGroup:1}));
  if(path==='/config/prod/appInit.html')data={urls:{cache:['https://test.example'],logic:['https://test.example']},vodTabs:[{type:'category',channelId:1,text:'电影'},{type:'category',channelId:2,text:'剧集'}],groups:[{id:1,url:[{domain:'https://img.example'}]}],channelListQuery:[1,2].map(channelId=>({channelId,items:[{query:'sort',selected:'3',data:[{id:'3',name:'最新'},{id:'1',name:'最热'}]},{query:'area',selected:'',data:[{id:'',name:'全部'},{id:'cn',name:'中国'},{id:'us',name:'美国'}]}]}))};
  else if(path==='/v5/vod/home.capi')data={blocks:[{header:{title:'精选片库',url:'specialTopic/vods?specialTopicId=12'},data:films},{header:{title:'第二片库',url:'specialTopic/vods?specialTopicId=13'},data:longFilms}]};
  else if(path==='/v2/vod/specialTopic/vods.capi')data=url.searchParams.get('specialTopicId')==='13'?{items:[{title:'专属栏目影片',url:'vod/detail?vodId=130'}]}:{items:url.searchParams.get('next')==='page=2'?[{title:'后续影片',url:'vod/detail?vodId=100',imagePath:'poster-100.jpg',imageGroup:1}]:films,next:url.searchParams.get('next')==='page=2'?'':'page=2'};
  else if(path.endsWith('/vod/channel/list.capi')){queries.push(url.searchParams);data=url.searchParams.get('next')==='page=2'?{items:[{title:'后续影片',url:'vod/detail?vodId=101',imagePath:'poster-101.jpg',imageGroup:1}],next:0}:{items:films,next:'page=2'};}
  else if(path==='/v2/vod/detail.capi')data={id:1,title:'测试影片1',channelId:2,playSources:[{siteId:1,name:'线路一',list:Array.from({length:45},(_,i)=>({id:10+i,title:`第${i+1}集`,open:true,playUrls:[{url:`https://test.example/${i===0?'a':i===1?'b':`a${i+1}`}.m3u8`}]}))},{siteId:2,name:'线路二',list:Array.from({length:45},(_,i)=>({id:20+i,title:`第${i+1}集`,open:true,playUrls:[{url:`https://test.example/${i===0?'d':i===1?'c':`b${i+1}`}.m3u8`}]}))}]};
  else throw Error('Unexpected '+path);
  await route.fulfill({json:{status:200,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')}});
 });
 await page.goto('http://127.0.0.1:4173/');
 await page.locator('.hero').waitFor();
 assert.equal(await page.locator('.hero h1').evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)');assert.equal(await page.locator('.herobuttons .secondary').evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)');
 assert.equal(await page.locator('.sources button').evaluateAll(buttons=>buttons.every(button=>button.scrollWidth<=button.clientWidth)),true);
 assert.equal(await page.locator('#bottomnav .nav-item').count(),5);
 assert.equal(await page.locator('#bottomnav').innerText().then(text=>text.includes('游戏')),false);
 await page.evaluate(()=>window.NativePageAction('page','games'));
 assert.equal(await page.locator('html').getAttribute('data-page'),'home');
 await page.locator('[data-act="hero-pick"][data-id="1"]').click();assert.match(await page.locator('.hero h1').innerText(),/测试影片2/);
 assert.equal(await page.locator('.home-section .card').count(),32);
 assert.deepEqual(await page.locator('.home-section .section-count').allTextContents(),['12 部','20 部']);
 assert.equal(await page.locator('.shelf').first().evaluate(row=>getComputedStyle(row).display), 'grid');
 assert.equal(await page.locator('.shelf').first().evaluate(row=>getComputedStyle(row).gridTemplateColumns.split(' ').length),3);
 assert.equal(await page.locator('.shelf').first().evaluate(row=>row.scrollWidth>row.clientWidth),false);
 assert.equal(await page.locator('.shelf').first().evaluate(row=>[...row.children].every(card=>{const r=card.getBoundingClientRect(),p=row.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1;})),true);
 await page.locator('.home-section [data-act="collection-link"]').first().click();await page.locator('.collection-content .card').first().waitFor();
 assert.equal(await page.locator('.collection-content .card').count(),12);
 await page.evaluate(()=>window.__collectionFirst=document.querySelector('.collection-content .card'));await page.locator('[data-act="more"]').click();await page.waitForFunction(()=>document.querySelectorAll('.collection-content .card').length===13);assert.equal(await page.evaluate(()=>window.__collectionFirst===document.querySelector('.collection-content .card')),true);const appendedCollectionCard=page.locator('.collection-content .card[data-id="100"]');await appendedCollectionCard.scrollIntoViewIfNeeded();await appendedCollectionCard.locator('img').waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('.collection-content .card[data-id="100"] img')?.getAttribute('src')?.startsWith('data:image/'));
 await page.locator('.collection-content .card').first().click();await page.locator('.detail-hero').waitFor();assert.equal(await page.locator('.detail-actions .detail-play').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(40, 120, 240)');assert.equal(await page.locator('.detail-actions .detail-favorite').evaluate(node=>getComputedStyle(node).color),'rgb(41, 49, 67)');assert.equal(await page.locator('.detail-actions .detail-secondary-action').evaluate(node=>getComputedStyle(node).color),'rgb(23, 104, 223)');
 await page.locator('[data-act="back"]').click();assert.equal(await page.locator('.collection-content .card').count(),13);
 await page.locator('[data-act="collection-back"]').click();assert.equal(await page.locator('.shelf').first().evaluate(row=>getComputedStyle(row).gridTemplateColumns.split(' ').length),3);
 await page.evaluate(()=>window.NativePageAction('collection-link',{route:'specialTopic/vods?specialTopicId=13',title:'第二片库'}));await page.locator('.collection-content .card').waitFor();assert.match(await page.locator('.collection-content').innerText(),/专属栏目影片/);assert.match(await page.locator('.collection-content h1').innerText(),/第二片库/);
 await page.locator('[data-act="collection-back"]').click();
 await page.screenshot({path:'/workspace/outputs/Sanyuan-0.2.4-home.png'});
 await page.locator('[data-act="page"][data-id="discover"]').click();await page.locator('.discover-page').waitFor();await page.waitForFunction(()=>document.querySelectorAll('.discover-page .card').length===12);assert.equal(await page.locator('body').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(243, 244, 248)');assert.equal(await page.locator('.movie-time-word').evaluate(node=>getComputedStyle(node).display),'none');assert.match(await page.locator('.bottomnav').evaluate(node=>getComputedStyle(node).borderRadius),/32px/);
 await page.evaluate(()=>window.__discoverFirst=document.querySelector('.discover-page .card'));await page.evaluate(()=>window.NativePageAction('discover-more'));await page.waitForFunction(()=>document.querySelectorAll('.discover-page .card').length===13);assert.equal(await page.evaluate(()=>window.__discoverFirst===document.querySelector('.discover-page .card')),true);assert.match(await page.locator('.discover-page').innerText(),/后续影片/);const appendedDiscoverCard=page.locator('.discover-page .card[data-id="101"]');await appendedDiscoverCard.scrollIntoViewIfNeeded();await appendedDiscoverCard.locator('img').waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('.discover-page .card[data-id="101"] img')?.getAttribute('src')?.startsWith('data:image/'));
 await page.locator('[data-act="page"][data-id="home"]').click();await page.locator('.hero').waitFor();
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
 await page.getByLabel('海报分栏',{exact:true}).selectOption('6');assert.equal(await page.locator('html').getAttribute('data-columns'),'6');
 assert.equal(await page.locator('.grid').first().evaluate(row=>getComputedStyle(row).gridTemplateColumns.split(' ').length),6);
 assert.equal(await page.locator('.grid').first().evaluate(row=>[...row.children].every(card=>{const r=card.getBoundingClientRect(),p=row.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1;})),true);
 await page.screenshot({path:'/workspace/outputs/Sanyuan-0.2.4-filters.png'});
 await page.locator('[data-act="filters-reset"]').click();await page.waitForFunction(()=>!document.querySelector('.selected-filters')&&document.querySelectorAll('.card').length>0);
 await page.locator('.content [data-act="more"]').waitFor();const browsePageCount=await page.locator('.content .card').count();await page.evaluate(()=>window.__browseFirst=document.querySelector('.content .card'));await page.evaluate(()=>window.NativePageAction('more'));await page.waitForFunction(count=>document.querySelectorAll('.content .card').length===count+1,browsePageCount);assert.equal(await page.evaluate(()=>window.__browseFirst===document.querySelector('.content .card')),true);assert.match(await page.locator('.content').innerText(),/后续影片/);assert.equal(await page.locator('.content [data-act="more"]').count(),0);
 await page.evaluate(()=>window.scrollTo(0,250));const returnY=await page.evaluate(()=>window.scrollY);
 await page.locator('.card').first().evaluate(el=>el.click());await page.locator('.route-card').first().waitFor();
 assert.ok(await page.locator('.detailtop-title').isVisible());
 await page.evaluate(()=>window.scrollTo(0,500));assert.ok(await page.locator('.detailtop').evaluate(el=>Math.abs(el.getBoundingClientRect().top)<2));
 await page.locator('[data-act="back"]').click();await page.locator('.browse-heading').waitFor();await page.evaluate(()=>new Promise(requestAnimationFrame));
 assert.ok(await page.evaluate(y=>Math.abs(window.scrollY-y)<3,returnY));
 await page.locator('.card').first().evaluate(el=>el.click());await page.locator('.route-card').first().waitFor();
 assert.equal(await page.locator('.episode-page-chip').count(),3);await page.locator('.episode-page-chip[data-id="2"]').click();await page.waitForFunction(()=>document.querySelector('.episode')?.dataset.id==='40');assert.equal(await page.locator('.episode').count(),5);await page.locator('.episode-page-chip[data-id="1"]').click();await page.waitForFunction(()=>document.querySelector('.episode')?.dataset.id==='20');assert.equal(await page.locator('.episode').count(),20);await page.locator('.episode-page-chip[data-id="0"]').click();await page.waitForFunction(()=>document.querySelector('.episode')?.dataset.id==='0');
 await page.locator('[data-act="episode"][data-id="1"]').click();await page.locator('#video').waitFor();
 await page.getByLabel('切换播放源',{exact:true}).selectOption('1');await page.waitForFunction(()=>document.querySelector('#video')?.src.endsWith('/c.m3u8'));
 assert.match(await page.locator('.episode.active').innerText(),/第2集/);
 await page.evaluate(()=>window.scrollTo(0,700));await page.waitForFunction(()=>document.querySelector('.playerbox')?.classList.contains('is-compact'));
 await page.waitForFunction(()=>Math.abs(document.querySelector('.playerbox')?.getBoundingClientRect().top-58)<3);
 assert.ok(await page.getByLabel('切换播放源',{exact:true}).evaluate(select=>select.getBoundingClientRect().bottom<innerHeight));
 await page.getByLabel('切换播放源',{exact:true}).selectOption('0');await page.waitForFunction(()=>document.querySelector('#video')?.src.endsWith('/b.m3u8'));await page.locator('#video').evaluate(video=>video.pause());
 await page.locator('#episode-list').evaluate(section=>section.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('.playerbox')?.classList.contains('is-compact'));await page.evaluate(()=>new Promise(requestAnimationFrame));
 await page.locator('.episode').first().evaluate(button=>button.scrollIntoView({block:'center',behavior:'instant'}));await page.evaluate(()=>new Promise(requestAnimationFrame));
 await page.waitForFunction(()=>{const episode=document.querySelector('.episode'),rect=episode?.getBoundingClientRect();return rect?.height>0&&rect.bottom<innerHeight;},undefined,{timeout:8000});
 assert.ok(await page.locator('.route-card').first().evaluate(card=>card.getBoundingClientRect().height)<65);
 await page.screenshot({path:'/workspace/outputs/Sanyuan-0.2.4-lines.png'});
 await page.locator('[data-act="back"]').click();await page.waitForFunction(()=>document.documentElement.dataset.page==='browse',undefined,{timeout:8000});
 await page.locator('[data-act="page"][data-id="live"]').click();await page.locator('.live-channel-list').waitFor();
 assert.equal(await page.locator('.live-channel-row').count(),3);assert.match(await page.locator('.live-now-copy').innerText(),/CCTV1综合/);assert.match(await page.locator('.live-category-row .active').innerText(),/全部频道/);
 await page.locator('.live-channel-row').nth(1).locator('[data-act="live-channel"]').click();await page.locator('#live-video').waitFor();
 assert.match(await page.locator('.live-now-copy').innerText(),/备用/);
 await page.locator('[data-act="live-panel"][data-id="routes"]').click();assert.equal(await page.locator('.live-route').count(),2);
 await page.locator('[data-act="live-panel"][data-id="programs"]').click();await page.locator('.live-program').waitFor();assert.match(await page.locator('.live-program').innerText(),/综合新闻/);
 await page.locator('.live-program').click();assert.match(await page.locator('.live-sheet-card').innerText(),/综合新闻/);
 await page.locator('[data-act="live-sheet-dismiss"]').last().click();
 await page.locator('[data-act="live-panel"][data-id="categories"]').click();assert.ok(await page.locator('.live-group-card').count()>=4);assert.match(await page.locator('.live-group-card[data-id="__all__"]').innerText(),/全部频道.*3 个频道/s);assert.match(await page.locator('.live-group-card[data-id="__favorites__"]').innerText(),/0 个频道/);
 await page.locator('.live-group-card[data-id="体育"]').click();await page.waitForFunction(()=>document.querySelector('.live-panel-tabs [data-id="channels"]')?.classList.contains('active'));assert.equal(await page.locator('.live-channel-row').count(),1);assert.match(await page.locator('.live-channel-row').innerText(),/CCTV5体育/);assert.match(await page.locator('.live-category-row .active').innerText(),/体育/);
 await page.locator('.live-category-row [data-id="__all__"]').click();assert.equal(await page.locator('.live-channel-row').count(),3);assert.match(await page.locator('.live-category-row .active').innerText(),/全部频道/);
 await page.locator('[data-act="live-panel"][data-id="categories"]').click();await page.locator('.live-group-card[data-id="央视频"]').click();assert.equal(await page.locator('.live-channel-row').count(),2);assert.match(await page.locator('.live-category-row .active').innerText(),/央视频/);
 await page.locator('[data-act="live-back"]').click();await page.waitForFunction(()=>document.documentElement.dataset.page==='browse');await page.locator('[data-act="page"][data-id="live"]').click();await page.locator('#live-video').waitFor();assert.match(await page.locator('#live-video').getAttribute('src'),/two\.m3u8/);await page.locator('[data-act="page"][data-id="browse"]').click();await page.waitForFunction(()=>document.documentElement.dataset.page==='browse');await page.locator('[data-act="page"][data-id="live"]').click();await page.locator('#live-video').waitFor();assert.match(await page.locator('#live-video').getAttribute('src'),/two\.m3u8/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'live page horizontal overflow');
 for(const width of [320,390,768,1024]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow at '+width);
 }
 await page.locator('[data-act="page"][data-id="me"]').click();
 assert.equal(await page.locator('.me-tabs [role="tab"]').count(),3);
 await page.locator('[data-act="me-tab"][data-id="favorites"]').click();assert.match(await page.locator('.my-library-heading h2').innerText(),/收藏/);assert.match(await page.locator('.my-library').innerText(),/收藏测试影片/);
 await page.locator('[data-act="me-tab"][data-id="history"]').click();assert.match(await page.locator('.my-library-heading h2').innerText(),/观看记录/);assert.match(await page.locator('.my-library').innerText(),/第3集.*记录测试影片/s);
 await page.locator('[data-act="me-tab"][data-id="settings"]').click();
 assert.equal(await page.locator('.settings-card').count(),5);
 assert.equal(await page.locator('.settings-line-group').count(),2);
 assert.equal(await page.locator('[data-clean-hls]').isChecked(),true);
 assert.equal(await page.locator('[data-player-rate]').inputValue(),'1');
 for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'settings horizontal overflow at '+width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/sanyuan-settings-review.png',fullPage:true});
 await page.locator('[data-act="theme"][data-id="black"]').click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'black');
 assert.equal(await page.evaluate(()=>localStorage.getItem('sanyuan:theme')),'black');
 await page.locator('[data-act="page"][data-id="discover"]').click();assert.equal(await page.locator('body').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(9, 13, 17)');assert.equal(await page.locator('.discover-tabs button.active').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(32, 53, 47)');await page.locator('[data-act="page"][data-id="live"]').click();assert.match(await page.locator('.live-pinned').evaluate(node=>getComputedStyle(node).backgroundColor),/^rgba\(16, 23, 29,/);await page.locator('[data-act="live-panel"][data-id="categories"]').click();assert.equal(await page.locator('.live-group-card').first().evaluate(node=>getComputedStyle(node).color),'rgb(232, 238, 241)');
 await page.locator('[data-act="page"][data-id="me"]').click();await page.locator('[data-act="me-tab"][data-id="settings"]').click();
 await page.locator('[data-act="theme"][data-id="white"]').click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'white');
 assert.equal(await page.evaluate(()=>localStorage.getItem('sanyuan:theme')),'white');
 for(const columns of ['3','4','5','6']){
  await page.locator(`[data-act="columns"][data-id="${columns}"]`).click();
  assert.equal(await page.locator('html').getAttribute('data-columns'),columns);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--grid-cols').trim()),columns);
  assert.equal(await page.evaluate(()=>localStorage.getItem('sanyuan:columns')),columns);
 }
 await page.locator('[data-act="page"][data-id="home"]').click();await page.locator('.shelf').first().waitFor();
 assert.equal(await page.locator('.shelf').first().evaluate(row=>getComputedStyle(row).gridTemplateColumns.split(' ').length),6);
 const homeCardCount=await page.locator('.home-section .card').count();await page.evaluate(()=>window.failNextHomeRequest());await page.locator('.top [data-act="refresh"]').click();await page.locator('.home-stale-banner').waitFor();assert.equal(await page.locator('.home-section .card').count(),homeCardCount);
 assert.deepEqual(errors,[]);
 console.log('Usability passed: unified favorites/history/settings tabs, home refresh fallback, configurable three-to-six-column film grids, section pagination and image loading, sticky detail/player controls, origin-page restoration, filters, same-episode switching, M3U import, linked live category/channel filtering, route selection, EPG, global themes, and 320–1024px layouts.');
}finally{await browser.close();}
