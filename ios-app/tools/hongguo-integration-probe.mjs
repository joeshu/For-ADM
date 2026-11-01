// Live, read-only contract check for Hongguo's public catalogue and preview.
// Run with: node --use-env-proxy tools/hongguo-integration-probe.mjs
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {HongguoClient} from '../Web/hongguo-api.mjs';

const origin='https://hongguoduanju.com';
const storage={getItem(){return null;},setItem(){}};
async function boundedBody(response,limit){
 const reader=response.body?.getReader();if(!reader)return Buffer.alloc(0);
 const chunks=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit)throw Error('Response exceeded the probe byte limit');chunks.push(Buffer.from(part.value));}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
const transport=async({signal,...request})=>{
 const timeout=AbortSignal.timeout(20000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 const response=await fetch(request.url,{...request,signal:combined});
 const body=request.method==='HEAD'?Buffer.alloc(0):await boundedBody(response,3_500_000);
 return {status:response.status,bodyBase64:body.toString('base64'),url:response.url};
};
const client=new HongguoClient({id:'hongguo',name:'红果短剧',provider:'hongguo',origin},transport,storage);
const report={checkedAt:new Date().toISOString(),origin,scope:'Public SSR catalogue, two catalogue pages, a topic filter, one detail and official public-preview metadata. Media validation uses HEAD only; no media bytes, account data, or protected playback URLs are fetched.',home:{},categories:[],filter:null,detail:null,preview:null};

const home=await client.home();
assert.ok(home.blocks.length,'Public home returned no sections');
assert.ok(home.blocks.some(block=>block.data.length),'Public home returned no cards');
report.home={sections:home.blocks.length,cards:home.blocks.reduce((sum,block)=>sum+block.data.length,0)};

const firstCategory=await client.channel(1,{},'page=1');
const secondCategory=await client.channel(1,{},firstCategory.next);
assert.ok(firstCategory.items.length&&secondCategory.items.length,'Real-drama pagination returned an empty page');
const firstIDs=new Set(firstCategory.items.map(item=>item.url));
const newSecondPage=secondCategory.items.filter(item=>!firstIDs.has(item.url)).length;
assert.ok(newSecondPage,'Real-drama page 2 contained no new records');
report.categories.push({id:1,firstPage:firstCategory.items.length,secondPage:secondCategory.items.length,newOnSecondPage:newSecondPage,hasThirdPage:!!secondCategory.next});

for(const id of [2,3,4]){
 const page=await client.channel(id,{},'page=1');
 assert.ok(page.items.length,`Category ${id} returned no records`);
 report.categories.push({id,firstPage:page.items.length,hasNext:!!page.next});
}

const topic=client.config.channelListQuery.find(item=>item.channelId===1)?.items?.find(filter=>filter.query==='topic')?.data?.find(item=>item.id);
if(topic){
 const filtered=await client.channel(1,{topic:topic.id},'page=1');
 report.filter={topic:topic.name,items:filtered.items.length,status:'official category route returned'};
}

const firstMovie=firstCategory.items[0],id=new URLSearchParams(firstMovie.url.split('?')[1]).get('vodId');
assert.ok(id,'Catalogue card had no series id');
const detail=await client.detail(id),line=detail.playSources?.[0];
assert.ok(detail.title&&Array.isArray(detail.playSources),'Detail page mapping failed');
const episodes=await client.episodes(id,line);
report.detail={title:detail.title,siteAccessibleEpisodes:line.total,publicPreviewEpisodes:episodes.length};
report.preview={publicEpisodes:episodes.length,headStatus:null,contentType:null};
for(const episode of episodes){
 const url=new URL(episode.playUrls[0].url);
 assert.equal(url.origin,origin,'Preview URL left the official origin');
 assert.ok(url.pathname.startsWith('/video/public/'),'Episode URL was not from the official public-preview path');
}
if(episodes[0]){
 const response=await fetch(episodes[0].playUrls[0].url,{method:'HEAD',headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});
 report.preview.headStatus=response.status;
 report.preview.contentType=response.headers.get('content-type');
 assert.ok(response.status>=200&&response.status<300,'Official public preview HEAD failed');
 assert.match(report.preview.contentType||'',/video\/mp4/i,'Public preview was not served as MP4');
}

const output=new URL('../docs/hongguo-integration-probe.json',import.meta.url);
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
console.log('Report:',output.pathname);
