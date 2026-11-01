// Offline integration check for website-backed clients through the real UI bundle.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {mp4Init} from '../tests/fixtures/mp4-init.mjs';

const cwd=fileURLToPath(new URL('../',import.meta.url)),port=4175;
execFileSync(process.execPath,['tools/build-web.mjs'],{cwd,stdio:'pipe'});
const server=spawn(process.execPath,['tools/preview.mjs'],{cwd,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.once('error',reject);server.once('exit',code=>reject(Error('Preview exited '+code)));server.stdout.on('data',data=>{if(String(data).includes('Preview:'))resolve();});});
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[],unexpected=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',route=>route.abort());
 let dylsPage=1,holdHome=false,heldResolve,heldStarted;
 const heldRequest=new Promise(resolve=>{heldStarted=resolve;});
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=';
 const encoded=data=>({status:200,bodyBase64:Buffer.from(typeof data==='string'?data:JSON.stringify(data)).toString('base64')});
 const film=(source,id)=>({vodId:id,vodName:source+'影片'+id,coverImg:'https://posters.example/'+source+'/'+id+'.png',flags:'2026 / 科幻片 / 中国',score:'8.0',iconList:[],remark:'高清'});
 const movie=id=>({id,name:'猎手影片'+id,cover:'https://posters.example/dyls/'+id+'.png',type_id:1,type_name:'电影',dynamic:'高清'});
 const hgIDs=['7700000000000000001','7700000000000000002','7700000000000000003'];
 const hgVideos=['8700000000000000001','8700000000000000002','8700000000000000003','8700000000000000004'];
 const hgMovie=(id,title)=>({series_id:id,series_name:title,series_cover:'https://posters.example/hongguo/'+id+'.png',episode_cnt:2,episode_right_text:'全2集',tags:['都市','短剧']});
 const hgHTML=loaderData=>'<html><script>window._ROUTER_DATA = '+JSON.stringify({loaderData})+';</script></html>';
 await page.route('**/__transport',async route=>{
  const req=route.request().postDataJSON(),url=new URL(req.url),path=url.pathname;
  const params=req.body?JSON.parse(req.body):{};
  requests.push({url:req.url,path,params,headers:req.headers});
  const send=async data=>{try{await route.fulfill({json:encoded(data)});}catch(error){if(!/already handled|Invalid Interception|Target closed|Fetch.enable|interception/i.test(error.message))throw error;}};
  if(url.hostname==='posters.example'){await route.fulfill({json:{status:200,bodyBase64:png}});return;}
  if(/^v\d+-(?:reading|hgweb)\.qznovelvod\.com$/.test(url.hostname)){
   const bytes=mp4Init();await route.fulfill({json:{status:206,headers:{'Content-Type':'video/mp4','Content-Range':'bytes 0-'+(bytes.length-1)+'/6971183'},bodyBase64:bytes.toString('base64')}});return;
  }
  if(path==='/js/baseUrlList.js'){await send('var baseApiList=["https://website-api.example"];');return;}
  if(path.startsWith('/v1/api/')||path.startsWith('/v2/api/')){
   const source=String(params.reqDomain||'').includes('qntv')?'QNTV':'YQK';
   let data;
   if(path==='/v2/api/home/header')data={channeList:[{channelId:2,channelName:'电影'},{channelId:5,channelName:'体育'}]};
   else if(path==='/v2/api/home/body'){
    if(holdHome&&source==='YQK'){holdHome=false;heldStarted();await new Promise(resolve=>{heldResolve=resolve;});data={vodTopicList:[{vodTopicId:77,topicName:'YQK迟到内容',vodList:[film('YQK迟到',999)]}]};}
    else data={vodTopicList:[{vodTopicId:77,topicName:source+'专题',vodList:[film(source,101),film(source,102)]}]};
   }
   else if(path==='/v2/api/channel/childListView')data={childChannelList:[{channelId:9,channelName:'科幻片'}]};
   else if(path==='/v2/api/channel/getVodList')data=params.nextVal?{items:[film(source,203)],hasNext:false,nextVal:''}:{items:[film(source,201),film(source,202)],hasNext:true,nextVal:source+'-cursor'};
   else if(path==='/v1/api/vodTopic/getVodList')data={items:params.pageIndex===2?[film(source,503)]:[film(source,501),film(source,502)],totalPages:2};
   else if(path==='/v1/api/search/search')data={items:[film(source+'搜索',301)],hasNext:false,nextVal:''};
   else if(path==='/v2/api/vodInfo/index')data={vodId:Number(params.vodId),vodName:source+'详情',coverImg:'https://posters.example/'+source+'/detail.png',year:2026,areaName:'中国',intro:'测试简介',tagList:['科幻'],actorList:[{vodWorkerName:'演员'}],playerList:[{vodPlayerKind:4,playerName:'线路 A',totalEpCount:45,epList:Array.from({length:45},(_,i)=>({epId:800+i,epName:'第'+(i+1)+'集'}))}]};
   else {unexpected.push(path);await send({result:false,msg:'Unexpected fixture path '+path});return;}
   await send({result:true,data});return;
  }
  if(path.startsWith('/api/v1/')){
   let data;
   if(path==='/api/v1/app/config')data={index_top_nav:[{id:0,name:'推荐'},{id:1,name:'电影'},{id:2,name:'剧集'},{id:13,name:'福利'}],movie_screen:{filter:[{id:1,name:'电影',class:['类型','科幻','Netflix'],area:['地区','中国'],year:['年份','2026']},{id:2,name:'剧集',class:['类型','都市']}],sort:[{name:'最新',value:'by_time'},{name:'最热',value:'by_hits'}]}};
   else if(path==='/api/v1/movie/index_recommend')data=[{layout:'advert_self',title:'不应显示广告',list:[movie('AD')]},{layout:'movie_list',title:'猎手精选',right:{type_id:1},list:[movie('A_1'),movie('A-2')]}];
   else if(path==='/api/v1/movie/screen/list')data={list:dylsPage===2?[movie('A3')]:[movie('A_1'),movie('A-2')],total:3,page:dylsPage,pageSize:2};
   else if(path==='/api/v1/movie/search')data={list:[movie('Search_1')],total:1,page:1,pageSize:20};
   else if(path==='/api/v1/movie/detail')data={id:'A_1',name:'猎手详情 A_1',cover:'https://posters.example/dyls/detail.png',type_id:1,type_name:'电影',content:'猎手简介',tags:[{name:'科幻'}],members:[{type:1,name:'演员'}],play_from:[{code:'official',name:'官方线路',total:45,player_need_to_parse:false,list:[]}]};
   else if(path==='/api/v1/movie_addr/list')data=Array.from({length:45},(_,i)=>({episode_id:900+i,episode_name:'第'+(i+1)+'集',from_code:'official',play_url:'https://media.example/'+i+'.m3u8'}));
   else {unexpected.push(path);await send({errorCode:400,msg:'Unexpected fixture path '+path});return;}
   await send({msg:'获取成功',data});return;
  }
  if(url.hostname==='hongguoduanju.com'){
   if(path==='/'){
    await send(hgHTML({page:{isSuccess:true,mBannerList:[hgMovie(hgIDs[0],'红果首页短剧')],homeSections:[{tab_type:'human',tab_name:'热播短剧',video_list:[hgMovie(hgIDs[0],'红果首页短剧'),hgMovie(hgIDs[1],'红果第二部短剧')]}]}}));return;
   }
   if(path.startsWith('/category/')){
    const pageNumber=Number(url.searchParams.get('page')||1),selected=path.endsWith('/romance'),id=pageNumber===2?hgIDs[2]:selected?hgIDs[1]:hgIDs[0];
    await send(hgHTML({'category_$':{isSuccess:true,query:{page:pageNumber},selectorList:[{items:[{selector_item_id:'romance',show_name:'爱情'}]}],recommendList:[hgMovie(id,pageNumber===2?'红果第二页短剧':selected?'红果爱情短剧':'红果分类短剧')],pagination:{pageNum:pageNumber,totalPages:2}}}));return;
   }
   if(path==='/detail'){
    await send(hgHTML({detail_page:{isSuccess:true,seriesDetail:{series_id:hgIDs[0],series_name:'红果首页短剧',series_cover:'https://posters.example/hongguo/detail.png',series_intro:'官网公开目录测试简介',episode_cnt:4,accessible_episode_cnt:3,episode_right_text:'全4集',vid_list:hgVideos,tags:['都市','短剧'],celebrities:[{nickname:'测试演员'}]},seriesSocialInfo:{rating:8.2}}}));return;
   }
   if(path.startsWith('/player/')){
    const itemId=path.split('/').at(-1);
    await send(hgHTML({'player_(series_id)/(vid)/page':{isSuccess:true,protectedPlayback:true,publicVideoSeo:{available:itemId===hgVideos[0],seriesId:hgIDs[0],itemId}}}));return;
   }
   if(path==='/api/video/protected/fallback-play-info'){
    const itemId=params.item_id,payload=itemId===hgVideos[3]?{error:'public_fallback_unavailable'}:{main_url:'https://v3-hgweb.qznovelvod.com/video/clear/'+itemId+'/?mime_type=video_mp4',base_resp:{StatusCode:0,StatusMessage:''}};
    await route.fulfill({json:{status:itemId===hgVideos[3]?403:200,bodyBase64:Buffer.from(JSON.stringify(payload)).toString('base64')}});return;
   }
   if(path.startsWith('/video/public/')){
    const bytes=mp4Init();await route.fulfill({json:{status:206,headers:{'Content-Type':'video/mp4','Content-Range':'bytes 0-'+(bytes.length-1)+'/493363'},bodyBase64:bytes.toString('base64')}});return;
   }
   unexpected.push(path);await send({error:'Unexpected Hongguo fixture path '+path});return;
  }
  if(path==='/config/prod/appInit.html'){await send({urls:{cache:['https://legacy.example'],logic:['https://legacy.example']},vodTabs:[{type:'category',channelId:1,text:'电影'}],groups:[]});return;}
  if(path==='/v5/vod/home.capi'){await send({blocks:[{header:{title:'原有片源'},data:[{title:'原有影片',url:'vod/detail?vodId=1'}]}]});return;}
  unexpected.push(path);await send({error:'Unexpected fixture path '+path});
 });
 const action=(name,payload={})=>page.evaluate(([action,data])=>window.NativePageAction(action,data),[name,payload]);
 const home=async()=>{await action('page',{id:'home'});await page.locator('.hero').waitFor();};
 const source=async id=>{await page.locator('[data-act="source"][data-id="'+id+'"]').first().click();};
 await page.goto('http://127.0.0.1:'+port+'/');await page.locator('.hero').waitFor();
 assert.equal(await page.locator('.sources button').count(),7);
 await source('yqk');await page.getByRole('heading',{name:'YQK专题'}).waitFor();
 assert.equal(await page.locator('[data-act="category"][data-id="5"]').count(),1);
 assert.equal(await page.locator('.home-section .card').count(),2);
 await page.waitForFunction(()=>document.querySelector('.home-section img')?.src.startsWith('data:image/'));
 assert.ok(requests.some(r=>r.url==='https://posters.example/YQK/101.png'));
 await page.locator('.home-section [data-act="collection-link"]').click();await page.locator('.collection-content .card').first().waitFor();
 assert.equal(await page.locator('.collection-content .card').count(),2);
 await page.evaluate(()=>window.firstTopicCard=document.querySelector('.collection-content .card'));
 await action('more');await page.waitForFunction(()=>document.querySelectorAll('.collection-content .card').length===3);
 assert.equal(await page.evaluate(()=>window.firstTopicCard===document.querySelector('.collection-content .card')),true);
 assert.equal(await page.locator('.collection-content [data-act="more"]').count(),0);
 await action('collection-back');await page.locator('.hero').waitFor();
 await action('category',{id:'5'});await page.getByRole('heading',{name:'体育',exact:true}).waitFor();await page.locator('.content .card').first().waitFor();
 assert.ok(requests.some(r=>r.path==='/v2/api/channel/getVodList'&&r.params.parentChannelId===5));
 await action('category',{id:'2'});await page.getByRole('heading',{name:'电影',exact:true}).waitFor();await page.locator('.content .card').first().waitFor();
 await page.evaluate(()=>window.firstBrowseCard=document.querySelector('.content .card'));
 await action('more');await page.waitForFunction(()=>document.querySelectorAll('.content .card').length===3);
 assert.equal(await page.evaluate(()=>window.firstBrowseCard===document.querySelector('.content .card')),true);
 await action('filter-option',{key:'childChannelId',id:'9'});await page.locator('.selected-filters').waitFor();
 assert.ok(requests.some(r=>r.path==='/v2/api/channel/getVodList'&&r.params.childChannelId==='9'));
 await action('page',{id:'discover'});await page.locator('.discover-page .card').first().waitFor();
 assert.deepEqual(await page.locator('.discover-tabs button').allTextContents(),['片库','Netflix','专题']);
 assert.equal(await page.locator('.timeline-years,.timeline-months').count(),0);
 await action('page',{id:'me'});await action('me-tab',{id:'settings'});await page.locator('.settings-page').waitFor();
 assert.equal(await page.locator('#login-form').count(),0);
 await home();holdHome=true;await action('refresh');await heldRequest;
 await source('qntv');await page.getByRole('heading',{name:'QNTV专题'}).waitFor();heldResolve();
 await page.waitForTimeout(100);assert.equal(await page.getByText('YQK迟到内容',{exact:true}).count(),0);
 const yqkHeader=requests.find(r=>r.path==='/v2/api/home/header'&&r.params.reqDomain==='yqk18.app');
 const qntvHeader=requests.find(r=>r.path==='/v2/api/home/header'&&r.params.reqDomain==='qntv28.app');
 assert.ok(yqkHeader&&qntvHeader);assert.notEqual(yqkHeader.params.udid,qntvHeader.params.udid);
 await page.locator('#search-query').fill('测试影片');await page.locator('#search-form').evaluate(form=>form.requestSubmit());
 await page.getByRole('heading',{name:'“测试影片” 的搜索结果'}).waitFor();await page.locator('.content .card').first().waitFor();
 assert.match(await page.locator('.content').innerText(),/QNTV搜索影片/);
 await home();await source('dyls');await page.getByRole('heading',{name:'猎手精选'}).waitFor();
 assert.equal(await page.getByText('不应显示广告',{exact:true}).count(),0);
 await page.locator('.home-section [data-act="collection-link"]').click();await page.locator('.collection-content .card').first().waitFor();
 assert.equal(await page.locator('.collection-content .card').count(),2);
 await page.evaluate(()=>window.firstChannelCard=document.querySelector('.collection-content .card'));dylsPage=2;
 await action('more');await page.waitForFunction(()=>document.querySelectorAll('.collection-content .card').length===3);
 assert.equal(await page.evaluate(()=>window.firstChannelCard===document.querySelector('.collection-content .card')),true);
 await page.locator('.collection-content .card[data-id="A_1"]').click();await page.getByRole('heading',{name:'猎手详情 A_1',exact:true}).waitFor();
 await page.locator('.episode-page-chip[data-id="1"]').click();
 assert.equal(await page.locator('.episodes .episode').first().innerText(),'第21集');
 assert.equal(await page.locator('.episodes .episode').count(),20);
 assert.ok(requests.some(r=>r.path==='/api/v1/movie/detail'));
 assert.ok(requests.some(r=>r.path==='/api/v1/movie_addr/list'));
 await action('back');await page.locator('.collection-content .card[data-id="A_1"]').waitFor();
 await action('page',{id:'discover'});await page.locator('.discover-page .card').first().waitFor();
 assert.deepEqual(await page.locator('.discover-tabs button').allTextContents(),['片库','热播']);
 assert.equal(await page.locator('.timeline-years,.timeline-months').count(),0);
 await action('page',{id:'me'});await action('me-tab',{id:'settings'});await page.locator('.settings-page').waitFor();
 assert.equal(await page.locator('#login-form').count(),0);
 await home();await source('hongguo');await page.locator('.home-section h2').filter({hasText:'热播短剧'}).waitFor();
 const hongguoHot=page.locator('.home-section').filter({hasText:'热播短剧'}).last();
 assert.equal(await hongguoHot.locator('.card').count(),2);
 await hongguoHot.locator('[data-act="collection-link"]').click();await page.locator('.collection-content .card').first().waitFor();
 assert.equal(await page.locator('.collection-content .card').count(),1);
 await page.evaluate(()=>window.firstHongguoCard=document.querySelector('.collection-content .card'));
 await action('more');await page.waitForFunction(()=>document.querySelectorAll('.collection-content .card').length===2);
 assert.equal(await page.evaluate(()=>window.firstHongguoCard===document.querySelector('.collection-content .card')),true);
 await action('collection-back');await page.locator('.hero').waitFor();
 await action('page',{id:'discover'});await page.locator('.discover-page .card').first().waitFor();
 assert.deepEqual(await page.locator('.discover-tabs button').allTextContents(),['热播短剧','真人剧','漫剧','AI剧']);
 await page.locator('.discover-tabs [data-id="1"]').click();await page.locator('.discover-page .card').first().waitFor();
 assert.equal(await page.locator('.discover-page .card').count(),1);
 await action('discover-more');await page.waitForFunction(()=>document.querySelectorAll('.discover-page .card').length===2);
 await page.locator('.discover-page .card[data-id="'+hgIDs[0]+'"]').click();
 await page.getByRole('heading',{name:'红果首页短剧',exact:true}).waitFor();
 assert.equal(await page.locator('.episodes .episode').count(),hgVideos.length);
 assert.equal(await page.locator('.episodes .episode').first().innerText(),'第1集');
 assert.ok(requests.some(r=>r.url==='https://hongguoduanju.com/detail?series_id='+hgIDs[0]));
 await page.getByText('官网网页当前开放前 3 集完整播放，其余集请前往红果官方 App。',{exact:true}).waitFor();
 // Exercise the native bridge options with a stale full-video resume position.
 await page.evaluate(([sid,vid])=>{
  localStorage.setItem('sanyuan:history',JSON.stringify([{key:'hongguo:'+sid,siteId:'hongguo',movie:{id:sid,title:'红果首页短剧'},episodeId:vid,time:65,updated:Date.now()}]));
  window.__nativePlays=[];window.NativeTransport.native=()=>true;
  window.NativeTransport.syncPage=state=>{window.__nativePage=state;};
  window.NativeTransport.play=async(url,headers,options)=>{window.__nativePlays.push({url,headers,options});return {ok:true};};
 },[hgIDs[0],hgVideos[0]]);
 await action('episode',{id:'0'});await page.waitForFunction(()=>window.__nativePlays.length===1);
 const full=await page.evaluate(()=>window.__nativePlays[0]);
 assert.equal(full.url,'https://v3-hgweb.qznovelvod.com/video/clear/'+hgVideos[0]+'/?mime_type=video_mp4');assert.equal(full.options.startAt,65);
 await page.evaluate(context=>window.NativeTransport.onPlaybackEvent({context,status:'ended'}),full.options.context);
 await page.waitForFunction(()=>window.__nativePlays.length===2);
 assert.match((await page.evaluate(()=>window.__nativePlays[1])).url,new RegExp(hgVideos[1]));
 await action('play-source',{id:'1'});await page.waitForFunction(()=>window.__nativePage?.line===1&&!window.__nativePage.loading);
 await page.evaluate(([sid,vid])=>localStorage.setItem('sanyuan:history',JSON.stringify([{key:'hongguo:'+sid,siteId:'hongguo',movie:{id:sid,title:'红果首页短剧'},episodeId:vid,time:65,updated:Date.now()}])),[hgIDs[0],hgVideos[0]]);
 await action('episode',{id:'0'});await page.waitForFunction(()=>window.__nativePlays.length===3);
 const preview=await page.evaluate(()=>window.__nativePlays[2]);
 assert.equal(preview.url,'https://hongguoduanju.com/video/public/'+hgVideos[0]+'/360p.mp4');assert.equal(preview.options.startAt,0);
 await page.evaluate(context=>window.NativeTransport.onPlaybackEvent({context,status:'ended'}),preview.options.context);
 assert.match(await page.locator('#toast').innerText(),/公开试看已结束/);
 assert.equal(await page.evaluate(()=>window.__nativePlays.length),3,'a ten-second preview must not silently advance to the next full episode');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sanyuan:history'))[0].time),65,'a preview must not overwrite the full-video resume position');
 await action('play-source',{id:'0'});await page.waitForFunction(()=>window.__nativePage?.line===0&&!window.__nativePage.loading);
 await action('episode',{id:'3'});
 await page.waitForFunction(()=>/红果官网未提供本集的完整播放/.test(window.__nativePage?.playError));
 assert.ok(requests.some(r=>r.url==='https://hongguoduanju.com/api/video/protected/fallback-play-info'&&r.params.item_id===hgVideos[3]));
 assert.ok(!requests.some(r=>r.url.endsWith('/protected/play-info')));
 await page.evaluate(()=>{window.open=url=>{window.__openedOfficialURL=url;return null;};});
 await action('hongguo-official-page');
 await page.waitForFunction(()=>window.__openedOfficialURL==='https://hongguoduanju.com/player/7700000000000000001/8700000000000000004');
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 console.log('Website UI passed: seven sources including Hongguo, distinct YQK/QNTV identities, sports visibility, direct posters, website protocols, incremental category/topic/channel pagination, string movie IDs, 45-episode paging, complete Hongguo episode selection and official-app handoff, stale-response isolation, and source-aware discovery/account controls.');
}finally{await browser?.close();server.kill('SIGTERM');}
