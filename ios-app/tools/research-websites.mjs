// Read public frontend protocol constants and probe metadata without signing in.
// Run with NODE_USE_ENV_PROXY=1 when the environment requires its HTTP proxy.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const day=new Date().toISOString().slice(0,10);
const root=new URL('../research/website-sources/'+day+'/',import.meta.url);
await fs.mkdir(root,{recursive:true});
const manifest={checkedAt:new Date().toISOString(),sites:[]};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function fetchPublic(url,options={}){
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});
 return {status:r.status,text:await r.text(),encrypted:r.headers.get('x-app-data-encrypt')};
}
function schema(value,depth=0){
 if(value===null)return 'null';
 if(depth>7)return Array.isArray(value)?'array':typeof value;
 if(Array.isArray(value))return {type:'array',count:value.length,items:value.slice(0,2).map(v=>schema(v,depth+1))};
 if(typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,schema(v,depth+1)]));
 return typeof value;
}
async function archive(row,url,name){
 const r=await fetchPublic(url);if(r.status!==200)throw Error('Source HTTP '+r.status);
 const filename=row.id+'/'+(name||path.basename(new URL(url).pathname));
 await fs.mkdir(new URL(row.id+'/',root),{recursive:true});
 await fs.writeFile(new URL(filename,root),r.text);
 row.files.push({file:filename,url,bytes:Buffer.byteLength(r.text),sha256:hash(r.text)});
 return r.text;
}
function endpointInventory(source){
 return [...new Set([...source.matchAll(/(?:\/v[12]\/api)?\/(?:home|channel|vodInfo|vodTopic|search|movie|movie_addr)\/[a-zA-Z_][\w/]*/g)].map(m=>m[0]))].sort();
}
async function record(row,endpoint,params,request){
 const evidenceParams=Object.fromEntries(Object.entries(params).map(([k,v])=>[k,/url|token|signature|pack/i.test(k)?'<redacted>':v]));
 try{const {status,data}=await request();const success=status===200&&data?.result!==false&&!data?.errorCode;
  row.probes.push({endpoint,params:evidenceParams,status,success,message:data?.msg||data?.message||'',response:schema(data)});
  console.log(row.id,endpoint,status,success?'OK':data?.msg||'FAILED');return success?data?.data:null;
 }catch(e){row.probes.push({endpoint,params:evidenceParams,success:false,error:e.message});console.log(row.id,endpoint,e.message);return null;}
}
async function checkPlaylist(row,value){
 if(typeof value!=='string')return;
 let url;try{url=new URL(value);}catch{return;}
 row.mediaSample={host:url.host,protocol:url.protocol,pathExtension:path.extname(url.pathname),verifiedPlayback:false};
 if(url.protocol!=='https:'||!url.pathname.endsWith('.m3u8'))return;
 try{const r=await fetchPublic(url,{headers:{Referer:row.origin+'/'}});
  row.mediaSample.httpStatus=r.status;row.mediaSample.validPlaylist=r.status===200&&r.text.trimStart().startsWith('#EXTM3U');
 }catch(e){row.mediaSample.error=e.message;}
 // Reading a playlist verifies transport only; it does not prove AVPlayer playback.
}
async function yqk(id,origin){
 const row={id,origin,files:[],probes:[],endpoints:[]};manifest.sites.push(row);
 const html=await archive(row,origin,'index.html');
 const entry=html.match(/src="([^" ]*\/_nuxt\/entry\.[^" ]+\.js)"/)?.[1];
 if(!entry)throw Error(id+': entry script not found');
 const js=await archive(row,new URL(entry,origin).href);
 row.routes=[...js.matchAll(/path:\([^)]*\)\?\?"([^"]+)"[\s\S]*?component:\(\)=>__vitePreload\(\(\)=>import\("([^"]+)"\)/g)].map(m=>({path:m[1],module:m[2]})).filter(r=>/^\/(?:category-|play\/|search|vodTopic|vodRank|releaseVod)/.test(r.path));
 const chunks=[...new Set([...(js.match(/\.\/(?:_play_|play|category|list-[123]|_search_|search)\.[\w]+\.js/g)||[]),...row.routes.map(r=>r.module)])];
 for(const name of chunks){try{const source=await archive(row,new URL(name,new URL(entry,origin)).href);row.endpoints.push(...endpointInventory(source));}catch(e){row.files.push({url:name,error:e.message});}}
 const appId=js.match(/\bappId="([^"]+)"/)?.[1],appKey=js.match(/\bappKey="([^"]+)"/)?.[1],version=js.match(/\bversion="([\d.]+)"/)?.[1];
 if(!appId||!appKey||!version)throw Error(id+': protocol constants changed');
 const basesJS=await archive(row,origin+'/js/baseUrlList.js');
 const bases=JSON.parse(basesJS.match(/baseApiList\s*=\s*(\[[^;]+\])/)?.[1]||'[]').filter(u=>u.startsWith('https://'));
 row.apiOrigins=bases;row.version=version;row.endpoints=[...new Set([...row.endpoints,...endpointInventory(js)])].sort();
 let active;
 const udid=crypto.randomUUID();
 async function post(endpoint,extra={}){
  const p={...extra,appId,reqDomain:new URL(origin).host,deviceInfo:'iPhone',version,requestId:crypto.randomBytes(16).toString('hex'),cus1tom:'aabbcc',udid};
  const raw=Object.keys(p).sort().filter(k=>p[k]!=='').map(k=>k+'='+p[k]+'&').join('')+'appKey='+appKey;
  p.sign=crypto.createHash('md5').update(raw).digest('hex');
  let last;
  for(const base of [...new Set([active,...bases].filter(Boolean))].slice(0,4)){
   try{const r=await fetchPublic(base+endpoint,{method:'POST',headers:{'content-type':'application/json;charset=UTF-8',Referer:origin+'/',Origin:origin},body:JSON.stringify(p)});
    const data=JSON.parse(r.text);if(r.status===200){active=base;return {status:r.status,data};}last=Error('HTTP '+r.status);
   }catch(e){last=e;}
  }throw last||Error('No API origins');
 }
 const probe=(ep,p={})=>record(row,ep,p,()=>post(ep,p));
 await probe('/v2/api/home/header');const home=await probe('/v2/api/home/body');
 await probe('/v2/api/channel/childListView');await probe('/v1/api/search/getSearchFilter');
 await probe('/v2/api/channel/topicListView',{channelId:2});
 const listParams={parentChannelId:2,childChannelId:'',nextCount:12,nextVal:''};
 const first=await probe('/v2/api/channel/getVodList',listParams);
 if(first?.hasNext&&first.nextVal){const second=await probe('/v2/api/channel/getVodList',{...listParams,nextVal:first.nextVal});
  const ids=new Set((first.items||[]).map(x=>x.vodId));row.paginationSummary={firstCount:first.items?.length||0,secondCount:second?.items?.length||0,newItems:second?.items?.filter(x=>!ids.has(x.vodId)).length||0};
 }
 await probe('/v1/api/search/search',{keyword:'流浪地球',nextCount:12,nextVal:''});
 const movie=home?.vodTopicList?.flatMap(t=>t.vodList||[]).find(v=>v.vodId);
 if(movie){const detail=await probe('/v2/api/vodInfo/index',{vodId:movie.vodId});
  row.detailSummary={movieId:movie.vodId,lines:detail?.playerList?.length||0,episodes:detail?.playerList?.[0]?.epList?.length||0};
  const ep=detail?.playerList?.flatMap(l=>l.epList||[])[0];
  if(ep){const resolutions=await probe('/v2/api/vodInfo/epDetail',{vodEpId:ep.epId});row.resolutionSummary=Array.isArray(resolutions)?resolutions.map(r=>({fields:Object.keys(r),canPlay:r.canPlay===true,defaultSelect:r.defaultSelect===true})):[];
   const allowed=Array.isArray(resolutions)?resolutions.find(r=>r.canPlay===true):null;
   if(allowed){const play=await probe('/v2/api/vodInfo/playUrl',{vodResolution:allowed.vodResolution,epId:ep.epId});await checkPlaylist(row,play?.playUrl);}
   else row.playbackNote='No guest-playable resolution was returned; no playback request was made.';
  }
 }
 row.activeApiOrigin=active;
}
async function dyls(){
 const origin='https://dyls1.mbxqnb.cn',row={id:'dyls',origin,files:[],probes:[],endpoints:[]};manifest.sites.push(row);
 const html=await archive(row,origin,'index.html');
 const entry=html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];if(!entry)throw Error('Dyls entry changed');
 const main=await archive(row,origin+entry);
 const names=[...new Set(main.match(/assets\/(?:newEncryption|apiClient|homeApi|searchApi|playerService|helperService|storage|secureRequest)-[\w-]+\.js/g)||[])];
 const sources=[];
 for(const name of names){try{sources.push(await archive(row,origin+'/'+name));}catch(e){row.files.push({url:origin+'/'+name,error:e.message});}}
 const enc=sources.find(s=>s.includes('function h(')&&s.includes('REACT_APP_PUBLIC_KEY'));
 if(!enc)throw Error('Dyls encryption module not found');
 row.endpoints=[...new Set(sources.flatMap(endpointInventory))].sort();
 const constant=k=>enc.match(new RegExp(k+':`([^`]+)`'))?.[1];
 const pem=constant('REACT_APP_PUBLIC_KEY').replace('-----BEGIN RSA PUBLIC KEY-----','-----BEGIN RSA PUBLIC KEY-----\n').replace('-----END RSA PUBLIC KEY-----','\n-----END RSA PUBLIC KEY-----');
 const signKey=constant('REACT_APP_SIGN_KEY');
 async function get(endpoint,params={}){
  const payload={timestamp:Date.now(),...params};
  const plain=Buffer.from(JSON.stringify(payload)),key=crypto.createPublicKey(pem),blockSize=key.asymmetricKeyDetails.modulusLength/8-11,chunks=[];
  for(let i=0;i<plain.length;i+=blockSize)chunks.push(crypto.publicEncrypt({key,padding:crypto.constants.RSA_PKCS1_PADDING},plain.subarray(i,i+blockSize)));
  const pack=Buffer.concat(chunks).toString('base64url');
  const signature=crypto.createHmac('md5',signKey).update(pack).digest('hex');
  const url=new URL('/api/v1'+endpoint,origin);url.searchParams.set('pack',pack);url.searchParams.set('signature',signature);
  const r=await fetchPublic(url,{headers:{'X-Client-Version':'3102','X-Client-Setting':'{"pure-mode":1}','Accept-Language':'en',Referer:origin+'/'}});
  let data=JSON.parse(r.text);
  if(r.encrypted==='1'){
   const decipher=crypto.createDecipheriv('aes-128-cbc',Buffer.from(constant('REACT_APP_AES_KEY')),Buffer.from(constant('REACT_APP_AES_IV')));
   data=JSON.parse(Buffer.concat([decipher.update(Buffer.from(typeof data==='string'?data:r.text,'base64')),decipher.final()]).toString());
  }
  return {status:r.status,data};
 }
 const probe=(ep,p={})=>record(row,ep,p,()=>get(ep,p));
 const home=await probe('/movie/index_recommend');const first=await probe('/movie/screen/list',{type_id:1,page:1,pageSize:12});
 const second=await probe('/movie/screen/list',{type_id:1,page:2,pageSize:12});
 const ids=new Set((first?.list||[]).map(x=>x.id));row.paginationSummary={firstCount:first?.list?.length||0,secondCount:second?.list?.length||0,newItems:second?.list?.filter(x=>!ids.has(x.id)).length||0};
 await probe('/movie/search',{keyword:'流浪地球',page:1,res_type:'by_movie_name'});
 const blocks=Array.isArray(home)?home:[];const item=blocks.filter(b=>b.layout!=='advert_self').flatMap(b=>b.list||[]).find(x=>x.id||x.movie_id);
 row.homeSummary={blocks:blocks.length,sampleItemFields:item?Object.keys(item):[]};
 // A fresh ID is obtained from the homepage; never assume all providers use numeric IDs.
 const id=item?.id||item?.movie_id;
 if(id){const detail=await probe('/movie/detail',{id});const line=detail?.play_from?.[0];
  row.detailSummary={movieId:id,lines:detail?.play_from?.length||0,episodes:line?.total||line?.list?.length||0,requiresParsing:line?.player_need_to_parse===true};
  if(line){const episodes=await probe('/movie_addr/list',{from_code:line.code,movie_id:id});
   if(!line.player_need_to_parse)await checkPlaylist(row,episodes?.[0]?.play_url);
   row.parserContract={endpoint:'/movie_addr/parse_url',method:'GET',params:['type','episode_id','from_code','play_url','refresh'],verified:false,evidence:'playerService original source'};
  }
  const parsedLine=detail?.play_from?.find(l=>l.player_need_to_parse&&l.total>0);
  if(parsedLine){const episodes=parsedLine.list?.length?parsedLine.list:await probe('/movie_addr/list',{from_code:parsedLine.code,movie_id:id});const ep=episodes?.[0];
   if(ep?.play_url){const result=await probe('/movie_addr/parse_url',{type:'play',episode_id:ep.episode_id,from_code:ep.from_code||parsedLine.code,play_url:ep.play_url,refresh:1});
    row.parserContract.verified=!!result;row.parserContract.returnedPlayableURL=typeof result?.play_url==='string';
   }
  }
 }
}
for(const job of [()=>yqk('yqk','https://yqk18.app'),()=>yqk('qntv','https://qntv28.app'),dyls]){
 try{await job();}catch(e){manifest.sites.at(-1).error=e.message;console.error(e.message);}
 await fs.writeFile(new URL('manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
}
console.log('Evidence:',root.pathname);
if(manifest.sites.some(s=>s.error||!s.probes.length||s.probes.some(p=>!p.success)))process.exitCode=1;
