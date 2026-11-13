// Standalone 华谊 adapter (HyProto: protobuf + RSA/AES signing).
// Protocol reconstructed from the site's Android client (spider.jar, 2026-11-13)
// and the live unsigned category endpoint. Signed proto calls (zone / list /
// search / detail / play) cannot be verified from the build machine: POST to
// the bare-IP backend times out there. Needs an on-device test.
var Source={id:'huayi',name:'华谊',origin:'http://43.240.158.154:18004',version:'0.1.0'};
var CCTVHostMetadata={id:'joeshu.huayi',title:'华谊',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'分类片库、搜索、完整分集与播放地址（protobuf 签名接口）。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'kind',title:'分类',type:'enumeration',value:'21',enumOptions:[{"title": "电影", "value": "21"}, {"title": "剧集", "value": "22"}, {"title": "动漫", "value": "25"}, {"title": "综艺", "value": "26"}, {"title": "短剧", "value": "27"}, {"title": "漫剧", "value": "28"}, {"title": "纪录片", "value": "30"}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'例如：仙逆'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'华谊搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
var SjKinds=[['21','电影'],['22','剧集'],['25','动漫'],['26','综艺'],['27','短剧'],['28','漫剧'],['30','纪录片']];
var HY={
  configUrl:'https://1851089669.cdn.123clouddisk.com/1851089669/44107727',
  host:'http://43.240.158.154:18004',
  pkg:'com.lxf.sncgtzxyx',
  vname:'6.0.0.1',
  vno:'6001',
  appName:'华谊',
  rsa1:'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCr8SzZhjYy+rsya1K09t8d2K50pWFoBkgUqMpKOiW+3IEVKd4eTdvg9RSOjQ82kypL6R9BnsmrS1V8s4PVDwjQbUtYhTPPC9Hz16qY7rpD6m0d2vr09/UpWQ5uOy9PR0QTrsioveZ+DIe9jc3C+zBCu/kZSY/R8stwJoiitki3gwIDAQAB',
  dataKey:'V04XQZNYRWN6T0JODZFIAG5CTZB3PT0=',
  dataIv:'OC1A06E197EF10CF3F6058CA7A803B5E',
  nativeK:'ed5fdsgucxumegqa',
  listPath:'/api/proto/v5/drama/category',
  tsNumber:true,
  uuidUpper:true,
  homeKind:'21',
  movieKind:'21'
};
var HYState={host:'',dynkey:'',uuid:'',zonePromise:null};

// ---- byte helpers (no runtime dependency) ----
var HY_B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function hyB64Encode(bytes){
  var out='',i;
  for(i=0;i<bytes.length;i+=3){
    var b0=bytes[i],b1=i+1<bytes.length?bytes[i+1]:0,b2=i+2<bytes.length?bytes[i+2]:0;
    out+=HY_B64[b0>>2]+HY_B64[((b0&3)<<4)|(b1>>4)]+((i+1<bytes.length)?HY_B64[((b1&15)<<2)|(b2>>6)]:'=')+((i+2<bytes.length)?HY_B64[b2&63]:'=');
  }
  return out;
}
function hyB64Decode(str){
  var clean=String(str||'').replace(/[^A-Za-z0-9+/=]/g,'');
  var rev={},i;
  for(i=0;i<64;i++) rev[HY_B64[i]]=i;
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
function hyUtf8Bytes(s){
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
function hyUtf8Text(bytes){
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
function hyConcat(){
  var total=0,i,off=0;
  for(i=0;i<arguments.length;i++) total+=arguments[i].length;
  var out=new Uint8Array(total);
  for(i=0;i<arguments.length;i++){ out.set(arguments[i],off); off+=arguments[i].length; }
  return out;
}
function hyFindBytes(hay,needle,from){
  for(var i=from||0;i+needle.length<=hay.length;i++){
    var ok=true;
    for(var j=0;j<needle.length;j++){ if(hay[i+j]!==needle[j]){ ok=false; break; } }
    if(ok) return i;
  }
  return -1;
}

// ---- protobuf (wire format) ----
function hyVarint(n){
  var out=[];
  n=Math.floor(n);
  while(true){ var x=n%128; n=Math.floor(n/128); if(n>0){ out.push(x|0x80); } else { out.push(x); break; } }
  return new Uint8Array(out);
}
function hyField(num,wire,payload){
  var tag=hyVarint((num<<3)|wire);
  if(wire===2){ return hyConcat(tag,hyVarint(payload.length),payload); }
  return hyConcat(tag,hyVarint(payload));
}
function hyParse(buf){
  var out=[],i=0,n=buf.length;
  while(i<n){
    var b=buf[i++]; if(b===0) break;
    var fn=b>>3,wt=b&7;
    if(wt===0){ var v=0,sh=0; while(i<n){ var x=buf[i++]; v+=(x&0x7f)*Math.pow(2,sh); sh+=7; if(!(x&0x80)) break; } out.push({num:fn,wire:wt,value:v}); }
    else if(wt===2){ var ln=0,sh2=0; while(i<n){ var y=buf[i++]; ln+=(y&0x7f)*Math.pow(2,sh2); sh2+=7; if(!(y&0x80)) break; } out.push({num:fn,wire:wt,value:buf.slice(i,i+ln)}); i+=ln; }
    else if(wt===5){ out.push({num:fn,wire:wt,value:buf.slice(i,i+4)}); i+=4; }
    else if(wt===1){ out.push({num:fn,wire:wt,value:buf.slice(i,i+8)}); i+=8; }
    else { break; }
  }
  return out;
}
function hyPick(fields,num,wire,def){
  for(var i=0;i<fields.length;i++){ if(fields[i].num===num&&fields[i].wire===wire) return fields[i].value; }
  return def;
}

// ---- random ----
var HY_RND_TABLE='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function hyRnd(n){
  var s='';
  for(var i=0;i<n-1;i++) s+=HY_RND_TABLE[Math.floor(Math.random()*62)];
  return s+'=';
}
function hyUuid(){
  var s='',hex='0123456789ABCDEF';
  for(var i=0;i<32;i++) s+=hex[Math.floor(Math.random()*16)];
  return HY.uuidUpper?s:s.toLowerCase();
}

// ---- AES via the runtime CryptoJS (bundled in CCTVHost) ----
function hyCryptoJS(){
  if(typeof CryptoJS!=='undefined'&&CryptoJS&&CryptoJS.AES&&CryptoJS.enc&&CryptoJS.mode&&CryptoJS.pad) return CryptoJS;
  try{
    var g=(typeof globalThis!=='undefined')?globalThis:null;
    if(g&&typeof g.__cctvImport==='function'){ var c=g.__cctvImport('crypto-js'); if(c&&c.AES&&c.enc) return c; }
  }catch(e){}
  throw new Error('本站需要 CryptoJS 运行环境，请更新 CCTVHost 后重试');
}
function hyWordArray(bytes){
  var C=hyCryptoJS();
  var words=[];
  for(var i=0;i<bytes.length;i++){ var w=i>>2; if(words[w]===undefined) words[w]=0; words[w]|=bytes[i]<<(24-((i%4)*8)); }
  return C.lib.WordArray.create(words,bytes.length);
}
function hyBytesFromWordArray(wa){
  var out=[],i;
  for(i=0;i<wa.sigBytes;i++){ out.push((wa.words[i>>2]>>>(24-((i%4)*8)))&0xff); }
  return new Uint8Array(out);
}
function hyAesEcbB64(keyStr,plainStr){
  var C=hyCryptoJS();
  var key=C.enc.Utf8.parse(keyStr);
  var data=C.enc.Utf8.parse(plainStr);
  var enc=C.AES.encrypt(data,key,{mode:C.mode.ECB,padding:C.pad.Pkcs7});
  return hyB64Encode(hyBytesFromWordArray(enc.ciphertext));
}
function hyAesCbcHex(keyStr,ivStr,plainBytes){
  var C=hyCryptoJS();
  var key=C.enc.Utf8.parse(keyStr);
  var iv=C.enc.Utf8.parse(ivStr);
  var enc=C.AES.encrypt(hyWordArray(plainBytes),key,{iv:iv,mode:C.mode.CBC,padding:C.pad.Pkcs7});
  var bytes=hyBytesFromWordArray(enc.ciphertext);
  var hex='';
  for(var i=0;i<bytes.length;i++){ var h=bytes[i].toString(16); hex+=h.length===1?'0'+h:h; }
  return hex;
}

// ---- RSA PKCS#1 v1.5 (BigInt; same shape as the runtime webox helper) ----
function hyRsaParseKey(b64){
  var clean=String(b64||'').replace(/-----[^-]+-----/g,'').replace(/\s+/g,'');
  var der=hyB64Decode(clean);
  if(!der.length||der[0]!==0x30) throw new Error('RSA 公钥格式无效');
  var ints=[];
  function walk(buf,offset,end){
    while(offset<end){
      var tag=buf[offset++];
      if(offset>=end) break;
      var len=buf[offset++];
      if(len&0x80){ var nb=len&0x7f; len=0; for(var i=0;i<nb;i++) len=(len<<8)|buf[offset++]; }
      var contentEnd=Math.min(end,offset+len);
      if(tag===0x02){
        var slice=buf.slice(offset,contentEnd);
        while(slice.length>1&&slice[0]===0x00) slice=slice.slice(1);
        ints.push(slice);
      }else if((tag&0x20)||tag===0x04||tag===0x03){
        walk(buf,tag===0x03?offset+1:offset,contentEnd);
      }
      offset=contentEnd;
    }
  }
  walk(der,0,der.length);
  var nObj=null,eObj=null;
  for(var j=0;j<ints.length;j++){
    if(!nObj&&ints[j].length>=64){ nObj=ints[j]; if(j+1<ints.length) eObj=ints[j+1]; break; }
  }
  if(!nObj||!eObj) throw new Error('RSA 公钥缺少模数');
  var nHex='',eHex='',a;
  for(a=0;a<nObj.length;a++){ var h=nObj[a].toString(16); nHex+=h.length===1?'0'+h:h; }
  for(a=0;a<eObj.length;a++){ var h2=eObj[a].toString(16); eHex+=h2.length===1?'0'+h2:h2; }
  var n=BigInt('0x'+nHex),e=BigInt('0x'+eHex);
  if(n<=1n||e<=1n) throw new Error('RSA 公钥无效');
  return {n:n,e:e,k:nObj.length};
}
function hyRsaModPow(base,exp,mod){
  var result=1n; base=((base%mod)+mod)%mod;
  while(exp>0n){ if(exp&1n) result=(result*base)%mod; exp>>=1n; base=(base*base)%mod; }
  return result;
}
function hyRsaEncryptB64(pemB64,plainStr){
  var key=hyRsaParseKey(pemB64);
  var data=hyUtf8Bytes(plainStr);
  var k=key.k,maxChunk=k-11;
  var out=[];
  for(var off=0;off<data.length||(data.length===0&&off===0);off+=maxChunk){
    var chunk=data.slice(off,Math.min(data.length,off+maxChunk));
    var padLen=k-3-chunk.length;
    var block=new Uint8Array(k);
    block[0]=0x00; block[1]=0x02;
    for(var i=0;i<padLen;i++){ var r=0; while(r===0) r=Math.floor(Math.random()*255)+1; block[2+i]=r; }
    block[2+padLen]=0x00;
    block.set(chunk,3+padLen);
    var hex='';
    for(var j=0;j<block.length;j++){ var hh=block[j].toString(16); hex+=hh.length===1?'0'+hh:hh; }
    var c=hyRsaModPow(BigInt('0x'+hex),key.e,key.n);
    var cHex=c.toString(16);
    while(cHex.length<k*2) cHex='0'+cHex;
    var cBytes=new Uint8Array(k);
    for(var q=0;q<k;q++) cBytes[q]=parseInt(cHex.slice(q*2,q*2+2),16);
    out.push(cBytes);
    if(data.length===0) break;
  }
  return hyB64Encode(hyConcat.apply(null,out));
}

// ---- HyProto session ----
function hyUuidField(){ var u=HYState.uuid||(HYState.uuid=hyUuid()); return HY.uuidUpper?u:u.toUpperCase(); }
function hyDeviceFields(){
  var u=hyUuidField();
  return [
    ['country','CN'],['vName',HY.vname],['cpuId','MT6893Z%2FCZA'],
    ['young',0],['facturer','Xiaomi'],['pkg',HY.pkg],
    ['uuid',u],['resolution','1080x2272'],
    ['mac','02%3A00%3A00%3A00%3A00%3A00'],['abid','397'],
    ['model','M2012K11AC'],['plat','android'],['udid',u],
    ['dpi','440'],['net','1'],['lang','zh'],['brand','Xiaomi'],
    ['density','2.75'],['appName',HY.appName],['cpu','arm64-v8a'],
    ['chid','10000'],['carrier','%E8%81%94%E9%80%9A'],
    ['_vOsCode',30],['vOs','11'],['v',1],['tenantId',''],
    ['vApp',HY.vno],['device',0],
    ['androidID',HYState.uuid.toLowerCase().slice(0,16)]
  ];
}
function hyJsonOf(pairs){
  var parts=[];
  for(var i=0;i<pairs.length;i++){
    var k=pairs[i][0],v=pairs[i][1];
    if(typeof v==='number') parts.push('"'+k+'":'+v);
    else parts.push('"'+k+'":"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"');
  }
  return '{'+parts.join(',')+'}';
}
function hyHeaders(){
  var t=Date.now();
  var rnd=hyRnd(16);
  var keyB64=HYState.dynkey||HY.rsa1;
  var sig='';
  try{ sig=hyRsaEncryptB64(keyB64,String(t)+rnd+HY.vno); }catch(e){ sig=''; }
  if(!sig&&HYState.dynkey){ try{ sig=hyRsaEncryptB64(HY.rsa1,String(t)+rnd+HY.vno); }catch(e){ sig=''; } }
  var ao=hyAesEcbB64(HY.dataIv,String(t)+rnd);
  var m=hyDeviceFields();
  m.push(['sig',sig]); m.push(['random_str',rnd]);
  m.push(['timestamp',HY.tsNumber?t:String(t)]);
  m.push(['sig2',ao.slice(0,8)]); m.push(['sig3',ao.slice(8)]);
  var json=hyJsonOf(m);
  var pd=hyAesCbcHex(HY.nativeK,HY.nativeK,hyUtf8Bytes(json));
  return {'User-Agent':'okhttp/3.12.1','Cache-Control':'no-cache','Accept':'application/x-protobuf','Content-Type':'application/x-protobuf','publicParams':'{"paramsData":"'+pd+'"}'};
}
async function hyHost(){
  if(HYState.host) return HYState.host;
  try{
    var r=await CCTVHttp.get(HY.configUrl,{headers:{'Accept':'*/*'},timeout:15000});
    var d=r.data;
    if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(e){} }
    if(d&&typeof d==='object'&&typeof d.domain==='string'&&/^https?:\/\//.test(d.domain)) HYState.host=d.domain.replace(/\/+$/,'');
  }catch(e){}
  if(!HYState.host) HYState.host=HY.host;
  return HYState.host;
}
async function hyProtoPost(path,bodyBytes){
  var host=await hyHost();
  var r=await CCTVHttp.post(host+path,bodyBytes,{headers:hyHeaders(),buffer:1,timeout:15000});
  if(r.statusCode<200||r.statusCode>=300) throw new Error('本站接口暂不可用（HTTP '+r.statusCode+'）');
  if(!r.bodyBase64) throw new Error('本站返回了空数据');
  var raw=hyB64Decode(r.bodyBase64);
  var fields=hyParse(raw);
  var code=hyPick(fields,1,0,-1);
  var msg=hyUtf8Text(hyPick(fields,2,2,new Uint8Array(0)));
  if(code!==200) throw new Error('本站接口返回异常（'+code+'）'+(msg?'：'+msg:''));
  var payload=hyPick(fields,3,2,null);
  if(!payload) throw new Error('本站接口未返回数据');
  return payload;
}
async function hyEnsureKey(){
  if(HYState.dynkey) return HYState.dynkey;
  if(HYState.zonePromise) return HYState.zonePromise;
  HYState.zonePromise=(async function(){
    var host=await hyHost();
    var t=Date.now();
    var rnd=hyRnd(16);
    var sign=hyRsaEncryptB64(HY.rsa1,String(t)+rnd);
    var body=hyConcat(
      hyField(1,0,t),
      hyField(2,2,hyUtf8Bytes(sign)),
      hyField(3,2,hyUtf8Bytes(hyRnd(16))),
      hyField(4,2,hyUtf8Bytes(rnd)),
      hyField(5,2,hyUtf8Bytes(hyRnd(16))));
    var payload=await hyProtoPost('/api/v5/find/app/zone',body);
    var strs={};
    hyParse(payload).forEach(function(f){ if(f.wire===2) strs[f.num]=f.value; });
    var cands=[[2,3,4,5],[1,2,4,5]];
    for(var i=0;i<cands.length;i++){
      var parts=[],ok=true;
      for(var j=0;j<cands[i].length;j++){ var s=strs[cands[i][j]]; if(!s){ ok=false; break; } parts.push(hyUtf8Text(s)); }
      if(!ok) continue;
      var joined=parts.join('');
      try{ hyRsaParseKey(joined); HYState.dynkey=joined; return joined; }catch(e){}
    }
    throw new Error('本站会话密钥格式异常，请稍后重试');
  })();
  try{ return await HYState.zonePromise; }finally{ HYState.zonePromise=null; }
}
function hySecureBody(params){
  var s=params.filter(function(p){ return p[1]!==''&&p[1]!=null; }).map(function(p){ return p[0]+'='+p[1]; }).join('&');
  var t=Date.now();
  var rnd8=hyRnd(8),rnd20=hyRnd(20);
  var enc=hyAesEcbB64(HY.dataKey,s+String(t));
  var combined=rnd8+enc;
  var split=Math.min(20,combined.length);
  return hyConcat(
    hyField(1,2,hyUtf8Bytes(combined.slice(0,split))),
    hyField(2,2,hyUtf8Bytes(combined.slice(split))),
    hyField(3,2,hyUtf8Bytes(rnd20)),
    hyField(4,0,t),
    hyField(5,2,hyUtf8Bytes(rnd8)));
}

// ---- response parsing ----
function hyImgFrom(bytes){
  var cands=[];
  if(bytes&&bytes.length){
    hyParse(bytes).forEach(function(f){
      if(f.wire===2&&f.value&&f.value.length>=4){
        var s=hyUtf8Text(f.value);
        if(s.indexOf('http')===0) cands.push(s);
      }
    });
    if(!cands.length){
      var m=hyUtf8Text(bytes).match(/https?:\/\/[!-~]+/);
      if(m) cands.push(m[0]);
    }
  }
  if(!cands.length) return '';
  for(var i=0;i<cands.length;i++){ if(cands[i].indexOf('https')===0) return cands[i]; }
  return cands[0];
}
function hyParseItems(data){
  var out=[];
  hyParse(data).forEach(function(f){
    if(f.num!==1||f.wire!==2) return;
    var item={vod_id:'',vod_name:'',vod_pic:'',vod_remarks:''};
    hyParse(f.value).forEach(function(g){
      if(g.num===3&&g.wire===0) item.vod_id=String(g.value);
      else if(g.num===5&&g.wire===2) item.vod_name=hyUtf8Text(g.value);
      else if(g.num===2&&g.wire===2) item.vod_pic=hyImgFrom(g.value);
      else if(g.num===13&&g.wire===2) item.vod_remarks=hyUtf8Text(g.value);
    });
    if(item.vod_id&&item.vod_name) out.push(item);
  });
  return out;
}
async function hyList(kind,page){
  await hyEnsureKey();
  var payload=await hyProtoPost(HY.listPath,hySecureBody([['pagesize','21'],['typeId1',String(kind)],['page',String(page)],['vodOrderBy','最新']]));
  return hyParseItems(payload);
}
async function hySearch(keyword,page){
  await hyEnsureKey();
  var payload=await hyProtoPost('/api/proto/v5/drama/search',hySecureBody([['searchKeys',keyword],['page',String(page)],['pagesize','21']]));
  return hyParseItems(payload);
}
async function hyDetail(vodId){
  await hyEnsureKey();
  var payload=await hyProtoPost('/api/proto/v5/drama/getDetail',hySecureBody([['id',String(vodId)]]));
  var fields=hyParse(payload);
  var name=hyUtf8Text(hyPick(fields,9,2,new Uint8Array(0)));
  var pic=hyImgFrom(hyPick(fields,2,2,new Uint8Array(0)));
  var area=hyUtf8Text(hyPick(fields,1,2,new Uint8Array(0)));
  var director=hyUtf8Text(hyPick(fields,12,2,new Uint8Array(0)));
  var content=hyUtf8Text(hyPick(fields,6,2,hyPick(fields,7,2,new Uint8Array(0))));
  var eps=[],pos=0;
  while(true){
    var j=hyFindBytes(payload,[0xEA,0x01],pos);
    if(j<0) break;
    var k=j+2,ln=0,sh=0;
    while(k<payload.length){ var x=payload[k]; k++; ln+=(x&0x7f)*Math.pow(2,sh); sh+=7; if(!(x&0x80)) break; }
    if(ln<=0||k+ln>payload.length){ pos=j+1; continue; }
    var entry=payload.slice(k,k+ln); pos=k+ln;
    var title='',pth='',src='',srcCn='';
    hyParse(entry).forEach(function(f){
      if(f.wire!==2) return;
      if(f.num===2||f.num===3) title=hyUtf8Text(f.value);
      else if(f.num===4) pth=hyUtf8Text(f.value);
      else if(f.num===9) src=hyUtf8Text(f.value);
      else if(f.num===10) srcCn=hyUtf8Text(f.value);
    });
    if(pth) eps.push({title:title,path:pth,src:src,srcCn:srcCn});
  }
  return {name:name,pic:pic,area:area,director:director,content:content,episodes:eps};
}

// ---- CatVod entry functions ----
function hyText(v){ return String(v==null?'':v).trim(); }
function hyPage(p){ var n=Math.max(1,Math.floor(Number(p)||1)); return String(n); }
function hyVodLink(id){ return HY.host+'/__cctvhost__/'+Source.id+'/vod?id='+encodeURIComponent(id); }
function hyEpisodeLink(vod,title,path,src,srcCn){
  return HY.host+'/__cctvhost__/'+Source.id+'/episode?vod='+encodeURIComponent(vod)+'&title='+encodeURIComponent(title)+'&path='+encodeURIComponent(path)+'&src='+encodeURIComponent(src)+'&srccn='+encodeURIComponent(srcCn);
}
function hyParseVod(link){
  var re=new RegExp('^https?://[^/]+/__cctvhost__/'+Source.id+'/vod\\?id=(.+)$');
  var m=String(link).match(re);
  if(!m) throw new Error('请选择'+HY.appName+'组件内的影片');
  return decodeURIComponent(m[1]);
}
function hyParseEpisode(link){
  var re=new RegExp('^https?://[^/]+/__cctvhost__/'+Source.id+'/episode\\?vod=([^&]*)&title=([^&]*)&path=([^&]*)&src=([^&]*)&srccn=([^&]*)$');
  var m=String(link).match(re);
  if(!m) throw new Error('请选择'+HY.appName+'组件内的分集');
  return {vod:decodeURIComponent(m[1]),title:decodeURIComponent(m[2]),path:decodeURIComponent(m[3]),src:decodeURIComponent(m[4]),srcCn:decodeURIComponent(m[5])};
}
function hyCard(item,mediaType){
  if(!item||!item.vod_id||!item.vod_name) throw new Error(HY.appName+'影片数据不完整');
  var link=hyVodLink(item.vod_id);
  var cover=/^https?:\/\//.test(item.vod_pic||'')?item.vod_pic:'';
  return {id:link,type:'url',link:link,title:hyText(item.vod_name),coverUrl:cover,posterPath:cover,
    mediaType:mediaType||'tv',releaseDate:'',genreTitle:'',
    description:hyText(item.vod_remarks),actor:'',director:''};
}
async function loadHome(params){
  var items=await hyList(HY.homeKind,1);
  return items.map(function(it){ return hyCard(it,HY.homeKind===HY.movieKind?'movie':'tv'); });
}
async function loadCatalog(params){
  params=params||{};
  var kind=String(params.kind||HY.homeKind);
  if(SjKinds.every(function(k){ return k[0]!==kind; })) throw new Error('分类无效');
  var items=await hyList(kind,hyPage(params.page));
  return items.map(function(it){ return hyCard(it,kind===HY.movieKind?'movie':'tv'); });
}
async function search(params){
  params=params||{};
  var keyword=String(params.keyword||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
  if(!keyword) return [];
  var items=await hySearch(keyword,hyPage(params.page));
  return items.map(function(it){ return hyCard(it,'tv'); });
}
async function loadDetail(link){
  var id=hyParseVod(link);
  var d=await hyDetail(id);
  if(!d.name) throw new Error(HY.appName+'详情数据异常');
  var item={id:link,type:'url',link:link,title:d.name,coverUrl:d.pic,posterPath:d.pic,mediaType:'tv',
    releaseDate:'',genreTitle:'',description:[d.content,d.area].filter(Boolean).join(' · '),actor:'',director:d.director};
  if(!d.episodes.length) throw new Error(HY.appName+'没有返回可选分集');
  var byTitle={},order=[];
  d.episodes.forEach(function(ep,idx){
    var title=hyText(ep.title)||('第'+(idx+1)+'集');
    if(!byTitle[title]){ byTitle[title]=[]; order.push(title); }
    byTitle[title].push(ep);
  });
  item.episodeItems=order.map(function(title){
    var lines=byTitle[title];
    var first=lines[0];
    return {id:hyEpisodeLink(id,title,first.path,first.src,first.srcCn),type:'url',
      link:hyEpisodeLink(id,title,first.path,first.src,first.srcCn),title:title,coverUrl:item.coverUrl,mediaType:'tv',
      childItems:lines.map(function(ep){
        var line=hyText(ep.srcCn)||'原站线路';
        return {id:hyEpisodeLink(id,title,ep.path,ep.src,ep.srcCn),type:'url',
          link:hyEpisodeLink(id,title,ep.path,ep.src,ep.srcCn),title:line+' · '+title};
      })};
  });
  item.childItems=[];
  return item;
}
async function resolveResource(params){
  var ep=hyParseEpisode(String((params&&params.link)||''));
  await hyEnsureKey();
  var payload=await hyProtoPost('/api/proto/v5/videoUsableUrl',hySecureBody([['vodPlayFrom',encodeURIComponent(ep.src)],['playUrl',encodeURIComponent(ep.path)]]));
  var text=hyUtf8Text(payload);
  var url='',headers={};
  try{
    var j=JSON.parse(text);
    if(j&&typeof j.url==='string') url=j.url;
    if(j&&j.header&&typeof j.header==='object') headers=j.header;
  }catch(e){}
  if(!url){
    var m=text.match(/https?:\/\/[!-~]+/);
    if(m) url=m[0];
  }
  if(!/^https?:\/\//i.test(url)) throw new Error(HY.appName+'没有返回可播放的视频地址');
  if(!headers.Referer&&!headers.referer) headers.Referer=(await hyHost())+'/';
  return [{name:hyText(ep.srcCn)||'播放线路',url:url,playerType:'app',customHeaders:headers}];
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
