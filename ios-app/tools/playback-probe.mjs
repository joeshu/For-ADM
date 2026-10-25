// Uses the same resolver as the app. Reads manifests only, never video segments.
import fs from 'node:fs';import{createRequire}from'node:module';globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const {createSourceClient}=await import('../Web/source-clients.mjs');const {homeSections}=await import('../Web/model.mjs');const {resolvePlayableEpisode}=await import('../Web/playback.mjs');
const sites=JSON.parse(fs.readFileSync(new URL('../Web/sites.json',import.meta.url))),results=[];
for(const site of sites){const row={source:site.id,attemptedLines:[]};try{
 const transport=async r=>{const x=await fetch(r.url,{...r,signal:r.signal||AbortSignal.timeout(18000)});return {url:x.url,status:x.status,bodyBase64:Buffer.from(await x.arrayBuffer()).toString('base64')};};
 const c=createSourceClient(site,transport,{getItem(){return null},setItem(){}});await c.bootstrap();const h=await c.home(),d=await c.detail(homeSections(h)[0].items[0].id);if(!d.playSources[0]?.list?.length)d.playSources[0].list=await c.episodes(d.id,d.playSources[0]);const at=Math.min(1,d.playSources[0].list.length-1);
 const r=await resolvePlayableEpisode(c,d,0,at,undefined,name=>row.attemptedLines.push(name));Object.assign(row,{selectedLine:d.playSources[r.lineIndex].name,episode:r.episode.title,automaticGuest:c.sessionKind==='guest',manifestValidated:true,switched:r.switched});await c.logout();
}catch(error){row.error=error.message;row.code=error.code;}results.push(row);console.log(row);}
fs.writeFileSync(new URL('../docs/playback-probe.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),results,segmentsFetched:0,devicePlaybackTested:false},null,2)+'\n');if(results.some(x=>x.error))process.exitCode=1;
