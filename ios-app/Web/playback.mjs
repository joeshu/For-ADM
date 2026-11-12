import {orderLinesByHealth} from './player-controller.mjs';
import {playbackURLs,safeHTTPS} from './model.mjs';
import {ServiceError} from './site-api.mjs';
export class MediaError extends Error {constructor(message,status=0){super(message);this.status=status;}}
const urlsFrom=data=>playbackURLs({playUrls:Array.isArray(data)?data:data?.playUrls||data?.urls||[]}).concat(data?.url?playbackURLs({playUrls:[data]}):[]);
export function mediaHeaders(client,entry={}){
 const headers={...(entry.referrerPolicy==='no-referrer'?{}:{Referer:client.site.origin+'/'}),...entry.headers};
 return Object.fromEntries(Object.entries(headers).filter(([,v])=>typeof v==='string'&&v.length));
}
export function prioritizeMediaCandidates(urls=[]){
 if(!Array.isArray(urls)||urls.length<=1)return Array.isArray(urls)?urls:[];
 const isM3U8=entry=>{try{const u=new URL(entry?.url||'');return /\.m3u8(?:$|\?)/i.test(u.pathname+u.search);}catch{return false;}};
 const hls=[],other=[];
 for(const item of urls)(isM3U8(item)?hls:other).push(item);
 return [...hls,...other];
}
export async function resolvePlayback(client,vodId,line,episode,signal,{refresh=false}={}){
 const raw=episode.open&&!refresh?playbackURLs(episode):urlsFrom(await client.play({vodId,siteId:line.siteId,episodeId:episode.id},signal));
 const urls=prioritizeMediaCandidates(raw);
 if(!urls.length)throw new MediaError('这条线路暂未返回播放地址');
 return urls;
}
// A1 先播后验的快路径：只取地址，不做清单验证。按与
// resolvePlayableEpisode 相同的线路顺序取第一条有地址的线路；
// 调用方先用这条地址起播，验证在后台并行跑。
export async function resolveFirstCandidate(client,detail,lineIndex,episodeIndex,signal,{excludedLines=[],lineHealth={}}={}){
 const lines=detail.playSources||[],original=lines[lineIndex],requested=original?.list?.[episodeIndex];
 if(!original||!requested)throw new MediaError('未找到选集');
 const order=orderLinesByHealth(lines,lineIndex,client.preferredPlaybackSiteId,lineHealth,client.site?.id||'',excludedLines);
 let last;
 for(const index of order){
  if(signal?.aborted)throw new DOMException('请求取消','AbortError');
  const line=lines[index];
  try{
   if(!Array.isArray(line.list)||!line.list.length||line.list.length<Number(line.total||0)){const list=await client.episodes(detail.id,line,signal);if(Array.isArray(list)&&list.length)line.list=list;}
   const at=index===lineIndex?episodeIndex:matchingEpisode(requested,line.list||[],{singleMovie:Number(detail.channelId)===1&&original.list.length===1,singleEpisodeSource:original.list.length===1});
   if(at<0)continue;
   const urls=await resolvePlayback(client,detail.id,line,line.list[at],signal);
   if(!urls.length)continue;
   return {lineIndex:index,episodeIndex:at,episode:line.list[at],urls,switched:index!==lineIndex};
  }catch(error){if(error.name==='AbortError'||error instanceof ServiceError)throw error;last=error;}
 }
 throw new MediaError('暂未找到可用的同集线路。'+(last?.message||'请稍后重试或手动切换线路。'));
}
export function matchingEpisode(requested,list,{singleMovie=false,singleEpisodeSource=false}={}){
 const key=e=>{const title=String(e.title||'').trim().toLowerCase().replace(/\s+/g,'');const n=title.match(/^(?:第|ep(?:isode)?[._-]?)?0*(\d+)(?:集|话|期)?$/);return n?'number:'+Number(n[1]):title;};
 const target=key(requested);const index=list.findIndex(e=>target?key(e)===target||(!key(e)&&e.id===requested.id):e.id===requested.id);
 if(index>=0)return index;
 if(list.length!==1)return -1;
 const extra=e=>/预告|花絮|特辑|trailer|teaser|behind.the.scenes/i.test(e?.title||'');
 if(extra(requested)||extra(list[0]))return -1;
 const filmQuality=e=>/^(?:(?:tc|hd|bd|sd|4k|1080p|720p|2160p|蓝光|正片|高清|超清|标清|国语|粤语|中字|国粤双语|中英双字)[\s._-]*)+$/i.test(String(e?.title||'').trim());
 return singleMovie||(singleEpisodeSource&&filmQuality(requested)&&filmQuality(list[0]))?0:-1;
}
async function mediaRequest(client,url,signal,method='GET',headers={}){
 const ctrl=new AbortController(),abort=()=>ctrl.abort();if(signal?.aborted)throw new DOMException('请求取消','AbortError');signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,8000);
 try{return await client.transport({url,method,headers,signal:ctrl.signal});}
 catch(error){if(signal?.aborted)throw new DOMException('请求取消','AbortError');const problem=new MediaError(error.name==='AbortError'?'视频线路检查超时':error.message);problem.certificate=/CERT|TLS/.test(String(error.cause?.code||error.code||''))||[-1200,-1201,-1202,-1203,-1204,-1205,-1206].includes(error.code);throw problem;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function playlist(response){if(response.status<200||response.status>=300)throw new MediaError('视频线路返回 HTTP '+response.status,response.status);let text;try{const binary=atob(response.bodyBase64||''),bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('gb18030').decode(bytes);}text=text.replace(/^\uFEFF/,'').trim();}catch{throw new MediaError('视频清单格式错误');}if(!text.startsWith('#EXTM3U'))throw new MediaError('视频线路未返回有效播放清单');return text;}
export function parseMasterVariants(text,baseURL){
 const lines=String(text||'').split(/\r?\n/),variants=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(!line.startsWith('#EXT-X-STREAM-INF:'))continue;
  const bwMatch=line.match(/BANDWIDTH=(\d+)/i),resMatch=line.match(/RESOLUTION=(\d+)x(\d+)/i);
  const bandwidth=bwMatch?Number(bwMatch[1]):0,width=resMatch?Number(resMatch[1]):0,height=resMatch?Number(resMatch[2]):0;
  const label=height>=2160?'4K UHD':height>=1080?'1080p FHD':height>=720?'720p HD':height>0?`${height}p`:bandwidth>=2500000?'高码率':bandwidth>0?`${Math.round(bandwidth/1000)}kbps`:'自适应';
  for(let j=i+1;j<lines.length;j++){
   const candidate=lines[j].trim();if(!candidate)continue;if(candidate.startsWith('#'))break;
   const href=safeHTTPS(new URL(candidate,baseURL).href);
   if(href)variants.push({href,bandwidth,width,height,label,order:variants.length});
   break;
  }
 }
 variants.sort((a,b)=>(b.height-a.height)||(b.bandwidth-a.bandwidth)||(a.order-b.order));
 return variants;
}
export function selectBestMasterVariant(text,baseURL){
 const variants=parseMasterVariants(text,baseURL);
 if(variants.length)return variants[0].href;
 const lines=String(text||'').split(/\r?\n/);
 const next=lines.find(x=>x.trim()&&!x.trim().startsWith('#'));
 return next?safeHTTPS(new URL(next.trim(),baseURL).href):'';
}
export async function verifyMedia(client,url,signal,headers={},referrerPolicy){
 headers=mediaHeaders(client,{headers,referrerPolicy});
 const parsed=new URL(url),hls=/\.m3u8(?:$|\?)/i.test(parsed.pathname+parsed.search),response=await mediaRequest(client,url,signal,hls?'GET':'HEAD',headers);
 if(!hls){
  if((response.status<200||response.status>=300)&&![405,501].includes(response.status))throw new MediaError('视频线路返回 HTTP '+response.status,response.status);
  const type=Object.entries(response.headers||{}).find(([k])=>k.toLowerCase()==='content-type')?.[1]||'';
  if(/text\/html|application\/(?:json|xml)/i.test(type))throw new MediaError('该线路返回网页，未返回媒体文件');
  return {hls:false,qualityLabel:'',bandwidth:0};
 }
 const text=playlist(response),masterURL=safeHTTPS(response.url||url)||url,warmPlaylists=[];
 const remember=(entryURL,body,baseURL=entryURL)=>{if(!entryURL||!body||warmPlaylists.some(item=>item.url===entryURL))return;warmPlaylists.push(baseURL&&baseURL!==entryURL?{url:entryURL,text:body,baseURL}:{url:entryURL,text:body});};
 remember(url,text,masterURL);remember(masterURL,text,masterURL);
 if(text.includes('#EXT-X-STREAM-INF:')){
  const variants=parseMasterVariants(text,masterURL),child=variants[0]?.href||selectBestMasterVariant(text,masterURL);
  if(!child)throw new MediaError('视频清单缺少有效子线路');
  const childResponse=await mediaRequest(client,child,signal,'GET',headers),childText=playlist(childResponse),childFinal=safeHTTPS(childResponse.url||child)||child;
  remember(child,childText,childFinal);remember(childFinal,childText,childFinal);
  return {hls:true,qualityLabel:variants[0]?.label||'',bandwidth:variants[0]?.bandwidth||0,variants,warmPlaylists};
 }
 return {hls:true,qualityLabel:'',bandwidth:0,variants:[],warmPlaylists};
}
export async function resolvePlayableEpisode(client,detail,lineIndex,episodeIndex,signal,onAttempt=()=>{},{excludedSites=[],excludedLines=[],initialUrls=null,initialLineIndex=-1,lineHealth={}}={}){
 const lines=detail.playSources||[],original=lines[lineIndex],requested=original?.list?.[episodeIndex];if(!requested)throw new MediaError('未找到选集');
 const order=orderLinesByHealth(lines,lineIndex,client.preferredPlaybackSiteId,lineHealth,client.site?.id||'',excludedLines).filter(i=>!excludedSites.includes(lines[i]?.siteId)),badHosts=new Set();let last;
 for(const index of order){
  if(signal?.aborted)throw new DOMException('请求取消','AbortError');const line=lines[index];onAttempt(line.name||'播放线路');
  try{
   if(!Array.isArray(line.list)||!line.list.length||line.list.length<Number(line.total||0)){const list=await client.episodes(detail.id,line,signal);if(Array.isArray(list)&&list.length)line.list=list;}
   const at=index===lineIndex?episodeIndex:matchingEpisode(requested,line.list||[],{singleMovie:Number(detail.channelId)===1&&original.list.length===1,singleEpisodeSource:original.list.length===1});if(at<0)continue;const episode=line.list[at];
   const reuseInitial=index===initialLineIndex&&Array.isArray(initialUrls)&&initialUrls.length;
   let urls=reuseInitial?initialUrls.map(item=>({...item})):await resolvePlayback(client,detail.id,line,episode,signal),checked=[],expired=false,latencyMs=0,qualityLabel='',bandwidth=0;
   const inspect=async candidates=>{
    // 候选地址并行验证：三条一起验，取第一条通过的；其余通过的也
    // 留在 checked 里备用。每条通过的地址都打上 verifiedMeta，供
    // 后台验证合并与恢复流程直接复用，不必重复验。
    const targets=candidates.slice(0,3).filter(entry=>{try{return !badHosts.has(new URL(entry.url).host);}catch{return false;}});
    const t0=Date.now();
    const outcomes=await Promise.all(targets.map(entry=>verifyMedia(client,entry.url,signal,entry.headers,entry.referrerPolicy).then(meta=>({entry,meta,error:null}),error=>({entry,meta:null,error}))));
    for(const {entry,meta,error} of outcomes){
     if(error){if(error.name==='AbortError')throw error;if(error instanceof ServiceError)throw error;last=error;if(error.certificate){try{badHosts.add(new URL(entry.url).host);}catch{}}if([403,404,410].includes(error.status))expired=true;continue;}
     if(!checked.length){latencyMs=Math.max(1,Date.now()-t0);qualityLabel=meta?.qualityLabel||'';bandwidth=meta?.bandwidth||0;}
     entry.cicadaURL=meta?.variants?.[0]?.href||'';
     entry.verifiedMeta={qualityLabel:meta?.qualityLabel||'',bandwidth:meta?.bandwidth||0,warmPlaylists:meta?.warmPlaylists||[],cicadaURL:entry.cicadaURL};
     checked.push(entry);
    }
   };
   await inspect(urls);
   if(!checked.length&&expired&&(episode.open||reuseInitial)){urls=await resolvePlayback(client,detail.id,line,episode,signal,{refresh:true});await inspect(urls);}
   if(checked.length){if(!line.preview)client.preferredPlaybackSiteId=line.siteId;return {lineIndex:index,episodeIndex:at,episode,urls:[...checked,...urls.filter(x=>!checked.some(y=>y.url===x.url))],switched:index!==lineIndex,latencyMs,qualityLabel,bandwidth};}
  }catch(error){if(error.name==='AbortError'||error instanceof ServiceError)throw error;last=error;}
 }
 throw new MediaError('暂未找到可用的同集线路。'+(last?.message||'请稍后重试或手动切换线路。'));
}
