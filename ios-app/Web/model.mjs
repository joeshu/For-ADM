export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function safeHTTPS(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:'';}catch{return '';}}
// Image CDNs sometimes return protocol-relative, HTTP, or path-relative covers
// even when their HTTPS site is available. Keep playback URLs strict; only
// image metadata is upgraded/resolved here, and never allow non-web schemes.
export function safeImageURL(value,base){
 const raw=String(value??'').trim();if(!raw||/[\r\n]/.test(raw))return '';
 try{const url=new URL(raw.startsWith('//')?'https:'+raw:raw,base);if(url.protocol==='http:')url.protocol='https:';return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
const flaggedAdult=(item,adultChannelIds)=>!!item&&(item.isAdult===true||Number(item.isAdult)===1||(Array.isArray(adultChannelIds)?adultChannelIds.map(String).includes(String(item.channelId)):Number(item.channelId)===5));
export function movieFrom(item,{includeAdult=false}={}){
  if(!item||typeof item!=='object'||(!includeAdult&&flaggedAdult(item))||!item.title)return null;
  const route=String(item.url||'').replace(/^\//,'');if(!/^vod\/detail\?/.test(route))return null;
  const id=new URLSearchParams(route.split('?')[1]).get('vodId')||new URLSearchParams(route.split('?')[1]).get('id');if(!/^[A-Za-z0-9_-]{1,80}$/.test(id||''))return null;
  return {id:String(id),title:String(item.title),imagePath:String(item.imagePath||''),imageGroup:String(item.imageGroup||''),...(safeImageURL(item.imageURL)?{imageURL:safeImageURL(item.imageURL)}:{}),subtitle:String(item.bottomLabel||item.scoreText||''),badge:String(item.topLeftLabel||item.topRightLabel||''),channelId:item.channelId,isAdult:!!flaggedAdult(item),labels:Array.isArray(item.labels)?item.labels.map(x=>x.name||x).filter(Boolean):[]};
}
export function collectMovies(value,options={}){const out=[],seen=new Set();function visit(node,depth){if(depth>9||!node||typeof node!=='object')return;if(Array.isArray(node)){for(const item of node)visit(item,depth+1);return;}if(String(node._vod||'').startsWith('ad_')||node.type==='ad'||node.isAd)return;const movie=movieFrom(node,options);if(movie){if(!seen.has(movie.id)){seen.add(movie.id);out.push(movie);}return;}for(const key of ['data','items','list','vods'])if(node[key])visit(node[key],depth+1);}visit(value,0);return out;}
export function sectionRoute(value){
 if(typeof value!=='string'||/^(?:[a-z]+:|\/\/)/i.test(value))return null;
 const [path,query='']=value.replace(/^\//,'').split('?'),params=new URLSearchParams(query);
 const routes={'specialTopic/vods':['topic','specialTopicId'],'specialTopic/categoryTopics':['topics','topicCategoryId'],'vod/timeline':['timeline','timelineId'],'catalog/channel':['channel','channelId']},spec=routes[path];
 if(!spec||!/^\d+$/.test(params.get(spec[1])||''))return null;
 const clean=new URLSearchParams({[spec[1]]:params.get(spec[1])}),filters={};
 if(spec[0]==='channel')for(const key of ['class','area','year','sort']){const value=params.get(key);if(value&&value.length<=120&&!/[\x00-\x1f]/.test(value)){clean.set(key,value);filters[key]=value;}}
 return {kind:spec[0],id:params.get(spec[1]),title:params.get('title')||'',url:path+'?'+clean.toString(),...(Object.keys(filters).length?{filters}:{})};
}
export function topicFrom(item,{includeAdult=false}={}){
 if(!item||!item.title||(!includeAdult&&flaggedAdult(item)))return null;
 const route=sectionRoute(item.url);if(!route)return null;
 return {id:route.kind+':'+route.id,title:String(item.title),route,imagePath:String(item.imagePath||item.coverPathVertical||item.coverPathHorizontal||''),imageGroup:String(item.imageGroup||item.coverGroupVertical||item.coverGroupHorizontal||''),...(safeImageURL(item.imageURL)?{imageURL:safeImageURL(item.imageURL)}:{}),labels:[],subtitle:item.count?item.count+' 部影片':'专题合集',badge:'专题'};
}
export function sectionItems(value,options={}){
 const out=[],seen=new Set();
 function visit(node,depth){
  if(depth>9||!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const item of node)visit(item,depth+1);return;}
  if(String(node._vod||'').startsWith('ad_')||node.isAd||node.type==='ad')return;
  const item=movieFrom(node,options)||topicFrom(node,options);
  if(item){if(!seen.has(item.id)){seen.add(item.id);out.push(item);}return;}
  for(const key of ['items','data','list','vods'])if(node[key])visit(node[key],depth+1);
 }
 visit(value,0);return out;
}
export function homeSections(data){return (Array.isArray(data?.blocks)?data.blocks:[]).filter(block=>block&&block.isAd!==true&&block.type!=='ad'&&block.layout!=='advert_self'&&!String(block._vod||'').startsWith('ad_')).map(block=>({title:String(block.header?.title||'为你推荐'),route:sectionRoute(block.header?.url),items:sectionItems(block.data)})).filter(section=>section.items.length);}
export function collectionGroups(data,options={}){
 return (data?.items||[]).filter(item=>!String(item?._vod||'').startsWith('ad_')).map(item=>({title:String(item.header?.title||''),route:sectionRoute(item.header?.url),items:sectionItems(item.data,options)})).filter(group=>group.items.length);
}
export function categories(config,{includeAdult=false}={}){const adult=tab=>flaggedAdult(tab,config?.adultChannelIds);return (config?.vodTabs||[]).filter(tab=>tab.type==='category'&&(includeAdult||!adult(tab))).map(tab=>({id:Number(tab.channelId),name:String(adult(tab)?'18+ · ':'')+(tab.text||tab.name),...(adult(tab)?{isAdult:true}:{})}));}
export function imageURLs(movie,config){if(safeImageURL(movie?.imageURL))return [safeImageURL(movie.imageURL)];const group=config?.groups?.find(x=>String(x.id)===String(movie?.imageGroup));if(!movie?.imagePath||!group)return [];return [...new Set((group.url||[]).map(x=>safeImageURL(String(x.domain||'').replace(/\/$/,'')+'/'+String(movie.imagePath).replace(/^\//,''))).filter(Boolean))];}
// YQK and QNTV publish cover paths on a shared CDN hostname. The same bucket
// is also available under a QNTV hostname; keep the API URL first and add this
// independently verified hostname as a fallback.
export function imageURLsForSource(movie,source,config){
 const urls=Array.isArray(movie?.imageURLs)&&movie.imageURLs.length?movie.imageURLs.filter(value=>safeImageURL(value)):imageURLs(movie,config);
 if(!['yqk','qntv'].includes(source))return urls;
 const mirror='qntv.j3kjn242sq.com',out=[];
 for(const value of urls){
  const url=safeImageURL(value);if(!url)continue;out.push(url);
  try{const alternate=new URL(url);if(alternate.hostname.toLowerCase()==='yqk.j3kjn242sq.com'){alternate.hostname=mirror;out.push(alternate.href);}}catch{}
 }
 return [...new Set(out)];
}
export function playbackURLs(episode){return (episode?.playUrls||[]).map(entry=>({...entry,url:safeHTTPS(entry.url)})).filter(x=>x.url);}
export function sourceKey(siteId,movieId){return siteId+':'+movieId;}
