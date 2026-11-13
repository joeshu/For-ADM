// Standalone 半日99 adapter (App99 family).
// Protocol reconstructed from the site's Android client (spider.jar,
// Lcom/github/catvod/spider/App99 method bodies, 2026-11-13) and verified
// live against this backend: systemInit -> userInfo -> search/detail ->
// vodParser all return decrypted data from this machine. AES-256-CBC key is
// the session uuid with '-' removed; responses are raw-deflate compressed
// after decryption. No account credentials: anonymous visitor token only.
var Source={id:'banri99',name:'半日99',origin:'http://103.217.190.91:19987/app/bn',version:'0.1.0'};
var CCTVHostMetadata={id:'joeshu.banri99',title:'半日99',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'分类片库、搜索、完整分集与直连/解析线路。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'kind',title:'分类',type:'enumeration',value:'1',enumOptions:[{"title":"电影","value":"1"},{"title":"电视剧","value":"2"},{"title":"动漫","value":"3"},{"title":"综艺","value":"4"},{"title":"短剧","value":"22"},{"title":"少儿","value":"20"},{"title":"纪录片","value":"5"},{"title":"直播","value":"23"}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'例如：仙逆'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'半日99搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var SjKinds=[["1","电影"],["2","电视剧"],["3","动漫"],["4","综艺"],["22","短剧"],["20","少儿"],["5","纪录片"],["23","直播"]];
var A99Site={host:'http://103.217.190.91:19987/app/bn',origin:'http://103.217.190.91:19987/app/bn',versionName:'3.5.8',name:'半日闲',package:'com.yf.lelian',buildNumber:'2001',buildSignature:'A40DA80A59D170CAA950CF15C18C454D47A39B26989D8B640ECD745BA71BF5DC',defaultKind:'1',movieTids:["1"]};
// App99 protocol adapter head (shared by juquan99.js / banri99.js).
// Protocol reconstructed from Lcom/github/catvod/spider/App99 method bodies
// (classes.dex, 2026-11-13) and verified live against both backends.
// Sign = lowercase hex SHA-256 of  encryptedBody + ':' + timestamp + ':' +
//   nonce + ':' + token. AES-256-CBC key = session uuid with '-' removed
//   (32 bytes UTF-8); encrypt uses a random IV, output base64(IV||ciphertext);
//   decrypt takes IV from the first 16 bytes, then zlib-inflates the
//   plaintext (falls back to plain UTF-8). systemInit issues the player map,
//   parser list and categories; userInfo issues user_token (4th sign field).
//   Live finding 2026-11-13: userInfo sometimes returns an EMPTY user_token
//   (same device, minutes apart — server-side issuance is intermittent), and
//   search/detail/vodParser all work fine with token '' — so an empty token
//   is not an error; the adapter proceeds without one and keeps using it
//   only when the server actually issues it.
// No account credentials: the uuid is a fresh random client id, the token is
// an anonymous visitor token issued by /app/userInfo.

// ---- byte helpers (no runtime dependency) ----
var A99_B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function a99B64Encode(bytes){
  var out='',i;
  for(i=0;i<bytes.length;i+=3){
    var b0=bytes[i],b1=i+1<bytes.length?bytes[i+1]:0,b2=i+2<bytes.length?bytes[i+2]:0;
    out+=A99_B64[b0>>2]+A99_B64[((b0&3)<<4)|(b1>>4)]+((i+1<bytes.length)?A99_B64[((b1&15)<<2)|(b2>>6)]:'=')+((i+2<bytes.length)?A99_B64[b2&63]:'=');
  }
  return out;
}
function a99B64Decode(str){
  var clean=String(str||'').replace(/[^A-Za-z0-9+/=]/g,''),rev={},i;
  for(i=0;i<64;i++) rev[A99_B64[i]]=i;
  var out=[];
  for(var j=0;j+4<=clean.length;j+=4){
    var c0=rev[clean[j]],c1=rev[clean[j+1]],c2=clean[j+2]==='='?0:rev[clean[j+2]],c3=clean[j+3]==='='?0:rev[clean[j+3]];
    if(c0===undefined||c1===undefined||c2===undefined||c3===undefined) break;
    out.push((c0<<2)|(c1>>4));
    if(clean[j+2]!=='=') out.push(((c1&15)<<4)|(c2>>2));
    if(clean[j+3]!=='=') out.push(((c2&3)<<6)|c3);
  }
  return new Uint8Array(out);
}
function a99Utf8Bytes(s){
  s=String(s==null?'':s);
  var out=[],i,cp;
  for(i=0;i<s.length;i++){
    cp=s.charCodeAt(i);
    if(cp<0x80){ out.push(cp); }
    else if(cp<0x800){ out.push(0xC0|(cp>>6),0x80|(cp&0x3F)); }
    else if(cp>=0xD800&&cp<0xDC00&&i+1<s.length){
      var lo=s.charCodeAt(i+1);
      if(lo>=0xDC00&&lo<0xE000){ cp=0x10000+((cp-0xD800)<<10)+(lo-0xDC00); i++; out.push(0xF0|(cp>>18),0x80|((cp>>12)&0x3F),0x80|((cp>>6)&0x3F),0x80|(cp&0x3F)); }
      else { out.push(0xEF,0xBF,0xBD); }
    }
    else if(cp>=0xD800&&cp<0xE000){ out.push(0xEF,0xBF,0xBD); }
    else { out.push(0xE0|(cp>>12),0x80|((cp>>6)&0x3F),0x80|(cp&0x3F)); }
  }
  return new Uint8Array(out);
}
function a99Utf8Text(bytes){
  if(!bytes||!bytes.length) return '';
  var out='',i=0;
  while(i<bytes.length){
    var b=bytes[i++];
    if(b<0x80){ out+=String.fromCharCode(b); }
    else if(b>=0xC0&&b<0xE0&&i<bytes.length){ var b2=bytes[i++]; out+=String.fromCharCode(((b&0x1F)<<6)|(b2&0x3F)); }
    else if(b>=0xE0&&b<0xF0&&i+1<bytes.length){ var c2=bytes[i++],c3=bytes[i++]; out+=String.fromCharCode(((b&0x0F)<<12)|((c2&0x3F)<<6)|(c3&0x3F)); }
    else if(b>=0xF0&&i+2<bytes.length){ var d2=bytes[i++],d3=bytes[i++],d4=bytes[i++]; var cp=(((b&0x07)<<18)|((d2&0x3F)<<12)|((d3&0x3F)<<6)|(d4&0x3F))-0x10000; out+=String.fromCharCode(0xD800+(cp>>10),0xDC00+(cp&0x3FF)); }
    else { out+='\uFFFD'; }
  }
  return out;
}

// ---- pure-JS SHA-256 (same shape as the shipped piandi/kanju adapters) ----
function a99ShaBytes(text){var s=unescape(encodeURIComponent(text));return Array.prototype.map.call(s,function(c){return c.charCodeAt(0);});}
function a99ShaHex(text){
 var k=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
 var h=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],b=a99ShaBytes(text).slice(),bits=b.length*8,i;
 b.push(128);while(b.length%64!==56)b.push(0);for(i=7;i>=0;i--)b.push(Math.floor(bits/Math.pow(256,i))&255);
 function r(x,n){return (x>>>n)|(x<<(32-n));}
 for(var off=0;off<b.length;off+=64){var w=[];for(i=0;i<16;i++)w[i]=(b[off+i*4]<<24)|(b[off+i*4+1]<<16)|(b[off+i*4+2]<<8)|b[off+i*4+3];
  for(i=16;i<64;i++){var x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(r(x,7)^r(x,18)^(x>>>3))+w[i-7]+(r(y,17)^r(y,19)^(y>>>10)))|0;}
  var a=h.slice();for(i=0;i<64;i++){var t1=(a[7]+(r(a[4],6)^r(a[4],11)^r(a[4],25))+((a[4]&a[5])^(~a[4]&a[6]))+k[i]+w[i])|0,t2=((r(a[0],2)^r(a[0],13)^r(a[0],22))+((a[0]&a[1])^(a[0]&a[2])^(a[1]&a[2])))|0;a=[(t1+t2)|0,a[0],a[1],a[2],(a[3]+t1)|0,a[4],a[5],a[6]];}
  for(i=0;i<8;i++)h[i]=(h[i]+a[i])|0;
 }
 var out='';h.forEach(function(x){for(var n=3;n>=0;n--){var v=(x>>>(n*8))&255;out+=('0'+v.toString(16)).slice(-2);}});return out;
}

// ---- raw-deflate (RFC 1951) inflate; server plaintext is deflated ----
var A99_LEN_BASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
var A99_LEN_EXT=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
var A99_DIST_BASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
var A99_DIST_EXT=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
function a99Inflate(input){
  var pos=0,bitBuf=0,bitLen=0,out=[];
  function bits(n){
    while(bitLen<n){
      if(pos>=input.length) throw new Error('数据解压失败：数据不完整');
      bitBuf|=(input[pos++]<<bitLen); bitLen+=8;
    }
    var v=bitBuf&((1<<n)-1); bitBuf>>>=n; bitLen-=n; return v;
  }
  function huff(lengths){
    var maxLen=0,i;
    for(i=0;i<lengths.length;i++) if(lengths[i]>maxLen) maxLen=lengths[i];
    var count=[],first=[],syms=[];
    for(i=0;i<=maxLen;i++){ count[i]=0; first[i]=0; syms[i]=[]; }
    for(i=0;i<lengths.length;i++) if(lengths[i]) count[lengths[i]]++;
    var code=0;
    for(i=1;i<=maxLen;i++){ code=(code+count[i-1])<<1; first[i]=code; }
    for(i=0;i<lengths.length;i++) if(lengths[i]) syms[lengths[i]].push(i);
    return {maxLen:maxLen,count:count,first:first,syms:syms};
  }
  function huffDecode(h){
    var code=0,len=0;
    for(;;){
      code=(code<<1)|bits(1); len++;
      if(len>h.maxLen) throw new Error('数据解压失败：编码无效');
      var idx=code-h.first[len];
      if(idx>=0&&idx<h.count[len]) return h.syms[len][idx];
    }
  }
  var finalBlock=false;
  while(!finalBlock){
    finalBlock=bits(1)===1;
    var type=bits(2),litHuff,distHuff,i;
    if(type===0){
      bitBuf=0; bitLen=0;
      if(pos+4>input.length) throw new Error('数据解压失败：数据不完整');
      var len=input[pos]|(input[pos+1]<<8),nlen=input[pos+2]|(input[pos+3]<<8);
      pos+=4;
      if(len!==((~nlen)&0xffff)) throw new Error('数据解压失败：存储块校验失败');
      for(i=0;i<len;i++){ if(pos>=input.length) throw new Error('数据解压失败：数据不完整'); out.push(input[pos++]); }
    }else{
      if(type===1){
        var litLens=[],distLens=[];
        for(i=0;i<288;i++) litLens[i]=i<144?8:(i<256?9:(i<280?7:8));
        for(i=0;i<32;i++) distLens[i]=5;
        litHuff=huff(litLens); distHuff=huff(distLens);
      }else if(type===2){
        var hlit=bits(5)+257,hdist=bits(5)+1,hclen=bits(4)+4;
        var order=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
        var clLens=[],k;
        for(k=0;k<19;k++) clLens[k]=0;
        for(k=0;k<hclen;k++) clLens[order[k]]=bits(3);
        var clHuff=huff(clLens),lens=[];
        while(lens.length<hlit+hdist){
          var sym=huffDecode(clHuff);
          if(sym<16) lens.push(sym);
          else if(sym===16){ var prev=lens[lens.length-1],rep=3+bits(2); for(var r=0;r<rep;r++) lens.push(prev); }
          else if(sym===17){ var rep2=3+bits(3); for(var r2=0;r2<rep2;r2++) lens.push(0); }
          else { var rep3=11+bits(7); for(var r3=0;r3<rep3;r3++) lens.push(0); }
        }
        litHuff=huff(lens.slice(0,hlit)); distHuff=huff(lens.slice(hlit));
      }else throw new Error('数据解压失败：块类型无效');
      for(;;){
        var s=huffDecode(litHuff);
        if(s===256) break;
        if(s<256){ out.push(s); continue; }
        var li=s-257,length=A99_LEN_BASE[li]+bits(A99_LEN_EXT[li]);
        var dsym=huffDecode(distHuff),dist=A99_DIST_BASE[dsym]+bits(A99_DIST_EXT[dsym]);
        if(dist>out.length) throw new Error('数据解压失败：距离越界');
        for(var m=0;m<length;m++) out.push(out[out.length-dist]);
      }
    }
  }
  return new Uint8Array(out);
}

// ---- AES via the runtime CryptoJS (bundled in CCTVHost) ----
function a99CryptoJS(){
  if(typeof CryptoJS!=='undefined'&&CryptoJS&&CryptoJS.AES&&CryptoJS.enc&&CryptoJS.mode&&CryptoJS.pad) return CryptoJS;
  try{
    var g=(typeof globalThis!=='undefined')?globalThis:null;
    if(g&&typeof g.__cctvImport==='function'){ var c=g.__cctvImport('crypto-js'); if(c&&c.AES&&c.enc) return c; }
  }catch(e){}
  throw new Error('本站需要 CryptoJS 运行环境，请更新 CCTVHost 后重试');
}
function a99WordsToBytes(wa){
  var out=[],i;
  for(i=0;i<wa.sigBytes;i++) out.push((wa.words[i>>2]>>>(24-((i%4)*8)))&0xff);
  return new Uint8Array(out);
}
function a99BytesToWords(bytes){
  var C=a99CryptoJS(),words=[];
  for(var i=0;i<bytes.length;i++){ var w=i>>2; if(words[w]===undefined) words[w]=0; words[w]|=bytes[i]<<(24-((i%4)*8)); }
  return C.lib.WordArray.create(words,bytes.length);
}
function a99AesEncrypt(keyStr,plainStr){
  var C=a99CryptoJS();
  var key=C.enc.Utf8.parse(keyStr),iv=C.lib.WordArray.random(16);
  var enc=C.AES.encrypt(C.enc.Utf8.parse(plainStr),key,{iv:iv,mode:C.mode.CBC,padding:C.pad.Pkcs7});
  var ivBytes=a99WordsToBytes(iv),ctBytes=a99WordsToBytes(enc.ciphertext);
  var all=new Uint8Array(ivBytes.length+ctBytes.length);
  all.set(ivBytes,0); all.set(ctBytes,ivBytes.length);
  return a99B64Encode(all);
}
function a99AesDecryptBytes(keyStr,b64){
  var C=a99CryptoJS();
  var raw=a99B64Decode(b64);
  if(raw.length<=16) throw new Error('本站返回了无效数据，请稍后重试');
  var key=C.enc.Utf8.parse(keyStr);
  var iv=a99BytesToWords(raw.slice(0,16)),ct=a99BytesToWords(raw.slice(16));
  var dec=C.AES.decrypt({ciphertext:ct},key,{iv:iv,mode:C.mode.CBC,padding:C.pad.Pkcs7});
  return a99WordsToBytes(dec);
}
function a99Decompress(bytes){
  // The server plaintext is zlib-wrapped deflate (Java Inflater default):
  // 2-byte header (CMF/FLG, divisible by 31), raw deflate body, Adler-32 tail.
  if(bytes.length>2&&bytes[0]===0x78&&((bytes[0]*256+bytes[1])%31)===0) return a99Inflate(bytes.slice(2));
  return a99Inflate(bytes);
}
function a99DecryptText(keyStr,b64){
  var bytes=a99AesDecryptBytes(keyStr,b64);
  try{ return a99Utf8Text(a99Decompress(bytes)); }
  catch(e){ return a99Utf8Text(bytes); }
}

// ---- session ----
var A99_UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
var A99={uuid:'',token:'',player:null,parses:null,categories:null,sessionPromise:null};
var A99Memory={};
async function a99Get(k){
  if(Object.prototype.hasOwnProperty.call(A99Memory,k)) return A99Memory[k];
  try{ var v=await CCTVStorage.get('a99.'+k); if(v){ A99Memory[k]=JSON.parse(v); return A99Memory[k]; } }catch(e){}
  return null;
}
async function a99Set(k,v){
  A99Memory[k]=v;
  try{ await CCTVStorage.set('a99.'+k,JSON.stringify(v)); }catch(e){}
}
function a99Uuid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==='x'?r:(r&0x3|0x8)).toString(16);});
}
function a99Nonce(){
  var C=a99CryptoJS();
  return C.enc.Base64.stringify(C.lib.WordArray.random(16));
}
function a99Key(){ return A99.uuid.replace(/-/g,''); }
function a99Text(s){ return String(s==null?'':s).replace(/<[^>]*>/g,'').trim(); }
function a99Page(p){ var n=Number(p||1); if(!Number.isSafeInteger(n)||n<1||n>500) throw new Error('页码无效'); return n; }
async function a99Call(path,bodyObj,tokenOverride,_retried){
  var nonce=a99Nonce(),ts=String(Date.now());
  bodyObj.timestamp=ts; bodyObj.nonce=nonce;
  var body=JSON.stringify(bodyObj);
  var enc=a99AesEncrypt(a99Key(),body);
  var token=tokenOverride!==undefined?tokenOverride:A99.token;
  var sign=a99ShaHex(enc+':'+ts+':'+nonce+':'+token);
  var headers={'User-Agent':A99_UA,Accept:'application/json','Content-Type':'application/json',
    client_type:'android',uuid:A99.uuid,timestamp:ts,sign:sign,nonce:nonce,
    version:A99Site.versionName,api_version:'v1'};
  var r,raw,text,d;
  try{
    r=await CCTVHttp.post(A99Site.host+path,enc,{headers:headers,timeout:15000});
    var status=r.statusCode||r.status;
    if(status!==200) throw new Error('本站接口暂不可用（HTTP '+status+'）');
    raw=r.data;
    if(typeof raw!=='string'||!raw) throw new Error('本站返回了无效数据，请稍后重试');
    text=a99DecryptText(a99Key(),raw);
    d=JSON.parse(text);
    if(!d||typeof d!=='object') throw new Error('本站返回了无效数据，请稍后重试');
  }catch(e){
    // A stale saved visitor token (or a rotated uuid) fails decrypt/parse:
    // drop it, fetch a fresh one, and retry the same call once.
    if(!_retried&&A99.token&&path.indexOf('/vod/')===0||!_retried&&A99.token&&path==='/app/vodParser'){
      A99.token=''; A99.sessionPromise=null;
      await a99Set('session',{uuid:A99.uuid,token:''});
      await a99EnsureSession();
      return a99Call(path,bodyObj,tokenOverride,true);
    }
    if(/本站接口暂不可用|本站返回了无效数据/.test(e.message)) throw e;
    throw new Error('本站返回了无法解密的数据，请重新进入组件');
  }
  return d;
}
async function a99EnsureSession(){
  if(A99.sessionPromise) return A99.sessionPromise;
  A99.sessionPromise=(async function(){
    var saved=await a99Get('session');
    if(saved&&saved.uuid) A99.uuid=saved.uuid;
    if(!A99.uuid){ A99.uuid=a99Uuid(); await a99Set('session',{uuid:A99.uuid,token:''}); }
    if(saved&&saved.token) A99.token=saved.token;
    var init=await a99Call('/app/systemInit',
      {v:A99Site.versionName,n:A99Site.name,s:A99Site.buildSignature,pl:'1',apiVersion:'v2',token:''},'');
    if(init.code!==0&&init.code!==undefined) throw new Error('本站初始化失败，请稍后重试');
    A99.player=init.player||{};
    A99.parses=init.parser_api||[];
    var cats=init.categorys||{};
    A99.categories=Array.isArray(cats.data)?cats.data:[];
    if(!A99.token){
      var now=Date.now();
      var info=await a99Call('/app/userInfo',
        {os:'android',name:'xiaomi',version:'15',sdkInt:32,device:'xiaomi',
         brand:'xiaomi',manufacturer:'xiaomi',product:'b0q',hardware:'xiaomi',
         isPhysicalDevice:true,androidId:'V417IR',bootloader:'unknown',
         display:'V417IR release-keys',host:'a11-gz01-test',tags:'release-keys',
         type:'user',finger:'xiaomi/b0q/b0q:15/V619IR/613:user/release-keys',
         app:{version:A99Site.versionName,name:A99Site.name,package:A99Site.package,
              buildNumber:A99Site.buildNumber,buildSignature:A99Site.buildSignature,
              install:now,update:now},
         did:a99Uuid(),apiVersion:'v2',channel:'',token:''},'');
      var ui=info.userInfo||{};
      if(ui.user_token){ A99.token=ui.user_token; await a99Set('session',{uuid:A99.uuid,token:A99.token}); }
      // An empty user_token is fine: search/detail/vodParser accept token ''.
    }
  })();
  try{ return await A99.sessionPromise; }
  finally{ A99.sessionPromise=null; }
}
async function a99SearchBody(bodyObj){
  await a99EnsureSession();
  var d=await a99Call('/vod/search',bodyObj);
  if(!d||!Array.isArray(d.data)) throw new Error('本站片单格式异常');
  return d;
}
function a99VodLink(id){ return A99Site.origin+'/__cctvhost__/'+Source.id+'/vod?id='+encodeURIComponent(String(id)); }
function a99EpisodeLink(ticket){ return A99Site.origin+'/__cctvhost__/'+Source.id+'/episode?d='+encodeURIComponent(ticket); }
function a99ParseVod(link){
  var m=String(link).match(/\/vod\?id=([^&]+)$/);
  if(!m) throw new Error('请选择本站组件内的影片');
  return decodeURIComponent(m[1]);
}
function a99ParseEpisode(link){
  var m=String(link).match(/\/episode\?d=([^&]+)$/);
  if(!m) throw new Error('请选择本站组件内的分集');
  return decodeURIComponent(m[1]);
}
function a99Card(c){
  if(!c||c.id==null||!c.name) throw new Error('本站影片数据不完整');
  var tid=String(c.tid==null?'':c.tid);
  var cover=/^https?:\/\//.test(c.pic||'')?c.pic:'';
  return {id:a99VodLink(c.id),type:'url',link:a99VodLink(c.id),title:a99Text(c.name),
    coverUrl:cover,posterPath:cover,
    mediaType:A99Site.movieTids.indexOf(tid)>=0?'movie':'tv',
    releaseDate:c.year?String(c.year):'',genreTitle:a99Text(c.class),
    description:[a99Text(c.blurb),c.year,a99Text(c.area),a99Text(c.remarks)].filter(Boolean).join(' · '),
    actor:a99Text(c.actor),director:a99Text(c.director)};
}
function a99Cards(list){
  if(!Array.isArray(list)) throw new Error('本站片单格式异常');
  var seen={};
  return list.filter(function(c){ if(!c||c.id==null||seen[c.id]) return false; seen[c.id]=true; return true; }).map(a99Card);
}
function a99ReorderLines(froms,urls){
  // Mirrors App99.processDetailResult: 4K lines first, then 蓝光， then the rest.
  var n=Math.min(froms.length,urls.length),k4=[],bl=[],rest=[];
  for(var i=0;i<n;i++){
    if(froms[i].indexOf('4K')>=0) k4.push(i);
    else if(froms[i].indexOf('蓝光')>=0) bl.push(i);
    else rest.push(i);
  }
  if(k4.length+bl.length===n) return {froms:froms,urls:urls};
  var order=k4.concat(bl,rest);
  return {froms:order.map(function(i){return froms[i];}),urls:order.map(function(i){return urls[i];})};
}
async function loadHome(params){
  await a99EnsureSession();
  // The class hardcodes pid '1' here, but pid 1 is not a category on every
  // tenant (juquan99 has no pid 1 and returns an empty home); use this
  // site's first movie category instead, same endpoint and shape.
  var d=await a99Call('/vod/search',
    {kw:'',page:'1',limit:21,pid:A99Site.defaultKind,orderBy:'time',isCategory:1,token:''},'');
  return a99Cards(d.data);
}
async function loadCatalog(params){
  params=params||{};
  var kind=String(params.kind||A99Site.defaultKind);
  if(!/^\d+$/.test(kind)) throw new Error('分类无效');
  var d=await a99SearchBody({kw:'',page:String(a99Page(params.page)),limit:21,pid:kind,orderBy:'time',isCategory:1,token:A99.token});
  return a99Cards(d.data);
}
async function search(params){
  params=params||{};
  var keyword=String(params.keyword||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
  if(!keyword) return [];
  var d=await a99SearchBody({kw:keyword,page:1,limit:21,orderBy:'vod_hits_month',sort:'desc',token:A99.token});
  return a99Cards(d.data);
}
async function loadDetail(link){
  await a99EnsureSession();
  var id=a99ParseVod(link);
  var d=await a99Call('/vod/detail',{id:id,eps:'1',v:'2.0.0',pl:1,token:A99.token});
  var data=d.data||{};
  if(String(data.id)!==String(id)) throw new Error('影片详情不匹配');
  var item=a99Card(data);
  item.link=link; item.id=link;
  item.description=(item.description?item.description+' · ':'')+a99Text(data.content);
  var froms=String(data.play_from||'').split('$$$');
  var urls=String(data.play_url||'').split('$$$');
  if(!froms.length||!froms[0]||!urls.length||!urls[0]) throw new Error('此影片暂无可用线路');
  var re=a99ReorderLines(froms,urls);
  froms=re.froms; urls=re.urls;
  item.episodeItems=[];
  for(var i=0;i<Math.min(froms.length,urls.length);i++){
    var from=froms[i],player=(A99.player||{})[from]||{};
    var lineName=a99Text(player.name||from)||from;
    var eps=String(urls[i]).split('#').filter(function(e){ return e.indexOf('$')>0; });
    if(!eps.length) continue;
    var children=eps.map(function(ep){
      var cut=ep.indexOf('$'),epName=ep.slice(0,cut),epUrl=ep.slice(cut+1);
      var digits=epName.replace(/\D+/g,'')||'1';
      var ticket=epName+'$'+epUrl+'@'+from+'@'+String(data.id)+'@'+digits;
      return {id:a99EpisodeLink(ticket),type:'url',link:a99EpisodeLink(ticket),
        title:lineName+' · '+a99Text(epName),coverUrl:item.coverUrl,mediaType:item.mediaType};
    });
    item.episodeItems.push({id:children[0].link,
      type:'url',link:children[0].link,title:lineName,coverUrl:item.coverUrl,
      mediaType:item.mediaType,childItems:children});
  }
  if(!item.episodeItems.length) throw new Error('此影片暂无可用线路');
  item.childItems=[];
  return item;
}
async function resolveResource(params){
  params=params||{};
  await a99EnsureSession();
  var link=String(params.link||params.id||'');
  var ticket=a99ParseEpisode(link);
  var parts=ticket.split('@');
  if(parts.length<4) throw new Error('请选择本站组件内的分集');
  var epStr=parts[0],from=parts[1];
  var cut=epStr.indexOf('$');
  var epUrl=cut>=0?epStr.slice(cut+1):epStr;
  var epName=cut>=0?epStr.slice(0,cut):'正片';
  var player=(A99.player||{})[from];
  if(!player) throw new Error('此线路暂不可用，请更换其他线路');
  var lineName=a99Text(player.name||from)||from;
  if(player.type===0){
    if(!/^https?:\/\//.test(epUrl)) throw new Error('此分集暂无可用线路');
    return [{name:lineName,url:epUrl,playerType:'app',customHeaders:{},description:'直连线路'}];
  }
  var ids=String(player.parseUrl||'').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  var out=[];
  for(var i=0;i<ids.length;i++){
    var pid=null;
    (A99.parses||[]).forEach(function(p){ if(p&&String(p.id)===ids[i]) pid=p.id; });
    if(pid==null) continue;
    var r=await a99Call('/app/vodParser',{id:pid,url:epUrl,token:A99.token});
    var url=r.data||'';
    if(typeof url==='string'&&/^https?:\/\//.test(url)){
      out.push({name:lineName,url:url,playerType:'app',customHeaders:{},description:'官方线路解析'});
    }
  }
  if(!out.length) throw new Error('播放链接解析失败,请更换其他源播放');
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
