import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('universal/templates.json'));
function run(code,url,body,meta={}) {
 let calls=0,result,logs=0;
 vm.runInNewContext(code,{$request:{url,...meta.request},$response:{body,...meta.response},$done:r=>{calls++;result=r;},console:{log(){logs++;}}});
 assert.equal(calls,1);assert.equal(logs,0);
 return result.body===undefined?body:result.body;
}
const universal=read('universal/ad-clean.js');
test('HTML cleanup preserves similar classes and fake markup in comments and raw text',()=>{
 const protectedContent='<!-- <div class="ad-item"><video src="comment.m3u8"></video></div> -->'+
 '<script>const markup=\'<div class="ad-item">literal</div>\';const config=\'<video data-preroll-ad-url="keep">\';</script>'+
 '<style>.x:after{content:\'<div class="ad-item">style</div>\'}</style>'+
 '<textarea><div class="ad-item">text</div></textarea>'+
 '<div class="ad-item-wrapper"><video src="movie.m3u8"></video></div><div class="my-ad-item">keep</div>';
 // Actual Auete pages place quoted attributes adjacent to one another.
 const html='<html>'+protectedContent+'<div title="nested > content"class="slot ad-item active"><div>advert</div></div><video data-preroll-ad-url="ad.mp4" src="movie.m3u8"></video></html>';
 check('4kvm','https://4kvms.org/play/ep1',html,out=>{
  assert(out.includes(protectedContent));assert(!out.includes('advert'));assert(!out.includes('ad.mp4'));assert(out.includes('<video src="movie.m3u8">'));
 });
 for(const broken of ['<html><!-- unfinished <div class="ad-item">','<html><div class="ad-item"><video src="movie.m3u8">','<html><script>const fake="<div class=ad-item>"'])assert.equal(run(universal,'https://4kvms.org/play/ep1',broken),broken);
});
test('script and anchor deletion use real tags, including unquoted attributes',()=>{
 const literal='<!-- <script src="/js/mcenter/dbtl.js"></script> -->'+
 '<script>const s=\'<script src="/js/mcenter/dbtl.js">example</scriptX>\';</script>';
 const html='<html>Auete<script src="/js/common.js"></script>'+literal+'<script src=/js/mcenter/dbtl.js></script><script src="https://evil.com/js/mcenter/dbtl.js"></script></html>';
 check('auete','https://www.au1080.top/index.html',html,out=>{assert(out.includes(literal));assert(!out.includes('src=/js/mcenter/dbtl.js'));assert(out.includes('evil.com'));});
 const anchor='<html><link href="/template/buka/css"><script>const a=\'<a href="https://app2.zstv47.com/">sample</a>\';</script><a href=https://app2.zstv47.com/><span>ad</span></a><a href="/vodplay/2.html">ep2</a></html>';
 check('ycblcw','https://ycblcw.com/vodplay/1.html',anchor,out=>{assert(out.includes('sample</a>'));assert(!out.includes('<span>ad</span>'));assert(out.includes('/vodplay/2.html'));});
});
test('error statuses, response type mismatches and HTML gateway pages are preserved',()=>{
 const url='https://yz250907.7k5jb8t9.com/v2/api/vodInfo/index',body=JSON.stringify({result:true,data:{startAd:1,playerList:[]}});
 for(const status of [403,'403','502 Bad Gateway','HTTP/1.1 403 Forbidden','304 Not Modified'])assert.equal(run(universal,url,body,{response:{statusCode:status}}),body);
 assert.equal(run(universal,url,body,{response:{status:'HTTP/2 502 Bad Gateway'}}),body);
 for(const method of ['OPTIONS','options','HEAD','head'])assert.equal(run(universal,url,body,{request:{method}}),body);
 assert.equal(run(universal,url,body,{response:{headers:{'Content-Type':'text/html'}}}),body);
 for(const site of ['https://aeete.com/js/mcenter/dbtl.js','https://ycblcw.com/dedg/cs13341.js']) {
  for(const html of ['<!--gateway--><html><body>error</body></html>','\uFEFF /* gateway */ <!doctype html><html>error</html>','// gateway\n<head>error</head>'])assert.equal(run(universal,site,html),html);
  const content='temporarily unavailable';assert.equal(run(universal,site,content,{response:{headers:{'CONTENT-TYPE':'text/html; charset=utf-8'}}}),content);
 }
 check('auete','https://aeete.com/js/mcenter/dbtl.js','const markup="<html>";document.write("ad");',out=>assert(out.includes('disabled')));
});
test('Souju runtime patch requires every mandatory site exactly once',()=>{
 const r=manifest.templates.find(t=>t.id==='souju-ai').runtime;
 const source='function As(t){const marker="splash_screen player_info showcase_grid";'+r.pairs.map(p=>p[0]+';').join('')+'return "movie.m3u8"}';
 const url='https://kanju3.com/assets/movie-card-runtime-test.js';
 check('souju-ai',url,source,out=>{assert.notEqual(out,source);for(const p of r.pairs)assert(out.includes(p[1]));assert(out.includes('movie.m3u8'));});
 for(const p of r.pairs){assert.equal(run(universal,url,source.replace(p[0],'')),source.replace(p[0],''));const duplicate=source.replace(p[0],p[0]+';'+p[0]);assert.equal(run(universal,url,duplicate),duplicate);}
});
function check(template,url,body,verify){
 const independent=read(manifest.templates.find(t=>t.id===template).output.script);
 const a=run(universal,url,body),b=run(independent,url,body);
 assert.equal(a,b);verify(a);assert.equal(run(universal,url,a),a);
}
test('Auete ad loaders clear while player, episodes, history and unknown hosts stay intact',()=>{
 const ads=['tbxf','tbtl','tlbf','dibu','dbtl'];
 const player='<script src="/js/play.js"></script><iframe src="/js/player/oyun.html"></iframe><script>var player={url:"https://media.example/movie.m3u8",next:"play-0-8.html"};function openHistoryPanel(){return 1}</script><a href="play-0-8.html">下一集</a>';
 const common='<html><img alt="Auete影视网" src="/statics/picture/logo.png"><script src="/js/common.js"></script><script src="/js/function.js"></script><script src="/js/seajump.js"></script><script src="/statics/js/ditre.js"></script>';
 const html=common+ads.map((n,i)=>`<script language="javascript" src = '${i%2?'https://www.aeete.com':''}/js/mcenter/${n}.js?v=1'></script>`).join('')+'<script src="/js/mcenter/unknown.js"></script>'+player+'</html>';
 for(const host of ['aeete.com','www.aeete.com','au1080.top','www.au1080.top'])for(const path of ['/','/index.html','/Tv/riju/example/','/Tv/riju/example/play-0-7.html?from=home'])check('auete','https://'+host+path,html,out=>{
  for(const n of ads)assert(!out.includes(n+'.js'));
  assert(out.includes(player));assert(out.includes(common));assert(out.includes('/js/mcenter/unknown.js'));
 });
 check('auete','https://www.au1080.top/index.html',html.replaceAll('https://www.aeete.com','https://www.au1080.top'),out=>assert(!out.includes('/js/mcenter/dbtl.js')));
 for(const n of ads)check('auete','https://aeete.com/js/mcenter/'+n+'.js?v=1','document.write("ad");',out=>{assert(out.includes('disabled'));new vm.Script(out);});
 for(const url of ['https://aeete.com/js/common.js','https://aeete.com/js/play.js','https://aeete.com/js/mcenter/unknown.js','https://aeete.com/js/mcenter/dbtl.js.extra','https://aeete.com/movie.m3u8','https://aeete.com/go/api/dp.php?url=movie.m3u8','https://aeete.com.evil.com/','https://au1080.top.evil.com/','https://au1081.top/','https://auete.asia/','https://unrelated.com/'])assert.equal(run(universal,url,html),html);
 assert.equal(run(universal,'https://aeete.com/',html.replace('Auete','Different')),html.replace('Auete','Different'));
 const error='<html><body>Unavailable</body></html>';
 assert.equal(run(universal,'https://aeete.com/js/mcenter/dbtl.js',error),error);
 const rules=read('universal/quantumult-x-snippet.conf').split('\n').filter(l=>l.startsWith('^')).map(l=>new RegExp(l.split(' url ')[0]));
 assert(rules.some(r=>r.test('https://www.aeete.com/Tv/example/play-0-7.html')));
 for(const url of ['https://aeete.com/movie.m3u8','https://aeete.com/js/play.js','https://aeete.com.evil.com/','https://au1080.top.evil.com/','https://au1081.top/','https://auete.asia/'])assert(!rules.some(r=>r.test(url)));
});
test('generated artifacts and standalone syntax remain deterministic',()=>{
 execFileSync(process.execPath,['scripts/build-ad-clean.mjs','--check'],{cwd:root});
 for(const f of ['universal/ad-clean.js',...manifest.templates.map(t=>t.output.script)])new vm.Script(read(f));
 const revisions=new Set();for(const p of ['universal/quantumult-x-snippet.conf',...manifest.templates.map(t=>t.output.conf)])for(const m of read(p).matchAll(/ad-clean\.js\?v=([a-f0-9]+)/g))revisions.add(m[1]);assert.equal(revisions.size,1);
});
test('all API domain suffixes support known and rotated prefixes, without matching other services',()=>{
 const t=manifest.templates.find(t=>t.id==='yqk-qntv');
 const conf=read('universal/quantumult-x-snippet.conf'),rules=conf.split('\n').filter(l=>l.startsWith('^')).map(l=>new RegExp(l.split(' url ')[0]));
 for(const suffix of t.bindings[0].domains.suffixes)for(const prefix of ['yz250907','yz1018','yzy0916','yz261011']) {
  const url='https://'+prefix+'.'+suffix+'/v2/api/basic/init';assert(rules.some(r=>r.test(url)));
  const data={result:true,data:{startAdList:[{id:1}],startAdShowTime:9,channeList:[{id:2}]}};
  check('yqk-qntv',url,JSON.stringify(data),out=>{const p=JSON.parse(out);assert.deepEqual(p.data.startAdList,[]);assert.equal(p.data.startAdShowTime,0);assert.deepEqual(p.data.channeList,data.data.channeList);});
 }
 for(const url of ['https://yz261011.unrelated.com/v2/api/basic/init','https://yz261011.bzy42ezt.com.evil.com/v2/api/basic/init','https://evil.bzy42ezt.com/v2/api/basic/init','https://souju.ai/v10/app/config'])assert(!rules.some(r=>r.test(url)));
 assert(rules.some(r=>r.test('https://souju.ai/v1/app/experience?x=1')));
});
test('YQK ad fields, external shortcuts and supplemental ad lists clear, playback data remain',()=>{
 const base='https://yz250907.7k5jb8t9.com/v2/api/';
 const cases=[['adInfo/getPageAd',{floatAd:{id:1},popupAd:{id:2},other:5},d=>{assert.equal(d.floatAd,null);assert.equal(d.popupAd,null);assert.equal(d.other,5);}],['adInfo/getChatAd',[{id:1}],d=>assert.deepEqual(d,[])],['adInfo/getTopicAd',{topicAdList:[1],vodList:[3]},d=>{assert.deepEqual(d.topicAdList,[]);assert.deepEqual(d.vodList,[3]);}],['adInfo/getTextAd',{title:'ad'},d=>assert.equal(d,null)],['vodInfo/getVodPauseAd',{title:'ad'},d=>assert.equal(d,null)],['vodInfo/getVodBodyAd',[{id:1}],d=>assert.deepEqual(d,[])],['adInfo/getSearchAd',[1],d=>assert.deepEqual(d,[])],['adInfo/getUserCenterAd',[1],d=>assert.deepEqual(d,[])],['home/body',{adList:[1],vodTopicList:[3]},d=>{assert.deepEqual(d.adList,[]);assert.deepEqual(d.vodTopicList,[3]);}],['home/firstScreen',{focusAdList:[1],hotMudleList:[1,2,8,10,11,3,4,5,6,7,9].map(adAction=>({adAction})),hotVodList:[90]},d=>{assert.deepEqual(d.focusAdList,[]);assert.deepEqual(d.hotMudleList.map(x=>x.adAction),[3,4,5,6,7,9]);assert.deepEqual(d.hotVodList,[90]);}],['vodInfo/index',{startAd:{id:1},playerList:[{url:'https://media.example/movie.m3u8',episodes:[1,2]}],vipOnly:true},d=>{assert.equal(d.startAd,null);assert.equal(d.playerList[0].url,'https://media.example/movie.m3u8');assert.deepEqual(d.playerList[0].episodes,[1,2]);assert.equal(d.vipOnly,true);}]];
 for(const [ep,data,verify]of cases)check('yqk-qntv',base+ep,JSON.stringify({result:true,data}),out=>verify(JSON.parse(out).data));
});
test('unknown sites, wrong schemas, auth failures, media paths and empty/error responses pass through',()=>{
 const data=JSON.stringify({result:true,data:{startAd:{id:1},playerList:[{url:'movie.m3u8'}]}});
 for(const url of ['https://other.app/_nuxt/entry.abc.js','https://yz261011.unrelated.com/v2/api/vodInfo/index','https://yz250907.7k5jb8t9.com/v2/api/vodInfo/playUrl','https://yz250907.7k5jb8t9.com/movie.m3u8','https://yz250907.7k5jb8t9.com/v2/api/vodInfo/epDetail'])assert.equal(run(universal,url,data),data);
 const url='https://yz250907.7k5jb8t9.com/v2/api/vodInfo/index';
 for(const body of ['not JSON',JSON.stringify({result:false,operateCode:10001,data:{playerList:[]}}),JSON.stringify({result:true,data:{playerList:'changed schema',startAd:1}}),''])assert.equal(run(universal,url,body),body);
 assert.equal(run(universal,url,data,{request:{method:'OPTIONS'}}),data);
 assert.equal(run(universal,url,data,{response:{statusCode:403}}),data);
});
test('Souju snapshot operations share JSON engine while preserving movie/episode fields',()=>{
 const snapshot={object:'app.experience_snapshot',placements:{splash_screen:{items:[1]},showcase_grid:{items:[2]},player_info:{items:[3],grid_items:[4],banner_items:[5],enabled:true,default_ad_targeting:{enabled:true,other:9},movie:{url:'movie.m3u8',episodes:[1,2]}}}};
 const payload={app_experience:snapshot,auth:{vipOnly:true}};
 check('souju-ai','https://souju.ai/v1/app/experience',JSON.stringify(payload),out=>{const p=JSON.parse(out),s=p.app_experience.placements;assert.deepEqual(s.splash_screen.items,[]);assert.deepEqual(s.showcase_grid.items,[]);assert.equal(s.player_info.enabled,false);assert.equal(s.player_info.default_ad_targeting.enabled,false);assert.equal(s.player_info.default_ad_targeting.other,9);assert.deepEqual(s.player_info.movie,snapshot.placements.player_info.movie);assert.deepEqual(p.auth,payload.auth);});
});
test('Kanju shares Souju policies and unwraps flip ads without deleting player children',()=>{
 const conf=read('universal/quantumult-x-snippet.conf'),rules=conf.split('\n').filter(l=>l.startsWith('^')).map(l=>new RegExp(l.split(' url ')[0]));
 for(const host of ['kanju3.com','www.kanju3.com']) {
  for(const asset of ['global-player-host-BEk1MOSZ','movie-card-runtime-DQVzig5g','main-DupXbhqc'])assert(rules.some(r=>r.test('https://'+host+'/assets/'+asset+'.js')));
  assert(rules.some(r=>r.test('https://'+host+'/v1/app/experience')));
  const snapshot={object:'app.experience_snapshot',placements:{player_info:{enabled:true,items:[1],grid_items:[2],banner_items:[3]}},playerList:[{url:'movie.m3u8'}]};
  check('souju-ai','https://'+host+'/v1/app/experience',JSON.stringify(snapshot),out=>{const data=JSON.parse(out);assert.equal(data.placements.player_info.enabled,false);assert.deepEqual(data.playerList,snapshot.playerList);});
 }
 assert(!rules.some(r=>r.test('https://kanju3.com.evil.com/assets/main-DupXbhqc.js')));
 const body='function Sp({children:e,frontBackdropEffect:r,frontClassName:s}){qr("player_info");const ad="movie-player-info-flip";return i.jsx("div",{className:s,"data-backdrop-effect":r,children:e})}function em(){return i.jsx("section",{className:"movie-player-top-grid-ad","aria-label":"播放器顶部广告"})}';
 check('souju-ai','https://kanju3.com/assets/global-player-host-BEk1MOSZ.js',body,out=>{
  const ctx={i:{jsx:(type,props)=>({type,props})}};vm.runInNewContext(out,ctx);
  const child={type:'player',url:'movie.m3u8',episodes:[1,2]},element=ctx.Sp({children:child,frontClassName:'original-layout',frontBackdropEffect:'original-effect'});
  assert.strictEqual(element.props.children,child);assert.equal(element.props.className,'original-layout');assert.equal(element.props['data-backdrop-effect'],'original-effect');assert.equal(ctx.em(),null);
 });
 const unknown='function Sp({children:e}){return e}function em(){return "movie.m3u8"}';
 assert.equal(run(universal,'https://kanju3.com/assets/global-player-host-next.js',unknown),unknown);
});
test('HTML adapters remove only verified blocks and preserve player config and episode links',()=>{
 const html='<html><div class="ad-item"><div>ad</div></div><video data-preroll-ad-url="ad.mp4" src="movie.m3u8"></video><a href="/play/ep2">ep2</a></html>';
 check('4kvm','https://www.4kvms.org/play/ep1',html,out=>{assert(!out.includes('ad-item'));assert(!out.includes('data-preroll'));assert(out.includes('movie.m3u8'));assert(out.includes('/play/ep2'));});
 const buka='<html><link href="/template/buka/x.css"><script src="/dedg/cs13341.js"></script><a href="https://app2.zstv47.com/">ad</a><script>var player_aaaa={url:"movie.m3u8"};</script><a href="/vodplay/2.html">ep2</a></html>';
 check('ycblcw','https://m.ycblcw.com/vodplay/1.html',buka,out=>{assert(!out.includes('cs13341.js'));assert(!out.includes('app2.zstv47'));assert(out.includes('player_aaaa'));assert(out.includes('/vodplay/2.html'));});
 check('ycblcw','https://ycblcw.com/dedg/cs13341.js','window.open("ad")',out=>assert(out.includes('disabled')));
});
test('JS replacements require known fingerprints; unknown bundles remain unchanged',()=>{
 const souju='function Cp(){var t=qr("player_info");return t.creative_daily_rotation_limit;}function ti(){return "movie-player-info-ad-grid";}function qu(){return "movie-player-info-ad-banner-shell";}const url="movie.m3u8";';
 check('souju-ai','https://souju.ai/assets/global-player-host-test.js',souju,out=>{assert(out.includes('function Cp(){return null}'));assert(out.includes('movie.m3u8'));new vm.Script(out);});
 const art='const plugin="artplayerPluginAds({";function f(){this.prerollAdEnabled=!0;return this.prerollAdEnabled&&"movie.m3u8";}';
 check('4kvm','https://4kvms.org/static/js/dist/app.ultra.min.test.js',art,out=>{assert(out.includes('this.prerollAdEnabled=!1'));assert(out.includes('false&&'));new vm.Script(out);});
 for(const url of ['https://yqk43.app/_nuxt/entry.abc.js','https://souju.ai/assets/main-abc.js','https://4kvms.org/static/js/dist/app.ultra.min.abc.js'])assert.equal(run(universal,url,'const unknown="movie.m3u8";'),'const unknown="movie.m3u8";');
});
test('Nuxt injected cleaner is self-contained and protects the player list',()=>{
 const t=manifest.templates.find(t=>t.id==='yqk-qntv'),rules=t.jsRules[0];
 // Minimal bundle with all verified patch sites, without executing site networking.
 const body='const marker={class:"startup-ad",endpoint:"/adInfo/getPageAd"};function f(){'+rules.groups[0].map(p=>p[0]+';').join('')+'}const useHttp={get:(e)=>({'+rules.inject[0][0]+'}),post:(e)=>({'+rules.inject[0][0]+'}),put:(e)=>({'+rules.inject[0][0]+'})};';
 const out=run(universal,'https://yqk43.app/_nuxt/entry.abc.js',body);
 assert.notEqual(out,body);new vm.Script(out);
 const helper=out.slice(out.indexOf('function __admRead'));
 const ctx={};vm.runInNewContext(helper,ctx);
 const list=[{url:'movie.m3u8',episodes:[1,2]}],payload={result:true,data:{startAd:{id:1},playerList:list}};
 const cleaned=ctx.__forAdmYqkClean(payload,'/v2/api/vodInfo/index');assert.equal(cleaned.data.startAd,null);assert.strictEqual(cleaned.data.playerList,list);assert(payload.data.startAd);
 assert.equal(run(universal,'https://yqk43.app/_nuxt/entry.abc.js',out),out);
});

test('Eboyang dedicated loader requires source markers and preserves unrelated scripts',()=>{
 const body='!function() { var c=`sample`; var t=c; new Function(t)(); }();\n//le1008';
 for(const host of ['eboyang.com','www.eboyang.com'])check('eboyang','https://'+host+'/dedg/le1008.js?v=1',body,out=>{assert(out.includes('disabled'));new vm.Script(out);});
 for(const marker of ['var c=','new Function(t)()','//le1008'])assert.equal(run(universal,'https://www.eboyang.com/dedg/le1008.js',body.replace(marker,'OTHER')),body.replace(marker,'OTHER'));
 for(const url of ['https://www.eboyang.com/js/caonima.js','https://www.eboyang.com/js/play.js','https://www.eboyang.com/js/common.js','https://www.eboyang.com/dedg/other.js','https://www.eboyang.com/dedg/le1008.js.extra','https://www.eboyang.com/movie.m3u8','https://www.eboyang.com.evil.com/dedg/le1008.js','https://tv.qingning88.com/api/publicApi.php?url=movie.m3u8'])assert.equal(run(universal,url,body),body);
});
test('Eboyang HTML removes exact ad entries without deleting reminders or player children',()=>{
 const fixture=JSON.parse(read('universal/fixtures/eboyang.json'));
 const fake='<!-- <script src="/dedg/le1008.js"></script> --><script>const example="<a href=//app3.qingning9.com>keep</a>";</script>';
 const body=fixture.body.replace('</html>',fake+'<script src="https://other.com/dedg/le1008.js"></script><a href="https://app3.qingning9.com.evil.com/">keep</a></html>');
 for(const route of ['/','/index.html','/bovod/3896.html','/bovideo/3896-1-0.html','/vodlist/1.html','/search.php?searchword=test'])check('eboyang','https://www.eboyang.com'+route,body,out=>{
  assert(!out.includes('fixture-eboyang-app-ad'));assert(!out.includes('<script src="/dedg/le1008.js"></script><a'));
  assert(out.includes(fake));assert(out.includes('other.com'));assert(out.includes('qingning9.com.evil.com'));for(const s of fixture.preserved)assert(out.includes(s));
 });
 const drift=body.replace('一起看影院','Different');assert.equal(run(universal,fixture.url,drift),drift);
 const rules=read('universal/quantumult-x-snippet.conf').split('\n').filter(l=>l.startsWith('^')).map(l=>new RegExp(l.split(' url ')[0]));
 for(const url of ['https://www.eboyang.com/js/player/vip.html','https://www.eboyang.com/js/play.js','https://www.eboyang.com/movie.m3u8','https://eboyang.com.evil.com/'])assert(!rules.some(r=>r.test(url)));
});

test('Juyeye inline advertising requires all source fingerprints and keeps player and access logic',()=>{
 const fixture=JSON.parse(read('universal/fixtures/juyeye.json'));
 const rule=manifest.templates.find(t=>t.id==='juyeye').actions[0];
 const ad=fixture.body.match(/<script>(!function\(\)\{function a[\s\S]*?)<\/script>/)[0];
 const access='<script>if(navigator.platform==="Win32")location.href="../404.html";</script><script>function captchaVerify(){return "keep"}</script>';
 const protectedContent='<!-- '+ad+' --><style>.sample:after{content:\''+ad+'\'}</style><script src="/known-player.js">'+ad.slice(8,-9)+'</script>'+access;
 const body=fixture.body.replace('</html>',protectedContent+'</html>');
 check('juyeye',fixture.url,body,out=>{assert(out.includes(protectedContent));for(const s of fixture.preserved)assert(out.includes(s));assert.equal(out.split(ad).length,3);});
 for(const marker of rule.scriptRequires){const drift=fixture.body.replace(marker,'SOURCE-CHANGED');assert.equal(run(universal,fixture.url,drift),drift);}
 for(const url of ['https://juyeye.cc/voddetail/96188.html','https://www.juyeye.cc.evil.com/voddetail/96188.html','https://www.juyeye.vip/','https://www.juyeye.cc/captcha.php','https://www.juyeye.cc/mxtheme/js/home.js','https://www.juyeye.cc/movie.m3u8'])assert.equal(run(universal,url,fixture.body),fixture.body);
 const challenge='<html>系统安全验证<script>captchaVerify.Init();</script></html>';assert.equal(run(universal,fixture.url,challenge),challenge);
});

test('Juyeye desktop redirect patch keeps platform variables, unrelated redirects and CAPTCHA',()=>{
 const t=manifest.templates.find(t=>t.id==='juyeye'),rule=t.actions.find(r=>r.op==='replaceInlineScripts');
 const script='var system = {};\nvar p = navigator.platform;\nsystem.win = p.indexOf("Win") == 0;\nsystem.mac = p.indexOf("Mac") == 0;\nsystem.ispc = navigator.userAgent.match(/spider|iPad|iPhone|iPod|Android/i) == null;\nif (system.win || system.mac || system.ispc) {\nwindow.location.href = "../404.html";\n}';
 const functional='<script>function captchaVerify(){return "keep"}</script><script>location.href="/vodplay/96188-1-2.html";</script>';
 const head='<html><script src="/mxtheme/js/home.js"></script><script>var maccms={url:"www.juyeye.cc"}</script>';
 const body=head+'<script>'+script+'</script>'+functional+'</html>',url='https://www.juyeye.cc/voddetail/96188.html';
 check('juyeye',url,body,out=>{
  assert(out.includes(functional));const patched=out.match(/<script>(var system[\s\S]*?)<\/script>/)[1];
  assert.equal(patched,script.replace(rule.pairs[0][0],rule.pairs[0][1]));
  new vm.Script(patched);
  for(const [platform,userAgent]of [['Win32','Chrome'],['MacIntel','Safari'],['Linux x86_64','Chrome'],['iPhone','iPhone Safari']]){
   const ctx={navigator:{platform,userAgent},window:{location:{href:'original'}}};vm.runInNewContext(patched,ctx);assert.equal(ctx.window.location.href,'original');assert.equal(typeof ctx.system.ispc,'boolean');
  }
 });
 for(const marker of rule.scriptRequires){const drift=body.replace(marker,'CHANGED');assert.equal(run(universal,url,drift),drift);}
 const duplicate=body.replace(rule.pairs[0][0],rule.pairs[0][0]+rule.pairs[0][0]);assert.equal(run(universal,url,duplicate),duplicate);
 const challenge='<html><title>系统安全验证</title><script>'+script+'</script><input name="verify"></html>';assert.equal(run(universal,url,challenge),challenge);
});
