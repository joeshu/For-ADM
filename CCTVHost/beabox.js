/* 笔盒短剧 CCTVHost 适配器：公开目录、详情与播放直链（18+ 成人站）。
 * 站点：https://beabox.live（永久域名，首页是“正在为您连接…”跳转页），
 * 发布页 bh4066.top / bihe347.com（标题“笔盒-地址发布页：beabox.cc”，明示 18+）。
 * 跳转页逻辑（实测 2026-11-12）：先调 /publish-check.php/<base64url(host)> 验域是否过期，
 * 再从 __ENC_DOMAINS（base64 + 与 "secureKey" 异或，纯公开逻辑）解出 10 个候选域
 * bh4066/bh4254/bh4287/bh4362/bh4549/bh5530/bh6246/bh6291/bh6429/bh6831.top，
 * 随机挑一个跳转；各候选域目前都 serve 同一份发布页 SPA，同时 /api 可用。
 * 真实数据源：候选域上的 /api（axios baseURL "/api"），返回 {"code":200,"data":"<hex>"}，
 * 响应头 X-Encrypted: AES-128-CBC:hex；hex = IV(16B) + AES-128-CBC(PKCS7) 密文，
 * 密钥为 web 客户端 bundle 内公开的硬编码密钥（非登录/签名取得，无需账号），
 * 本文件用纯 JS 实现 AES-128-CBC 解密（无外部依赖）。
 * 已实测的端点：GET /vod/recommend、/vod/latest?page&limit、/vod/search?keyword&page&limit&sort=latest、
 * /vod/detail/{vodId}、/topic/list、/topic/detail/{id}、/vod/carousel、/configs。
 * 详情含 vodPlaySource（直链 m3u8，needParse=false，无登录/签名/付费），
 * resolveResource 照实返回该公开地址；取不到时明确报错。封面：老条目是直出 .jpg，可用；新条目 vodPic 是 .txt 密文
 * （前 4096 字节与 0x12 异或后是 data:URL，需浏览器内解密成 blob，CCTVHost 无法直接当封面），
 * 本适配器只取直出图片地址，.txt 封面留空。beabox.live 与 bihe347.com 的 /api 实测 404，
 * 故 API 请求在 10 个 bh*.top 候选域之间轮换，首个成功者会被记住。 */
var Source={id:'beabox',name:'笔盒短剧',origin:'https://beabox.live'};
var CCTVHostMetadata={id:'joeshu.'+Source.id,title:Source.name,author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'笔盒短剧公开目录、详情与播放直链（18+ 成人站；播放地址来自站内公开详情接口）。',detailCacheDuration:0,
 modules:[
  {id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:60,params:[]},
  {id:'category',title:'分类片库',functionName:'loadCatalog',cacheDuration:0,params:[{name:'channelId',title:'分类',type:'enumeration',value:'latest',enumOptions:[{title:'最新视频',value:'latest'},{title:'推荐',value:'recommend'},{title:'专题',value:'topics'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'searchList',title:'搜索影片',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'片名',type:'input',description:'输入片名或关键词'},{name:'page',title:'页码',type:'page',value:'1'}]},
  {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}
 ],search:{title:Source.name+'搜索',functionName:'search',params:[{name:'keyword',title:'片名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};

var siteText=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();};
var siteIdOK=function(v){return /^[A-Za-z0-9_-]{1,100}$/.test(String(v==null?'':v));};
var siteArray=function(v){return Array.isArray(v)?v:[];};
var sitePage=function(v){var n=Math.floor(Number(v)||1);return n>0&&n<=500?n:1;};
var siteSafeURL=function(v){var s=String(v==null?'':v);return s.length<=8192&&/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#]|$)/i.test(s)&&!/[\s\\\x00-\x1f]/.test(s)?s:'';};
var siteGet=function(o,keys){for(var i=0;i<keys.length;i++)if(o&&o[keys[i]]!=null&&o[keys[i]]!=='')return o[keys[i]];return undefined;};
var siteQueryValue=function(link,key){var re=new RegExp('[?&]'+key+'=([^&#]*)');var m=String(link||'').match(re);if(!m)return '';try{return decodeURIComponent(m[1].replace(/\+/g,' '));}catch(_){return '';}};
var siteLink=function(kind,values){var q=Object.keys(values).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(String(values[k]));}).join('&');return Source.origin+'/__cctvhost__/'+Source.id+'/'+kind+'?'+q;};
var UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/* AES-128-CBC 纯 JS 解密：S 盒由 GF(2^8) 现算，避免抄表错；密钥为 bundle 内公开值。 */
var BEABOX_AES_KEY_HEX='f6322fa1c064370ea40c8cdc20649f8e';
function beaboxGfMul(a,b){var p=0;for(var i=0;i<8;i++){if(b&1)p^=a;var hi=a&0x80;a=(a<<1)&0xff;if(hi)a^=0x1b;b>>=1;}return p;}
var BEABOX_SBOXES=(function(){
  function rotl(x,n){return ((x<<n)|(x>>(8-n)))&0xff;}
  var fwd=new Array(256),inv=new Array(256);
  for(var x=0;x<256;x++){
    var ix=0;
    if(x!==0){var r=1;for(var i=0;i<254;i++)r=beaboxGfMul(r,x);ix=r;}
    var s=ix^rotl(ix,1)^rotl(ix,2)^rotl(ix,3)^rotl(ix,4)^0x63;
    fwd[x]=s;inv[s]=x;
  }
  return {fwd:fwd,inv:inv};
})();
function beaboxExpandKey(key){
  var rcon=[0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36],w=[];
  for(var i=0;i<4;i++)w.push([key[4*i],key[4*i+1],key[4*i+2],key[4*i+3]]);
  for(var k=4;k<44;k++){
    var t=w[k-1].slice();
    if(k%4===0)t=[BEABOX_SBOXES.fwd[t[1]]^rcon[k/4-1],BEABOX_SBOXES.fwd[t[2]],BEABOX_SBOXES.fwd[t[3]],BEABOX_SBOXES.fwd[t[0]]];
    w.push([w[k-4][0]^t[0],w[k-4][1]^t[1],w[k-4][2]^t[2],w[k-4][3]^t[3]]);
  }
  var rk=[];
  for(var r=0;r<=10;r++){var kk=[];for(var c=0;c<4;c++)for(var row=0;row<4;row++)kk.push(w[4*r+c][row]);rk.push(kk);}
  return rk;
}
function beaboxDecryptBlock(block,rk){
  var s=block.slice();
  function addRK(r){for(var i=0;i<16;i++)s[i]^=rk[r][i];}
  function invSub(){for(var i=0;i<16;i++)s[i]=BEABOX_SBOXES.inv[s[i]];}
  function invShift(){var t=s.slice();for(var r=0;r<4;r++)for(var c=0;c<4;c++)s[4*c+r]=t[4*((c-r+4)%4)+r];}
  function invMix(){for(var c=0;c<4;c++){var i=4*c,a0=s[i],a1=s[i+1],a2=s[i+2],a3=s[i+3];
    s[i]=beaboxGfMul(a0,14)^beaboxGfMul(a1,11)^beaboxGfMul(a2,13)^beaboxGfMul(a3,9);
    s[i+1]=beaboxGfMul(a0,9)^beaboxGfMul(a1,14)^beaboxGfMul(a2,11)^beaboxGfMul(a3,13);
    s[i+2]=beaboxGfMul(a0,13)^beaboxGfMul(a1,9)^beaboxGfMul(a2,14)^beaboxGfMul(a3,11);
    s[i+3]=beaboxGfMul(a0,11)^beaboxGfMul(a1,13)^beaboxGfMul(a2,9)^beaboxGfMul(a3,14);}}
  addRK(10);
  for(var round=9;round>=1;round--){invShift();invSub();addRK(round);invMix();}
  invShift();invSub();addRK(0);
  return s;
}
function beaboxHexToBytes(hex){
  var h=String(hex||'').trim();
  if(!/^[0-9a-fA-F]+$/.test(h)||h.length%2!==0)return null;
  var out=new Array(h.length/2);
  for(var i=0;i<out.length;i++)out[i]=parseInt(h.substr(i*2,2),16);
  return out;
}
function beaboxUtf8(bytes){
  var out='',i=0;
  while(i<bytes.length){
    var c=bytes[i++];
    if(c<0x80)out+=String.fromCharCode(c);
    else if((c&0xe0)===0xc0){var c2=bytes[i++];out+=String.fromCharCode(((c&0x1f)<<6)|(c2&0x3f));}
    else if((c&0xf0)===0xe0){var c2=bytes[i++],c3=bytes[i++];out+=String.fromCharCode(((c&0x0f)<<12)|((c2&0x3f)<<6)|(c3&0x3f));}
    else if((c&0xf8)===0xf0){var c2=bytes[i++],c3=bytes[i++],c4=bytes[i++];var cp=(((c&0x07)<<18)|((c2&0x3f)<<12)|((c3&0x3f)<<6)|(c4&0x3f))-0x10000;out+=String.fromCharCode(0xd800+(cp>>10),0xdc00+(cp&0x3ff));}
  }
  return out;
}
function beaboxDecryptEnvelope(hex){
  var bytes=beaboxHexToBytes(hex);
  if(!bytes||bytes.length<32||bytes.length%16!==0)throw Error('笔盒短剧返回的加密数据格式不对');
  var rk=beaboxExpandKey(beaboxHexToBytes(BEABOX_AES_KEY_HEX));
  var iv=bytes.slice(0,16),plain=[];
  for(var off=16;off<bytes.length;off+=16){
    var block=beaboxDecryptBlock(bytes.slice(off,off+16),rk);
    for(var i=0;i<16;i++)plain.push(block[i]^iv[i]);
    iv=bytes.slice(off,off+16);
  }
  var pad=plain[plain.length-1];
  if(pad<1||pad>16)throw Error('笔盒短剧返回的加密数据解密失败');
  for(var j=0;j<pad;j++)if(plain[plain.length-1-j]!==pad)throw Error('笔盒短剧返回的加密数据解密失败');
  var text=beaboxUtf8(plain.slice(0,plain.length-pad));
  try{return JSON.parse(text);}catch(_){return text;}
}

/* 跳转页解出的 10 个候选域（2026-11-12 实测，bh4066/bh4254/bh6831 的 /api 均已验证）。
 * beabox.live 与 bihe347.com 的 /api 实测 404，故不列入 API 轮换。 */
var BEABOX_API_HOSTS=['bh4066.top','bh4254.top','bh4287.top','bh4362.top','bh4549.top','bh5530.top','bh6246.top','bh6291.top','bh6429.top','bh6831.top'];
var beaboxApiHost='';
async function siteApi(path){
  if(!beaboxApiHost){try{beaboxApiHost=await CCTVStorage.get('apiHost')||'';}catch(_){beaboxApiHost='';}}
  var hosts=[];
  if(beaboxApiHost)hosts.push(beaboxApiHost);
  for(var i=0;i<BEABOX_API_HOSTS.length;i++)if(hosts.indexOf(BEABOX_API_HOSTS[i])<0)hosts.push(BEABOX_API_HOSTS[i]);
  var lastErr=null;
  for(var h=0;h<hosts.length;h++){
    var url='https://'+hosts[h]+'/api'+path;
    try{
      var r=await CCTVHttp.get(url,{headers:{'User-Agent':UA,'Accept':'application/json'},timeout:10000});
      var body=r.data;
      if(!body||typeof body!=='object')throw Error('返回不是 JSON');
      if(body.code!==200)throw Error('接口返回 '+(body.code||'')+' '+siteText(body.msg||''));
      var data=body.data;
      if(typeof data==='string'){
        if(!data)throw Error('接口返回空数据');
        data=beaboxDecryptEnvelope(data);
      }
      beaboxApiHost=hosts[h];
      try{await CCTVStorage.set('apiHost',hosts[h]);}catch(_){}
      return data;
    }catch(e){lastErr=e;}
  }
  throw Error('笔盒短剧当前域名均不可达（'+(lastErr&&lastErr.message||'网络失败')+'）');
}

/* 封面：只取直出图片地址；.txt 密文封面（需站内 XOR 解密成 blob）留空，不伪造。 */
var IMAGE_EXT=/\.(jpe?g|png|webp|gif)(\?|#|$)/i;
function siteCover(v){
  var u=siteSafeURL(siteGet(v,['vodPic','vodPicSlide']));
  if(!u||!IMAGE_EXT.test(u))return '';
  return u;
}
function siteCard(v){
  if(!v||typeof v!=='object')return null;
  var id=String(siteGet(v,['vodId','id'])||'');
  if(!siteIdOK(id))return null;
  var title=siteText(v.vodName);if(!title)return null;
  var link=siteLink('vod',{id:id});
  var classes=siteArray(v.vodClass).map(siteText).filter(Boolean);
  var desc=classes.join(' · ');
  if(v.heatValue)desc+=(desc?' · ':'')+'热度 '+(v.heatValue||'');
  return {id:link,type:'url',link:link,title:title,coverUrl:siteCover(v),posterPath:siteCover(v),
    description:desc,mediaType:'movie',labels:classes.slice(0,4).map(function(n){return {name:n};})};
}
function siteTopicCard(t){
  if(!t||typeof t!=='object')return null;
  var id=String(siteGet(t,['topicId','id'])||'');
  if(!siteIdOK(id))return null;
  var title=siteText(t.topicName);if(!title)return null;
  var link=siteLink('topic',{id:id});
  var vods=siteArray(t.relatedVods),cover='';
  for(var i=0;i<vods.length&&!cover;i++)cover=siteCover(vods[i]);
  return {id:link,type:'url',link:link,title:title,coverUrl:cover,posterPath:cover,
    description:'专题 · '+vods.length+' 条',mediaType:'tv',labels:[]};
}
async function loadHome(){
  var data=await siteApi('/vod/recommend');
  return siteArray(data&&data.data||data).map(siteCard).filter(Boolean).slice(0,20);
}
async function loadCatalog(p){
  p=p||{};var cid=String(p.channelId||'latest'),page=sitePage(p.page);
  if(cid==='recommend'){
    if(page>1)return [];
    var rec=await siteApi('/vod/recommend');
    return siteArray(rec&&rec.data||rec).map(siteCard).filter(Boolean).slice(0,20);
  }
  if(cid==='topics'){
    var topics=await siteApi('/topic/list?page='+page+'&limit=20&sortBy=topicSort&sortOrder=ASC&vodLimit=10');
    return siteArray(topics&&topics.data||topics).map(siteTopicCard).filter(Boolean);
  }
  var latest=await siteApi('/vod/latest?page='+page+'&limit=20');
  return siteArray(latest&&latest.data||latest).map(siteCard).filter(Boolean);
}
async function search(p){
  p=p||{};var kw=siteText(p.keyword);if(!kw)return [];
  var page=sitePage(p.page);
  var data=await siteApi('/vod/search?keyword='+encodeURIComponent(kw)+'&page='+page+'&limit=20&sort=latest');
  return siteArray(data&&data.data||data).map(siteCard).filter(Boolean).slice(0,60);
}
async function loadDetail(link){
  link=typeof link==='string'?link:String(link&&link.link||'');
  if(link.indexOf('/topic?')>=0){
    var tid=siteQueryValue(link,'id');
    if(!siteIdOK(tid))throw Error('影片链接不属于'+Source.name);
    var topic=await siteApi('/topic/detail/'+encodeURIComponent(tid)+'?vodPage=1&vodLimit=20');
    var tname=siteText(topic.topicName);if(!tname)throw Error(Source.name+'未找到该专题');
    var cardLink=siteLink('topic',{id:tid});
    var eps=siteArray(topic.relatedVods).map(function(v){
      var c=siteCard(v);if(!c)return null;
      return {id:c.link,type:'url',link:c.link,title:c.title,coverUrl:c.coverUrl,
        childItems:[{id:c.link,type:'url',link:c.link,title:'笔盒 · '+c.title}]};
    }).filter(Boolean);
    return {id:cardLink,type:'url',link:cardLink,title:tname,coverUrl:eps.length?eps[0].coverUrl:'',posterPath:eps.length?eps[0].coverUrl:'',description:'专题',mediaType:'tv',labels:[],episodeItems:eps};
  }
  var id=siteQueryValue(link,'id');
  if(!siteIdOK(id))throw Error('影片链接不属于'+Source.name);
  var d=await siteApi('/vod/detail/'+encodeURIComponent(id));
  var title=siteText(d.vodName);if(!title)throw Error(Source.name+'未找到该影片');
  var cardLink2=siteLink('vod',{id:id});
  var classes=siteArray(d.vodClass).map(siteText).filter(Boolean);
  var desc=classes.join(' · ');
  if(d.heatValue)desc+=(desc?' · ':'')+'热度 '+d.heatValue;
  if(d.rating)desc+=(desc?' · ':'')+'评级 '+siteText(d.rating);
  var card={id:cardLink2,type:'url',link:cardLink2,title:title,coverUrl:siteCover(d),posterPath:siteCover(d),
    description:desc,mediaType:'movie',labels:classes.slice(0,4).map(function(n){return {name:n};})};
  var groups=(d.vodPlaySource&&typeof d.vodPlaySource==='object')?d.vodPlaySource:{};
  var children=[];
  Object.keys(groups).forEach(function(g){
    siteArray(groups[g]).forEach(function(src){
      var flag=siteText(src.flag)||'播放源';
      var plink=siteLink('play',{vodId:id,flag:flag});
      children.push({id:plink,type:'url',link:plink,title:flag+' · 正片'});
    });
  });
  if(!children.length){
    var plink0=siteLink('play',{vodId:id,flag:'正片'});
    children.push({id:plink0,type:'url',link:plink0,title:'正片 · 正片'});
  }
  card.episodeItems=[{id:cardLink2,type:'url',link:cardLink2,title:'正片',coverUrl:card.coverUrl,childItems:children}];
  return card;
}
async function resolveResource(p){
  /* 详情接口直接返回公开直链 m3u8（vodPlaySource.playUrl，needParse=false），
   * 无登录/签名/付费，与黑桃站同属可公开播放，照实返回，不伪造地址。 */
  p=typeof p==='string'?{link:p}:p||{};
  var link=String(p.link||p.id||'');
  var vodId=siteQueryValue(link,'vodId'),flag=siteQueryValue(link,'flag');
  if(!siteIdOK(vodId))throw Error('请选择'+Source.name+'中的影片分集');
  var d=await siteApi('/vod/detail/'+encodeURIComponent(vodId));
  var groups=(d.vodPlaySource&&typeof d.vodPlaySource==='object')?d.vodPlaySource:{};
  var url='',name=flag||'原站线路';
  Object.keys(groups).forEach(function(g){
    siteArray(groups[g]).forEach(function(src){
      var f=siteText(src.flag)||'播放源';
      if((!flag||f===flag)&&!url){
        var u=siteSafeURL(String(src.playUrl||src.url||''));
        if(u){url=u;name=f;}
      }
    });
  });
  if(!url)throw Error(Source.name+'未找到公开播放地址');
  return [{name:name,url:url,playerType:'app',customHeaders:{Referer:'https://'+(beaboxApiHost||BEABOX_API_HOSTS[0])+'/'}}];
}

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
  var classes=cctvCatVodClasses(),items;
  items=await loadHome({});
  return {class:classes,list:cctvCatVodCards(items)};
}
async function cctvCatVodCategory(tid,page,filter,extend){
  var id=String(tid||''),current=Math.max(1,Math.floor(Number(page)||1)),items,maxPage=0;
  items=await loadCatalog({channelId:id,page:current});
  return cctvCatVodPage(items,current,maxPage);
}
async function cctvCatVodSearch(keyword,quick,page){
  return cctvCatVodPage(await search({keyword:String(keyword||''),page:Math.max(1,Math.floor(Number(page)||1))}),page);
}
async function cctvCatVodDetail(ids){
  var id=Array.isArray(ids)?ids[0]:ids,detail=await loadDetail(String(id||''));
  var groups=cctvCatVodGroups(detail);
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
