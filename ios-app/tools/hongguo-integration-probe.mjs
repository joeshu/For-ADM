// Live, read-only contract check for Hongguo's public catalogue and playback API.
// Run with: node --use-env-proxy tools/hongguo-integration-probe.mjs
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {HongguoClient} from '../Web/hongguo-api.mjs';

const origin='https://hongguoduanju.com';
const output=new URL('../docs/hongguo-integration-probe.json',import.meta.url);
const report={checkedAt:new Date().toISOString(),origin,scope:'Live, read-only crawl of public SSR pages, category pagination, topic filtering, a full episode list, and the official anonymous play-info endpoint. Media validation uses HEAD only; no media bytes or account data are fetched.',home:{},categories:[],filter:null,detail:null,playback:null,ssrContract:{}};
async function boundedBody(response,limit){
 const reader=response.body?.getReader();if(!reader)return Buffer.alloc(0);
 const chunks=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit)throw Error('Response exceeded the probe byte limit');chunks.push(Buffer.from(part.value));}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
async function main(){
 const storage={getItem(){return null;},setItem(){}};
 const transport=async({signal,...request})=>{
  const timeout=AbortSignal.timeout(20000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
  const response=await fetch(request.url,{...request,signal:combined});
  const body=request.method==='HEAD'?Buffer.alloc(0):await boundedBody(response,3_500_000);
  return {status:response.status,bodyBase64:body.toString('base64'),url:response.url};
 };
 const client=new HongguoClient({id:'hongguo',name:'红果短剧',provider:'hongguo',origin},transport,storage);

const home=await client.home();
assert.ok(home.blocks.length,'Public home returned no sections');
assert.ok(home.blocks.some(block=>block.data.length),'Public home returned no cards');
report.home={sections:home.blocks.length,cards:home.blocks.reduce((sum,block)=>sum+block.data.length,0)};
assert.equal(client.lastDiagnostics?.ok,true,'Homepage SSR shape was not recognized');
report.ssrContract.home=client.lastDiagnostics;

const firstCategory=await client.channel(1,{},'page=1');
const secondCategory=await client.channel(1,{},firstCategory.next);
assert.ok(firstCategory.items.length&&secondCategory.items.length,'Real-drama pagination returned an empty page');
const firstIDs=new Set(firstCategory.items.map(item=>item.url));
const newSecondPage=secondCategory.items.filter(item=>!firstIDs.has(item.url)).length;
assert.ok(newSecondPage,'Real-drama page 2 contained no new records');
report.categories.push({id:1,firstPage:firstCategory.items.length,secondPage:secondCategory.items.length,newOnSecondPage:newSecondPage,hasThirdPage:!!secondCategory.next});
assert.equal(client.lastDiagnostics?.ok,true,'Category SSR shape was not recognized');
report.ssrContract.categoryPage2=client.lastDiagnostics;

for(const id of [2,3,4]){
 const page=await client.channel(id,{},'page=1');
 assert.ok(page.items.length,`Category ${id} returned no records`);
 report.categories.push({id,firstPage:page.items.length,hasNext:!!page.next});
}

const topic=client.config.channelListQuery.find(item=>item.channelId===1)?.items?.find(filter=>filter.query==='topic')?.data?.find(item=>item.id);
assert.ok(topic,'Real-drama topic selector missing from the official page');
const filtered=await client.channel(1,{topic:topic.id},'page=1');
assert.ok(filtered.items.length,'Official topic filter returned no catalogue results');
report.filter={topic:topic.name,items:filtered.items.length,status:'official category route returned'};

const firstMovie=firstCategory.items[0],id=new URLSearchParams(firstMovie.url.split('?')[1]).get('vodId');
assert.ok(id,'Catalogue card had no series id');
const detail=await client.detail(id),line=detail.playSources?.[0];
assert.ok(detail.title&&Array.isArray(detail.playSources),'Detail page mapping failed');
assert.equal(client.lastDiagnostics?.ok,true,'Detail SSR shape was not recognized');
const episodes=await client.episodes(id,line);
assert.ok(episodes.length>1,'Sample official series did not expose a complete episode list');
assert.equal(episodes.length,Number(detail.playSources[0].total),'UI episode list did not include the complete official video ID list');
const detailRecord=client.details.get(String(id));
report.detail={title:detail.title,episodeCount:episodes.length,websiteAnonymousOpenCount:detailRecord?.accessible||0};
report.ssrContract.detail=client.lastDiagnostics;
if(episodes[1]){
 const playback=await client.play({vodId:id,siteId:line.siteId,episodeId:episodes[1].id});
 const url=playback.playUrls[0].url,parsed=new URL(url);
 assert.match(parsed.hostname,/^v\d+-hgweb\.qznovelvod\.com$/i,'Unexpected official video host');
 const response=await fetch(url,{method:'HEAD',headers:{'User-Agent':'Mozilla/5.0',Referer:origin+'/player/'+id+'/'+episodes[1].id},signal:AbortSignal.timeout(20000)});
 report.playback={episode:episodes[1].title,officialPlayInfo:'available',mediaHost:parsed.hostname,headStatus:response.status,contentType:response.headers.get('content-type')};
 assert.ok(response.status>=200&&response.status<300,'Official play-info media HEAD failed');
 assert.match(report.playback.contentType||'',/video\/mp4/i,'Official video was not served as MP4');
 const protectedEpisode=episodes[detailRecord?.accessible||0];
 if(protectedEpisode){
  try{await client.play({vodId:id,siteId:line.siteId,episodeId:protectedEpisode.id});report.playback.firstBeyondWebsiteOpenCount='official endpoint returned a URL';}
  catch(error){report.playback.firstBeyondWebsiteOpenCount=Number(error.code)===403?'official web endpoint returned 403; playback remains subject to official free-access flow':'official endpoint error: '+String(error.code||error.message).slice(0,120);}
 }
}

 await writeFile(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 console.log('Report:',output.pathname);
}

main().catch(async error=>{
 report.failure={name:String(error?.name||'Error'),message:String(error?.message||error).slice(0,240),code:error?.code??null};
 await writeFile(output,JSON.stringify(report,null,2)+'\n').catch(()=>{});
 console.error('Hongguo live probe failed:',report.failure);
 process.exitCode=1;
});
