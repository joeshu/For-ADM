import {chromium}from'playwright-core';import assert from'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];await page.addInitScript(()=>localStorage.setItem('sanyuan:playbackRate','1.5'));page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',r=>r.abort());
 await page.route('**/__transport',async route=>{
  const request=route.request().postDataJSON(),path=new URL(request.url).pathname;
  let data;
  if(path.endsWith('.m3u8')){await route.fulfill({contentType:'application/json',body:JSON.stringify({status:200,bodyBase64:Buffer.from('#EXTM3U\n#EXTINF:5,\nsegment.ts\n').toString('base64')})});return;}
  if(path==='/config/prod/appInit.html')data={urls:{cache:['https://test.example'],logic:['https://test.example']},vodTabs:[],groups:[]};
  else if(path==='/v5/vod/home.capi')data={blocks:[{header:{title:'影片'},data:[{title:'测试影片',url:'vod/detail?vodId=1'}]}]};
  else if(path==='/v2/vod/detail.capi')data={id:1,title:'测试影片',playSources:[{siteId:2,name:'线路',list:[{id:10,title:'第一集',open:true,playUrls:[{url:'https://test.example/first.m3u8'}]},{id:11,title:'第二集',open:false,playUrls:[{url:'https://test.example/closed.m3u8'}]}]}]};
  else if(path==='/user/anonymous')data={id:123,token:'test-only'};
  else if(path==='/vod/episodePlayUrl')data={code:40401,message:'请登录后播放'};
  else throw Error('Unexpected endpoint '+path);
  await route.fulfill({contentType:'application/json',body:JSON.stringify({status:200,bodyBase64:Buffer.from(JSON.stringify(data)).toString('base64')})});
 });
 await page.goto('http://127.0.0.1:4173/');await page.locator('.hero [data-act="detail"]').click();await page.locator('[data-act="episode"][data-id="0"]').click();await page.waitForSelector('#video');
 await page.evaluate(()=>{
  HTMLMediaElement.prototype.pause=function(){window.__paused=true;};
  window.webkit={messageHandlers:{native:{postMessage(message){
   if(message.type==='request'){
    fetch('/__transport',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message)}).then(r=>r.json()).then(data=>window.NativeTransport.deliver({id:message.id,...data}));
   }
   if(message.type==='play'){
    window.__nativePlay={url:message.url,wasPaused:window.__paused,rate:message.rate,title:message.title,frame:message.frame};
    window.NativeTransport.deliver({id:message.id,ok:true});
   }
  }}}};
 });
 await page.locator('[data-act="favorite-detail"]').click();await page.locator('#native-player-slot').waitFor();
 await page.locator('[data-act="episode"][data-id="0"]').click();await page.waitForFunction(()=>!!window.__nativePlay);const played=await page.evaluate(()=>window.__nativePlay);assert.equal(played.frame.visible,true);assert.equal(played.frame.width,390);assert.ok(Math.abs(played.frame.height/played.frame.width-9/16)<0.01);assert.equal(await page.locator('.playtoolbar [data-act="native-player"]').count(),0);assert.equal(played.rate,1.5);assert.equal(played.title,'测试影片 · 第一集');assert.equal(played.url,'https://test.example/first.m3u8');await page.evaluate(()=>delete window.webkit);
 await page.locator('[data-act="episode"][data-id="1"]').click();await page.getByText('请登录后播放',{exact:true}).waitFor();assert.equal(await page.locator('#video').count(),0);
 const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('sanyuan:history')));assert.equal(history[0].episodeId,10);assert.deepEqual(errors,[]);console.log('Playback UI passed: native player receives an inline 16:9 frame without forced fullscreen; denied episode removes stale video and preserves correct history.');
}finally{await browser.close();}
