// Exercise the App's real client factory, model and five-line playback resolver.
// Metadata and small HLS playlists only; no credentials, signed URLs or segments
// are persisted. Run NODE_USE_ENV_PROXY=1 node tools/source-integration-probe.mjs.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createSourceClient} from '../Web/source-clients.mjs';
import {homeSections,categories,collectMovies,sectionItems,collectionGroups} from '../Web/model.mjs';
import {resolvePlayableEpisode} from '../Web/playback.mjs';

globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const sites=JSON.parse(await fs.readFile(new URL('../Web/sites.json',import.meta.url),'utf8'));
const output=new URL('../docs/source-integration-probe.json',import.meta.url);
const selected=process.argv.find(x=>x.startsWith('--site='))?.slice(7);
if(selected&&!['yqk','qntv','dyls'].includes(selected))throw Error('Unknown source selector');
const previous=selected?JSON.parse(await fs.readFile(output,'utf8').catch(()=>'{}')):{};
const report={checkedAt:new Date().toISOString(),scope:'Real App client factory + shared models + resolvePlayableEpisode; one sample film and at most five same-episode source lines per source; metadata, HEAD and small HLS playlists only. No accounts or video segments. AVPlayer decoding is not verified.',sources:(previous.sources||[]).filter(s=>s.id!==selected)};
const sampleIDs={yqk:'159159',qntv:'159159',dyls:'nrLxl'};
const clean=value=>String(value||'').replace(/https?:\/\/\S+/g,'<url>').slice(0,350);
function memoryStorage(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
async function readBounded(response,limit){
 const reader=response.body?.getReader();if(!reader)return Buffer.alloc(0);const chunks=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit)throw Error('Response exceeded the metadata/playlist byte limit');chunks.push(Buffer.from(part.value));}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
for(const site of sites.filter(s=>Object.hasOwn(sampleIDs,s.id)&&(!selected||s.id===selected))){
 const row={id:site.id,checkedAt:new Date().toISOString(),success:false,steps:{},apiRequests:[],mediaRequests:[],decodedPlaybackVerified:false};report.sources.push(row);
 const mediaByURL=new Map();let stage='bootstrap';
 const transport=async({signal,...request})=>{
  const target=new URL(request.url),isAPI=/\/(?:api\/|v[12]\/api\/)/.test(target.pathname),method=request.method||'GET';
  const event=isAPI?{method,endpoint:target.pathname}:{method,host:target.host,pathExtension:target.pathname.match(/\.[A-Za-z0-9]+$/)?.[0]||''};
  const media=!isAPI&&!target.pathname.endsWith('.js');
  if(isAPI)row.apiRequests.push(event);else if(media){row.mediaRequests.push(event);mediaByURL.set(request.url,event);}
  try{
   const timeout=AbortSignal.timeout(25000),res=await fetch(request.url,{...request,signal:signal?AbortSignal.any([signal,timeout]):timeout});
   event.status=res.status;event.responseHost=new URL(res.url).host;event.contentType=res.headers.get('content-type')||'';
   const body=method==='HEAD'?Buffer.alloc(0):await readBounded(res,isAPI?2*1024*1024:512*1024);
   if(media)event.validPlaylist=res.status>=200&&res.status<300&&body.toString('utf8').trimStart().startsWith('#EXTM3U');
   console.log(`[${site.id}] ${method} ${isAPI?target.pathname:target.host} HTTP ${res.status}${media?' HLS='+!!event.validPlaylist:''}`);
   return {status:res.status,bodyBase64:body.toString('base64'),url:res.url};
  }catch(error){event.error=clean(error.cause?.code||error.message);console.log(`[${site.id}] ${method} ${isAPI?target.pathname:target.host} ERROR ${event.error}`);throw error;}
 };
 try{
  const client=createSourceClient(site,transport,memoryStorage()),config=await client.bootstrap(),cats=categories(config);
  assert.ok(cats.length>0,'No visible categories');row.steps.bootstrap={categories:cats.length,supportsAccount:config.supportsAccount!==false};
  stage='home';const home=homeSections(await client.home()),homeCount=home.reduce((n,s)=>n+s.items.length,0);assert.ok(home.length&&homeCount,'Home had no native film cards');row.steps.home={sections:home.length,films:homeCount};
  stage='category-pagination';const category=cats.find(c=>/^电影$/.test(c.name))||cats[0];
  const first=await client.channel(category.id),firstItems=collectMovies(first.items);assert.ok(firstItems.length,'Category page 1 was empty');assert.ok(first.next,'Large sample category returned no continuation');
  const second=await client.channel(category.id,{},first.next),secondItems=collectMovies(second.items),ids=new Set(firstItems.map(x=>x.id)),newCount=secondItems.filter(x=>!ids.has(x.id)).length;
  assert.ok(secondItems.length&&newCount>0,'Category page 2 did not contain new films');row.steps.pagination={category:category.name,firstCount:firstItems.length,secondCount:secondItems.length,newCount,overlap:secondItems.length-newCount};
  stage='search';const searched=collectMovies((await client.search('抓娃娃')).items);assert.ok(searched.length,'Search returned no native film cards');row.steps.search={query:'抓娃娃',films:searched.length};
  stage='home-more';const section=home.find(s=>s.route);assert.ok(section,'No server-backed More route on the home page');
  const more=await client.collection(section.route),moreItems=sectionItems(more.items),moreGroups=collectionGroups(more),moreCount=moreItems.length+moreGroups.reduce((n,g)=>n+g.items.length,0);
  assert.ok(moreCount,'Home More returned no films');row.steps.homeMore={title:section.title,kind:section.route.kind,films:moreCount,hasNext:!!more.next};
  stage='detail';const detail=await client.detail(sampleIDs[site.id]);assert.ok(detail.id&&detail.title,'Invalid detail');assert.ok(detail.playSources?.length,'Detail had no playback sources');
  const selectedLine=detail.playSources[0];if(!selectedLine.list?.length)selectedLine.list=await client.episodes(detail.id,selectedLine);
  assert.ok(selectedLine.list?.length,'Selected source had no episodes');row.steps.detail={id:detail.id,title:detail.title,lines:detail.playSources.length,selectedLine:selectedLine.name,episodes:selectedLine.list.length,selectedEpisode:selectedLine.list[0].title};
  stage='shared-playback-resolver';const attempts=[];
  const resolved=await resolvePlayableEpisode(client,detail,0,0,undefined,name=>{attempts.push(name);assert.ok(attempts.length<=5,'Shared resolver exceeded five source lines');});
  const entry=resolved.urls[0],master=mediaByURL.get(entry.url),lastMedia=row.mediaRequests.at(-1),hls=/\.m3u8$/i.test(new URL(entry.url).pathname);
  assert.ok(master,'Resolver returned a URL without a media transport request');
  assert.ok(hls?master.validPlaylist&&lastMedia?.validPlaylist:master.status>=200&&master.status<300,'Resolver did not verify a successful media response');
  row.steps.playback={attempts,lineIndex:resolved.lineIndex,lineName:detail.playSources[resolved.lineIndex].name,episodeId:resolved.episode.id,episodeTitle:resolved.episode.title,switched:resolved.switched,mediaHost:new URL(entry.url).host,status:master.status,validPlaylist:!!master.validPlaylist,finalRequestHost:lastMedia?.responseHost||lastMedia?.host,finalRequestStatus:lastMedia?.status,finalRequestValidPlaylist:!!lastMedia?.validPlaylist,referrerPolicy:entry.referrerPolicy||'site-default',headerNames:Object.keys(entry.headers||{})};
  row.success=true;console.log(`[${site.id}] PASS selected ${row.steps.playback.lineName}, final host ${row.steps.playback.finalRequestHost}`);
 }catch(error){row.failedStage=stage;row.error=clean(error.message);row.errorCode=error.code||error.status||null;console.log(`[${site.id}] FAIL at ${stage}: ${row.error}`);}
 await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
}
console.log('Report:',output.pathname);
if(report.sources.some(row=>!row.success))process.exitCode=1;
