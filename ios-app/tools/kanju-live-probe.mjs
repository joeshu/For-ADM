import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createSourceClient} from '../Web/source-clients.mjs';
import {collectMovies} from '../Web/model.mjs';
import {resolvePlayableEpisode} from '../Web/playback.mjs';

globalThis.CryptoJS=createRequire(import.meta.url)('../Web/vendor/crypto-js.js');
const sites=JSON.parse(fs.readFileSync(new URL('../Web/sites.json',import.meta.url),'utf8'));
const site=sites.find(item=>item.id==='kanju');
if(!site)throw Error('sites.json 中缺少看剧AI来源配置');
const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
const transport=async request=>{
 const response=await fetch(request.url,{method:request.method||'GET',headers:request.headers,body:request.body,signal:request.signal});
 const body=Buffer.from(await response.arrayBuffer());
 return {status:response.status,url:response.url,headers:Object.fromEntries(response.headers.entries()),bodyBase64:body.toString('base64')};
};

try{
 const client=createSourceClient(site,transport,storage),config=await client.bootstrap(),home=await client.home(),latest=await client.channel(9),series=await client.channel(2),search=await client.search('流浪地球');
 const movie=collectMovies(series.items)[0];
 if(!home.blocks.length||!latest.items.length||!movie||!search.items.length)throw Error('公开片库或搜索接口没有返回内容');
 const detail=await client.detail(movie.id),directIndex=detail.playSources.findIndex(line=>line.playMode==='direct');
 if(!detail.playSources[0]?.list?.length||detail.playSources[0].list.length!==detail.playSources[0].total)throw Error('详情没有返回完整剧集');
 if(directIndex<0)throw Error('当前剧集没有可测试的公开直连线路');
 const playback=await resolvePlayableEpisode(client,detail,directIndex,0,new AbortController().signal);
 console.log(JSON.stringify({status:'passed',source:site.name,categories:config.vodTabs.length,homeSections:home.blocks.length,homeCards:home.blocks.reduce((total,block)=>total+block.data.length,0),latest:latest.items.length,series:series.items.length,search:search.items.length,episodes:detail.playSources[0].list.length,playbackLine:detail.playSources[directIndex].name,manifestVerified:true,playableURLs:playback.urls.length}));
}catch(error){
 console.error(JSON.stringify({status:'failed',message:String(error?.message||error).slice(0,240)}));
 process.exitCode=1;
}
