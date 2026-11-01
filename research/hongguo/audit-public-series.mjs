// Read-only audit of the website's normal compatibility endpoint.
// No App caches, content keys, signature emulation, or protected-media processing.
import {writeFile} from 'node:fs/promises';
import {HongguoClient} from '../../ios-app/Web/hongguo-api.mjs';
import {inspectMP4Init} from '../../ios-app/Web/mp4-inspection.mjs';

const series=process.argv.find(arg=>arg.startsWith('--series='))?.slice(9)||'7690961604636052505';
if(!/^\d{1,24}$/.test(series))throw Error('Invalid series ID');
const origin='https://hongguoduanju.com';
const output=new URL('./public-series-audit.json',import.meta.url);
const allowedMedia=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/^v\d+-(?:reading|hgweb)\.qznovelvod\.com$/i.test(u.hostname);}catch{return false;}};
async function boundedBody(response,limit){
 const reader=response.body?.getReader();if(!reader)return Buffer.alloc(0);
 const parts=[];let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limit)throw Error('Response exceeds audit limit');parts.push(Buffer.from(next.value));}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(parts);
}
const transport=async({signal,...request})=>{
 const response=await fetch(request.url,{...request,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
 const body=await boundedBody(response,3_500_000);
 return {status:response.status,url:response.url,headers:Object.fromEntries(response.headers),bodyBase64:body.toString('base64')};
};
const client=new HongguoClient({id:'hongguo',provider:'hongguo',origin},transport,{getItem(){return null;},setItem(){}});
const detail=await client.detail(series),episodes=await client.episodes(series,detail.playSources[0]);
const report={checkedAt:new Date().toISOString(),seriesId:series,title:detail.title,catalogueEpisodeCount:episodes.length,scope:'Known catalogue IDs only; one normal website compatibility request per episode. Up to 64 KiB of returned MP4 initialization is inspected. This does not verify end-to-end playback or full duration.',episodes:[]};
for(const [index,episode] of episodes.entries()){
 const row={number:index+1,itemId:episode.id,addressReturned:false,initializationVerified:false,completePlaybackVerified:false};
 try{
  const referer=origin+'/player/'+series+'/'+episode.id;
  const response=await fetch(origin+'/api/video/protected/fallback-play-info',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Origin:origin,Referer:referer},body:JSON.stringify({item_id:episode.id}),signal:AbortSignal.timeout(20000)});
  row.status=response.status;
  const raw=await boundedBody(response,256000);let data;try{data=JSON.parse(raw.toString());}catch{throw Error('Invalid play-info JSON');}
  row.providerError=typeof data.error==='string'?data.error.slice(0,100):'';
  if(response.ok&&Number(data.base_resp?.StatusCode)===0&&allowedMedia(data.main_url)){
   row.addressReturned=true;row.mediaHost=new URL(data.main_url).hostname;
   const media=await fetch(data.main_url,{headers:{Referer:referer,Range:'bytes=0-65535'},signal:AbortSignal.timeout(20000)});
   row.mediaStatus=media.status;row.contentRange=media.headers.get('content-range');
   const bytes=await boundedBody(media,65536),info=inspectMP4Init(bytes.toString('binary'));
   row.initialization=info;row.initializationVerified=allowedMedia(media.url)&&media.status===206&&info.mp4&&!info.encrypted;
  }
 }catch(error){row.error=String(error?.message||'Request failed').slice(0,120);}
 report.episodes.push(row);
 if((index+1)%10===0||index===episodes.length-1)console.log('Audited',index+1,'/',episodes.length);
 await new Promise(resolve=>setTimeout(resolve,150));
}
report.summary={addressCount:report.episodes.filter(row=>row.addressReturned).length,initializationCount:report.episodes.filter(row=>row.initializationVerified).length,deniedCount:report.episodes.filter(row=>row.status===403).length,otherErrorCount:report.episodes.filter(row=>row.error||(!row.addressReturned&&row.status!==403)).length,allAddressesAvailable:report.episodes.length>0&&report.episodes.every(row=>row.addressReturned&&row.initializationVerified),allEpisodesPlaybackVerified:false};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({title:report.title,catalogue:episodes.length,...report.summary,report:output.pathname},null,2));
// Denials/errors must not yield a successful source-availability self-test.
if(!report.summary.allAddressesAvailable)process.exitCode=1;
