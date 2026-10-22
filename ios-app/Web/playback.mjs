import {playbackURLs,safeHTTPS} from './model.mjs';
import {ServiceError} from './site-api.mjs';
export class MediaError extends Error {constructor(message,status=0){super(message);this.status=status;}}
const urlsFrom=data=>playbackURLs({playUrls:Array.isArray(data)?data:data?.playUrls||data?.urls||[]}).concat(data?.url?playbackURLs({playUrls:[data]}):[]);
export async function resolvePlayback(client,vodId,line,episode,signal,{refresh=false}={}){
 const urls=episode.open&&!refresh?playbackURLs(episode):urlsFrom(await client.play({vodId,siteId:line.siteId,episodeId:episode.id},signal));
 if(!urls.length)throw new MediaError('这条线路暂未返回播放地址');
 return urls;
}
export function matchingEpisode(requested,list,{singleMovie=false}={}){
 const key=e=>{const title=String(e.title||'').trim().toLowerCase().replace(/\s+/g,'');const n=title.match(/^(?:第|ep(?:isode)?[._-]?)?0*(\d+)(?:集|话|期)?$/);return n?'number:'+Number(n[1]):title;};
 const target=key(requested);const index=list.findIndex(e=>target?key(e)===target||(!key(e)&&e.id===requested.id):e.id===requested.id);
 return index>=0?index:singleMovie&&list.length===1?0:-1;
}
async function mediaRequest(client,url,signal,method='GET'){
 const ctrl=new AbortController(),abort=()=>ctrl.abort();if(signal?.aborted)throw new DOMException('请求取消','AbortError');signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,8000);
 try{return await client.transport({url,method,headers:{Referer:client.site.origin+'/'},signal:ctrl.signal});}
 catch(error){if(signal?.aborted)throw new DOMException('请求取消','AbortError');const problem=new MediaError(error.name==='AbortError'?'视频线路检查超时':error.message);problem.certificate=/CERT|TLS/.test(String(error.cause?.code||error.code||''))||[-1200,-1201,-1202,-1203,-1204,-1205,-1206].includes(error.code);throw problem;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function playlist(response){if(response.status<200||response.status>=300)throw new MediaError('视频线路返回 HTTP '+response.status,response.status);let text;try{text=atob(response.bodyBase64||'').replace(/^\u00ef\u00bb\u00bf/,'').trim();}catch{throw new MediaError('视频清单格式错误');}if(!text.startsWith('#EXTM3U'))throw new MediaError('视频线路未返回有效播放清单');return text;}
export async function verifyMedia(client,url,signal){
 const hls=/\.m3u8(?:$|\?)/i.test(new URL(url).pathname+new URL(url).search),response=await mediaRequest(client,url,signal,hls?'GET':'HEAD');
 if(!hls){if((response.status<200||response.status>=300)&&![405,501].includes(response.status))throw new MediaError('视频线路返回 HTTP '+response.status,response.status);return;}
 const text=playlist(response);
 if(text.includes('#EXT-X-STREAM-INF:')){const next=text.split(/\r?\n/).find(x=>x.trim()&&!x.startsWith('#'));const child=next&&safeHTTPS(new URL(next.trim(),response.url||url).href);if(!child)throw new MediaError('视频清单缺少有效子线路');playlist(await mediaRequest(client,child,signal));}
}
export async function resolvePlayableEpisode(client,detail,lineIndex,episodeIndex,signal,onAttempt=()=>{}){
 const lines=detail.playSources||[],original=lines[lineIndex],requested=original?.list?.[episodeIndex];if(!requested)throw new MediaError('未找到选集');
 const preferred=lines.findIndex(x=>x.siteId===client.preferredPlaybackSiteId),order=[...new Set([lineIndex,preferred,...lines.map((_,i)=>i)].filter(i=>i>=0))].slice(0,5),badHosts=new Set();let last;
 for(const index of order){
  if(signal?.aborted)throw new DOMException('请求取消','AbortError');const line=lines[index];onAttempt(line.name||'播放线路');
  try{
   if(!Array.isArray(line.list)||!line.list.length)line.list=await client.episodes(detail.id,line,signal);
   const at=index===lineIndex?episodeIndex:matchingEpisode(requested,line.list||[],{singleMovie:Number(detail.channelId)===1&&original.list.length===1});if(at<0)continue;const episode=line.list[at];
   let urls=await resolvePlayback(client,detail.id,line,episode,signal),checked=[],expired=false;
   const inspect=async candidates=>{for(const entry of candidates.slice(0,3)){const host=new URL(entry.url).host;if(badHosts.has(host))continue;try{await verifyMedia(client,entry.url,signal);checked.push(entry);return;}catch(error){if(error.name==='AbortError')throw error;if(error instanceof ServiceError)throw error;last=error;if(error.certificate)badHosts.add(host);if([403,404,410].includes(error.status))expired=true;}}};
   await inspect(urls);
   if(!checked.length&&expired&&episode.open){urls=await resolvePlayback(client,detail.id,line,episode,signal,{refresh:true});await inspect(urls);}
   if(checked.length){client.preferredPlaybackSiteId=line.siteId;return {lineIndex:index,episodeIndex:at,episode,urls:[...checked,...urls.filter(x=>!checked.some(y=>y.url===x.url))],switched:index!==lineIndex};}
  }catch(error){if(error.name==='AbortError'||error instanceof ServiceError)throw error;last=error;}
 }
 throw new MediaError('暂未找到可用的同集线路。'+(last?.message||'请稍后重试或手动切换线路。'));
}
