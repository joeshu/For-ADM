// Public guest playback investigation. No account, signed media URL or video
// segment is persisted. Only small HLS playlists and metadata are requested.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const archive=new URL('../research/website-sources/2026-10-25/',import.meta.url);
const output=new URL('../research/website-playback-2026-10-25.json',import.meta.url);
const mobileUA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const selected=process.argv.find(x=>x.startsWith('--site='))?.slice(7);
if(selected&&!['yqk','qntv','dyls'].includes(selected))throw Error('Unknown site');
const previous=selected?JSON.parse(await fs.readFile(output,'utf8').catch(()=>'{}')):{};
const report={checkedAt:new Date().toISOString(),scope:'Three public films per source; at most five corresponding-episode lines for YQK/QNTV and three for Dyls. No account, authorization bypass, video segments or AVPlayer playback.',protocolRequests:{yqk:[{method:'POST',endpoint:'/v2/api/vodInfo/index',keys:['vodId']},{method:'POST',endpoint:'/v2/api/vodInfo/epDetail',keys:['vodEpId'],gate:'canPlay must be true'},{method:'POST',endpoint:'/v2/api/vodInfo/playUrl',keys:['vodResolution','epId']}],dyls:[{method:'GET',endpoint:'/movie/detail',keys:['id']},{method:'GET',endpoint:'/movie_addr/list',keys:['from_code','movie_id']},{method:'GET',endpoint:'/movie_addr/parse_url',keys:['type','episode_id','from_code','play_url','refresh'],gate:'Use original source need_to_parse / player_need_to_parse / !ready_to_play decision'}]},sites:(previous.sites||[]).filter(s=>s.id!==selected)};
const cleanMessage=v=>String(v||'').replace(/https?:\/\/\S+/g,'<url>').slice(0,240);
const bool=v=>v===true||v===1||typeof v==='string'&&['true','1'].includes(v.toLowerCase());
async function readSmall(response){const reader=response.body?.getReader();if(!reader)return '';const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144)break;chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(chunks.map(x=>Buffer.from(x))).toString('utf8');}
async function request(url,options={}){const res=await fetch(url,{...options,signal:AbortSignal.timeout(12000)});return {status:res.status,headers:res.headers,text:await readSmall(res)};}
function briefURL(value){const u=new URL(value);const result={host:u.host,protocol:u.protocol,extension:path.extname(u.pathname),queryKeys:[...u.searchParams.keys()]};
 for(const key of ['t','ts','timestamp']){const n=Number(u.searchParams.get(key));if(n>1e9&&n<1e11)result.timestampParameterAgeSeconds=Math.round(Date.now()/1000-n);}
 for(const key of ['expires','expire','expiry']){const n=Number(u.searchParams.get(key));if(n>1e9&&n<1e11)result.expiryParameterExpired=n<Date.now()/1000;}
 return result;
}
function failureKind(status,text){return status===401||status===403?'authorization-or-access-denied':status===404?'resource-not-found':status===410?'resource-gone':status>=500?'upstream-error':status===200&&!text.trimStart().startsWith('#EXTM3U')?'not-a-playlist':'http-error';}
async function inspectURL(value,origin,lineHeaders={}){
 let u;try{u=new URL(value);}catch{return {error:'No valid URL was returned'};}
 const row={...briefURL(value),variants:[],playlistVerified:false,mediaHeadVerified:false,decodedPlaybackVerified:false};
 if(!['https:','http:'].includes(u.protocol)){row.error='Unsupported URL scheme';return row;}
 const headerVariants=[{name:'site-referer',headers:{Referer:origin+'/',...lineHeaders}},{name:'mobile-and-site-referer',headers:{Referer:origin+'/',...lineHeaders,'User-Agent':mobileUA}},{name:'no-referer',headers:{}},{name:'mobile-no-referer',headers:{'User-Agent':mobileUA}}];
 for(const variant of headerVariants){
  try{
   const isHLS=/\.m3u8$/i.test(u.pathname);
   const res=await request(value,{method:isHLS?'GET':'HEAD',headers:variant.headers});
   const contentType=res.headers.get('content-type');
   const r={headers:variant.name,status:res.status,contentType,validPlaylist:isHLS&&res.status===200&&res.text.trimStart().startsWith('#EXTM3U'),mediaHeadVerified:!isHLS&&res.status===200&&/^video\//i.test(contentType||'')};
   if(r.validPlaylist){row.playlistVerified=true;r.master=res.text.includes('#EXT-X-STREAM-INF:');
    if(r.master){const relative=res.text.split(/\r?\n/).find(l=>l.trim()&&!l.startsWith('#'));if(relative){const childURL=new URL(relative.trim(),value),child=await request(childURL,{headers:variant.headers});r.child={host:childURL.host,status:child.status,validPlaylist:child.status===200&&child.text.trimStart().startsWith('#EXTM3U')};row.playlistVerified=r.child.validPlaylist;}}
   }else if(r.mediaHeadVerified)row.mediaHeadVerified=true;
   else {r.failure=failureKind(res.status,res.text);const title=res.text.match(/<title>([^<]{1,120})<\/title>/i)?.[1];if(title)r.errorPageTitle=title;}
   row.variants.push(r);if(row.playlistVerified||row.mediaHeadVerified)break;
  }catch(e){row.variants.push({headers:variant.name,failure:e.name==='TimeoutError'?'timeout':'transport-error',error:cleanMessage(e.cause?.code||e.message)});}
 }
 return row;
}
function matchingEpisode(requested,episodes){const key=t=>String(t||'').replace(/[\s\[\]【】（）()]/g,'').replace(/第0*(\d+)集/g,'$1').replace(/^0+(\d+)$/,'$1');const wanted=key(requested);return episodes.find(e=>key(e.title)===wanted)||(episodes.length===1&&/正片|高清|HD|TC|720|1080|蓝光|中字|国语|原声|抢先版|完整版/i.test(requested)&&!/预告|花絮|trailer/i.test(episodes[0].title)?episodes[0]:null);}
async function yqk(id,origin){
 const row={id,origin,checkedAt:new Date().toISOString(),movies:[]};report.sites.push(row);
 const files=await fs.readdir(new URL(id+'/',archive));const js=await fs.readFile(new URL(id+'/'+files.find(f=>f.startsWith('entry.')),archive),'utf8');
 const appId=js.match(/\bappId="([^"]+)"/)?.[1],appKey=js.match(/\bappKey="([^"]+)"/)?.[1],version=js.match(/\bversion="([\d.]+)"/)?.[1];
 const basesJS=await fs.readFile(new URL(id+'/baseUrlList.js',archive),'utf8'),bases=JSON.parse(basesJS.match(/baseApiList\s*=\s*(\[[^;]+\])/)?.[1]||'[]');const udid=crypto.randomUUID();let active;
 async function post(endpoint,params={}){
  const p={...params,appId,reqDomain:new URL(origin).host,deviceInfo:'iPhone',version,requestId:crypto.randomBytes(16).toString('hex'),cus1tom:'aabbcc',udid};
  p.sign=crypto.createHash('md5').update(Object.keys(p).sort().filter(k=>p[k]!=='').map(k=>k+'='+p[k]+'&').join('')+'appKey='+appKey).digest('hex');
  let last;for(const base of [...new Set([active,...bases].filter(Boolean))].slice(0,4)){try{const r=await request(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json;charset=UTF-8',Referer:origin+'/',Origin:origin,'User-Agent':mobileUA},body:JSON.stringify(p)});const data=JSON.parse(r.text);if(r.status!==200){last=Error('HTTP '+r.status);continue;}active=base;if(data.result!==true)throw Object.assign(Error(cleanMessage(data.msg)),{code:data.operateCode,business:true});return data.data;}catch(e){if(e.business)throw e;last=e;}}throw last;
 }
 const home=await post('/v2/api/home/body'),recent=await post('/v2/api/channel/getVodList',{parentChannelId:2,childChannelId:'',nextCount:12,nextVal:''});
 const combined=[...(recent.items||[]),...(home.vodTopicList||[]).flatMap(t=>t.vodList||[])];const films=[...new Map(combined.filter(m=>m.vodId).map(m=>[m.vodId,m])).values()].slice(0,3);
 for(const film of films){const result={id:String(film.vodId),title:film.vodName,lines:[]};row.movies.push(result);
  try{const d=await post('/v2/api/vodInfo/index',{vodId:film.vodId});const requestTitle=d.playerList?.[0]?.epList?.[0]?.epName;result.requestedEpisode=requestTitle;result.sourceLines=d.playerList?.length||0;
   for(const line of (d.playerList||[]).slice(0,5)){
    const episodes=(line.epList||[]).map(e=>({id:e.epId,title:e.epName}));const episode=matchingEpisode(requestTitle,episodes);const lr={name:line.playerName,episodeId:episode?.id,episode:episode?.title};result.lines.push(lr);
    if(!episode){lr.skipped='No corresponding episode';continue;}
    try{const resolutions=await post('/v2/api/vodInfo/epDetail',{vodEpId:episode.id});lr.resolutions=resolutions.map(r=>({name:r.showName,canPlay:bool(r.canPlay),resolution:r.vodResolution}));
     const allowed=resolutions.find(r=>bool(r.canPlay));if(!allowed){lr.failure='guest-not-authorized';continue;}
     const play=await post('/v2/api/vodInfo/playUrl',{vodResolution:allowed.vodResolution,epId:episode.id});lr.playbackResponse={fields:Object.keys(play||{}),popOperateCode:play?.popOperateCode};lr.media=await inspectURL(play?.playUrl,origin);
    }catch(e){lr.failure=e.business?'business-denial':'transport-error';lr.code=e.code;lr.error=cleanMessage(e.message);}
   }
  }catch(e){result.error=cleanMessage(e.message);}
  console.log(id,result.id,result.lines.map(l=>l.media?.playlistVerified?'PLAYLIST OK':l.failure||l.media?.variants?.[0]?.status||l.skipped).join(', '));
 }
 row.apiOrigin=active;
}
async function dyls(){
 const origin='https://dyls1.mbxqnb.cn',row={id:'dyls',origin,checkedAt:new Date().toISOString(),movies:[]};report.sites.push(row);
 const files=await fs.readdir(new URL('dyls/',archive));let enc='';for(const f of files.filter(f=>f.startsWith('newEncryption-'))){const js=await fs.readFile(new URL('dyls/'+f,archive),'utf8');if(js.includes('function h(')){enc=js;break;}}
 const constant=k=>enc.match(new RegExp(k+':`([^`]+)`'))?.[1];const pem=constant('REACT_APP_PUBLIC_KEY').replace('-----BEGIN RSA PUBLIC KEY-----','-----BEGIN RSA PUBLIC KEY-----\n').replace('-----END RSA PUBLIC KEY-----','\n-----END RSA PUBLIC KEY-----');const key=crypto.createPublicKey(pem),blockSize=key.asymmetricKeyDetails.modulusLength/8-11;
 async function get(endpoint,params={}){const plain=Buffer.from(JSON.stringify({timestamp:Date.now(),...params})),chunks=[];for(let i=0;i<plain.length;i+=blockSize)chunks.push(crypto.publicEncrypt({key,padding:crypto.constants.RSA_PKCS1_PADDING},plain.subarray(i,i+blockSize)));const pack=Buffer.concat(chunks).toString('base64url'),signature=crypto.createHmac('md5',constant('REACT_APP_SIGN_KEY')).update(pack).digest('hex');const u=new URL('/api/v1'+endpoint,origin);u.searchParams.set('pack',pack);u.searchParams.set('signature',signature);
  const r=await request(u,{headers:{'X-Client-Version':'3102','X-Client-Setting':'{"pure-mode":1}','Accept-Language':'en',Referer:origin+'/','User-Agent':mobileUA}});let data=JSON.parse(r.text);if(r.headers.get('x-app-data-encrypt')==='1'){const decipher=crypto.createDecipheriv('aes-128-cbc',Buffer.from(constant('REACT_APP_AES_KEY')),Buffer.from(constant('REACT_APP_AES_IV')));data=JSON.parse(Buffer.concat([decipher.update(Buffer.from(typeof data==='string'?data:r.text,'base64')),decipher.final()]).toString());}if(r.status!==200||data.errorCode)throw Object.assign(Error(cleanMessage(data.msg||'HTTP '+r.status)),{code:data.errorCode,business:true});return data.data;
 }
 const listing=await get('/movie/screen/list',{type_id:1,page:1,pageSize:12});const films=listing.list.slice(0,3);
 for(const film of films){const result={id:film.id,title:film.name,lines:[]};row.movies.push(result);
  try{const d=await get('/movie/detail',{id:film.id});result.sourceLines=d.play_from?.length||0;const first=d.play_from?.[0],firstEpisodes=first?.list?.length?first.list:await get('/movie_addr/list',{from_code:first.code,movie_id:film.id});const requested=firstEpisodes?.[0]?.episode_name;result.requestedEpisode=requested;
   for(const line of (d.play_from||[]).slice(0,3)){const lr={name:line.name,code:line.code,parseFlag:line.need_to_parse??line.player_need_to_parse,headerNames:Array.isArray(line.player_headers)?line.player_headers.map(h=>h.name||h.key):Object.keys(line.player_headers||{}),hasPlayerUA:!!line.player_user_agent};result.lines.push(lr);
    try{const raw=line.list?.length?line.list:await get('/movie_addr/list',{from_code:line.code,movie_id:film.id});const ep=matchingEpisode(requested,(raw||[]).map(e=>({...e,title:e.episode_name})));if(!ep){lr.skipped='No corresponding episode';continue;}lr.episodeId=ep.episode_id;lr.episode=ep.episode_name;
     const need=line.need_to_parse??line.player_need_to_parse??ep.need_to_parse??ep.player_need_to_parse;const parsed=need===undefined?!ep.ready_to_play:bool(need);lr.requiresParsing=parsed;let value=ep.parseUrl||ep.play_url;
     if(parsed&&!ep.parseUrl){const data=await get('/movie_addr/parse_url',{type:'play',episode_id:ep.episode_id,from_code:ep.from_code||line.code,play_url:ep.play_url,refresh:1});lr.parser={called:true,fields:Object.keys(data||{}),returnedURL:typeof data?.play_url==='string'};value=data?.play_url;}
     const headers=Array.isArray(line.player_headers)?Object.fromEntries(line.player_headers.filter(h=>h.name||h.key).map(h=>[h.name||h.key,h.value])):line.player_headers||{};if(line.player_user_agent)headers['User-Agent']=line.player_user_agent;lr.media=await inspectURL(value,origin,headers);
    }catch(e){lr.failure=e.business?'business-denial':'transport-error';lr.code=e.code;lr.error=cleanMessage(e.message);}
   }
  }catch(e){result.error=cleanMessage(e.message);}
  console.log('dyls',result.id,result.lines.map(l=>l.media?.playlistVerified?'PLAYLIST OK':l.media?.mediaHeadVerified?'MEDIA HEAD OK':l.failure||l.media?.variants?.[0]?.status||l.skipped).join(', '));
 }
}
const jobs=[['yqk',()=>yqk('yqk','https://yqk18.app')],['qntv',()=>yqk('qntv','https://qntv28.app')],['dyls',dyls]];
await Promise.all(jobs.filter(([id])=>!selected||selected===id).map(async([id,job])=>{try{await job();}catch(e){const row=report.sites.find(s=>s.id===id);if(row)row.error=cleanMessage(e.message);console.error(cleanMessage(e.message));}}));
for(const s of report.sites){s.summary={movies:s.movies.length,lines:s.movies.flatMap(m=>m.lines).length,verifiedPlaylists:s.movies.flatMap(m=>m.lines).filter(l=>l.media?.playlistVerified).length,verifiedMediaHeads:s.movies.flatMap(m=>m.lines).filter(l=>l.media?.mediaHeadVerified).length,parserCalls:s.movies.flatMap(m=>m.lines).filter(l=>l.parser?.called).length};}
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log('Report',output.pathname);
if(report.sites.length!==3||report.sites.some(s=>s.movies.length<3))process.exitCode=1;
