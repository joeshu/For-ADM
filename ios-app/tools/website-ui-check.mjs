// Offline integration check for the three website clients through the real UI bundle.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

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
 await page.route('**/__transport',async route=>{
  const req=route.request().postDataJSON(),url=new URL(req.url),path=url.pathname;
  const params=req.body?JSON.parse(req.body):{};
  requests.push({url:req.url,path,params,headers:req.headers});
  const send=async data=>{try{await route.fulfill({json:encoded(data)});}catch(error){if(!/already handled|Invalid Interception|Target closed|Fetch.enable|interception/i.test(error.message))throw error;}};
  if(url.hostname==='posters.example'){await route.fulfill({json:{status:200,bodyBase64:png}});return;}
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
  if(path==='/config/prod/appInit.html'){await send({urls:{cache:['https://legacy.example'],logic:['https://legacy.example']},vodTabs:[{type:'category',channelId:1,text:'电影'}],groups:[]});return;}
  if(path==='/v5/vod/home.capi'){await send({blocks:[{header:{title:'原有片源'},data:[{title:'原有影片',url:'vod/detail?vodId=1'}]}]});return;}
  unexpected.push(path);await send({error:'Unexpected fixture path '+path});
 });
 const action=(name,payload={})=>page.evaluate(([action,data])=>window.NativePageAction(action,data),[name,payload]);
 const home=async()=>{await action('page',{id:'home'});await page.locator('.hero').waitFor();};
 const source=async id=>{await page.locator('[data-act="source"][data-id="'+id+'"]').first().click();};
 await page.goto('http://127.0.0.1:'+port+'/');await page.locator('.hero').waitFor();
 assert.equal(await page.locator('.sources button').count(),6);
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
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 console.log('Website UI passed: six sources, distinct YQK/QNTV identities, sports visibility, direct posters, website protocols, incremental category/topic/channel pagination, string movie IDs, 45-episode paging, stale-response isolation, and source-aware discovery/account controls.');
}finally{await browser?.close();server.kill('SIGTERM');}
