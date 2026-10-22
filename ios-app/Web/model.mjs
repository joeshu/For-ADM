export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function safeHTTPS(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:'';}catch{return '';}}
export function movieFrom(item){
  if(!item||typeof item!=='object'||Number(item.channelId)===5||item.isAdult||!item.title)return null;
  const route=String(item.url||'').replace(/^\//,'');if(!/^vod\/detail\?/.test(route))return null;
  const id=new URLSearchParams(route.split('?')[1]).get('vodId')||new URLSearchParams(route.split('?')[1]).get('id');if(!/^\d+$/.test(id||''))return null;
  return {id:String(id),title:String(item.title),imagePath:String(item.imagePath||''),imageGroup:String(item.imageGroup||''),subtitle:String(item.bottomLabel||item.scoreText||''),badge:String(item.topLeftLabel||item.topRightLabel||''),channelId:item.channelId,labels:Array.isArray(item.labels)?item.labels.map(x=>x.name).filter(Boolean):[]};
}
export function collectMovies(value){const out=[],seen=new Set();function visit(node,depth){if(depth>9||!node||typeof node!=='object')return;if(Array.isArray(node)){for(const item of node)visit(item,depth+1);return;}if(String(node._vod||'').startsWith('ad_')||node.type==='ad'||node.isAd)return;const movie=movieFrom(node);if(movie){if(!seen.has(movie.id)){seen.add(movie.id);out.push(movie);}return;}for(const key of ['data','items','list','vods'])if(node[key])visit(node[key],depth+1);}visit(value,0);return out;}
export function homeSections(data){return (Array.isArray(data?.blocks)?data.blocks:[]).filter(block=>!String(block._vod||'').startsWith('ad_')).map(block=>({title:String(block.header?.title||'为你推荐'),items:collectMovies(block.data).slice(0,18)})).filter(section=>section.items.length);}
export function categories(config){return (config?.vodTabs||[]).filter(tab=>tab.type==='category'&&!tab.isAdult&&Number(tab.channelId)!==5).map(tab=>({id:Number(tab.channelId),name:String(tab.text||tab.name)}));}
export function imageURLs(movie,config){const group=config?.groups?.find(x=>String(x.id)===String(movie.imageGroup));if(!movie.imagePath||!group)return [];return(group.url||[]).map(x=>safeHTTPS(String(x.domain).replace(/\/$/,'')+'/'+movie.imagePath.replace(/^\//,''))).filter(Boolean);}
export function playbackURLs(episode){return (episode?.playUrls||[]).map(entry=>({...entry,url:safeHTTPS(entry.url)})).filter(x=>x.url);}
export function sourceKey(siteId,movieId){return siteId+':'+movieId;}
