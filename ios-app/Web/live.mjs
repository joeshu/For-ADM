const attribute=(text,name)=>{
 const match=text.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s,]+))`,'i'));
 return match?.[1]??match?.[2]??match?.[3]??'';
};
const channelIdentity=channel=>(channel.tvgId||channel.name).trim().toLocaleLowerCase();

export function decodePlaylist(base64){
 const binary=atob(base64||''),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/,'');
}

function createM3UParser(playlistURL){
 const base=new URL(playlistURL),channels=[];let pending='',group='',epgUrl='',started=false;
 const addLine=raw=>{
 const line=raw.trim();if(!line)return;
  if(/^#EXTM3U\b/i.test(line)){started=true;const value=attribute(line,'x-tvg-url');if(value){try{const url=new URL(value,base);if(['https:','http:'].includes(url.protocol))epgUrl=url.href;}catch{}}return;}
  if(!started)return;
  if(/^#EXTGRP:/i.test(line)){group=line.slice(line.indexOf(':')+1).trim()||'未分类';return;}
  if(/^#EXTINF:/i.test(line)){pending=line;group=attribute(line,'group-title')||group||'未分类';return;}
  if(line.startsWith('#')||!pending)return;
  let stream;try{stream=new URL(line,base);}catch{pending='';return;}
  if(!['https:','http:'].includes(stream.protocol)){pending='';return;}
  const comma=pending.search(/,(?=(?:[^"']|"[^"]*"|'[^']*')*$)/),title=comma>=0?pending.slice(comma+1).trim():'';
  const name=attribute(pending,'tvg-name')||title||attribute(pending,'tvg-id')||`频道 ${channels.length+1}`;
  const tvgId=attribute(pending,'tvg-id');let logo='';try{const candidate=new URL(attribute(pending,'tvg-logo'),base);if(candidate.protocol==='https:')logo=candidate.href;}catch{}
  const tvgName=attribute(pending,'tvg-name')||title||name;
  channels.push({index:channels.length,name,tvgName,tvgId,logo,group:attribute(pending,'group-title')||group||'未分类',url:stream.href,secure:stream.protocol==='https:',identity:channelIdentity({tvgId,name})});
  pending='';group='';
 };
 return {addLine,finish(){if(!started)throw Error('这个地址没有返回有效的 M3U 播放列表');if(!channels.length)throw Error('M3U 列表里没有可用频道');return {channels,groups:[...new Set(channels.map(channel=>channel.group))],epgUrl};}};
}
export function parseM3U(text,playlistURL){
 if(typeof text!=='string'||!/^(?:\uFEFF)?\s*#EXTM3U(?:\s|$)/i.test(text))throw Error('这个地址没有返回有效的 M3U 播放列表');
 const parser=createM3UParser(playlistURL);for(const raw of text.split(/\r?\n/))parser.addLine(raw);return parser.finish();
}
export async function parseM3UIncremental(text,playlistURL,{signal,batchLines=1200}={}){
 if(typeof text!=='string'||!/^(?:\uFEFF)?\s*#EXTM3U(?:\s|$)/i.test(text))throw Error('这个地址没有返回有效的 M3U 播放列表');
 if(signal?.aborted)throw new DOMException('请求取消','AbortError');
 const parser=createM3UParser(playlistURL),limit=Math.max(100,Math.min(5000,Number(batchLines)||1200));let start=0,processed=0;
 while(start<text.length){
  if(signal?.aborted)throw new DOMException('请求取消','AbortError');
  let end=text.indexOf('\n',start);if(end<0)end=text.length;const raw=text.slice(start,end);parser.addLine(raw);start=end+1;
  if(++processed>=limit){processed=0;await new Promise(resolve=>setTimeout(resolve,0));}
 }
 return parser.finish();
}

function xmlAttribute(text,name){return attribute(text,name);}
function xmlText(text){return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,value)=>{
 if(value[0]==='#'){const hex=value[1]?.toLowerCase()==='x',number=parseInt(value.slice(hex?2:1),hex?16:10);return Number.isFinite(number)?String.fromCodePoint(number):'';}
 return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[value.toLowerCase()]||'';
 });}
function xmlTime(value){
 const match=value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);if(!match)return 0;
 const [,year,month,day,hour,minute,second,sign,offsetHour,offsetMinute]=match;
 const offset=(Number(offsetHour||0)*60+Number(offsetMinute||0))*(sign==='-'?-1:1);
 return Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute),Number(second))-offset*60000;
}
export function parseXMLTV(xml,channelId){
 if(typeof xml!=='string'||!channelId)return [];
 const wanted=channelId.trim(),rows=[],programmes=/<programme\b([^>]*)>([\s\S]*?)<\/programme\s*>/gi;let match;
 while((match=programmes.exec(xml))){const attrs=match[1];if(xmlAttribute(attrs,'channel')!==wanted)continue;
  const start=xmlTime(xmlAttribute(attrs,'start')),stop=xmlTime(xmlAttribute(attrs,'stop')),
   tag=name=>{const found=match[2].match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`,'i'));return found?xmlText(found[1]).trim():'';},
   title=tag('title'),subtitle=tag('sub-title'),description=tag('desc'),categories=[...match[2].matchAll(/<category\b[^>]*>([\s\S]*?)<\/category\s*>/gi)].map(row=>xmlText(row[1]).trim()).filter(Boolean);
  if(start&&stop>start&&title)rows.push({start,stop,title,subtitle,description,categories});
 }
 return rows.sort((a,b)=>a.start-b.start);
}

export function indexChannelAlternates(channels){
 const index=new Map();for(const channel of channels){const list=index.get(channel.identity)||[];list.push(channel);index.set(channel.identity,list);}return index;
}
export function channelAlternates(channels,channel,index){
 if(!channel)return [];
 return index?.get(channel.identity)||channels.filter(candidate=>candidate.identity===channel.identity);
}
export function nextUntriedRouteIndex(routes,triedURLs){
 return routes.findIndex(route=>route&&!triedURLs?.has(route.url));
}
