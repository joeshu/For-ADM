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
  if(path.endsWith('.m3u8')){await route.fulfill({json:{status:200,bodyBase64:Buffer.from('#EXTM3U\n#EXTINF:5,\nsegment.ts\n').toString('base64')}});return;}
  const films=Array.from({length:12},(_,i)=>({title:'测试影片'+(i+1),url:'vod/detail?vodId='+(i+1)}));
  if(path==='/config/prod/appInit.html')data={urls:{cache:['https://test.example'],logic:['https://test.example']},vodTabs:[{type:'category',channelId:1,text:'电影'},{type:'category',channelId:2,text:'剧集'}],groups:[],channelListQuery:[1,2].map(channelId=>({channelId,items:[{query:'sort',selected:'3',data:[{id:'3',name:'最新'},{id:'1',name:'最热'}]},{query:'area',selected:'',data:[{id:'',name:'全部'},{id:'cn',name:'中国'},{id:'us',name:'美国'}]}]}))};
  else if(path==='/v5/vod/home.capi')data={blocks:[{header:{title:'精选片库'},data:films}]};
  else if(path.endsWith('/vod/channel/list.capi')){queries.push(url.searchParams);data={items:films,next:''};}
  else if(path==='/v2/vod/detail.capi')data={id:1,title:'测试影片1',channelId:2,playSources:[{siteId:1,name:'线路一',list:[{id:10,title:'第1集',open:true,playUrls:[{url:'https://test.example/a.m3u8'}]},{id:11,title:'第2集',open:true,playUrls:[{url:'https://test.example/b.m3u8'}]}]},{siteId:2,name:'线路二',list:[{id:21,title:'第2集',open:true,playUrls:[{url:'https://test.example/c.m3u8'}]},{id:20,title:'第1集',open:true,playUrls:[{url:'https://test.example/d.m3u8'}]}]}]};
  else throw Error('Unexpected '+path);
  await route.fulfill({json:{status:200,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')}});
 });
 await page.goto('http://127.0.0.1:4173/');
 await page.locator('.hero').waitFor();
 await page.locator('[data-act="hero-pick"][data-id="1"]').click();assert.match(await page.locator('.hero h1').innerText(),/测试影片2/);
 assert.equal(await page.locator('.home-section .card').count(),9);
 await page.locator('[data-act="section-toggle"]').click();assert.equal(await page.locator('.home-section .card').count(),12);
 await page.screenshot({path:'/workspace/outputs/Sanyuan-0.2.4-home.png'});
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
 await page.locator('.card').first().click();await page.locator('.route-card').first().waitFor();
 await page.locator('[data-act="episode"][data-id="1"]').click();await page.locator('#video').waitFor();
 await page.locator('[data-act="play-source"][data-id="1"]').click();await page.waitForFunction(()=>document.querySelector('#video')?.src.endsWith('/c.m3u8'));
 assert.match(await page.locator('.episode.active').innerText(),/第2集/);
 await page.screenshot({path:'/workspace/outputs/Sanyuan-0.2.4-lines.png'});
 for(const width of [320,390,768,1024]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow at '+width);
 }
 assert.deepEqual(errors,[]);
 console.log('Usability passed: hero switching, full sections, category-scoped filters, reset, column layout, same-episode switching with reordered sources, 320–1024px layout.');
}finally{await browser.close();}
