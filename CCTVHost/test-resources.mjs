import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const CryptoJS=require('../ios-app/Web/vendor/crypto-js.js');
const names=['kkapp','ncat','happ','yqk','qntv','dyls','souju','kanju'];
/* 2026-11-12 曾新增青空次元（仅非成人分类，播放未提供），同批的韩小圈、
 * 红果短剧已于 2026-11-13 按用户要求从订阅移除；青空次元亦于同日移除。
 * 13 个已删适配器文件已从仓库删除，只能从 git 历史找回。 */
/* 2026-11-13 新增 8 站（初忆 TVBox 配置实测）：特狗、饭搭子、热剧 TV、
 * 农民影视、映像星球、荐片、4K 影视、洛雪 TV；同日又加片帝（懂片帝，
 * HMAC-SHA256 签名已从 JAR 还原并实测走通整条链）。 */
/* 2026-11-13 新增 15 站（TVBoxOSC 20261109.zip 实测）：华谊、布布、
 * 马猴影视、快映fox、稀饭、吉里动漫、花子动漫、三六零、骚火影视、
 * 枫叶影视、爱看机器人、双星、星辰影视、番社动漫、剧圈影视。
 * 电影天堂未加：HyProto 协议已还原，但服务端 RSA 公钥已轮换，
 * zone 回 100002，适配器文件暂存工作区未入库；苹果与已上架的
 * 小苹果是同一后端，不重复加；茉莉只有网盘链接，未写适配器。
 * 同日晚按用户要求剔除其中 8 站（浏览型/未通）：马猴影视、三六零、
 * 快映fox、骚火影视、枫叶影视、双星、稀饭、剧圈影视；保留 7 站。
 * 2026-11-14 凌晨新增 12 站（TVBoxOSC 第二批，签名缺口已逐个还原）：
 * 王子、茉莉Get、剧圈99、半日99、一起影视、韩圈、戏曲多多、围观短剧、
 * 好看短剧、巴士动漫、咕噜（APP）、河马短剧。热播影视、蓝鸟、蓝鹰、
 * 飞娱只跑通 mock（host 本机不通），文件暂存工作区未入库；1905、
 * 厂长影视、果果短剧、橘汁 AppDrama、瓜子影视 native 未解出。
 * 2026-11-14 1905 应用户要求直接装入订阅（m1905.js），由用户 iPhone 实测播放。 */
const newNames=['tegou','fdzy','rejutv','nongmin','yingxiang','jianpian','sikv4k','luoxue','piandi','hetun','xpg','huayi','bubu','huazi','ikanbot','jili','xingchen','fanshe','wangzi','juquan99','banri99','yiqi','hanquan','xiqu','weiguan','bashi','guluapp','hema','m1905'];
/* 2026-11-12 曾新增 7 组站的 10 个 18+ 成人适配器（黑桃/鬼片/野果/剧果/
 * 禁果/笔盒/黄果/红果黄剧/黄果剧场/帝果），2026-11-13 按用户要求全部从订阅
 * 移除；适配器文件已于同日从仓库删除，只能从 git 历史找回。 */
const adultNames=[];
/* 2026-11-14 新增 119 站（py400.zip：首轮 WORKING 9 站 + 顺序重测翻成
 * WORKING 的 30 站 + 深挖翻成 WORKING 的 34 站 + 播放地址真实但本机
 * CDN 被挡、需 iPhone 验证的 NEEDS_PHONE 46 站；订阅显示名按验证状态
 * 加前缀：[通过] 73 站、[需手机测] 46 站；其中大马猴、野果短剧、
 * 可可、可可影视经用户明确解禁加回；与订阅同名的站（多多影视、
 * 茶杯狐、麒麟影视、哔哩直播）靠 [通过] 前缀区分；看剧AI 有两个
 * 不同文件，[影]看剧AI.py 用 [通过]看剧AI，看剧AI.py 用 [通过]看剧AI2。） */
const pythonSources=[
  ['duoduo','多多影视'],['fengshang','风尚影视'],['junnian','君念影院'],
  ['chabeihu','茶杯狐'],['dida','嘀嗒影视'],['douhua','豆花影视'],
  ['qilin','麒麟影视'],['nunu','努努影院'],['ystj','影视追剧'],
  ['dsxys8','大师兄影音'],['aigua','爱瓜TV'],['bubuzhuiju','布布追剧'],
  ['shortfilm','短剧'],['qixing','七星短剧'],['qimao','七猫短剧'],
  ['shijietingshu','世界听书'],['juxiafan','剧下饭'],['gulu','咕噜'],
  ['bilizhibo','哔哩直播'],['duoduo1920','多多1920'],['yangkuyun','央库云'],
  ['yangshi','央视'],['yangshiyingshi','央视影视'],['miaokan','妙看'],
  ['yingtan4k','影探4K'],['xingya','星芽短剧'],['guazi','瓜子影视'],
  ['juzi','橘汁'],['1234yingshi','[需手机测]1234影视'],['275tingshu','[需手机测]275听书'],
  ['28duanju','[通过]28短剧'],['57duanju','[通过]57短剧'],['618','[通过]618'],
  ['99yingshitv261030','[需手机测]99影視TV261030'],['aikanjiqiren','[通过]爱看机器人'],['animesex','[通过]AnimeSex'],
  ['av123','[需手机测]av123'],['avgc9','[通过]AVGC9'],['avjoy','[通过]avjoy'],
  ['baipiaozhiwang','[通过]白嫖之王'],['bajieyingshi','[需手机测]八戒影视'],['bilibili','[需手机测]bilibili'],
  ['bilizhibo2','[通过]哔哩直播'],['blibli','[通过]B里B里'],['cam4zhibo','[通过]Cam4直播'],
  ['cat3movie','[通过]cat3movie'],['chabeihu2','[通过]茶杯狐'],['chiguawang','[需手机测]吃瓜网'],
  ['daishuyingshi','[需手机测]袋鼠影视'],['damahou','[通过]大马猴'],['dianyingtiantang','[需手机测]电影天堂'],
  ['diekayingshi','[需手机测]蝶卡影视'],['duanjudaquan','[需手机测]短剧大全'],['duboku','[通过]独播库'],
  ['dukoutiaoyingshi','[需手机测]毒口条影视'],['duoduoyingshi','[通过]多多影视'],['duonaoyingyuan','[需手机测]多瑙影院'],
  ['dusheyingshi','[需手机测]毒舌影视'],['elaopingguo','[通过]E佬苹果'],['epornerdazhan','[通过]eporner大站'],
  ['fandaziyingshi','[需手机测]饭搭子影视'],['fantuanyingshi','[需手机测]饭团影视'],['feifanziyuan','[需手机测]非凡资源'],
  ['feikuaitv','[需手机测]飞快TV'],['getav','[通过]getav'],['guazi2','[通过]瓜子'],
  ['guaziapp','[通过]瓜子APP'],['guoguoduanju','[通过]果果短剧'],['hamigua','[通过]哈密瓜'],
  ['hanime','[通过]hanime'],['hemaduanju','[需手机测]河马短剧'],['hemajuchang','[通过]河马剧场'],
  ['hongdouduanju','[需手机测]红豆短剧'],['huangdouduanju','[通过]黄豆短剧'],['huayiyingshi','[需手机测]华谊影视'],
  ['hudieyingyuan','[通过]蝴蝶影院'],['hudieyingyuanneizhiquguanggaoanzhuobanben','[通过]蝴蝶影院（内置去广告）安卓版本'],['javday','[通过]JavDay'],
  ['javheo','[通过]javheo'],['jingdianlaopian','[需手机测]经典老片'],['jinpaiapp','[需手机测]金牌APP'],
  ['jinpaiapphuashiyingyuan','[需手机测]金牌APP-华视影院'],['jinpaiyingyuan','[通过]金牌影院'],['jiuheyi','[通过]九合一'],
  ['juyingyunbo','[通过]巨婴云播'],['juzhishipin','[通过]橘汁视频'],['kafeizhibo','[通过]咖啡直播'],
  ['kaiduanyingshi','[通过]开端影视'],['kaixinduanju','[需手机测]开心短剧'],['kanjuai','[通过]看剧AI'],
  ['kanjuai19','[通过]看剧AI19'],['kanjuai2','[通过]看剧AI2'],['kanxiyingshi','[需手机测]看戏影视'],
  ['keke','[需手机测]可可'],['kekeyingshi','[需手机测]可可影视'],['krx18','[需手机测]krx18'],
  ['liuzhouzhangmu','[需手机测]柳州丈母'],['madouai','[通过]麻豆AI'],['maiduidui','[需手机测]埋堆堆'],
  ['mangguotv','[需手机测]芒果TV'],['meibushengshoumianfan','[需手机测]美不胜收（免翻）'],['mifan','[通过]米饭'],
  ['missavmianfan','[需手机测]Missav（免翻）'],['missavquanfenleiban','[通过]missav全分类版'],['mofayingshi','[通过]魔法影视'],
  ['nishipin','[通过]泥视频'],['niuniuduanju','[通过]牛牛短剧'],['nongminyingshi','[通过]农民影视'],
  ['pengranxindong','[通过]怦然心动'],['pianba','[通过]片吧'],['pinpornxuboliu','[通过]pinporn续播流'],
  ['pornav','[通过]pornav'],['qianqianyinle','[需手机测]千千音乐'],['qilinyingshi','[通过]麒麟影视'],
  ['qimaoduanjuviperpojie','[通过]七貓短劇VIP二破解'],['qingniuyingshi','[需手机测]青牛影视'],['qingtingfm','[通过]蜻蜓 FM'],
  ['qiyouyingyuan','[需手机测]奇优影院'],['shaonvpochu','[通过]少女破处'],['shenmidianying','[通过]神秘电影'],
  ['shenshiyingshi','[需手机测]绅士影视'],['shequ','[需手机测]社区'],['shijueyingyuan','[通过]视觉影院'],
  ['shoujizhushou','[通过]手鸡助手'],['sweetpornos','[通过]sweetpornos'],['taohuashipin','[需手机测]桃花视频'],
  ['tingyouxiaoshuo','[需手机测]听友小说'],['tmdbduoxianyingshi','[需手机测]TMDB多线影视'],['trendypornus','[通过]trendypornUS'],
  ['vporn','[需手机测]VPorn'],['wanwushequ','[通过]玩物社区'],['wanwushequt3v15','[通过]玩物社区_T3v1.5'],
  ['wushengduanju','[通过]悟圣短剧'],['xianyuyingshi','[通过]咸鱼影视'],['xiaopingguo','[通过]小苹果'],
  ['xifuduanju','[通过]喜福短剧'],['xingmengasmr','[通过]星梦Asmr'],['xinxinyingshi','[需手机测]欣欣影视'],
  ['xx9yiguoyanzheng','[通过]xx9已过验证'],['yegouxinshi','[通过]夜勾心事'],['yeguoduanju','[通过]野果短剧'],
  ['yiqishua','[通过]一起刷'],['youguanzhibo','[需手机测]油管直播'],['youtube','[通过]YouTube'],
  ['zhibo','[通过]直播'],['zhuijudaren','[通过]追剧达人'],['zip0yingshi','[需手机测]ZIP0影视']
];
const subscription=JSON.parse(fs.readFileSync(path.join(here,'For-ADM.fwd'),'utf8'));
assert.equal(subscription.widgets.length,names.length,'the unified subscription lists all eight standalone widgets');
const catalog=JSON.parse(fs.readFileSync(path.join(here,'For-ADM.json'),'utf8'));
assert.equal(catalog.sites.length,names.length+newNames.length+adultNames.length+pythonSources.length+1,'the CCTVHost catalog lists the eight existing sources, twenty-nine new SSR sources, no adult sources, one hundred and forty-seven verified Python sources, and native title index');
assert.equal(catalog.lives.length,0,'the VOD catalog does not add unrelated live subscriptions');
for(const id of names){
  const entry=catalog.sites.find(site=>site.key==='joeshu.'+id);
  assert.ok(entry,id+' is present in the CCTVHost catalog');
  assert.equal(entry.type,'script',id+' is marked as an importable script');
  assert.equal(entry.api,'https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/'+id+'.js?v=3',id+' points to its current standalone CatVod source');
  assert.equal(new URL(entry.api).pathname.split('.').pop(),'js',id+' uses an extension recognized by the CCTVHost script importer');
}
for(const id of newNames){
  const entry=catalog.sites.find(site=>site.key==='joeshu.'+id);
  assert.ok(entry,id+' is present in the CCTVHost catalog');
  assert.equal(entry.type,'script',id+' is marked as an importable script');
  assert.equal(entry.api,'https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/'+id+'.js?v=1',id+' points to its standalone CatVod source');
  assert.equal(new URL(entry.api).pathname.split('.').pop(),'js',id+' uses an extension recognized by the CCTVHost script importer');
}
for(const id of adultNames){
  const entry=catalog.sites.find(site=>site.key==='joeshu.'+id);
  assert.ok(entry,id+' is present in the CCTVHost catalog');
  assert.equal(entry.type,'script',id+' is marked as an importable script');
  assert.equal(entry.api,'https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/'+id+'.js?v=1',id+' points to its standalone CatVod source');
  assert.equal(new URL(entry.api).pathname.split('.').pop(),'js',id+' uses an extension recognized by the CCTVHost script importer');
}
for(const [id,title] of pythonSources){
  const entry=catalog.sites.find(site=>site.key==='joeshu.hawk.'+id);
  assert.ok(entry,title+' is present in the CCTVHost catalog');
  assert.equal(entry.type,'script',title+' is marked as an importable script');
  assert.equal(entry.name,title+'（PY）',title+' is labeled as a Python Spider source');
  assert.equal(entry.api,'https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/python-spiders/'+id+'.py',title+' points to its standalone Python source');
  const source=fs.readFileSync(path.join(here,'python-spiders',id+'.py'),'utf8');
  assert.match(source,/class \w*Spider\s*\(/,title+' declares a Python Spider');
  for(const method of ['homeContent','categoryContent','searchContent','detailContent','playerContent'])
    assert.match(source,new RegExp('def\\s+'+method+'\\s*\\('),title+' implements '+method);
}
const douban=catalog.sites.find(site=>site.key==='joeshu.douban-index');
assert.ok(douban,'the source JSON native Douban index is present');
assert.equal(douban.type,3,'the Douban metadata index retains TVBox type 3 for the native iOS adapter');
assert.equal(douban.api,'csp_DouDou','the Douban index does not point iOS users at the Android APK');
const makeWidgetContext=(id,respond)=>{
  const values=new Map();
  const Widget={
    http:{get:(url,options)=>respond('GET',url,options),post:(url,body,options)=>respond('POST',url,{...options,body}),request:(options)=>respond(options.method||'GET',options.url,options)},
    storage:{get:async key=>values.get(key),set:async(key,value)=>values.set(key,value),remove:async key=>values.delete(key)},
    log:()=>{}
  };
  const context={Widget,CryptoJS,console,setTimeout,clearTimeout,Promise,Date,Math,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,atob,btoa,Buffer,process,AbortController,URL,URLSearchParams};
  context.globalThis=context;
  vm.runInNewContext(fs.readFileSync(path.join(here,'widget',id+'.js'),'utf8'),context,{filename:'widget/'+id+'.js',timeout:10000});
  return context;
};

for(const id of names){
  const source=fs.readFileSync(path.join(here,'widget',id+'.js'),'utf8');
  const context=makeWidgetContext(id,async()=>{throw Error('unexpected network call');});
  const subscriptionEntry=subscription.widgets.find(widget=>widget.id==='joeshu.'+id);
  assert.equal(context.WidgetMetadata.id,'joeshu.'+id,id+' has a source-scoped identity');
  assert.ok(subscriptionEntry,id+' is present in the importable subscription');
  assert.equal(subscriptionEntry.version,context.WidgetMetadata.version,id+' subscription version matches its script');
  assert.equal(subscriptionEntry.url,'https://raw.githubusercontent.com/joeshu/For-ADM/master/CCTVHost/widget/'+id+'.js',id+' uses a direct raw GitHub URL');
  assert.equal(typeof context.loadDetail,'function',id+' exposes detail lookup');
  assert.equal(typeof context.loadResource,'function',id+' exposes CCTVHost loadResource');
  assert.ok(context.WidgetMetadata.modules.some(module=>module.type==='stream'&&module.functionName==='loadResource'),id+' registers a playback resource module');
  await assert.rejects(context.loadResource({link:'https://invalid.example/episode'}),/请选择|分集|影片|站点|资源|链接/);
  if(id==='qntv'){
    assert.match(source,/qntv\.v1\./,'QNTV stores its visitor state independently');
    assert.doesNotMatch(source,/yqk\.v2\./,'QNTV does not share YQK storage');
    assert.match(source,/0576435a23b94990806ca98e54f95adf/,'QNTV uses its own app ID');
  }
  if(id==='yqk'){
    assert.match(source,/yqk\.v2\./,'YQK retains its own storage namespace');
    assert.match(source,/function yqkRequestTimeout\(budget,fallback\)/,'YQK centralizes request timeout calculation');
    assert.match(source,/timeout:yqkRequestTimeout\(budget,15000\)/,'YQK applies the remaining playback budget to API and HLS requests');
    assert.match(source,/value:"30",enumOptions:/,'YQK defaults to the full 30-second playback budget');
  }
  if(id==='kanju'){
    assert.ok(source.includes("site:'https://ai.kanju25.com'"),'Kanju uses its current site origin');
    assert.ok(source.includes("SOUJU.site+'/player/'"),'Kanju generates player links from its independent origin');
    assert.doesNotMatch(source,/kanju3\.com/,'Kanju does not retain its stale site origin');
    assert.match(source,/kanju\.aiQuota/,'Kanju quota state is isolated from Souju');
  }
}

for(const id of ['kkapp','ncat','happ']){
  const site=JSON.parse(fs.readFileSync(path.join(here,'../ios-app/Web/sites.json'),'utf8')).find(item=>item.id===id);
  const calls=[];
  const context=makeWidgetContext(id,async(method,url,options={})=>{
    calls.push({method,url,options});
    if(url.startsWith('https://img-encrypted.example/'))return {statusCode:200,headers:{'Content-Type':'application/octet-stream','Encrypted':'1'},data:''};
    if(url.startsWith('https://img-clear.example/'))return {statusCode:200,headers:{'Content-Type':'image/webp'},data:''};
    if(url.startsWith('https://img-only-encrypted.example/'))return {statusCode:200,headers:{'Content-Type':'application/octet-stream','Encrypted':'1'},data:''};
    if(url.includes('/config/prod/appInit.html'))return {statusCode:200,data:{data:{urls:{cache:[site.origin],logic:[site.origin]},groups:[{id:'vod1',url:[{domain:'https://img-encrypted.example/vod1'},{domain:'https://img-clear.example/vod1'}]}]}}};
    if(url.includes('/v2/vod/detail.capi'))return {statusCode:200,data:{data:{id:'movie-1',title:'测试影片',imagePath:'/poster.webp',imageGroup:'vod1',playSources:[{siteId:'line-a',name:'主线路',episodeVodId:'season-1',list:[{id:'ep-1',title:'第1集'}]}]}}};
    if(url.includes('/user/anonymous'))return {statusCode:200,data:{data:{id:'guest-1',token:'guest-token'}}};
    if(url.includes('/vod/episodePlayUrl'))return {statusCode:200,data:{data:{playUrls:[{name:'主线路',url:'https://media.example/master.m3u8',headers:{'User-Agent':'fixture'}}]}}};
    throw Error('unexpected endpoint '+url);
  });
  const detail=await context.loadDetail(site.origin+'/__cctvhost__/'+id+'/vod?id=movie-1');
  assert.equal(detail.episodeItems.length,1,id+' exposes the selected episode in its detail view');
  assert.equal(detail.coverUrl,'https://img-clear.example/vod1/poster.webp',id+' skips the encrypted mirror and selects the clear image mirror');
  const probes=calls.filter(call=>call.options&&call.options.buffer===1);
  assert.equal(probes.length,2,id+' probes each image mirror once');
  assert.ok(probes.every(call=>call.options.timeout===3000),id+' bounds image mirror probes');
  assert.match(detail.episodeItems[0].link,/siteId=line-a/,id+' keeps the selected source route in the episode link');
  const link=site.origin+'/__cctvhost__/'+id+'/episode?vodId=movie-1&siteId=line-a&episodeId=ep-1';
  const resources=await context.loadResource({link});
  assert.equal(resources.length,1,id+' returns one validated media resource');
  assert.equal(resources[0].url,'https://media.example/master.m3u8');
  assert.equal(resources[0].playerType,'app');
  assert.equal(resources[0].customHeaders['User-Agent'],'fixture');
  assert.equal(resources[0].customHeaders.Referer,site.origin+'/',id+' supplies the source Referer for protected media');
  assert.ok(calls.some(call=>call.url.includes('/user/anonymous')),id+' obtains a source-local guest session');
  assert.ok(calls.some(call=>call.url.includes('/vod/episodePlayUrl')),id+' calls its own play endpoint');
}

{
  const calls=[];
  const context=makeWidgetContext('kkapp',async(method,url,options={})=>{
    calls.push({method,url,options});
    if(url.startsWith('https://img-only-encrypted.example/'))return {statusCode:200,headers:{'Content-Type':'application/octet-stream','Encrypted':'1'},data:''};
    return {statusCode:200,data:{data:{}}};
  });
  context.siteConfig={groups:[{id:'cipher-only',url:[{domain:'https://img-only-encrypted.example/vod1'}]}]};
  await context.sitePrepareImageDomains({imagePath:'/poster.webp',imageGroup:'cipher-only'});
  assert.equal(context.siteImageDomains['cipher-only'].domain,'','no encrypted mirror is selected as a displayable image');
  assert.equal(context.siteCard({id:'m1',title:'密文封面',imagePath:'/poster.webp',imageGroup:'cipher-only'}).coverUrl,'','an encrypted-only group yields a safe placeholder instead of a broken image URL');
}

{
  const calls=[];
  const context=makeWidgetContext('yqk',async(method,url,options={})=>{
    calls.push({method,url,options});
    if(url.includes('/js/baseUrlList.js'))return {statusCode:200,data:'var baseApiList = ["https://api.example"];'};
    if(method==='POST')return {statusCode:200,data:{result:true,data:{ok:true}}};
    throw Error('unexpected YQK request '+url);
  });
  const budget={deadline:Date.now()+5000,seconds:5};
  await context.apiRequest('/fixture',{},budget);
  const discovery=calls.find(call=>call.url.includes('/js/baseUrlList.js'));
  const request=calls.find(call=>call.method==='POST');
  assert.ok(discovery&&discovery.options.timeout>0&&discovery.options.timeout<=5000,'YQK base discovery is bounded by the remaining playback budget');
  assert.ok(request&&request.options.timeout>0&&request.options.timeout<=5000,'YQK API requests are bounded by the remaining playback budget');
}

for(const id of ['kkapp','ncat','happ']){
  const site=JSON.parse(fs.readFileSync(path.join(here,'../ios-app/Web/sites.json'),'utf8')).find(item=>item.id===id);
  const context=makeWidgetContext(id,async(method,url)=>{
    if(url.includes('/config/prod/appInit.html'))return {statusCode:200,data:{data:{urls:{cache:[site.origin],logic:[site.origin]}}}};
    if(url.includes('/v2/vod/detail.capi'))return {statusCode:200,data:{data:{id:'movie-1',title:'测试影片',playSources:[{siteId:'locked',name:'登录线路',needLogin:true,list:[{id:'ep-1',title:'第1集'}]}]}}};
    throw Error('locked route must fail closed');
  });
  await assert.rejects(context.loadResource({link:site.origin+'/episode?vodId=movie-1&siteId=locked&episodeId=ep-1'}),/所选线路|访客可用|失败/);
}

{
  const calls=[];
  const context=makeWidgetContext('dyls',async(method,url,options={})=>{
    calls.push({method,url,options});
    if(url.includes('/app/config'))return {statusCode:200,data:{data:{movie_screen:{filter:[]},index_top_nav:[{id:1,name:'电影'}]}}};
    if(url.includes('/movie/detail'))return {statusCode:200,data:{data:{id:'m-1',name:'测试电影',type_name:'电影',play_from:[{code:'line-a',name:'公开线路',list:[{episode_id:'e-1',episode_name:'正片',play_url:'https://media.example/movie.m3u8',ready_to_play:false}]}]}}};
    if(url.includes('/movie_addr/list'))return {statusCode:200,data:{data:[{episode_id:'e-1',episode_name:'正片',play_url:'https://media.example/movie.m3u8',ready_to_play:false}]}};
    if(url==='https://media.example/movie.m3u8')return {statusCode:200,data:'#EXTM3U\n#EXTINF:6,segment\nsegment-1.ts\n#EXT-X-ENDLIST\n'};
    throw Error('unexpected Dyls endpoint '+url);
  });
  assert.equal(typeof context.JSEncrypt,'function','Dyls bundles the RSA helper');
  const resources=await context.loadResource({link:'https://dyls1.mbxqnb.cn/__cctvhost__/dyls/episode?vodId=m-1&siteId=line-a&episodeId=e-1'});
  assert.equal(resources.length,1);
  assert.equal(resources[0].url,'https://media.example/movie.m3u8');
  assert.equal(resources[0].customHeaders.Referer,undefined,'Dyls does not invent a media Referer');
  assert.ok(calls.some(call=>call.url.includes('signature=')),'Dyls signs the original request pack');
  assert.ok(calls.some(call=>call.url==='https://media.example/movie.m3u8'&&call.options.timeout===15000),'Dyls validates direct HLS manifests with a bounded timeout');
  assert.equal(calls.filter(call=>call.url.includes('/movie_addr/parse_url')).length,0,'Dyls does not send a direct playable URL through its parser');
}

const makeCatVodContext=id=>{
  const values=new Map(),module={exports:{}};
  const context={module,exports:module.exports,CryptoJS,console,setTimeout,clearTimeout,Promise,Date,Math,
    Uint8Array,Uint16Array,Uint32Array,ArrayBuffer,TextEncoder,TextDecoder,atob,btoa,Buffer,process,
    AbortController,URL,URLSearchParams,net:{http:async()=>{throw Error('unexpected network call');}},
    local:{get:key=>values.get(String(key))||'',set:(key,value)=>values.set(String(key),value),delete:key=>values.delete(String(key))}};
  context.globalThis=context;
  const source=fs.readFileSync(path.join(here,id+'.js'),'utf8');
  const testSetter="__testSet:function(name,value){if(name==='loadHome')loadHome=value;else if(name==='loadCatalog')loadCatalog=value;else if(name==='loadCategory')loadCategory=value;else if(name==='search')search=value;else if(name==='loadDetail')loadDetail=value;else if(name==='resolveResource')resolveResource=value;else if(name==='dylEnsure')dylEnsure=value;else if(name==='dylConfig')dylConfig=value;},";
  const executable=source.replace('module.exports={','module.exports={__testHttp:CCTVHttp,__testStorage:CCTVStorage,'+testSetter);
  assert.notEqual(executable,source,id+' CommonJS module has an injectable test boundary');
  const cjsFactory=vm.runInNewContext('(function(source){return new Function("module","exports",source);})',context);
  cjsFactory(executable)(module,module.exports);
  return {context,source,plugin:context.module.exports};
};

function detectHostProtocol(source){
  const widgetExtractor=source.includes('WidgetMetadata')&&source.includes('Widget.http')&&/(?:async\s+)?function\s+loadResource\s*\(/.test(source);
  const catVodMethods=[
    /(?:(?:async\s+)?(?:home|homeContent)\s*\(|\b(?:home|homeContent)\s*:\s*(?:async\s*)?(?:function\b|\())/,
    /(?:(?:async\s+)?category\s*\(|\bcategory\s*:\s*(?:async\s*)?(?:function\b|\())/,
    /(?:(?:async\s+)?detail\s*\(|\bdetail\s*:\s*(?:async\s*)?(?:function\b|\())/,
    /(?:(?:async\s+)?play\s*\(|\bplay\s*:\s*(?:async\s*)?(?:function\b|\())/
  ].every(pattern=>pattern.test(source));
  const catVodQuickJS=catVodMethods&&(source.includes('export default')||source.includes('module.exports'));
  if(widgetExtractor)return 'widget-extractor';
  if(catVodQuickJS)return 'catvod-js';
  return 'cctvhost.media/1';
}

for(const id of [...names,...newNames,...adultNames]){
  const {context,source,plugin}=makeCatVodContext(id);
  assert.equal(detectHostProtocol(source),'catvod-js',id+' is recognized by CCTVHost as a complete CatVod JavaScript source');
  assert.doesNotMatch(source,/\brequire\s*\(\s*['"]/,id+' does not trigger a missing external Node dependency');
  for(const method of ['home','category','search','detail','play'])assert.equal(typeof plugin[method],'function',id+' exports CatVod '+method);

  const httpCalls=[];
  context.net.http=async(url,options)=>{httpCalls.push({url,options});return {code:200,headers:{'content-type':'application/json'},content:'{"ok":true}'};};
  const bridged=await plugin.__testHttp.get('https://fixture.example/api',{headers:{'X-Fixture':'yes'}});
  assert.equal(bridged.statusCode,200,id+' bridges CCTVHost net.http status');
  assert.equal(bridged.data.ok,true,id+' decodes JSON responses for the source adapters');
  assert.equal(httpCalls[0].options.headers['X-Fixture'],'yes',id+' preserves request headers');
  await plugin.__testHttp.post('https://fixture.example/api','payload',{headers:{'X-Method':'post'}});
  assert.equal(httpCalls[1].options.method,'POST',id+' bridges source POST requests');
  assert.equal(httpCalls[1].options.body,'payload',id+' preserves POST bodies');
  await plugin.__testStorage.set('fixture-key','fixture-value');
  assert.equal(await plugin.__testStorage.get('fixture-key'),'fixture-value',id+' maps persistent storage');

  const fixtureCard={id:'https://media.example/'+id+'/movie?id=movie-1',title:'测试影片',coverUrl:'https://img.example/poster.jpg',description:'测试简介'};
  const fixtureDetail={...fixtureCard,episodeItems:[{id:'https://media.example/'+id+'/episode?id=ep-1',link:'https://media.example/'+id+'/episode?id=ep-1',title:'第1集'}]};
  let categoryArgs=null,searchArgs=null;
  const mockLoadHome=async()=>[fixtureCard];
  const mockLoadCatalog=async args=>{categoryArgs=args;return [fixtureCard];};
  const mockLoadCategory=async args=>{categoryArgs=args;return [fixtureCard];};
  const mockSearch=async args=>{searchArgs=args;return [fixtureCard];};
  const mockLoadDetail=async link=>{
    if(id==='yqk'||id==='qntv'){
      if(String(link).includes('line-a'))return {...fixtureDetail,episodeItems:[{id:'https://media.example/yqk/a-1',link:'https://media.example/yqk/a-1',title:'第1集'}]};
      if(String(link).includes('line-b'))return {...fixtureDetail,episodeItems:[{id:'https://media.example/yqk/b-1',link:'https://media.example/yqk/b-1',title:'第1集'}]};
      return {...fixtureDetail,childItems:[
        {id:'https://media.example/yqk/line-a',link:'https://media.example/yqk/line-a',title:'线路A（1集）'},
        {id:'https://media.example/yqk/line-b',link:'https://media.example/yqk/line-b',title:'线路B（1集）'}]};
    }
    if(['kkapp','ncat','happ','dyls'].includes(id))return {...fixtureDetail,episodeItems:[{...fixtureDetail.episodeItems[0],childItems:[
      {id:'https://media.example/'+id+'/line-a-1',link:'https://media.example/'+id+'/line-a-1',title:'线路A · 第1集'},
      {id:'https://media.example/'+id+'/line-b-1',link:'https://media.example/'+id+'/line-b-1',title:'线路B · 第1集'}]}]};
    return fixtureDetail;
  };
  const mockResolveResource=async()=>[{url:'https://media.example/play/master.m3u8',customHeaders:{Referer:'https://media.example/'}}];
  plugin.__testSet('loadHome',mockLoadHome);
  plugin.__testSet('loadCatalog',mockLoadCatalog);
  plugin.__testSet('loadCategory',mockLoadCategory);
  plugin.__testSet('search',mockSearch);
  plugin.__testSet('loadDetail',mockLoadDetail);
  plugin.__testSet('resolveResource',mockResolveResource);
  if(id==='dyls'){
    const config={index_top_nav:[{id:1,name:'电影'}]};
    plugin.__testSet('dylConfig',config);
    plugin.__testSet('dylEnsure',async()=>config);
  }

  const home=await plugin.home(true);
  assert.equal(home.list.length,1,id+' home call returns playable cards');
  assert.equal(home.list[0].vod_name,'测试影片',id+' maps site cards to CatVod fields');
  assert.ok(Array.isArray(home.class),id+' home call returns site categories');

  const specialTypeIds={huayi:'21',bubu:'电影',fanshe:'20',jili:'20',juquan99:'20',guluapp:'movie'};
  const typeId=id==='yqk'||id==='qntv'?'2:9':(id==='souju'||id==='kanju'||id==='piandi'?'movie':(id==='hetun'?'21':(specialTypeIds[id]||'1')));
  const category=await plugin.category(typeId,'2',true,{});
  assert.equal(category.list.length,1,id+' category call returns playable cards');
  assert.equal(category.page,'2',id+' category call preserves requested page');
  assert.ok(categoryArgs,id+' category call reaches the source adapter');
  if(id==='yqk'||id==='qntv'){
    assert.equal(String(categoryArgs.parentChannelId),'2',id+' maps parent channel');
    assert.equal(String(categoryArgs.childChannelId),'9',id+' maps child category');
  }else if(id==='souju'||id==='kanju'||id==='piandi')assert.equal(categoryArgs.kind,'movie',id+' maps content kind');
  else if(id==='hetun'||id==='xpg'||id==='huayi'||id==='bubu'||id==='fanshe'||id==='wangzi'||id==='juquan99'||id==='banri99'||id==='guluapp')assert.equal(categoryArgs.kind,typeId,id+' maps content kind');
  else if(id==='jili')assert.equal(String(categoryArgs.channelId),'20',id+' maps source channel');
  else assert.equal(String(categoryArgs.channelId),'1',id+' maps source channel');

  const search=await plugin.search('关键词',false,'3');
  assert.equal(search.list.length,1,id+' search call returns playable cards');
  assert.equal(searchArgs.keyword,'关键词',id+' forwards the search query');
  assert.equal(String(searchArgs.page),'3',id+' forwards the search page');

  const detail=await plugin.detail(fixtureCard.id);
  assert.equal(detail.list.length,1,id+' detail call returns a video record');
  assert.equal(detail.list[0].vod_name,'测试影片',id+' maps detail to CatVod fields');
  assert.ok(detail.list[0].vod_play_from,id+' detail call exposes a selectable line');
  assert.ok(detail.list[0].vod_play_url.includes('$https://media.example/'),id+' detail call exposes episode routes');
  if(['kkapp','ncat','happ','dyls'].includes(id))assert.match(detail.list[0].vod_play_from,/线路A.*线路B/,id+' preserves alternate episode sources');
  if(id==='yqk'||id==='qntv')assert.match(detail.list[0].vod_play_from,/线路A.*线路B/,id+' expands top-level source routes');

  const playback=await plugin.play('线路A','https://media.example/'+id+'/episode?id=ep-1',[]);
  assert.equal(playback.parse,0,id+' marks resolved media as a direct stream');
  assert.equal(playback.url,'https://media.example/play/master.m3u8',id+' returns the source media URL');
  assert.equal(playback.header.Referer,'https://media.example/',id+' preserves media request headers');
}

console.log('CCTVHost catalog checks passed for 185 entries (including one hundred and forty-seven Python Spiders and the native Douban index); mocked Widget and CatVod flows passed for the thirty-seven JavaScript sources.');
