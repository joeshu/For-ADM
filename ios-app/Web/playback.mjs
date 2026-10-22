import {playbackURLs} from './model.mjs';
import {ServiceError} from './site-api.mjs';
export async function resolvePlayback(client,vodId,line,episode,signal){
 let urls;
 if(episode.open)urls=playbackURLs(episode);
 else {
  // A cached address on a closed episode does not grant playback permission.
  const data=await client.play({vodId,siteId:line.siteId,episodeId:episode.id},signal);
  urls=playbackURLs({playUrls:Array.isArray(data)?data:data?.playUrls||data?.urls||[]});
  if(!urls.length&&data?.url)urls=playbackURLs({playUrls:[data]});
 }
 if(!urls.length)throw new ServiceError('服务未返回可播放地址，请检查本站会话、资源权限或切换线路');
 return urls;
}
