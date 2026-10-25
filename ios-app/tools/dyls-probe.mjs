// Metadata and public playback transport check; never prints or persists signed URLs.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
import {DylsClient} from '../Web/dyls-api.mjs';
const sites=JSON.parse(await fs.readFile(new URL('../Web/sites.json',import.meta.url)));
const site=sites.find(s=>s.provider==='dyls');if(!site)throw Error('Dyls site profile missing');
const storage=new Map(),transport=async({url,signal,...options})=>{
 const r=await fetch(url,{...options,signal:signal||AbortSignal.timeout(20000)});
 return {status:r.status,url:r.url,bodyBase64:Buffer.from(await r.arrayBuffer()).toString('base64')};
};
const client=new DylsClient(site,transport,{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)});
const report={checkedAt:new Date().toISOString(),site:site.id,metadata:{},playback:[],note:'Public guest access only. Playlist/HEAD transport checks do not prove native AVPlayer playback.'};
try{
 const config=await client.bootstrap();report.metadata.categories=config.vodTabs.map(t=>({id:t.channelId,name:t.text,isAdult:t.isAdult}));
 const home=await client.home();report.metadata.homeSections=home.blocks.map(b=>({title:b.header.title,items:b.data.length,hasMore:!!b.header.url}));
 const category=config.vodTabs.find(c=>c.text==='电影')||config.vodTabs[0],first=await client.channel(category.channelId),second=first.next?await client.channel(category.channelId,{},first.next):{items:[]};
 report.metadata.categoryPagination={first:first.items.length,second:second.items.length,newItems:second.items.filter(m=>!first.items.some(x=>x.url===m.url)).length};
 const search=await client.search('流浪地球');report.metadata.searchResults=search.items.length;
 const d=await client.detail('nrLxl');report.metadata.detail={id:d.id,title:d.title,actors:d.actors.length,lines:d.playSources.map(l=>({id:l.siteId,name:l.name,total:l.total}))};
 for(const code of ['cloudflare','bytedance']){
  const line=d.playSources.find(l=>l.siteId===code);if(!line)continue;const row={line:code};report.playback.push(row);
  try{const episodes=await client.episodes(d.id,line),entry=(await client.play({vodId:d.id,siteId:line.siteId,episodeId:episodes[0]?.id}))[0];
   const u=new URL(entry.url),hls=/\.m3u8$/i.test(u.pathname);row.episodeCount=episodes.length;row.host=u.host;row.referrerPolicy=entry.referrerPolicy;row.hasUserAgent=!!entry.headers?.['User-Agent'];
   const r=await fetch(entry.url,{method:hls?'GET':'HEAD',headers:entry.headers,signal:AbortSignal.timeout(20000)});row.status=r.status;row.contentType=r.headers.get('content-type');
   if(hls)row.validPlaylist=(await r.text()).trimStart().startsWith('#EXTM3U');else row.mediaType=/^video\//i.test(row.contentType||'');
  }catch(e){row.error=e.message;}
 }
}catch(e){report.error=e.message;}
console.log(JSON.stringify(report,null,2));
const output=process.argv.indexOf('--out');if(output>=0&&process.argv[output+1])await fs.writeFile(process.argv[output+1],JSON.stringify(report,null,2)+'\n');
if(report.error||!report.playback.some(r=>r.status===200&&(r.validPlaylist||r.mediaType)))process.exitCode=1;
