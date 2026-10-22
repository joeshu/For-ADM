export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function safeHTTPS(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:'';}catch{return '';}}
const flaggedAdult=item=>item&&(item.isAdult===true||Number(item.isAdult)===1||Number(item.channelId)===5);
export function movieFrom(item,{includeAdult=false}={}){
  if(!item||typeof item!=='object'||(!includeAdult&&flaggedAdult(item))||!item.title)return null;
  const route=String(item.url||'').replace(/^\//,'');if(!/^vod\/detail\?/.test(route))return null;
  const id=new URLSearchParams(route.split('?')[1]).get('vodId')||new URLSearchParams(route.split('?')[1]).get('id');if(!/^\d+$/.test(id||''))return null;
  return {id:String(id),title:String(item.title),imagePath:String(item.imagePath||''),imageGroup:String(item.imageGroup||''),subtitle:String(item.bottomLabel||item.scoreText||''),badge:String(item.topLeftLabel||item.topRightLabel||''),channelId:item.channelId,isAdult:!!flaggedAdult(item),labels:Array.isArray(item.labels)?item.labels.map(x=>x.name).filter(Boolean):[]};
}
export function collectMovies(value,options={}){const out=[],seen=new Set();function visit(node,depth){if(depth>9||!node||typeof node!=='object')return;if(Array.isArray(node)){for(const item of node)visit(item,depth+1);return;}if(String(node._vod||'').startsWith('ad_')||node.type==='ad'||node.isAd)return;const movie=movieFrom(node,options);if(movie){if(!seen.has(movie.id)){seen.add(movie.id);out.push(movie);}return;}for(const key of ['data','items','list','vods'])if(node[key])visit(node[key],depth+1);}visit(value,0);return out;}
export function sectionRoute(value){
 if(typeof value!=='string'||/^(?:[a-z]+:|\/\/)/i.test(value))return null;
 const [path,query='']=value.replace(/^\//,'').split('?'),params=new URLSearchParams(query);
 const routes={'specialTopic/vods':['topic','specialTopicId'],'specialTopic/categoryTopics':['topics','topicCategoryId'],'vod/timeline':['timeline','timelineId']},spec=routes[path];
 if(!spec||!/^\d+$/.test(params.get(spec[1])||''))return null;
 return {kind:spec[0],id:params.get(spec[1]),title:params.get('title')||'',url:path+'?'+spec[1]+'='+params.get(spec[1])};
}
export function topicFrom(item,{includeAdult=false}={}){
 if(!item||!item.title||(!includeAdult&&flaggedAdult(item)))return null;
 const route=sectionRoute(item.url);if(!route)return null;
 return {id:route.kind+':'+route.id,title:String(item.title),route,imagePath:String(item.imagePath||item.coverPathVertical||item.coverPathHorizontal||''),imageGroup:String(item.imageGroup||item.coverGroupVertical||item.coverGroupHorizontal||''),labels:[],subtitle:item.count?item.count+' 部影片':'专题合集',badge:'专题'};
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
export function homeSections(data){return (Array.isArray(data?.blocks)?data.blocks:[]).filter(block=>!String(block._vod||'').startsWith('ad_')).map(block=>({title:String(block.header?.title||'为你推荐'),route:sectionRoute(block.header?.url),items:sectionItems(block.data)})).filter(section=>section.items.length);}
export function collectionGroups(data,options={}){
 return (data?.items||[]).filter(item=>!String(item?._vod||'').startsWith('ad_')).map(item=>({title:String(item.header?.title||''),route:sectionRoute(item.header?.url),items:sectionItems(item.data,options)})).filter(group=>group.items.length);
}
export function categories(config,{includeAdult=false}={}){return (config?.vodTabs||[]).filter(tab=>{const adult=flaggedAdult(tab);return tab.type==='category'&&(includeAdult||!adult);}).map(tab=>({id:Number(tab.channelId),name:String(flaggedAdult(tab)?'18+ · ':'')+(tab.text||tab.name),...(flaggedAdult(tab)?{isAdult:true}:{})}));}
export function imageURLs(movie,config){const group=config?.groups?.find(x=>String(x.id)===String(movie.imageGroup));if(!movie.imagePath||!group)return [];return(group.url||[]).map(x=>safeHTTPS(String(x.domain).replace(/\/$/,'')+'/'+movie.imagePath.replace(/^\//,''))).filter(Boolean);}
export function playbackURLs(episode){return (episode?.playUrls||[]).map(entry=>({...entry,url:safeHTTPS(entry.url)})).filter(x=>x.url);}
export function sourceKey(siteId,movieId){return siteId+':'+movieId;}
