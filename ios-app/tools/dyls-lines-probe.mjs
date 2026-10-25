// Audit every advertised line through the App client, retaining only metadata.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createSourceClient} from '../Web/source-clients.mjs';
import {verifyMedia,matchingEpisode} from '../Web/playback.mjs';
globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const site=JSON.parse(await fs.readFile(new URL('../Web/sites.json',import.meta.url))).find(s=>s.id==='dyls');
const store=new Map(),client=createSourceClient(site,async({url,signal,...options})=>{
 const r=await fetch(url,{...options,signal:signal||AbortSignal.timeout(15000)});
 return {status:r.status,url:r.url,headers:Object.fromEntries(r.headers),bodyBase64:Buffer.from(await r.arrayBuffer()).toString('base64')};
},{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)});
const output=new URL('../docs/dyls-lines-probe.json',import.meta.url);
const report={checkedAt:new Date().toISOString(),note:'Every advertised line is selectable. Playlist/HEAD checks do not prove native decoding or availability for every episode.',movies:[]};
await client.bootstrap();
const series=await client.channel(2),seriesID=new URLSearchParams(series.items[0]?.url?.split('?')[1]).get('vodId');
const ids=[...new Set(['nrLxl',seriesID].filter(Boolean))];
for(const id of ids){
 const detail=await client.detail(id),movie={id,title:detail.title,lineCount:detail.playSources.length,lines:[]};report.movies.push(movie);let requested;
 for(const line of detail.playSources){
  const row={code:line.siteId,name:line.name,total:line.total};movie.lines.push(row);
  try{
   const episodes=await client.episodes(id,line);row.episodes=episodes.length;if(!requested)requested=episodes[0];
   const index=requested?matchingEpisode(requested,episodes,{singleMovie:detail.channelId===1&&episodes.length===1}):-1;
   if(index<0){row.result='missing-matching-episode';continue;}
   row.episodeTitle=episodes[index].title;
   const entry=(await client.play({vodId:id,siteId:line.siteId,episodeId:episodes[index].id}))[0];
   row.host=new URL(entry.url).host;row.referrerPolicy=entry.referrerPolicy;row.headerNames=Object.keys(entry.headers||{});
   await verifyMedia(client,entry.url,undefined,entry.headers,entry.referrerPolicy);row.result='transport-verified';
  }catch(e){row.result='failed';row.status=e.status||e.code||null;row.error=String(e.message).replace(/https?:\/\/\S+/g,'<url>');}
  console.log(id,line.name,row.result,row.status||'');
  await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
 }
 movie.verified=movie.lines.filter(r=>r.result==='transport-verified').length;
 await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
}
console.log('Report:',output.pathname);
if(report.movies.some(m=>!m.verified))process.exitCode=1;
