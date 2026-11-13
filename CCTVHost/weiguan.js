// Standalone 围观短剧 adapter. Public JSON API observed on api.drama.9ddm.com, 2026-11-13.
// Decompiled from Lcom/github/catvod/spider/ShortWeiguan (spider.jar): there is NO request
// signature. init() only builds clientInfo = MD5-hex of a random 10-char alphanumeric
// string; device_name/device_owning_firm are the device model/brand. All endpoints are
// plain GET / POST JSON with those fingerprint query params. No account credentials.
var Source={id:'weiguan',name:'围观短剧',origin:'https://api.drama.9ddm.com'};
var CCTVHostMetadata={id:'joeshu.weiguan',title:'围观短剧',author:'joeshu',site:Source.origin,version:'0.1.0',requiredVersion:'0.0.1',description:'围观短剧：标签分类、搜索、完整分集与多清晰度直连。',detailCacheDuration:0,
 modules:[{id:'home',title:'首页推荐',functionName:'loadHome',cacheDuration:300,params:[]},
 {id:'catalog',title:'分类片库',functionName:'loadCatalog',cacheDuration:60,params:[{name:'channelId',title:'标签',type:'enumeration',value:'全部',enumOptions:[{title:'全部',value:'全部'},{title:'逆袭',value:'逆袭'},{title:'都市',value:'都市'},{title:'家庭',value:'家庭'},{title:'古装',value:'古装'},{title:'复仇',value:'复仇'},{title:'正能量',value:'正能量'},{title:'爱情',value:'爱情'},{title:'动漫',value:'动漫'},{title:'穿越',value:'穿越'},{title:'重生',value:'重生'},{title:'甜宠',value:'甜宠'},{title:'奇幻',value:'奇幻'},{title:'虐恋',value:'虐恋'},{title:'乡村',value:'乡村'},{title:'职场',value:'职场'},{title:'悬疑',value:'悬疑'},{title:'年代',value:'年代'},{title:'异能',value:'异能'},{title:'总裁',value:'总裁'},{title:'修仙',value:'修仙'},{title:'战神',value:'战神'},{title:'萌宝',value:'萌宝'},{title:'神豪',value:'神豪'},{title:'宫廷',value:'宫廷'},{title:'喜剧',value:'喜剧'},{title:'青春',value:'青春'},{title:'科幻',value:'科幻'},{title:'武侠',value:'武侠'},{title:'神医',value:'神医'},{title:'赘婿',value:'赘婿'}]},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'searchList',title:'搜索短剧',functionName:'search',cacheDuration:0,params:[{name:'keyword',title:'剧名',type:'input',description:'例如：重生'},{name:'page',title:'页码',type:'page',value:'1'}]},
 {id:'resolveResource',title:'播放线路',type:'stream',functionName:'resolveResource',cacheDuration:0,params:[]}],
 search:{title:'围观短剧搜索',functionName:'search',params:[{name:'keyword',title:'剧名',type:'input'},{name:'page',title:'页码',type:'page',value:'1'}]}};
// Pure-JS MD5 (no node builtins in the CCTVHost sandbox).
function wgMd5(str){
 function rl(n,c){return (n<<c)|(n>>>(32-c));}
 function add(x,y){var l=(x&0xffff)+(y&0xffff),m=(x>>16)+(y>>16)+(l>>16);return (m<<16)|(l&0xffff);}
 function f(q,a,b,c,x,s,t){return add(rl(add(add(a,q),add(x,t)),s),b);}
 function ff(a,b,c,d,x,s,t){return f((b&c)|(~b&d),a,b,c,x,s,t);}
 function gg(a,b,c,d,x,s,t){return f((b&d)|(c&~d),a,b,c,x,s,t);}
 function hh(a,b,c,d,x,s,t){return f(b^c^d,a,b,c,x,s,t);}
 function ii(a,b,c,d,x,s,t){return f(c^(b|~d),a,b,c,x,s,t);}
 var u=unescape(encodeURIComponent(str)),bytes=[];
 for(var i=0;i<u.length;i++)bytes.push(u.charCodeAt(i));
 var bitLen=bytes.length*8;
 bytes.push(0x80);while(bytes.length%64!==56)bytes.push(0);
 for(i=0;i<8;i++)bytes.push(Math.floor(bitLen/Math.pow(2,i*8))&255);
 var w=[];for(i=0;i<bytes.length;i++)w[i>>2]=(w[i>>2]|0)|(bytes[i]<<((i%4)*8));
 var a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 for(var off=0;off<w.length;off+=16){
  var a=a0,b=b0,c=c0,d=d0;
  a=ff(a,b,c,d,w[off+0],7,0xd76aa478);d=ff(d,a,b,c,w[off+1],12,0xe8c7b756);c=ff(c,d,a,b,w[off+2],17,0x242070db);b=ff(b,c,d,a,w[off+3],22,0xc1bdceee);
  a=ff(a,b,c,d,w[off+4],7,0xf57c0faf);d=ff(d,a,b,c,w[off+5],12,0x4787c62a);c=ff(c,d,a,b,w[off+6],17,0xa8304613);b=ff(b,c,d,a,w[off+7],22,0xfd469501);
  a=ff(a,b,c,d,w[off+8],7,0x698098d8);d=ff(d,a,b,c,w[off+9],12,0x8b44f7af);c=ff(c,d,a,b,w[off+10],17,0xffff5bb1);b=ff(b,c,d,a,w[off+11],22,0x895cd7be);
  a=ff(a,b,c,d,w[off+12],7,0x6b901122);d=ff(d,a,b,c,w[off+13],12,0xfd987193);c=ff(c,d,a,b,w[off+14],17,0xa679438e);b=ff(b,c,d,a,w[off+15],22,0x49b40821);
  a=gg(a,b,c,d,w[off+1],5,0xf61e2562);d=gg(d,a,b,c,w[off+6],9,0xc040b340);c=gg(c,d,a,b,w[off+11],14,0x265e5a51);b=gg(b,c,d,a,w[off+0],20,0xe9b6c7aa);
  a=gg(a,b,c,d,w[off+5],5,0xd62f105d);d=gg(d,a,b,c,w[off+10],9,0x02441453);c=gg(c,d,a,b,w[off+15],14,0xd8a1e681);b=gg(b,c,d,a,w[off+4],20,0xe7d3fbc8);
  a=gg(a,b,c,d,w[off+9],5,0x21e1cde6);d=gg(d,a,b,c,w[off+14],9,0xc33707d6);c=gg(c,d,a,b,w[off+3],14,0xf4d50d87);b=gg(b,c,d,a,w[off+8],20,0x455a14ed);
  a=gg(a,b,c,d,w[off+13],5,0xa9e3e905);d=gg(d,a,b,c,w[off+2],9,0xfcefa3f8);c=gg(c,d,a,b,w[off+7],14,0x676f02d9);b=gg(b,c,d,a,w[off+12],20,0x8d2a4c8a);
  a=hh(a,b,c,d,w[off+5],4,0xfffa3942);d=hh(d,a,b,c,w[off+8],11,0x8771f681);c=hh(c,d,a,b,w[off+11],16,0x6d9d6122);b=hh(b,c,d,a,w[off+14],23,0xfde5380c);
  a=hh(a,b,c,d,w[off+1],4,0xa4beea44);d=hh(d,a,b,c,w[off+4],11,0x4bdecfa9);c=hh(c,d,a,b,w[off+7],16,0xf6bb4b60);b=hh(b,c,d,a,w[off+10],23,0xbebfbc70);
  a=hh(a,b,c,d,w[off+13],4,0x289b7ec6);d=hh(d,a,b,c,w[off+0],11,0xeaa127fa);c=hh(c,d,a,b,w[off+3],16,0xd4ef3085);b=hh(b,c,d,a,w[off+6],23,0x04881d05);
  a=hh(a,b,c,d,w[off+9],4,0xd9d4d039);d=hh(d,a,b,c,w[off+12],11,0xe6db99e5);c=hh(c,d,a,b,w[off+15],16,0x1fa27cf8);b=hh(b,c,d,a,w[off+2],23,0xc4ac5665);
  a=ii(a,b,c,d,w[off+0],6,0xf4292244);d=ii(d,a,b,c,w[off+7],10,0x432aff97);c=ii(c,d,a,b,w[off+14],15,0xab9423a7);b=ii(b,c,d,a,w[off+5],21,0xfc93a039);
  a=ii(a,b,c,d,w[off+12],6,0x655b59c3);d=ii(d,a,b,c,w[off+3],10,0x8f0ccc92);c=ii(c,d,a,b,w[off+10],15,0xffeff47d);b=ii(b,c,d,a,w[off+1],21,0x85845dd1);
  a=ii(a,b,c,d,w[off+8],6,0x6fa87e4f);d=ii(d,a,b,c,w[off+15],10,0xfe2ce6e0);c=ii(c,d,a,b,w[off+6],15,0xa3014314);b=ii(b,c,d,a,w[off+13],21,0x4e0811a1);
  a=ii(a,b,c,d,w[off+4],6,0xf7537e82);d=ii(d,a,b,c,w[off+11],10,0xbd3af235);c=ii(c,d,a,b,w[off+2],15,0x2ad7d2bb);b=ii(b,c,d,a,w[off+9],21,0xeb86d391);
  a0=add(a0,a);b0=add(b0,b);c0=add(c0,c);d0=add(d0,d);
 }
 function hex(n){var s='';for(var j=0;j<4;j++)s+=('0'+((n>>>(j*8))&0xff).toString(16)).slice(-2);return s;}
 return hex(a0)+hex(b0)+hex(c0)+hex(d0);
}
var WG={site:'https://api.drama.9ddm.com',ua:'okhttp/5.1.0',
 clientInfo:(function(){var chars='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',s='';for(var i=0;i<10;i++)s+=chars.charAt(Math.floor(Math.random()*62));return wgMd5(s);})()};
function wgFp(){return '?version_code=1600&version_name=1.6.0&device_name=iPhone&device_type=phone&is_first_day=true&is_first_24h=true&app_launch_way=icon&default_homepage=homepage_interaction&device_owning_firm=Apple&font_scale=default&os_type=1&clientInfo='+WG.clientInfo;}
function wgText(s){return String(s==null?'':s).replace(/<[^>]*>/g,'').trim();}
function wgPage(p){var n=Number(p||1);if(!Number.isSafeInteger(n)||n<1||n>500)throw new Error('页码无效');return n;}
function wgData(r){
 var s=r.statusCode||r.status,d=r.data;
 if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){throw new Error('围观短剧返回了无效数据，请稍后重试');}}
 if(s<200||s>=300||!d||(d.code!=null&&d.code!==200))throw new Error('围观短剧接口暂不可用（HTTP '+s+(d&&d.msg?'：'+wgText(d.msg):'')+'）');
 return d;
}
async function wgSearch(body){
 var r=await CCTVHttp.post(WG.site+'/drama/home/search'+wgFp(),JSON.stringify(body),{headers:{'User-Agent':WG.ua,'Content-Type':'application/json'}});
 var d=wgData(r);
 if(!Array.isArray(d.data))throw new Error('围观短剧片单格式异常');
 return d.data;
}
function wgCard(d){
 if(!d||!d.oneId||!d.title)throw new Error('围观短剧片单格式异常');
 var link=WG.site+'/drama/'+d.oneId,poster=wgText(d.horzPoster||d.vertPoster||'');
 return {id:link,type:'url',link:link,title:wgText(d.title),coverUrl:poster,posterPath:poster,mediaType:'tv',
  genreTitle:(Array.isArray(d.shortPlayTag)?d.shortPlayTag:[]).map(wgText).join(' / '),
  description:[wgText(d.description),d.episodeCount?('共 '+d.episodeCount+' 集'):'' ].filter(Boolean).join(' · ')};
}
async function loadHome(params){
 return (await wgSearch({audience:'全部',order:'最新',page:1,pageSize:30,searchWord:'',subject:''})).map(wgCard);
}
async function loadCatalog(params){
 params=params||{};var tag=String(params.channelId||'全部');
 return (await wgSearch({audience:'全部',order:'最新',page:wgPage(params.page),pageSize:30,searchWord:'',subject:tag==='全部'?'':tag})).map(wgCard);
}
async function search(params){
 params=params||{};var kw=wgText(params.keyword).replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
 if(!kw)return [];if(kw.length>200)throw new Error('剧名过长');
 return (await wgSearch({audience:'',order:'',page:wgPage(params.page),pageSize:30,searchWord:kw,subject:''})).map(wgCard);
}
async function wgDetail(oneId){
 var r=await CCTVHttp.get(WG.site+'/drama/home/shortVideoDetail'+wgFp()+'&oneId='+encodeURIComponent(oneId)+'&page=1&pageSize=1000&userId=0&queryAll=true',{headers:{'User-Agent':WG.ua}});
 var d=wgData(r);
 if(!d||!d.title||!Array.isArray(d.data))throw new Error('围观短剧详情格式异常');
 return d;
}
async function loadDetail(link){
 var m=String(link||'').match(/\/drama\/(\d+)$/);
 if(!m)throw new Error('请选择围观短剧组件内的影片');
 var d=await wgDetail(m[1]),oneId=m[1];
 var item={id:link,type:'url',link:link,title:wgText(d.title),coverUrl:wgText(d.vertPoster||d.horzPoster||''),posterPath:wgText(d.vertPoster||d.horzPoster||''),mediaType:'tv',
  genreTitle:(Array.isArray(d.shortPlayTag)?d.shortPlayTag:[]).map(wgText).join(' / '),
  description:[wgText(d.description),d.totalEpisodeCount?('共 '+d.totalEpisodeCount+' 集'):'' ].filter(Boolean).join(' · '),
  episodeItems:d.data.map(function(ep){
   var order=String(ep.playOrder==null?'':ep.playOrder),l=WG.site+'/drama/'+oneId+'/episode/'+order;
   return {id:l,type:'url',link:l,title:wgText(ep.title)||('第'+order+'集'),coverUrl:wgText(d.vertPoster||''),mediaType:'tv'};
  })};
 if(!item.episodeItems.length)throw new Error('该短剧暂无可选分集');
 return item;
}
function wgBestClarity(list){
 if(!Array.isArray(list)||!list.length)return null;
 var rank={'1080P':4,'720P':3,'480P':2,'360P':1},best=null,bestScore=-1;
 list.forEach(function(c){if(!c||!/^https?:\/\//.test(c.url||''))return;var score=rank[c.name]||0;if(score>bestScore){bestScore=score;best=c;}});
 return best||list[0];
}
async function resolveResource(params){
 params=params||{};var m=String(params.link||params.id||'').match(/\/drama\/(\d+)\/episode\/(\d+)$/);
 if(!m)throw new Error('请选择围观短剧组件内的分集');
 // Re-fetch detail so the signed clarity URLs are fresh (they carry timestamp+sign).
 var d=await wgDetail(m[1]),ep=null;
 d.data.forEach(function(e){if(String(e.playOrder)===m[2])ep=e;});
 if(!ep)throw new Error('该短剧中未找到所选分集');
 var best=wgBestClarity(ep.videoClarityList||ep.video264ClarityList);
 if(!best||!/^https?:\/\//.test(best.url||''))throw new Error('该分集暂无可播放地址');
 return [{name:wgText(best.name)||'播放',url:best.url}];
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
