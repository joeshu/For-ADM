import {chromium} from 'playwright-core';import fs from 'node:fs';import assert from 'node:assert/strict';
const out=process.env.APP_OUTPUT||'/workspace/outputs';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const cache=new Map();let images=0;
await page.route('https://**',async route=>{if(route.request().resourceType()!=='image')return route.abort();const url=route.request().url();try{if(!cache.has(url)){if(++images>18)return route.abort();cache.set(url,fetch(url,{signal:AbortSignal.timeout(10000)}).then(async r=>({status:r.status,contentType:r.headers.get('content-type')||'image/jpeg',body:Buffer.from(await r.arrayBuffer())})));}await route.fulfill(await cache.get(url));}catch{await route.abort();}});
const waitLoaded=()=>page.waitForSelector('.hero, .notice',{timeout:60000});
try{
 await page.goto('http://127.0.0.1:4173/');await page.waitForSelector('.hero',{timeout:60000});await page.waitForFunction(()=>[...document.images].filter(i=>i.complete&&i.naturalWidth>0).length>=3,{},{timeout:45000});await page.screenshot({path:out+'/Sanyuan-home.png'});
 assert.ok(await page.locator('.card').count()>5);
 await page.locator('[data-act="page"][data-id="browse"]').click();await page.waitForSelector('.filters select',{timeout:45000});await page.waitForSelector('.card',{timeout:45000});
 await page.locator('.card').first().click();await page.waitForSelector('.detailcover',{timeout:45000});await page.waitForSelector('.episode',{timeout:45000});
 await page.locator('[data-act="favorite-detail"]').click();assert.match(await page.locator('[data-act="favorite-detail"]').innerText(),/已收藏/);await page.screenshot({path:out+'/Sanyuan-detail.png'});
 await page.locator('[data-act="page"][data-id="saved"]').click();assert.equal(await page.locator('.card').count(),1);
 await page.locator('[data-act="page"][data-id="settings"]').click();await page.locator('[data-act="anonymous"]').click();await page.getByText('访客会话已连接',{exact:false}).waitFor({timeout:45000});
 await page.locator('#search-query').fill('流浪地球');await page.locator('#search-form button[type="submit"]').click();await page.waitForSelector('.card',{timeout:45000});const results=await page.locator('.card').count();assert.ok(results>0);
 for(const id of ['ncat','happ']){await page.locator('[data-act="page"][data-id="home"]').click();await page.locator('[data-act="source"][data-id="'+id+'"]').click();await page.waitForSelector('.hero',{timeout:60000});assert.ok(await page.locator('.card').count()>0);}
 await page.setViewportSize({width:1024,height:1366});await page.screenshot({path:out+'/Sanyuan-iPad.png'});
 assert.deepEqual(errors,[]);const report={checkedAt:new Date().toISOString(),browser:'Chromium',viewport:[390,844],allThreeSources:true,categories:true,detail:true,episodes:true,favorites:true,guestSearch:true,searchResults:results,ipadLayout:true,pageErrors:errors,deviceLaunchTested:false};fs.writeFileSync(new URL('../docs/browser-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{await browser.close();}
