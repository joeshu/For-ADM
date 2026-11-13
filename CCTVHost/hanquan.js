// 韩圈 HanjuTV adapter (hxqapi.hiyun.tv) — decompiled from the TVBoxOSC spider.jar
// Lcom/github/catvod/spider/Hxq; (method-level dex disassembly, 2026-11-13) and
// verified live from this machine. No account, no rpc signer host needed.
//
// Signing, as shipped in the class (all local; the class's remote "rpc" signer
// Y() is only a gate whose return value is discarded — the server checks the
// MD5 sign below, verified live: rslvV4 returns rescode 0 with a locally
// computed sign and no rpc host configured):
//  * Session: uid c = random 16 hex chars; said d / oa e = random 20 alnum;
//    g = MD5(c); uk f = AES-CBC/PKCS5(c, key "f349wghhe784tqwh", iv "d3w8hf94fidk38lk") base64.
//  * Per-request "sign" header: AES-CBC/PKCS5(device JSON, key g[0:16], iv g[16:32])
//    base64, where the JSON is {"emu":0,"ou":0,"it":<now-14d ms>,"iit":<same>,
//    "bs":0,"uid":c,"pc":0,"tm":81,"d8m":"0,0,0,0,0,0,0,4","md":"25128PNA1C",
//    "maker":"Xiaomi","osv":"17","br":95,"rpc":0,"scc":2,"plc":6,"toc":19,"tsc":10,
//    "ts":<now ms>,"pa":1,"crec":0,"nw":2,"px":"0","isp":"","ai":d,"oa":e,
//    "dpc":0,"dsc":0,"qpc":0,"apad":0,"pk":"com.babycloud.hanju"}.
//    Headers also carry said=d, uk=f, vc=a_8350, vn=6.9, ch=qq, app=hj and the
//    HanjuTV/6.9 UA. List/detail endpoints accept these headers (and even plain
//    headers); episode-detail and rslvV4 use them.
//  * Encrypted responses (j()): data is base64 AES-CBC; key material is
//    MD5((key || MD5(c + ts)) + "34F9Q53w/HJW8E6Q"), key = first 16 chars,
//    iv = next 16 chars (PKCS5, fallback NoPadding with trailing-zero trim).
//  * rslvV4 URL sign (w()): params t,dt,version,uuid,udid,pid,scid,re,sq in that
//    order; uuid = random 32 alnum, t = unix seconds, udid = g, re = 1, sq = 10
//    (quality value; 10 = 蓝光 1080P, 2 = 高清, 1 = 标清). sign = MD5 hex of
//    the params sorted by key DESCENDING as "&k=v" pieces, plus
//    "&2E159Q/Z8979WckQ" appended.
//  * rslvV4 datas[].data (Z() local fallback): base64 AES-CBC with
//    MD5(g + "34F9Q53w/HJW8E6Q") split key/iv as above; decrypted JSON carries
//    playUrl (a direct signed m3u8 on piccc.cdn.51touxiang.com, UA tdc.8350).
//    Verified live 2026-11-13: 《背着善宰跑》 ep1 -> m3u8 200 (33 KB playlist)
//    -> first .ts segment 206 video/mp2t.
//  * episode scid/smid (r()): /api/series2/episode/detail returns j()-encrypted
//    playItem; sources[0].data is base64 AES-CBC with key "e2320a0c5c7320a9" and
//    iv "cf99167f1f087475" -> [{"smid":"sm_..."}].
//  * Search: /api/search/s5 returns rescode 0 but an empty body from this
//    machine for every keyword tried (Chinese/Korean/English, signed or not;
//    POST -> 500). Implemented exactly as the class does it; needs an iPhone /
//    domestic-IP retest — it may need a logged-in auth-token.
//  * The class also has an m3u8/mp4 re-assembly path (U(): rebuilds playlists
//    from segmented mp4list/split_parts via its local proxy). The live chain
//    above returns a direct m3u8, so no re-assembly is needed here; if a
//    series ever returns only mp4list segments, resolveResource reports it.
var Source={id:'hanquan',name:'韩圈',origin:'https://hxqapi.hiyun.tv',version:'0.1.0'};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:'韩圈',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'韩剧、综艺、电影片库、搜索与分集直连播放。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'channelId',title:'分类',type:'enumeration',value:'1',enumOptions:[{title:'韩剧',value:'1'},{title:'综艺',value:'2'},{title:'电影',value:'3'},{title:'排行榜',value:'rank'}]},{name:'sort',title:'排序',type:'enumeration',value:'hot',enumOptions:[{title:'最热',value:'hot'},{title:'最新',value:'new'},{title:'好评',value:'score'}]},{name:'year',title:'年份',type:'enumeration',value:'-1',enumOptions:[{title:'全部',value:'-1'},{title:'2026',value:'2026'},{title:'2025',value:'2025'},{title:'2024',value:'2024'},{title:'2023',value:'2023'},{title:'2022',value:'2022'},{title:'2021',value:'2021'},{title:'2020',value:'2020'},{title:'2015-2019',value:'2015-2019'},{title:'更早',value:'1-2014'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'例如：背着善宰跑'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'韩圈搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var HX={site:'https://hxqapi.hiyun.tv',cdn:'https://voldn-ser01.51touxiang.com',
 ua:'HanjuTV/6.9 (25128PNA1C; Android 17; Scale/2.00)',refer:'rSwCIIUMYCiHZXIVfgxlxylE9eGqfmwMg5V8mRSBB55vN8P3bNpXkUrv9MFhYOvm',
 keyL:'34F9Q53w/HJW8E6Q',keyM:'2E159Q/Z8979WckQ',
 keyF:'f349wghhe784tqwh',ivK:'d3w8hf94fidk38lk',
 keyO:'e2320a0c5c7320a9',ivP:'cf99167f1f087475'};
// ---- pure-JS MD5 (RFC 1321) ----
function hxUtf8(s){var u=unescape(encodeURIComponent(String(s==null?'':s))),o=[];for(var i=0;i<u.length;i++)o.push(u.charCodeAt(i));return o;}
function hxMd5Hex(text){
 var bytes=hxUtf8(text),origLen=bytes.length;
 bytes.push(128);while(bytes.length%64!==56)bytes.push(0);
 var bits=origLen*8;for(var i=0;i<8;i++)bytes.push((bits/Math.pow(256,i))&255);
 function add(x,y){var l=(x&65535)+(y&65535),m=(x>>16)+(y>>16)+(l>>16);return (m<<16)|(l&65535);}
 function rol(x,n){return (x<<n)|(x>>>(32-n));}
 function f(x,y,z){return (x&y)|(~x&z);}function g(x,y,z){return (x&z)|(y&~z);}
 function h(x,y,z){return x^y^z;}function ii(x,y,z){return y^(x|~z);}
 function ff(a,b,c,d,x,s,t){return add(rol(add(add(a,f(b,c,d)),add(x,t)),s),b);}
 function gg(a,b,c,d,x,s,t){return add(rol(add(add(a,g(b,c,d)),add(x,t)),s),b);}
 function hh(a,b,c,d,x,s,t){return add(rol(add(add(a,h(b,c,d)),add(x,t)),s),b);}
 function iii(a,b,c,d,x,s,t){return add(rol(add(add(a,ii(b,c,d)),add(x,t)),s),b);}
 var a0=1732584193,b0=4023233417,c0=2562383102,d0=271733878;
 for(var off=0;off<bytes.length;off+=64){
  var w=[];for(var j=0;j<16;j++)w[j]=bytes[off+j*4]|(bytes[off+j*4+1]<<8)|(bytes[off+j*4+2]<<16)|(bytes[off+j*4+3]<<24);
  var a=a0,b=b0,c=c0,d=d0;
  a=ff(a,b,c,d,w[0],7,3614090360);d=ff(d,a,b,c,w[1],12,3905402710);c=ff(c,d,a,b,w[2],17,606105819);b=ff(b,c,d,a,w[3],22,3250441966);
  a=ff(a,b,c,d,w[4],7,4118548399);d=ff(d,a,b,c,w[5],12,1200080426);c=ff(c,d,a,b,w[6],17,2821735955);b=ff(b,c,d,a,w[7],22,4249261313);
  a=ff(a,b,c,d,w[8],7,1770035416);d=ff(d,a,b,c,w[9],12,2336552879);c=ff(c,d,a,b,w[10],17,4294925233);b=ff(b,c,d,a,w[11],22,2304563134);
  a=ff(a,b,c,d,w[12],7,1804603682);d=ff(d,a,b,c,w[13],12,4254626195);c=ff(c,d,a,b,w[14],17,2792965006);b=ff(b,c,d,a,w[15],22,1236535329);
  a=gg(a,b,c,d,w[1],5,4129170786);d=gg(d,a,b,c,w[6],9,3225465664);c=gg(c,d,a,b,w[11],14,643717713);b=gg(b,c,d,a,w[0],20,3921069994);
  a=gg(a,b,c,d,w[5],5,3593408605);d=gg(d,a,b,c,w[10],9,38016083);c=gg(c,d,a,b,w[15],14,3634488961);b=gg(b,c,d,a,w[4],20,3889429448);
  a=gg(a,b,c,d,w[9],5,568446438);d=gg(d,a,b,c,w[14],9,3275163606);c=gg(c,d,a,b,w[3],14,4107603335);b=gg(b,c,d,a,w[8],20,1163531501);
  a=gg(a,b,c,d,w[13],5,2850285829);d=gg(d,a,b,c,w[2],9,4243563512);c=gg(c,d,a,b,w[7],14,1735328473);b=gg(b,c,d,a,w[12],20,2368359562);
  a=hh(a,b,c,d,w[5],4,4294588738);d=hh(d,a,b,c,w[8],11,2272392833);c=hh(c,d,a,b,w[11],16,1839030562);b=hh(b,c,d,a,w[14],23,4259657740);
  a=hh(a,b,c,d,w[1],4,2763975236);d=hh(d,a,b,c,w[4],11,1272893353);c=hh(c,d,a,b,w[7],16,4139469664);b=hh(b,c,d,a,w[10],23,3200236656);
  a=hh(a,b,c,d,w[13],4,681279174);d=hh(d,a,b,c,w[0],11,3936430074);c=hh(c,d,a,b,w[3],16,3572445317);b=hh(b,c,d,a,w[6],23,76029189);
  a=hh(a,b,c,d,w[9],4,3654602809);d=hh(d,a,b,c,w[12],11,3873151461);c=hh(c,d,a,b,w[15],16,530742520);b=hh(b,c,d,a,w[2],23,3299628645);
  a=iii(a,b,c,d,w[0],6,4096336452);d=iii(d,a,b,c,w[7],10,1126891415);c=iii(c,d,a,b,w[14],15,2878612391);b=iii(b,c,d,a,w[5],21,4237533241);
  a=iii(a,b,c,d,w[12],6,1700485571);d=iii(d,a,b,c,w[3],10,2399980690);c=iii(c,d,a,b,w[10],15,4293915773);b=iii(b,c,d,a,w[1],21,2240044497);
  a=iii(a,b,c,d,w[8],6,1873313359);d=iii(d,a,b,c,w[15],10,4264355552);c=iii(c,d,a,b,w[6],15,2734768916);b=iii(b,c,d,a,w[13],21,1309151649);
  a=iii(a,b,c,d,w[4],6,4149444226);d=iii(d,a,b,c,w[11],10,3174756917);c=iii(c,d,a,b,w[2],15,718787259);b=iii(b,c,d,a,w[9],21,3951481745);
  a0=add(a0,a);b0=add(b0,b);c0=add(c0,c);d0=add(d0,d);
 }
 var out='';[a0,b0,c0,d0].forEach(function(x){for(var n=0;n<4;n++)out+=('0'+((x>>>(n*8))&255).toString(16)).slice(-2);});
 return out;
}
// ---- AES-CBC via the runtime CryptoJS (bundled in CCTVHost) ----
function hxCryptoJS(){
 if(typeof CryptoJS!=='undefined'&&CryptoJS&&CryptoJS.AES&&CryptoJS.enc&&CryptoJS.mode&&CryptoJS.pad)return CryptoJS;
 try{var g=(typeof globalThis!=='undefined')?globalThis:null;
  if(g&&typeof g.__cctvImport==='function'){var c=g.__cctvImport('crypto-js');if(c&&c.AES&&c.enc)return c;}}catch(e){}
 throw new Error('本站需要 CryptoJS 运行环境，请更新 CCTVHost 后重试');
}
function hxAesCbcEncryptB64(keyStr,ivStr,plainStr){
 var C=hxCryptoJS();
 var enc=C.AES.encrypt(C.enc.Utf8.parse(String(plainStr)),C.enc.Utf8.parse(keyStr),{iv:C.enc.Utf8.parse(ivStr),mode:C.mode.CBC,padding:C.pad.Pkcs7});
 return enc.toString();
}
function hxAesCbcDecryptB64(keyStr,ivStr,b64){
 var C=hxCryptoJS();
 var cipher=C.enc.Base64.parse(String(b64||''));
 var params=C.lib.CipherParams.create({ciphertext:cipher});
 var s='';
 try{
  var dec=C.AES.decrypt(params,C.enc.Utf8.parse(keyStr),{iv:C.enc.Utf8.parse(ivStr),mode:C.mode.CBC,padding:C.pad.Pkcs7});
  s=dec.toString(C.enc.Utf8);
 }catch(e){s='';}
 if(!s){ // class c() fallback: NoPadding, strip trailing zero bytes
  var dec2=C.AES.decrypt(params,C.enc.Utf8.parse(keyStr),{iv:C.enc.Utf8.parse(ivStr),mode:C.mode.CBC,padding:C.pad.NoPadding});
  s=dec2.toString(C.enc.Utf8).replace(/\u0000+$/,'');
 }
 return s;
}
function hxRandHex(n){var s='';for(var i=0;i<n;i++)s+='0123456789abcdef'[Math.floor(Math.random()*16)];return s;}
function hxRandAlnum(n){var a='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',s='';for(var i=0;i<n;i++)s+=a[Math.floor(Math.random()*a.length)];return s;}
function hxText(s){return String(s==null?'':s).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();}
function hxPage(p){var n=Number(p||1);if(!Number.isSafeInteger(n)||n<1||n>500)throw new Error('页码无效');return n;}
var hxSessionCache=null,hxSessionPromise=null;
async function hxSession(){
 if(hxSessionCache)return hxSessionCache;
 if(hxSessionPromise)return hxSessionPromise;
 hxSessionPromise=(async function(){
  var saved=null;
  try{var raw=await CCTVStorage.get('hanquan.session');if(raw)saved=JSON.parse(raw);}catch(e){}
  if(!saved||typeof saved.c!=='string'||saved.c.length!==16||typeof saved.d!=='string'||!saved.d||typeof saved.e!=='string'||!saved.e){
   saved={c:hxRandHex(16),d:hxRandAlnum(20),e:hxRandAlnum(20)};
   try{await CCTVStorage.set('hanquan.session',JSON.stringify(saved));}catch(e){}
  }
  var g=hxMd5Hex(saved.c);
  var f=hxAesCbcEncryptB64(HX.keyF,HX.ivK,saved.c);
  return hxSessionCache={c:saved.c,d:saved.d,e:saved.e,g:g,f:f};
 })();
 try{return await hxSessionPromise;}finally{hxSessionPromise=null;}
}
async function hxHeaders(){
 var s=await hxSession(),now=Date.now(),b=now-1209600000;
 var payload='{"emu":0,"ou":0,"it":"'+b+'","iit":"'+b+'","bs":0,"uid":"'+s.c+'","pc":0,"tm":81,"d8m":"0,0,0,0,0,0,0,4","md":"25128PNA1C","maker":"Xiaomi","osv":"17","br":95,"rpc":0,"scc":2,"plc":6,"toc":19,"tsc":10,"ts":"'+now+'","pa":1,"crec":0,"nw":2,"px":"0","isp":"","ai":"'+s.d+'","oa":"'+s.e+'","dpc":0,"dsc":0,"qpc":0,"apad":0,"pk":"com.babycloud.hanju"}';
 var sign=hxAesCbcEncryptB64(s.g.slice(0,16),s.g.slice(16,32),payload);
 return {vc:'a_8350',vn:'6.9',ch:'qq',app:'hj','User-Agent':HX.ua,'Accept-Encoding':'gzip','Connection':'Keep-Alive',said:s.d,uk:s.f,sign:sign};
}
function hxData(r){
 var s=r.statusCode||r.status,d=r.data;
 if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){throw new Error('韩圈返回了无效数据，请稍后重试');}}
 if(s<200||s>=300||!d)throw new Error('韩圈接口暂不可用（HTTP '+s+'）');
 if(d.rescode!=null&&d.rescode!==0)throw new Error('韩圈接口返回 rescode='+d.rescode);
 return d;
}
async function hxApi(path,decrypt){
 var r=await CCTVHttp.get(HX.site+path,{headers:await hxHeaders()});
 var d=hxData(r);
 if(decrypt&&typeof d.data==='string'&&d.data)return hxJDecrypt(d);
 return d;
}
// j(): decrypt an encrypted response body (data string).
function hxJDecrypt(obj){
 var s=hxSessionCache;if(!s)throw new Error('韩圈会话未初始化');
 var key=obj.key||'';
 if(!key){if(obj.ts==null)throw new Error('韩圈加密响应缺少密钥材料');key=hxMd5Hex(s.c+String(obj.ts));}
 var k2=hxMd5Hex(key+HX.keyL);
 var plain=hxAesCbcDecryptB64(k2.slice(0,16),k2.slice(16,32),obj.data);
 plain=plain.replace(/[\x00-\x1f\x7f-\x9f]/g,'');
 var out;try{out=JSON.parse(plain);}catch(e){throw new Error('韩圈加密响应解密失败');}
 return out;
}
function hxVodLink(sid){return Source.origin+'/__cctvhost__/hanquan/vod?sid='+encodeURIComponent(sid);}
function hxEpisodeLink(pid,sid){return Source.origin+'/__cctvhost__/hanquan/episode?pid='+encodeURIComponent(pid)+'&sid='+encodeURIComponent(sid||'');}
function hxCard(it){
 if(!it||!it.sid||!it.name)throw new Error('韩圈影片数据不完整');
 var cover=/^https?:\/\//.test(it.thumb||'')?it.thumb:(/^https?:\/\//.test(it.poster||'')?it.poster:'');
 var date='';if(it.publishTime){var d=new Date(Number(it.publishTime));if(!isNaN(d.getTime()))date=d.toISOString().slice(0,10);}
 return {id:hxVodLink(it.sid),type:'url',link:hxVodLink(it.sid),title:hxText(it.name),coverUrl:cover,posterPath:cover,
  mediaType:Number(it.category)===3?'movie':'tv',releaseDate:date,
  genreTitle:'',description:[hxText(it.intro),it.isFinished===true?'完结':(it.isFinished===false?'更新中':'')].filter(Boolean).join(' · '),
  actor:'',director:''};
}
function hxCards(list){
 if(!Array.isArray(list))throw new Error('韩圈片单格式异常');
 var seen={};return list.filter(function(it){if(!it||!it.sid||seen[it.sid])return false;seen[it.sid]=true;return true;}).map(hxCard);
}
async function loadHome(params){
 var d=await hxApi('/api/series/index?offset=0',false);
 return hxCards(d.seriesList||[]);
}
async function loadCatalog(params){
 params=params||{};var ch=String(params.channelId||'1'),page=hxPage(params.page);
 if(ch==='rank'){
  var r=await hxApi('/api/series/rank',false);
  return hxCards(r.seriesList||[]);
 }
 var sort=String(params.sort||'hot');if(['hot','new','score'].indexOf(sort)<0)sort='hot';
 var year=String(params.year==null?'-1':params.year);
 var q='/api/series/cate?stype='+encodeURIComponent(ch)+'&sort='+encodeURIComponent(sort)+'&page='+page;
 if(year&&year!=='-1'&&year!=='全部')q+='&year='+encodeURIComponent(year);
 var d=await hxApi(q,false);
 return hxCards(d.seriesList||[]);
}
async function search(params){
 params=params||{};var keyword=String(params.keyword||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
 if(!keyword)return [];
 var page=hxPage(params.page);
 var q='/api/search/s5?k='+encodeURIComponent(keyword)+'&srefer=search_input&type=0&page='+page;
 var d=await hxApi(q,true);
 var list=d.seriesList;
 if(!Array.isArray(list)&&d.seriesData&&Array.isArray(d.seriesData.seriesList))list=d.seriesData.seriesList;
 // The site occasionally returns a valid 200 with an empty list; retry once.
 if((!Array.isArray(list)||!list.length)&&page===1){
  d=await hxApi(q,true);
  list=d.seriesList;
  if(!Array.isArray(list)&&d.seriesData&&Array.isArray(d.seriesData.seriesList))list=d.seriesData.seriesList;
 }
 return hxCards(list||[]);
}
async function loadDetail(link){
 var m=String(link||'').match(/^https:\/\/hxqapi\.hiyun\.tv\/__cctvhost__\/hanquan\/vod\?sid=(.+)$/);
 if(!m)throw new Error('请选择韩圈组件内的影片');
 var sid=decodeURIComponent(m[1]);
 var d=await hxApi('/api/series/detail?sid='+encodeURIComponent(sid),false);
 var series=d.series||{};
 if(!series.sid)throw new Error('韩圈详情数据异常');
 var item=hxCard(series);item.link=link;item.id=link;
 var crew=hxText(series.crew||'');
 var date='';if(series.publishTime){var pd=new Date(Number(series.publishTime));if(!isNaN(pd.getTime()))date=pd.toISOString().slice(0,10);}
 item.description=[hxText(series.intro||''),crew,date,series.isFinished===true?'完结':''].filter(Boolean).join(' · ');
 if(crew){var actor=crew.replace(/^主演[:：]\s*/,'');if(actor)item.actor=actor;}
 var eps=Array.isArray(d.playItems)?d.playItems:[];
 item.episodeItems=eps.filter(function(p){return p&&p.pid;}).map(function(p){
  var title='第'+(p.serialNo||'')+'集';if(p.title)title+=' '+hxText(p.title);
  return {id:hxEpisodeLink(p.pid,sid),type:'url',link:hxEpisodeLink(p.pid,sid),title:title,coverUrl:item.coverUrl,mediaType:item.mediaType};
 });
 item.childItems=[];
 return item;
}
// Z(): extract a playable URL from a decrypted rslvV4 datas item.
function hxExtractPlayUrl(obj){
 if(!obj||typeof obj!=='object')return '';
 var keys=['playUrl','url','page','m3u8'],i,url='';
 for(i=0;i<keys.length;i++){var v=obj[keys[i]];if(typeof v==='string'&&v.trim()){url=v.trim();break;}}
 if(!url){
  var s=JSON.stringify(obj);
  var m=s.match(/https?:\/\/[^\s"']+\/(?:m3u8|video)\/[A-Za-z0-9_]+(?:\.m3u8|\.mp4)?/);
  if(m)url=m[0];
 }
 if(!url){
  var s2=JSON.stringify(obj);
  var m2=s2.match(/\/m3u8\/([A-Za-z0-9_]{20,})(?:\.m3u8)?/);
  if(m2)url=HX.cdn+'/m3u8/'+m2[1]+'.m3u8';
 }
 return url;
}
async function resolveResource(params){
 params=params||{};var link=String(params.link||params.id||'');
 var m=link.match(/^https:\/\/hxqapi\.hiyun\.tv\/__cctvhost__\/hanquan\/episode\?pid=([^&]+)(?:&sid=([^&]*))?$/);
 if(!m)throw new Error('请选择韩圈组件内的分集');
 var pid=decodeURIComponent(m[1]);
 var s=await hxSession();
 // 1. episode detail -> scid + encrypted sources data (r()).
 var ep=await hxApi('/api/series2/episode/detail?pid='+encodeURIComponent(pid)+'&refer='+encodeURIComponent(HX.refer),true);
 var playItem=ep.playItem||ep;
 var sources=playItem&&Array.isArray(playItem.sources)?playItem.sources:[];
 if(!sources.length||!sources[0].scid)throw new Error('该分集暂无播放源');
 var src=sources[0];
 if(src.data){
  // Validate the chain: sources data decrypts to [{"smid":"sm_..."}].
  var raw=hxAesCbcDecryptB64(HX.keyO,HX.ivP,src.data);
  var arr;try{arr=JSON.parse(raw);}catch(e){arr=null;}
  if(!Array.isArray(arr)||!arr.length||!arr[0].smid)throw new Error('韩圈分集源数据异常');
 }
 var scid=src.scid;
 // 2. rslvV4 with the local MD5 sign (w(), minus the rpc gate).
 var out=[],qualityName='';
 for(var qi=0;qi<3;qi++){
  var sq=['10','2','1'][qi];
  var uuid=hxRandAlnum(32),t=Math.floor(Date.now()/1000);
  var pairs=[['t',String(t)],['dt','android'],['version','6.9'],['uuid',uuid],['udid',s.g],['pid',pid],['scid',scid],['re','1'],['sq',sq]];
  var qs=pairs.map(function(p){return p[0]+'='+p[1];}).join('&');
  var map={};pairs.forEach(function(p){map[p[0]]=p[1];});
  var keys=Object.keys(map).sort().reverse();
  var md5str=keys.map(function(k){return '&'+k+'='+map[k];}).join('')+'&'+HX.keyM;
  var sign=hxMd5Hex(md5str);
  var r=await hxApi('/api/series/rslvV4?'+qs+'&sign='+encodeURIComponent(sign),false);
  if(r&&Array.isArray(r.datas)&&r.datas.length){
   qualityName=hxText(r.qualityName||'');
   var k2=hxMd5Hex(s.g+HX.keyL);
   var seen={};
   for(var di=0;di<r.datas.length;di++){
    var dataStr=r.datas[di]&&r.datas[di].data;
    if(typeof dataStr!=='string'||!dataStr)continue;
    var plain=hxAesCbcDecryptB64(k2.slice(0,16),k2.slice(16,32),dataStr);
    plain=plain.replace(/[\x00-\x1f\x7f-\x9f]/g,'');
    var dec;try{dec=JSON.parse(plain);}catch(e){continue;}
    var url=hxExtractPlayUrl(dec);
    if(!url||seen[url])continue;seen[url]=true;
    var ua='tdc.8350';
    if(dec.header&&typeof dec.header['User-Agent']==='string'&&dec.header['User-Agent'])ua=dec.header['User-Agent'];
    out.push({name:qualityName||'韩圈线路',url:url,playerType:'app',customHeaders:{'User-Agent':ua},description:'韩圈直连'});
   }
   if(out.length)break;
  }
 }
 if(!out.length)throw new Error('该分集暂无可播放地址（可能为分段 mp4list，需重组后才能播放）');
 return out;
}

// BEGIN COLLECTION RUNTIME
var CollectionConfig={"description":"六类片库 · 完整分集 · 直连与AI（受原站额度限制）","poster":"https://joeshu.github.io/yqk-forward-widget/collection-poster.png","guide":"六类片库 · 完整分集 · 直连与AI（受原站额度限制）\nAI会消耗原站词元，请查看AI额度状态；不通过轮换游客身份绕过额度。\n片单摘要为展示而缩短，详情保留全文；占位图仅表示暂无海报。新旧片以原站标注为准；旧片补录也可能出现在近期更新。"};
// Common presentation and request lifecycle. Site parsers and permissions remain in their adapters.
var CollectionCooldownUntil=0;
(function collectionInstall(root) {
  var meta=CCTVHostMetadata, config=CollectionConfig, pending=Object.create(null), last=null;
  var storeKey='collection.status.v1.'+meta.id, guideLink=meta.site.replace(/\/$/,'')+'/#joeshu-widget-guide';
  function text(value){return String(value==null?'':value).trim();}
  function scrub(value){return text(value).replace(/https?:\/\/\S+/g,'[地址]').replace(/(?:cookie|token|sessionSign|captcha_login_sign)\s*[:=]\s*\S+/gi,'[会话信息]').replace(/\b[a-f\d]{32,}\b/gi,'[标识]').slice(0,240);}
  function artwork(value){var s=text(value);if(/^\/\//.test(s))return 'https:'+s;if(/^https?:\/\/[^\s/@]+(?:[/?#]|$)/i.test(s)||/^data:image\//i.test(s))return s;return '';}
  function listItem(item){if(!item||typeof item!=='object')return item;var out=Object.assign({},item), cover=artwork(item.coverUrl)||artwork(item.posterPath);
    out.title=text(item.title);if(!cover&&/^\//.test(text(item.coverUrl)))cover=meta.site.replace(/\/$/,'')+text(item.coverUrl);
    if(!cover&&!text(item.posterPath)){cover=config.poster;out.description='暂无原站海报'+(item.description?' · '+text(item.description):'');}
    if(cover){out.coverUrl=cover;if(!item.posterPath)out.posterPath=cover;}
    var info=[],year=text(item.releaseDate).match(/^(?:19|20)\d{2}/), desc=text(out.description||item.description);
    if(year&&desc.indexOf(year[0])<0)info.push(year[0]);
    var genre=text(item.genreTitle);if(genre&&genre.length<=30&&desc.indexOf(genre)<0)info.push(genre);
    var summary=desc.replace(/\s+/g,' ');if(summary.length>150)summary=summary.slice(0,150)+'…';out.description=info.concat(summary?[summary]:[]).join(' · ');return out;
  }
  function resultList(items){if(!Array.isArray(items))throw new Error('片单格式异常，请更新模块后重试');var seen=Object.create(null),out=[];items.forEach(function(item){var key=item&&text(item.id||item.link);if(key&&seen[key])return;if(key)seen[key]=true;out.push(listItem(item));});return out;}
  function canonical(value,depth){if(depth>8)throw Error('deep');if(value===null||typeof value!=='object')return value;if(Array.isArray(value))return value.map(function(v){return canonical(v,depth+1);});var out={};Object.keys(value).sort().forEach(function(k){out[k]=canonical(value[k],depth+1);});return out;}
  function requestKey(name,args){try{var s=JSON.stringify(canonical(args,0));return s.length<=8192?name+'|'+s:null;}catch(e){return null;}}
  function errorHint(error){var e=new Error(),s=scrub(error&&error.message||error),status=Number(error&&error.status);
    if(/TLS|SSL|secure connection|安全连接|证书|-120[0-6]/i.test(s))s='HTTPS连接失败，请检查网络或代理后重试';
    else if(/timed out|timeout|超时|-1001/i.test(s))s='请求超时，请稍后重试或检查网络';
    if((error&&error.code==='RATE_LIMIT')||status===429){CollectionCooldownUntil=Date.now()+30000;s='原站请求过于频繁，30秒后重试；本次不再继续换线';}
    e.message=(s.indexOf(meta.title)===0?'':meta.title+'：')+s;
    ['code','status','apiCode','name'].forEach(function(k){if(error&&error[k]!=null)e[k]=error[k];});return e;
  }
  async function record(row){last={version:1,id:meta.id,at:Date.now(),stage:({loadDetail:'完整分集',resolveResource:'线路检查',search:'搜索',loadHome:'首页推荐',loadLatest:'近期更新',loadCatalog:'分类片库',loadCategory:'分类片库',loadFiltered:'条件筛选'})[row.stage]||'片单加载',ok:row.ok,count:row.count==null?null:row.count,elapsedMs:row.elapsedMs,error:row.error||''};try{if(CCTVStorage&&typeof CCTVStorage.set==='function')await CCTVStorage.set(storeKey,JSON.stringify(last));}catch(e){}}
  async function status(){var row=last;try{if(!row&&CCTVStorage){var raw=await CCTVStorage.get(storeKey);if(typeof raw==='string'&&raw.length<4096){var data=JSON.parse(raw);if(data.version===1&&data.id===meta.id&&typeof data.ok==='boolean'&&Number.isFinite(data.at)&&data.at>0&&data.at<=Date.now()+60000)row=data;}}}catch(e){}
    var title=meta.title+' · '+(row?(row.ok?'最近加载成功':'最近加载受阻'):'使用说明'),description=config.guide;
    if(row){var date=new Date(row.at+8*3600000).toISOString().slice(0,16).replace('T',' ');description='最近记录：北京时间 '+date+' · '+(row.stage||'加载')+' · '+Math.round(Number(row.elapsedMs)||0)+'毫秒'+(row.count!=null?' · '+row.count+'项':'')+'\n'+(!row.ok?scrub(row.error)+'\n':'')+description+'\n这是一条历史记录，不代表原站当前在线状态。';}
    return [{id:guideLink,type:'url',link:guideLink,title:title,description:description,coverUrl:config.poster}];
  }
  root.collectionStatus=status;
  var functions=Object.create(null);meta.modules.forEach(function(m){if(m.functionName&&!/^(?:configureSession|loadAiQuotaStatus|collectionStatus)$/.test(m.functionName))functions[m.functionName]=true;});if(meta.search)functions[meta.search.functionName]=true;functions.loadDetail=true;functions.resolveResource=true;
  Object.keys(functions).forEach(function(name){var original=root[name];if(typeof original!=='function')return;root[name]=function(){var args=Array.prototype.slice.call(arguments),self=this;if(name==='search'&&!text(args[0]&&args[0].keyword).replace(/[\u200b-\u200d\ufeff]/g,''))return Promise.resolve([]);
    if(name==='loadDetail'&&args[0]===guideLink)return status().then(function(items){return items[0];});
    if(Date.now()<CollectionCooldownUntil){var e=new Error(meta.title+'：原站请求过于频繁，请在30秒后重试');e.code='RATE_LIMIT';return Promise.reject(e);}
    var key=requestKey(name,args);if(Object.keys(pending).length>=64)key=null;if(key&&pending[key])return pending[key];var start=Date.now();var promise=Promise.resolve().then(function(){return original.apply(self,args);}).then(function(value){return name==='loadDetail'||name==='resolveResource'?value:resultList(value);}).then(async function(out){await record({stage:name,ok:true,count:Array.isArray(out)?out.length:null,elapsedMs:Date.now()-start});return out;},async function(error){var e=errorHint(error);await record({stage:name,ok:false,elapsedMs:Date.now()-start,error:e.message});throw e;});
    if(key){pending[key]=promise;function clean(){if(pending[key]===promise)delete pending[key];}promise.then(clean,clean);}return promise;
  };});
  meta.description=config.description;meta.detailCacheDuration=0;
  meta.modules.forEach(function(m){if(m.id==='latest')m.title=config.latestTitle||'近期更新';if(m.id==='home')m.title=config.homeTitle||'首页推荐';if(m.id==='catalog'||m.id==='category')m.title=config.catalogTitle||'分类片库';if(m.id==='searchList')m.title=meta.id==='joeshu.anime1'?'搜索动画':'搜索影片';if(m.type==='stream'){m.cacheDuration=0;m.title='播放线路';}else if(m.functionName==='search')m.cacheDuration=0;else if(!/^(?:configureSession|loadAiQuotaStatus)$/.test(m.functionName))m.cacheDuration=m.id==='latest'?30:60;});
  if(meta.search&&!meta.modules.some(function(m){return m.functionName===meta.search.functionName;}))meta.modules.push({id:'searchList',title:'搜索影片',functionName:meta.search.functionName,cacheDuration:0,params:meta.search.params});
  function order(m){if(m.id==='latest')return 0;if(m.id==='home')return 1;if(m.id==='newReleases')return 2;if(m.functionName==='configureSession')return meta.id==='joeshu.juyeye'?-1:8;if(m.functionName==='loadAiQuotaStatus')return 8;if(m.type==='stream')return 10;if(m.id==='searchList')return 7;return 3;}
  meta.modules=meta.modules.map(function(m,i){return {m:m,i:i};}).sort(function(a,b){return order(a.m)-order(b.m)||a.i-b.i;}).map(function(x){return x.m;});
  meta.modules.splice(meta.modules.findIndex(function(m){return m.type==='stream';})<0?meta.modules.length:meta.modules.findIndex(function(m){return m.type==='stream';}),0,{id:'collectionGuide',title:'使用说明与状态',functionName:'collectionStatus',cacheDuration:0,params:[]});
})(globalThis);

/* CCTVHost CatVod contract. This adapter is intentionally self-contained. */
var CCTVHttp=(function(){
  async function request(url,options){
    options=options||{};
    if(typeof net==='undefined'||!net||typeof net.http!=='function')throw new Error('CCTVHost 网络接口不可用');
    var result=await net.http(String(url),options);
    if(result&&result.error)throw new Error(String(result.error));
    var content=result&&result.content,data=content;
    if(options.buffer===1)data='';
    else if(typeof content==='string'){
      try{data=JSON.parse(content);}catch(_){data=content;}
    }
    return {statusCode:Number(result&&result.code)||0,status:Number(result&&result.code)||0,
      headers:result&&result.headers||{},data:data,bodyBase64:options.buffer===1&&typeof content==='string'?content:''};
  }
  return {request:request,get:function(url,options){return request(url,options);},
    post:function(url,body,options){options=Object.assign({},options||{},{method:'POST',body:body});return request(url,options);}};
})();
var CCTVStorage={
  get:async function(key){if(typeof local==='undefined'||!local||typeof local.get!=='function')return null;return local.get('cctvhost.'+String(CCTVHostMetadata.id)+'.'+String(key));},
  set:async function(key,value){if(typeof local==='undefined'||!local||typeof local.set!=='function')return;local.set('cctvhost.'+String(CCTVHostMetadata.id)+'.'+String(key),value==null?'':String(value));},
  remove:async function(key){if(typeof local==='undefined'||!local||typeof local.delete!=='function')return;local.delete('cctvhost.'+String(CCTVHostMetadata.id)+'.'+String(key));}
};

function cctvCatVodText(value){return String(value==null?'':value).replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();}
function cctvCatVodValue(item,keys){for(var i=0;i<keys.length;i++)if(item&&item[keys[i]]!=null&&item[keys[i]]!=='')return item[keys[i]];return '';}
function cctvCatVodCards(items){
  return (Array.isArray(items)?items:[]).map(function(item){
    if(!item||typeof item!=='object')return null;
    var id=cctvCatVodValue(item,['id','link']),name=cctvCatVodValue(item,['title','name']);
    if(!id||!name)return null;
    var cover=cctvCatVodValue(item,['coverUrl','posterPath','vod_pic']);
    return {vod_id:String(id),vod_name:cctvCatVodText(name),vod_pic:String(cover||''),
      vod_remarks:cctvCatVodText(cctvCatVodValue(item,['description','remark','vod_remarks'])),
      vod_content:cctvCatVodText(cctvCatVodValue(item,['description','summary','vod_content'])),
      vod_year:cctvCatVodText(cctvCatVodValue(item,['releaseDate','year','vod_year'])),
      vod_area:cctvCatVodText(cctvCatVodValue(item,['area','vod_area'])),
      vod_class:cctvCatVodText(cctvCatVodValue(item,['genreTitle','type','vod_class'])),
      vod_actor:cctvCatVodText(cctvCatVodValue(item,['actor','vod_actor'])),
      vod_director:cctvCatVodText(cctvCatVodValue(item,['director','vod_director']))};
  }).filter(Boolean);
}
function cctvCatVodPage(items,page,maxPage){
  var list=cctvCatVodCards(items),current=Math.max(1,Math.floor(Number(page)||1));
  var count=Number(maxPage)||0;
  if(!count)count=list.length?current+1:current;
  return {page:String(current),pagecount:String(Math.max(current,count)),limit:String(list.length||20),total:String(list.length),list:list};
}
function cctvCatVodClasses(){
  if(typeof Source!=='undefined'&&CCTVHostMetadata.modules){
    var module=CCTVHostMetadata.modules.find(function(row){return row&&row.functionName==='loadCatalog';});
    var param=module&&module.params&&module.params.find(function(row){return row.name==='channelId';});
    if(param&&Array.isArray(param.enumOptions))return param.enumOptions.map(function(row){return {type_id:String(row.value),type_name:String(row.title)};});
  }
  if(typeof DYL!=='undefined')return (dylConfig&&dylConfig.index_top_nav||[]).filter(function(row){return row&&/^\d+$/.test(String(row.id));}).map(function(row){return {type_id:String(row.id),type_name:cctvCatVodText(row.name||row.title)};});
  if(typeof YqkCategories!=='undefined'){
    var out=[];
    YqkCategories.forEach(function(row){out.push({type_id:String(row.id),type_name:String(row.title)});(row.children||[]).forEach(function(child){out.push({type_id:String(row.id)+':'+String(child[0]),type_name:String(row.title)+' · '+String(child[1])});});});
    out.push({type_id:'65',type_name:'奈飞 Netflix'},{type_id:'56',type_name:'高清韩剧'});
    return out;
  }
  if(typeof SjKinds!=='undefined')return SjKinds.map(function(row){return {type_id:String(row[0]),type_name:String(row[1])};});
  return [];
}
function cctvCatVodEpisode(item){
  var route=cctvCatVodValue(item,['link','id']);
  if(!route)return null;
  var title=cctvCatVodText(cctvCatVodValue(item,['title','name']))||'正片';
  return {title:title.replace(/[$#]/g,' '),url:String(route)};
}
function cctvCatVodGroups(item){
  var episodes=Array.isArray(item&&item.episodeItems)?item.episodeItems:[],groups=Object.create(null),order=[];
  function add(name,episode){if(!episode)return;name=cctvCatVodText(name)||'原站线路';if(!groups[name]){groups[name]=[];order.push(name);}groups[name].push(episode);}
  episodes.forEach(function(ep){
    var children=Array.isArray(ep&&ep.childItems)?ep.childItems:[];
    if(children.length){children.forEach(function(child){var title=cctvCatVodText(child&&child.title),split=title.indexOf(' · '),line=split>0?title.slice(0,split):'原站线路',episodeTitle=split>0?title.slice(split+3):cctvCatVodText(ep.title);add(line,{title:(episodeTitle||ep.title||'正片').replace(/[$#]/g,' '),url:String(child.link||child.id||'')});});}
    else add('原站线路',cctvCatVodEpisode(ep));
  });
  return order.map(function(name){return {name:name,episodes:groups[name]};});
}
function cctvCatVodDetailRow(item,groups){
  var row=cctvCatVodCards([item])[0];if(!row)throw new Error('站点详情缺少有效影片信息');
  groups=(groups||cctvCatVodGroups(item)).filter(function(group){return group&&group.episodes&&group.episodes.length;});
  if(!groups.length)throw new Error('站点没有返回可选分集');
  row.vod_play_from=groups.map(function(group){return cctvCatVodText(group.name).replace(/[$#]/g,' ');}).join('$$$');
  row.vod_play_url=groups.map(function(group){return group.episodes.map(function(ep){return ep.title+'$'+ep.url;}).join('#');}).join('$$$');
  return row;
}
async function cctvCatVodMap(items,mapper,limit){
  var out=new Array(items.length),next=0,workers=[];limit=Math.max(1,Math.min(Number(limit)||4,items.length||1));
  for(var i=0;i<limit;i++)workers.push((async function(){while(next<items.length){var index=next++;out[index]=await mapper(items[index],index);}})());
  await Promise.all(workers);return out;
}
async function cctvCatVodHome(){
  if(typeof DYL!=='undefined')await dylEnsure();
  var classes=cctvCatVodClasses(),items;
  if(typeof YQK!=='undefined')items=await loadHome({topicId:'all'});else items=await loadHome({});
  return {class:classes,list:cctvCatVodCards(items)};
}
async function cctvCatVodCategory(tid,page,filter,extend){
  var id=String(tid||''),current=Math.max(1,Math.floor(Number(page)||1)),items,maxPage=0;
  if(typeof YQK!=='undefined'){
    if(id==='65'||id==='56')items=await loadCollection({channelId:id,collection:'latest',page:current});
    else{var match=id.match(/^(\d+)(?::(\d+))?$/);if(!match)throw new Error('分类编号无效');
      items=await loadCategory({parentChannelId:match[1],childChannelId:match[2]||extend&&extend.childChannelId||'',page:current});}
    maxPage=Number(YQK.maxPage)||0;
  }else if(typeof SjKinds!=='undefined'){
    items=await loadCatalog({kind:id,genre:extend&&extend.genre||'',area:extend&&extend.area||'',year:extend&&extend.year||'',sort:extend&&extend.sort||'updated_desc',page:current});
  }else items=await loadCatalog({channelId:id,page:current});
  return cctvCatVodPage(items,current,maxPage);
}
async function cctvCatVodSearch(keyword,quick,page){
  return cctvCatVodPage(await search({keyword:String(keyword||''),page:Math.max(1,Math.floor(Number(page)||1))}),page);
}
async function cctvCatVodDetail(ids){
  var id=Array.isArray(ids)?ids[0]:ids,detail=await loadDetail(String(id||''));
  var groups=cctvCatVodGroups(detail);
  if(typeof YQK!=='undefined'&&Array.isArray(detail.childItems)&&detail.childItems.length){
    var sources=detail.childItems.slice(0,24);
    var resolved=await cctvCatVodMap(sources,async function(source){
      try{var lineDetail=await loadDetail(String(source.link||source.id||'')),episodes=Array.isArray(lineDetail.episodeItems)?lineDetail.episodeItems:[];
        var name=cctvCatVodText(source.title).replace(/\s*[（(].*[）)]\s*$/,'')||'原站线路';
        return {name:name,episodes:episodes.map(cctvCatVodEpisode).filter(Boolean)};
      }catch(_){return null;}
    },4);
    groups=resolved.filter(function(group){return group&&group.episodes.length;});
  }
  return {list:[cctvCatVodDetailRow(detail,groups)]};
}
async function cctvCatVodPlay(flag,id,vipFlags){
  var result=await resolveResource({link:String(id||'')}),media=Array.isArray(result)?result[0]:result;
  var url=String(media&&media.url||media&&media.playUrl||'');
  if(!/^https?:\/\//i.test(url))throw new Error('站点没有返回可播放的视频地址');
  return {parse:0,url:url,header:media.customHeaders||media.headers||media.header||{}};
}
module.exports={
  home:async function(filter){return cctvCatVodHome();},
  category:async function(tid,page,filter,extend){return cctvCatVodCategory(tid,page,filter,extend||{});},
  search:async function(keyword,quick,page){return cctvCatVodSearch(keyword,quick,page);},
  detail:async function(ids){return cctvCatVodDetail(ids);},
  play:async function(flag,id,vipFlags){return cctvCatVodPlay(flag,id,vipFlags);}
};
