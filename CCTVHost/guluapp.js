// Standalone 咕噜 adapter (native app API: ECDH handshake + AES-GCM protobuf).
// Protocol reconstructed from the TVBoxOSC spider.jar DEX bytecode
// (Gulu / Gulu$GuluCrypto / Gulu$PbUtil) and verified live from the build
// machine on 2026-11-13: handshake -> boot -> homeVideo/category/search/detail
// all return real data against http://103.45.132.22:19987/app/bn/v2.
// Notes:
//  - The sandbox has no WebCrypto / CompressionStream, only CryptoJS
//    (AES-CBC/ECB, HmacSHA256). ECDH P-256, AES-GCM and raw DEFLATE are
//    implemented here in pure JS (BigInt). Random bytes prefer
//    crypto.getRandomValues when present, else Math.random.
//  - Playback goes through third-party parse APIs whose keys are issued by
//    the boot response (and fall back to the static table below); the server
//    can rotate them, so a working parse line today may stop working later.
//  - Upstream detail drops direct-http episodes whose URL matches no known
//    parse prefix; this adapter keeps direct .m3u8 episodes (they play via
//    the direct path) and drops only platform web-page links.
var Source={id:'guluapp',name:'咕噜',origin:'http://103.45.132.22:19987/app/bn/v2',version:'0.1.0'};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:'咕噜',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'咕噜原生接口：分类片库、搜索、完整分集与播放地址（ECDH 握手 + AES-GCM protobuf）。播放经第三方解析接口，密钥由服务端下发。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'kind',title:'分类',type:'enumeration',value:'tv',enumOptions:[{"title":"电影","value":"movie"},{"title":"电视剧","value":"tv"},{"title":"综艺","value":"variety"},{"title":"动漫","value":"anime"},{"title":"短剧","value":"short"},{"title":"纪录片","value":"doc"},{"title":"大陆剧","value":"cn"},{"title":"港剧","value":"hk"},{"title":"台剧","value":"tw"},{"title":"美剧","value":"us"},{"title":"韩剧","value":"kr"},{"title":"日剧","value":"jp"}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'例如：仙逆'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'咕噜搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var SjKinds=[['movie','电影'],['tv','电视剧'],['variety','综艺'],['anime','动漫'],['short','短剧'],['doc','纪录片'],['cn','大陆剧'],['hk','港剧'],['tw','台剧'],['us','美剧'],['kr','韩剧'],['jp','日剧']];
var GU={
  host:'http://103.45.132.22:19987/app/bn/v2',
  ua:'Dalvik/2.1.0 (Linux; U; Android 11; Pixel 4)',
  appName:'咕噜咕噜',pkg:'com.jymqfh.xee',version:'2.1.2',vcode:'212',
  platform:'APP_PLATFORM_ANDROID_TV'
};
var GU_TYPE_MAP={movie:8,tv:9,variety:10,anime:11,short:12,doc:6,cn:34,hk:41,tw:42,us:35,kr:36,jp:38,th:39,uk:37,ru:45};
var GU_LINE_MAP={dyttm3u8:'电影天堂',bfzym3u8:'暴风资源',lzm3u8:'量子资源',ffm3u8:'非凡资源',qq:'腾讯视频',qiyi:'爱奇艺',youku:'优酷',newxfyun:'咕噜4K',xfyun:'咕噜4K二线',CO4K:'咖啡4K超清',jplink:'金牌极速',rose:'玫瑰4K',NBY:'蚂蚁资源',qsvip:'旋风VIP',qingshan:'青山资源'};
var GU_PREFIX_MAP={'CO4K_':'咖啡4K','rose_':'咖啡4K','NBY-':'蚂蚁','qsvip-':'熊出没','qingshan-':'熊出没','JP-':'旋风金牌','xfy-':'新咕噜4K'};
var GU_STATIC_TEMPLATES={'咖啡4K':'https://co4k.1ljx.com:32010/api/?key=6db7285d-c228-4cee-918e-67a01ef7c3f8&url=','rose_':'https://api.nbyjson.top:7788/api/?key=8LJohkjTZHC2F9ct48&url=','蚂蚁':'https://jf.hxx2023.cc/api?key=Uw5rZokFSAywqcLN&url=','熊出没':'http://111.170.58.215:4470/api.php?id=','旋风金牌':'http://172.247.189.48:7788/dsxt/api.php?user=xt&key=969632c8da19b3ef8c56e5b51011d5e0&j=19227eae77225a30&url=','咕噜4K':'http://172.247.189.48:7788/dsxt/api.php?user=xt&key=e1234a9df0358c6d78f20721a1b7b055&j=b8582063bca37121&url='};
var GUState={deviceId:'',sessionId:'',sessionKey:null,config:{},booted:false,sessionPromise:null};

// ---- byte helpers (no runtime dependency) ----
var GU_B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function guB64Encode(bytes){
  var out='',i;
  for(i=0;i<bytes.length;i+=3){
    var b0=bytes[i],b1=i+1<bytes.length?bytes[i+1]:0,b2=i+2<bytes.length?bytes[i+2]:0;
    out+=GU_B64[b0>>2]+GU_B64[((b0&3)<<4)|(b1>>4)]+((i+1<bytes.length)?GU_B64[((b1&15)<<2)|(b2>>6)]:'=')+((i+2<bytes.length)?GU_B64[b2&63]:'=');
  }
  return out;
}
function guB64Decode(str){
  var clean=String(str||'').replace(/[^A-Za-z0-9+/=]/g,'');
  var rev={},i;
  for(i=0;i<64;i++) rev[GU_B64[i]]=i;
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
function guUtf8Bytes(s){
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
function guUtf8Text(bytes){
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
function guConcat(){
  var total=0,i,off=0;
  for(i=0;i<arguments.length;i++) total+=arguments[i].length;
  var out=new Uint8Array(total);
  for(i=0;i<arguments.length;i++){ out.set(arguments[i],off); off+=arguments[i].length; }
  return out;
}
function guBytesEqual(a,b){
  if(!a||!b||a.length!==b.length) return false;
  for(var i=0;i<a.length;i++) if(a[i]!==b[i]) return false;
  return true;
}
function guSleep(ms){ return new Promise(function(res){ setTimeout(res,ms); }); }

// ---- protobuf (wire format; full multi-byte varint tags) ----
function guVarint(n){
  var out=[];
  n=Math.floor(n);
  while(true){ var x=n%128; n=Math.floor(n/128); if(n>0){ out.push(x|0x80); } else { out.push(x); break; } }
  return new Uint8Array(out);
}
function guField(num,wire,payload){
  var tag=guVarint((num<<3)|wire);
  if(wire===2){ return guConcat(tag,guVarint(payload.length),payload); }
  return guConcat(tag,guVarint(payload));
}
function guReadVarint(buf,pos){
  var v=0,sh=0;
  while(pos.i<buf.length){
    var x=buf[pos.i++]; v+=(x&0x7f)*Math.pow(2,sh); sh+=7;
    if(!(x&0x80)) break;
    if(sh>63) break;
  }
  return v;
}
function guParse(buf){
  var out=[],i=0,n=buf.length;
  while(i<n){
    var p={i:i},tag=guReadVarint(buf,p); i=p.i;
    if(tag===0) break;
    var fn=Math.floor(tag/8),wt=tag%8;
    if(wt===0){ var q={i:i},v=guReadVarint(buf,q); i=q.i; out.push({num:fn,wire:wt,value:v}); }
    else if(wt===2){ var r={i:i},ln=guReadVarint(buf,r); i=r.i; if(ln<0||i+ln>n) break; out.push({num:fn,wire:wt,value:buf.slice(i,i+ln)}); i+=ln; }
    else if(wt===5){ if(i+4>n) break; out.push({num:fn,wire:wt,value:buf.slice(i,i+4)}); i+=4; }
    else if(wt===1){ if(i+8>n) break; out.push({num:fn,wire:wt,value:buf.slice(i,i+8)}); i+=8; }
    else break;
  }
  return out;
}
function guPick(fields,num,wire,def){
  for(var i=0;i<fields.length;i++){ if(fields[i].num===num&&fields[i].wire===wire) return fields[i].value; }
  return def;
}

// ---- random ----
function guRandomBytes(n){
  var out=new Uint8Array(n),i;
  try{
    var c=(typeof crypto!=='undefined')?crypto:null;
    if(c&&c.getRandomValues){ c.getRandomValues(out); return out; }
  }catch(e){}
  for(i=0;i<n;i++) out[i]=Math.floor(Math.random()*256);
  return out;
}
function guRandomHex(n){
  var b=guRandomBytes(Math.floor(n/2)),hex='0123456789abcdef',s='';
  for(var i=0;i<b.length;i++) s+=hex[b[i]>>4]+hex[b[i]&15];
  return s;
}
function guDeviceId(){
  if(!GUState.deviceId) GUState.deviceId=guRandomHex(32);
  return GUState.deviceId;
}

// ---- CryptoJS (bundled in CCTVHost) ----
function guCryptoJS(){
  if(typeof CryptoJS!=='undefined'&&CryptoJS&&CryptoJS.AES&&CryptoJS.enc&&CryptoJS.mode&&CryptoJS.pad) return CryptoJS;
  try{
    var g=(typeof globalThis!=='undefined')?globalThis:null;
    if(g&&typeof g.__cctvImport==='function'){ var c=g.__cctvImport('crypto-js'); if(c&&c.AES&&c.enc) return c; }
  }catch(e){}
  throw new Error('本站需要 CryptoJS 运行环境，请更新 CCTVHost 后重试');
}
function guWordArray(bytes){
  var C=guCryptoJS();
  var words=[];
  for(var i=0;i<bytes.length;i++){ var w=i>>2; if(words[w]===undefined) words[w]=0; words[w]|=bytes[i]<<(24-((i%4)*8)); }
  return C.lib.WordArray.create(words,bytes.length);
}
function guBytesFromWordArray(wa){
  var out=[],i;
  for(i=0;i<wa.sigBytes;i++){ out.push((wa.words[i>>2]>>>(24-((i%4)*8)))&0xff); }
  return new Uint8Array(out);
}
function guAesCbcCrypt(keyBytes,ivBytes,dataBytes,encrypt){
  var C=guCryptoJS();
  var key=guWordArray(keyBytes),iv=guWordArray(ivBytes);
  if(encrypt){
    var enc=C.AES.encrypt(guWordArray(dataBytes),key,{iv:iv,mode:C.mode.CBC,padding:C.pad.Pkcs7});
    return guBytesFromWordArray(enc.ciphertext);
  }
  var dec=C.AES.decrypt({ciphertext:guWordArray(dataBytes)},key,{iv:iv,mode:C.mode.CBC,padding:C.pad.Pkcs7});
  return guBytesFromWordArray(dec);
}
function guAesEcbBlock(keyBytes,blockBytes){
  var C=guCryptoJS();
  var enc=C.AES.encrypt(guWordArray(blockBytes),guWordArray(keyBytes),{mode:C.mode.ECB,padding:C.pad.NoPadding});
  return guBytesFromWordArray(enc.ciphertext);
}
function guHmacSha256(keyBytes,msgBytes){
  var C=guCryptoJS();
  var mac=C.HmacSHA256(guWordArray(msgBytes),guWordArray(keyBytes));
  return guBytesFromWordArray(mac);
}

// ---- BigInt helpers ----
function guBigIntFromBytes(bytes){
  var hex='',i;
  for(i=0;i<bytes.length;i++){ var h=bytes[i].toString(16); hex+=h.length===1?'0'+h:h; }
  return BigInt('0x'+(hex||'0'));
}
function guBytesFromBigInt(v,bytes){
  var hex=v.toString(16);
  while(hex.length<bytes*2) hex='0'+hex;
  if(hex.length>bytes*2) hex=hex.slice(hex.length-bytes*2);
  var out=new Uint8Array(bytes);
  for(var i=0;i<bytes;i++) out[i]=parseInt(hex.slice(i*2,i*2+2),16);
  return out;
}
function guPad32(b){
  var out=new Uint8Array(32);
  if(b.length>=32) out.set(b.slice(b.length-32),0);
  else out.set(b,32-b.length);
  return out;
}

// ---- ECDH P-256 (secp256r1), pure BigInt ----
var GU_P=BigInt('0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF');
var GU_A=GU_P-BigInt(3);
var GU_B=BigInt('0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B');
var GU_N=BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551');
var GU_GX=BigInt('0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296');
var GU_GY=BigInt('0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5');
function guMod(a,m){ var r=a%m; return r<BigInt(0)?r+m:r; }
function guModInv(a,m){
  var lm=BigInt(1),hm=BigInt(0),low=guMod(a,m),high=m;
  while(low>BigInt(1)){
    var r=high/low,nm=hm-lm*r,nw=high-low*r;
    hm=lm; lm=nm; high=low; low=nw;
  }
  return guMod(lm,m);
}
function guEcAdd(P,Q){
  if(!P) return Q;
  if(!Q) return P;
  var lam;
  if(P[0]===Q[0]){
    if(guMod(P[1]+Q[1],GU_P)===BigInt(0)) return null;
    lam=guMod((BigInt(3)*P[0]*P[0]+GU_A)*guModInv(BigInt(2)*P[1],GU_P),GU_P);
  }else{
    lam=guMod((Q[1]-P[1])*guModInv(Q[0]-P[0],GU_P),GU_P);
  }
  var x3=guMod(lam*lam-P[0]-Q[0],GU_P);
  var y3=guMod(lam*(P[0]-x3)-P[1],GU_P);
  return [x3,y3];
}
function guEcMul(k,P){
  var R=null,Q=P;
  while(k>BigInt(0)){
    if(k&BigInt(1)) R=guEcAdd(R,Q);
    Q=guEcAdd(Q,Q);
    k>>=BigInt(1);
  }
  return R;
}
function guEcGenKey(){
  var bytes=guRandomBytes(32);
  var k=guMod(guBigIntFromBytes(bytes),GU_N-BigInt(1))+BigInt(1);
  var pub=guEcMul(k,[GU_GX,GU_GY]);
  return {priv:k,pub:pub};
}
function guEcPubBytes(P){
  var out=new Uint8Array(65);
  out[0]=4;
  out.set(guBytesFromBigInt(P[0],32),1);
  out.set(guBytesFromBigInt(P[1],32),33);
  return out;
}
function guEcPointFromBytes(b){
  if(!b||b.length!==65||b[0]!==4) throw new Error('EC 公钥格式异常');
  var x=guBigIntFromBytes(b.slice(1,33)),y=guBigIntFromBytes(b.slice(33,65));
  if(guMod(y*y,GU_P)!==guMod(x*x*x+GU_A*x+GU_B,GU_P)) throw new Error('EC 公钥不在曲线上');
  return [x,y];
}

// ---- AES-GCM (CryptoJS AES-ECB + BigInt GHASH) ----
var GU_GHASH_R=BigInt('0xE1000000000000000000000000000000');
var GU_GHASH_MASK=BigInt('0x80000000000000000000000000000000');
function guGfMul(x,y){
  var z=BigInt(0),v=y,mask=GU_GHASH_MASK;
  for(var i=0;i<128;i++){
    if((x&mask)!==BigInt(0)) z^=v;
    if((v&BigInt(1))!==BigInt(0)) v=(v>>BigInt(1))^GU_GHASH_R;
    else v=v>>BigInt(1);
    mask>>=BigInt(1);
  }
  return z;
}
function guGhash(h,data){
  var y=BigInt(0);
  for(var off=0;off<data.length;off+=16){
    var block=data.slice(off,off+16);
    var padded=new Uint8Array(16);
    padded.set(block,0);
    y=guGfMul(y^guBigIntFromBytes(padded),h);
  }
  return y;
}
function guLenBlock(aadBits,ctBits){
  var out=new Uint8Array(16);
  var a=aadBits,c=ctBits;
  for(var i=7;i>=0;i--){ out[i]=a%256; a=Math.floor(a/256); }
  for(var j=15;j>=8;j--){ out[j]=c%256; c=Math.floor(c/256); }
  return out;
}
function guInc32(block){
  var out=new Uint8Array(block);
  var v=((out[12]<<24)|(out[13]<<16)|(out[14]<<8)|out[15])>>>0;
  v=(v+1)>>>0;
  out[12]=(v>>>24)&0xFF; out[13]=(v>>>16)&0xFF; out[14]=(v>>>8)&0xFF; out[15]=v&0xFF;
  return out;
}
function guGcmCrypt(keyBytes,j0,data){
  var counter=guInc32(j0);
  var out=new Uint8Array(data.length);
  for(var off=0;off<data.length;off+=16){
    var ks=guAesEcbBlock(keyBytes,counter);
    var n=Math.min(16,data.length-off);
    for(var i=0;i<n;i++) out[off+i]=data[off+i]^ks[i];
    counter=guInc32(counter);
  }
  return out;
}
function guGcmPad16(data){ var r=new Uint8Array(Math.ceil(data.length/16)*16); r.set(data,0); return r; }
function guAesGcmEncrypt(keyBytes,iv12,plainBytes){
  var h=guBigIntFromBytes(guAesEcbBlock(keyBytes,new Uint8Array(16)));
  var j0=new Uint8Array(16);
  j0.set(iv12,0); j0[15]=1;
  var ct=guGcmCrypt(keyBytes,j0,plainBytes);
  // GHASH input is ct zero-padded to a 16-byte boundary, then the length
  // block as its own block; concatenating raw ct would let the length block
  // bleed into the final partial ct block.
  var s=guGhash(h,guConcat(guGcmPad16(ct),guLenBlock(0,plainBytes.length*8)));
  var t=guBytesFromBigInt(s^guBigIntFromBytes(guAesEcbBlock(keyBytes,j0)),16);
  return guConcat(ct,t);
}
function guAesGcmDecrypt(keyBytes,iv12,data){
  if(!data||data.length<16) throw new Error('GCM 数据过短');
  var ct=data.slice(0,data.length-16),tag=data.slice(data.length-16);
  var h=guBigIntFromBytes(guAesEcbBlock(keyBytes,new Uint8Array(16)));
  var j0=new Uint8Array(16);
  j0.set(iv12,0); j0[15]=1;
  var s=guGhash(h,guConcat(guGcmPad16(ct),guLenBlock(0,ct.length*8)));
  var expect=guBytesFromBigInt(s^guBigIntFromBytes(guAesEcbBlock(keyBytes,j0)),16);
  if(!guBytesEqual(expect,tag)) throw new Error('GCM 校验失败，会话可能已失效');
  return guGcmCrypt(keyBytes,j0,ct);
}

// ---- DEFLATE (raw inflate; stored-block deflate for requests) ----
function guAdler32(data){
  var a=1,b=0;
  for(var i=0;i<data.length;i++){ a=(a+data[i])%65521; b=(b+a)%65521; }
  return ((b<<16)|a)>>>0;
}
function guDeflateStored(data){
  var out=[],pos=0;
  if(data.length===0) return new Uint8Array([1,0,0,255,255]);
  while(pos<data.length){
    var chunk=Math.min(65535,data.length-pos);
    var last=(pos+chunk>=data.length)?1:0;
    out.push(last,chunk&0xFF,(chunk>>8)&0xFF,(~chunk)&0xFF,((~chunk)>>8)&0xFF);
    for(var i=0;i<chunk;i++) out.push(data[pos+i]);
    pos+=chunk;
  }
  return new Uint8Array(out);
}
function guZlibWrap(deflated,original){
  var ad=guAdler32(original);
  var out=new Uint8Array(deflated.length+6);
  out[0]=0x78; out[1]=0x9C;
  out.set(deflated,2);
  var o=2+deflated.length;
  out[o]=(ad>>>24)&0xFF; out[o+1]=(ad>>>16)&0xFF; out[o+2]=(ad>>>8)&0xFF; out[o+3]=ad&0xFF;
  return out;
}
function guZlibInflate(data){
  if(!data||data.length<2) throw new Error('inflate: zlib 流过短');
  return guInflateRaw(data.slice(2));
}
function guInflateRaw(data){
  var pos=0;
  function bit(){
    var b=data[pos>>3]||0;
    var v=(b>>(pos&7))&1;
    pos++;
    return v;
  }
  function bits(n){
    var v=0;
    for(var i=0;i<n;i++) v|=bit()<<i;
    return v;
  }
  function huff(lengths){
    var max=0,i;
    for(i=0;i<lengths.length;i++) if(lengths[i]>max) max=lengths[i];
    if(max===0) return function(){ throw new Error('inflate: 空 Huffman 表'); };
    var blCount=[],nextCode=[];
    for(i=0;i<=max;i++) blCount[i]=0;
    for(i=0;i<lengths.length;i++) if(lengths[i]>0) blCount[lengths[i]]++;
    var code=0;
    for(i=1;i<=max;i++){ code=(code+blCount[i-1])<<1; nextCode[i]=code; }
    var map={};
    for(i=0;i<lengths.length;i++){
      var len=lengths[i];
      if(len!==0){ map[len+':'+nextCode[len]]=i; nextCode[len]++; }
    }
    return function(){
      var c=0,l=0;
      while(true){
        c=(c<<1)|bit(); l++;
        var s=map[l+':'+c];
        if(s!==undefined) return s;
        if(l>15) throw new Error('inflate: 无效 Huffman 码');
      }
    };
  }
  var LEN_BASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var LEN_EXT=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var DIST_BASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  var DIST_EXT=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  var CLEN_ORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  var out=[];
  while(true){
    var bfinal=bits(1),btype=bits(2);
    if(btype===0){
      pos=((pos+7)>>3)<<3;
      var bytePos=pos>>3;
      var len=(data[bytePos]||0)|((data[bytePos+1]||0)<<8);
      for(var k=0;k<len;k++) out.push(data[bytePos+4+k]||0);
      pos=(bytePos+4+len)<<3;
    }else{
      var litDec,distDec;
      if(btype===1){
        var litLen=[],distLen=[],i2;
        for(i2=0;i2<288;i2++) litLen.push(i2<144?8:(i2<256?9:(i2<280?7:8)));
        for(i2=0;i2<30;i2++) distLen.push(5);
        litDec=huff(litLen); distDec=huff(distLen);
      }else if(btype===2){
        var hlit=bits(5)+257,hdist=bits(5)+1,hclen=bits(4)+4;
        var clen=new Array(19);
        for(var c=0;c<19;c++) clen[c]=0;
        for(c=0;c<hclen;c++) clen[CLEN_ORDER[c]]=bits(3);
        var clenDec=huff(clen);
        var total=hlit+hdist;
        var lens=[];
        while(lens.length<total){
          var sym=clenDec();
          if(sym<16){ lens.push(sym); }
          else if(sym===16){
            var prev=lens.length?lens[lens.length-1]:0;
            var rep=bits(2)+3;
            for(var r=0;r<rep;r++) lens.push(prev);
          }else if(sym===17){
            var rep17=bits(3)+3;
            for(var r17=0;r17<rep17;r17++) lens.push(0);
          }else if(sym===18){
            var rep18=bits(7)+11;
            for(var r18=0;r18<rep18;r18++) lens.push(0);
          }else throw new Error('inflate: 无效长度码');
        }
        litDec=huff(lens.slice(0,hlit));
        distDec=huff(lens.slice(hlit));
      }else{
        throw new Error('inflate: 无效块类型');
      }
      while(true){
        var sym2=litDec();
        if(sym2===256) break;
        if(sym2<256){ out.push(sym2); continue; }
        if(sym2>285) throw new Error('inflate: 无效字面量/长度码');
        var li=sym2-257;
        var length=LEN_BASE[li]+bits(LEN_EXT[li]);
        var dsym=distDec();
        if(dsym>29) throw new Error('inflate: 无效距离码');
        var dist=DIST_BASE[dsym]+bits(DIST_EXT[dsym]);
        if(dist>out.length) throw new Error('inflate: 距离超出输出');
        for(var m=0;m<length;m++) out.push(out[out.length-dist]);
      }
    }
    if(bfinal) break;
  }
  return new Uint8Array(out);
}

// ---- Gulu session: ECDH handshake -> boot -> AES-GCM callApi ----
async function guHandshake(){
  var kp=guEcGenKey();
  var pub=guEcPubBytes(kp.pub);
  var inner=guConcat(guField(1,0,1),guField(2,0,1),guField(3,0,1));
  var outer=guConcat(guField(1,2,pub),guField(2,2,guUtf8Bytes('1.0.0')),guField(3,2,inner));
  var hsKey=guRandomHex(32);
  var iv=guRandomBytes(16);
  var plain=guZlibWrap(guDeflateStored(outer),outer);
  var ct=guAesCbcCrypt(guUtf8Bytes(hsKey),iv,plain,true);
  var body=guB64Encode(guConcat(iv,ct));
  var r=await CCTVHttp.post(GU.host,body,{headers:{'Content-Type':'application/x-protobuf','User-Agent':GU.ua,'X-Player-Page-Protection':'1','X-Handshake-Key':hsKey},buffer:1,timeout:15000});
  if(r.statusCode<200||r.statusCode>=300) throw new Error('咕噜握手失败（HTTP '+r.statusCode+'）');
  var respB64=String(r.bodyBase64||'').replace(/\s+/g,'');
  if(!respB64) throw new Error('咕噜握手无响应');
  // The HTTP body itself is a base64 text string; buffer:1 wraps the raw
  // body bytes in base64 once more, so decode twice to reach IV||ciphertext.
  var raw=guB64Decode(guUtf8Text(guB64Decode(respB64)));
  if(raw.length<=16) throw new Error('咕噜握手响应异常');
  var dec=guAesCbcCrypt(guUtf8Bytes(hsKey),raw.slice(0,16),raw.slice(16),false);
  var inflated=guZlibInflate(dec);
  var fields=guParse(inflated);
  var sessionId=guUtf8Text(guPick(fields,1,2,new Uint8Array(0)));
  var serverPub=guPick(fields,2,2,null);
  if(!sessionId||!serverPub||serverPub.length!==65) throw new Error('咕噜握手响应缺少会话信息');
  var pt=guEcPointFromBytes(serverPub);
  var shared=guEcMul(kp.priv,pt);
  if(!shared) throw new Error('咕噜 ECDH 失败');
  var shared32=guPad32(guBytesFromBigInt(shared[0],32));
  var k1=guHmacSha256(guUtf8Bytes(sessionId),shared32);
  var sessKey=guHmacSha256(k1,guUtf8Bytes('v2-session\x01'));
  GUState.sessionId=sessionId;
  GUState.sessionKey=sessKey;
  GUState.booted=false;
  return true;
}
async function guBoot(){
  var deviceId=guDeviceId();
  var appMsg=guConcat(guField(1,2,guUtf8Bytes(GU.appName)),guField(2,2,guUtf8Bytes(GU.version)),guField(3,2,guUtf8Bytes(GU.pkg)),guField(4,2,guUtf8Bytes(deviceId)),guField(5,2,guUtf8Bytes(GU.vcode)));
  var devMsg=guConcat(guField(1,2,guUtf8Bytes(deviceId)),guField(2,0,0),guField(3,2,guUtf8Bytes('11')),guField(4,2,guUtf8Bytes('Pixel 4')),guField(5,2,guUtf8Bytes('google/redfin/redfin:11/RQ3A.211001.001')),guField(6,2,guUtf8Bytes('google')),guField(7,2,guUtf8Bytes('redfin')),guField(8,0,0),guField(9,2,guUtf8Bytes('unknown')),guField(10,2,guUtf8Bytes('unknown')),guField(11,0,0),guField(12,0,30));
  var platMsg=guConcat(guField(1,2,guUtf8Bytes('v1')),guField(2,2,guUtf8Bytes('Android 11')),guField(3,2,guUtf8Bytes('gulu')),guField(4,2,appMsg),guField(5,2,devMsg));
  var data=await guCallApi(1,0,platMsg);
  var cfg={};
  if(data){
    guParse(data).forEach(function(f){
      if(f.num===7&&f.wire===2){
        var inner=guParse(f.value),k='',v='';
        inner.forEach(function(g){
          if(g.num===2&&g.wire===2) k=guUtf8Text(g.value);
          if(g.num===3&&g.wire===2) v=guUtf8Text(g.value);
        });
        if(k) cfg[k]=v;
      }
    });
  }
  GUState.config=cfg;
  return cfg;
}
async function guEnsureSession(){
  if(GUState.sessionKey){
    if(!GUState.booted){ try{ await guBoot(); }catch(e){} GUState.booted=true; }
    return;
  }
  if(GUState.sessionPromise) return GUState.sessionPromise;
  GUState.sessionPromise=(async function(){
    await guHandshake();
    try{ await guBoot(); }catch(e){}
    GUState.booted=true;
  })();
  try{ return await GUState.sessionPromise; }finally{ GUState.sessionPromise=null; }
}
async function guCallApi(a,b,payload){
  if(!GUState.sessionKey) throw new Error('咕噜会话未建立');
  var now=Date.now();
  var inner=guConcat(
    guField(1,0,now),guField(2,0,a),guField(3,0,b),
    guField(4,2,guUtf8Bytes(guDeviceId())),
    guField(5,2,new Uint8Array(0)),
    guField(6,2,payload),
    guField(7,0,now));
  var rawDef=guDeflateStored(inner);
  var iv12=guRandomBytes(12);
  var enc=guAesGcmEncrypt(GUState.sessionKey,iv12,rawDef);
  var outer=guConcat(guField(1,0,now),guField(2,2,guConcat(iv12,enc)));
  var r=await CCTVHttp.post(GU.host,outer,{headers:{'Content-Type':'application/x-protobuf','User-Agent':GU.ua,'X-Player-Page-Protection':'1','X-Session-Id':GUState.sessionId},buffer:1,timeout:15000});
  if(r.statusCode<200||r.statusCode>=300) throw new Error('咕噜接口暂不可用（HTTP '+r.statusCode+'）');
  if(!r.bodyBase64) throw new Error('咕噜接口未返回数据');
  var resp=guB64Decode(String(r.bodyBase64).replace(/\s+/g,''));
  var fields=guParse(resp);
  var blob=guPick(fields,2,2,null);
  if(!blob||blob.length<28) throw new Error('咕噜接口响应异常');
  var plain=guAesGcmDecrypt(GUState.sessionKey,blob.slice(0,12),blob.slice(12));
  var inflated=guInflateRaw(plain);
  var innerF=guParse(inflated);
  var code=guPick(innerF,2,0,null);
  if(typeof code==='number'&&code>=400){
    var msg=guUtf8Text(guPick(innerF,3,2,new Uint8Array(0)));
    throw new Error('咕噜接口返回 '+code+(msg?('：'+msg):''));
  }
  var payloadOut=guPick(innerF,4,2,null);
  if(!payloadOut) return null;
  return payloadOut;
}

// ---- list / detail / search parsing ----
function guParseRecord(bytes){
  var item={vod_id:'',vod_name:'',vod_pic:'',vod_remarks:'',vod_year:''};
  guParse(bytes).forEach(function(f){
    if(f.num===1&&f.wire===0) item.vod_id=String(f.value);
    else if(f.num===2&&f.wire===0) item.vod_year=String(f.value);
    else if(f.num===3&&f.wire===2) item.vod_name=guUtf8Text(f.value);
    else if(f.num===6&&f.wire===2) item.vod_pic=guUtf8Text(f.value);
    else if(f.num===9&&f.wire===2&&!item.vod_remarks) item.vod_remarks=guUtf8Text(f.value);
    else if(f.num===11&&f.wire===2) item.vod_remarks=guUtf8Text(f.value);
  });
  if(!item.vod_id||!item.vod_name) return null;
  return item;
}
function guParseItems(data,limit){
  var out=[];
  if(!data) return out;
  guParse(data).forEach(function(f){
    if(f.wire!==2||!f.value||f.value.length<30) return;
    var nested=guParse(f.value),found=false,i,g;
    for(i=0;i<nested.length;i++){
      g=nested[i];
      if(g.num===66&&g.wire===2){
        var it=guParseRecord(g.value);
        if(it) out.push(it);
        found=true;
      }
    }
    if(found) return;
    var hasVar2=false;
    for(i=0;i<nested.length;i++){ if(nested[i].num===2&&nested[i].wire===0){ hasVar2=true; break; } }
    if(hasVar2){
      var it2=guParseRecord(f.value);
      if(it2) out.push(it2);
      return;
    }
    for(i=0;i<nested.length;i++){
      g=nested[i];
      if(g.num===3&&g.wire===2&&g.value.length>30){
        var it3=guParseRecord(g.value);
        if(it3) out.push(it3);
      }
    }
  });
  if(out.length>limit) out=out.slice(0,limit);
  return out;
}
async function guList(kind,page,year,sort){
  await guEnsureSession();
  var typeId=GU_TYPE_MAP[kind]||9;
  var parts=[guField(1,0,typeId),guField(2,0,page)];
  if(year) parts.push(guField(3,2,guUtf8Bytes(year)));
  if(sort){
    var nested=guConcat(guField(1,0,1),guField(2,0,0),guField(3,2,guUtf8Bytes(sort)));
    parts.push(guField(5,2,nested));
  }
  var data=await guCallApi(3,66,guConcat.apply(null,parts));
  return guParseItems(data,100);
}
async function guSearch(keyword,page){
  await guEnsureSession();
  var nested=guConcat(guField(1,0,1),guField(2,0,0),guField(3,2,guUtf8Bytes('vod_hits_week')));
  var payload=guConcat(guField(1,2,guUtf8Bytes(keyword)),guField(2,0,page),guField(5,2,nested));
  var data=null,delay=600;
  for(var i=0;i<3;i++){
    var d=await guCallApi(3,61,payload);
    if(d&&d.length>200){ data=d; break; }
    if(i<2){ await guSleep(delay); delay*=2; }
  }
  if(!data) return [];
  return guParseItems(data,100);
}
async function guDetail(vodId){
  await guEnsureSession();
  var payload=guConcat(guField(1,0,Number(vodId)),guField(4,2,guUtf8Bytes(GU.platform)),guField(5,0,0));
  var data=await guCallApi(3,62,payload);
  if(!data||!data.length) return null;
  var d={name:'',pic:'',area:'',actor:'',director:'',content:'',remarks:'',groups:[]};
  var actors=[],directors=[],areas=[];
  guParse(data).forEach(function(f){
    if(f.wire!==2) return;
    var s=guUtf8Text(f.value);
    if(f.num===5) d.name=s;
    else if(f.num===13) d.pic=s;
    else if(f.num===17) actors.push(s);
    else if(f.num===18) directors.push(s);
    else if(f.num===12) areas.push(s);
    else if(f.num===21) d.content=s;
    else if(f.num===22) d.remarks=s;
    else if(f.num===28&&!d.remarks) d.remarks=s;
    else if((f.num===6||f.num===7)&&!d.content) d.content=s;
    else if(f.num===75){
      var line='',eps=[];
      guParse(f.value).forEach(function(gf){
        if(gf.num===1&&gf.wire===2) line=guUtf8Text(gf.value);
        else if(gf.num===2&&gf.wire===2){
          var num='',url='',title='';
          guParse(gf.value).forEach(function(ef){
            if(ef.num===1&&ef.wire===0) num=String(ef.value);
            else if(ef.num===3&&ef.wire===2) url=guUtf8Text(ef.value);
            else if(ef.num===4&&ef.wire===2) title=guUtf8Text(ef.value);
          });
          if(!title) title='第'+(num||'')+'集';
          if(url) eps.push({num:num,url:url,title:title});
        }
      });
      if(line&&eps.length) d.groups.push({line:line,episodes:eps});
    }
  });
  d.actor=actors.slice(0,12).join('、');
  d.director=directors.slice(0,12).join('、');
  d.area=areas.slice(0,4).join('/');
  return d;
}

// ---- playback ----
function guQualityRewrite(url){
  if(!url) return url;
  if(url.indexOf('.m3u8')<0) return url;
  return url.replace(/\/\d{3,4}k[bB]?\//g,'/2000k/').replace(/index_\d+k/g,'index_2000k').replace(/\/720[pP]\//g,'/1080p/');
}
function guLineDisplay(name){ return GU_LINE_MAP[name]||name; }
function guPrefixOf(token){
  for(var k in GU_PREFIX_MAP){ if(token.indexOf(k)===0) return k; }
  return null;
}
function guParseTemplate(lineName){
  if(GUState.config&&GUState.config[lineName]) return GUState.config[lineName];
  if(GU_STATIC_TEMPLATES[lineName]) return GU_STATIC_TEMPLATES[lineName];
  return null;
}
function guEncodeParseId(id){
  var s=String(id);
  return encodeURIComponent(s).replace(/%20/g,'+').replace(/%3A/g,':').replace(/%2C/g,',').replace(/%5F/g,'_').replace(/%2D/g,'-');
}
async function guResolvePlay(path,lineName){
  if(path.indexOf('http')===0){
    if(path.indexOf('.m3u8')>=0||path.indexOf('m.php')<0){
      return {url:guQualityRewrite(path),name:guLineDisplay(lineName)};
    }
    throw new Error('咕噜该线路暂不支持播放');
  }
  var prefix=guPrefixOf(path);
  if(!prefix) throw new Error('咕噜未知解析线路');
  var line=GU_PREFIX_MAP[prefix];
  var template=guParseTemplate(line);
  if(!template) throw new Error('咕噜缺少解析接口');
  var enc=guEncodeParseId(path);
  var lastErr=null;
  for(var i=0;i<2;i++){
    try{
      var r=await CCTVHttp.get(template+enc,{headers:{'User-Agent':GU.ua},timeout:15000});
      if(r.statusCode<200||r.statusCode>=300) throw new Error('解析接口暂不可用（HTTP '+r.statusCode+'）');
      // CCTVHttp parses JSON bodies into objects; accept either form.
      var text=(typeof r.data==='string')?r.data:(r.data?JSON.stringify(r.data):'');
      var url='';
      try{ var j=JSON.parse(text); if(j&&typeof j.url==='string') url=j.url; }catch(e){}
      if(!url){ var m=text.match(/"url"\s*:\s*"([^"]+)"/); if(m) url=m[1]; }
      url=String(url||'').replace(/\\\//g,'/').trim();
      if(!url) throw new Error('解析接口未返回播放地址');
      return {url:guQualityRewrite(url),name:guLineDisplay(line)};
    }catch(e){ lastErr=e; if(i<1) await guSleep(600); }
  }
  throw lastErr||new Error('咕噜解析失败');
}

// ---- CatVod entry functions ----
function guText(v){ return String(v==null?'':v).trim(); }
function guPage(p){ var n=Math.max(1,Math.floor(Number(p)||1)); return String(n); }
function guVodLink(id){ return GU.host+'/__cctvhost__/'+Source.id+'/vod?id='+encodeURIComponent(id); }
function guEpisodeLink(vod,title,path,src,srcCn){
  return GU.host+'/__cctvhost__/'+Source.id+'/episode?vod='+encodeURIComponent(vod)+'&title='+encodeURIComponent(title)+'&path='+encodeURIComponent(path)+'&src='+encodeURIComponent(src)+'&srccn='+encodeURIComponent(srcCn);
}
function guParseVod(link){
  var re=new RegExp('/__cctvhost__/'+Source.id+'/vod\\?id=(.+)$');
  var m=String(link).match(re);
  if(!m) throw new Error('请选择咕噜组件内的影片');
  return decodeURIComponent(m[1]);
}
function guParseEpisode(link){
  var re=new RegExp('/__cctvhost__/'+Source.id+'/episode\\?vod=([^&]*)&title=([^&]*)&path=([^&]*)&src=([^&]*)&srccn=([^&]*)$');
  var m=String(link).match(re);
  if(!m) throw new Error('请选择咕噜组件内的分集');
  return {vod:decodeURIComponent(m[1]),title:decodeURIComponent(m[2]),path:decodeURIComponent(m[3]),src:decodeURIComponent(m[4]),srcCn:decodeURIComponent(m[5])};
}
function guCard(item,mediaType){
  if(!item||!item.vod_id||!item.vod_name) throw new Error('咕噜影片数据不完整');
  var link=guVodLink(item.vod_id);
  var cover=/^https?:\/\//.test(item.vod_pic||'')?item.vod_pic:'';
  return {id:link,type:'url',link:link,title:guText(item.vod_name),coverUrl:cover,posterPath:cover,
    mediaType:mediaType||'tv',releaseDate:item.vod_year||'',genreTitle:'',
    description:guText(item.vod_remarks),actor:'',director:''};
}
async function loadHome(params){
  var items=await guList('tv',1);
  return items.map(function(it){ return guCard(it,'tv'); });
}
async function loadCatalog(params){
  params=params||{};
  var kind=String(params.kind||'tv');
  if(SjKinds.every(function(k){ return k[0]!==kind; })) throw new Error('分类无效');
  var items=await guList(kind,guPage(params.page),String(params.year||''),String(params.sort||''));
  return items.map(function(it){ return guCard(it,kind==='movie'?'movie':'tv'); });
}
async function search(params){
  params=params||{};
  var keyword=String(params.keyword||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
  if(!keyword) return [];
  var items=await guSearch(keyword,guPage(params.page));
  return items.map(function(it){ return guCard(it,'tv'); });
}
async function loadDetail(link){
  var id=guParseVod(link);
  var d=await guDetail(id);
  if(!d||!d.name) throw new Error('咕噜详情数据异常');
  var item={id:link,type:'url',link:link,title:d.name,coverUrl:d.pic,posterPath:d.pic,mediaType:'tv',
    releaseDate:'',genreTitle:'',description:[d.content,d.area,d.remarks].filter(Boolean).join(' · '),actor:d.actor,director:d.director};
  if(!d.groups.length) throw new Error('咕噜没有返回可选分集');
  var used={},byTitle={},order=[];
  d.groups.forEach(function(group){
    var display=guLineDisplay(group.line);
    if(used[display]){ var n=2; while(used[display+String(n)]) n++; display=display+String(n); }
    used[display]=true;
    group.episodes.forEach(function(ep){
      var title=guText(ep.title)||'正片';
      if(!byTitle[title]){ byTitle[title]=[]; order.push(title); }
      byTitle[title].push({line:display,raw:group.line,ep:ep});
    });
  });
  item.episodeItems=order.map(function(title){
    var lines=byTitle[title];
    var first=lines[0];
    return {id:guEpisodeLink(id,title,first.ep.url,first.raw,first.line),type:'url',
      link:guEpisodeLink(id,title,first.ep.url,first.raw,first.line),title:title,coverUrl:item.coverUrl,mediaType:'tv',
      childItems:lines.map(function(row){
        return {id:guEpisodeLink(id,title,row.ep.url,row.raw,row.line),type:'url',
          link:guEpisodeLink(id,title,row.ep.url,row.raw,row.line),title:row.line+' · '+title};
      })};
  });
  item.childItems=[];
  return item;
}
async function resolveResource(params){
  var ep=guParseEpisode(String((params&&params.link)||''));
  await guEnsureSession();
  var play=await guResolvePlay(ep.path,ep.src);
  return [{name:play.name||guText(ep.srcCn)||'播放线路',url:play.url,playerType:'app',customHeaders:{'User-Agent':GU.ua}}];
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
