import {resolvePlayableEpisode,resolveFirstCandidate,verifyMedia,matchingEpisode,mediaHeaders} from './playback.mjs';
import {recordLineOutcome,shouldAutoSkipOutro,computeResumeStartAt,orderLinesByHealth} from './player-controller.mjs';
import {loadVisibleImages} from './image-loader.mjs';
import {decodePlaylist,parseM3UIncremental,parseXMLTV,channelAlternates,indexChannelAlternates,nextUntriedRouteIndex,normalizePlaylistURL} from './live.mjs';
import sites from './sites-data.mjs';
import {NativeTransport as native} from './transport.mjs';
import {createSourceClient} from './source-clients.mjs';
import {escapeHTML as e,collectMovies,homeSections,categories,imageURLsForSource,sourceKey,sectionRoute,sectionItems,collectionGroups} from './model.mjs';
const $=selector=>document.querySelector(selector),root=$('#app'),pageRoot=$('#app-page'),navRoot=$('#bottomnav');
const paths={home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',browse:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M15.8 8.2l-2.1 5.5-5.5 2.1 2.1-5.5z',saved:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z',settings:'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',discover:'M6 3h12v18l-6-4-6 4z',live:'M4 8a11 11 0 0 1 16 0 M7 11a7 7 0 0 1 10 0 M10 14a3 3 0 0 1 4 0 M12 18h.01',games:'M6 8h12a4 4 0 0 1 3.8 5l-1.4 4.2a2 2 0 0 1-3.2 1l-3.2-2.4h-4l-3.2 2.4a2 2 0 0 1-3.2-1L2.2 13A4 4 0 0 1 6 8z M7 11v4 M5 13h4 M16 12h.01 M18 14h.01',search:'m21 21-5-5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',back:'m15 5-7 7 7 7',refresh:'M20 7v5h-5 M19 11a8 8 0 1 0 0 5',play:'m9 5 11 7-11 7z',star:'m12 3 3 6 6 .9-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 9.9 9 9z'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.play}"/></svg>`;
const read=(key,fallback=[])=>{try{return JSON.parse(localStorage.getItem('sanyuan:'+key))??fallback;}catch{return fallback;}};
const validSavedRows=key=>{const raw=read(key,[]);return Array.isArray(raw)?raw.filter(row=>row&&typeof row==='object'&&row.movie&&typeof row.movie==='object'&&row.movie.id!=null):[];};
const write=(key,value)=>localStorage.setItem('sanyuan:'+key,JSON.stringify(value));
const formatDuration=sec=>{const s=Math.max(0,Math.floor(Number(sec)||0)),m=Math.floor(s/60),r=s%60;return m>=60?`${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}:${String(r).padStart(2,'0')}`:`${m}:${String(r).padStart(2,'0')}`;};
const savedColumns=localStorage.getItem('sanyuan:columns')||'3';
const savedTheme=localStorage.getItem('sanyuan:theme')==='black'?'black':'white';
const storedSite=localStorage.getItem('sanyuan:site'),initialSite=sites.find(item=>item.id===storedSite)?.id||'kkapp';
const state={theme:savedTheme,cleanHLS:read('cleanHLS',true)!==false,autoNext:read('autoNext',true)!==false,skipIntroSeconds:[60,90,120].includes(Number(read('skipIntroSeconds',90)))?Number(read('skipIntroSeconds',90)):90,skipOutroSeconds:[0,60,90,120].includes(Number(read('skipOutroSeconds',0)))?Number(read('skipOutroSeconds',0)):0,playerMirrored:false,playerMuted:false,sleepTimerMode:'off',sleepTimerEndAt:0,nextEpisodeReady:false,playQualityLabel:'',playBandwidth:0,savedSourceFilter:'all',savedSort:'recent',settingsSection:'all',siteHealth:(h=>h&&typeof h==='object'&&!Array.isArray(h)?h:{})(read('siteHealth',{})),lineHealth:(h=>h&&typeof h==='object'&&!Array.isArray(h)?h:{})(read('lineHealth',{})),siteProbing:false,aspectMode:['fit','fill','stretch'].includes(localStorage.getItem('sanyuan:aspectMode'))?localStorage.getItem('sanyuan:aspectMode'):'fit',episodeDesc:false,locatedEpisodeIndex:-1,removedAdSegments:0,removedAdSeconds:0,playLatencyMs:0,searchHistory:Array.isArray(read('searchHistory',[]))?read('searchHistory',[]).slice(0,8):[],heroIndex:0,homeScroll:0,collection:null,collectionStack:[],collectionGroups:[],detailReturn:null,site:initialSite,page:'home',query:'',channel:1,filters:{},next:'page=1',items:[],sections:[],loading:false,error:'',savedTab:'favorites',detail:null,line:0,episode:null,episodePage:0,playURLs:[],playIndex:0,playError:'',playStatus:'',playLoading:false,playLoadingText:'',playTime:0,playDuration:0,summaryExpanded:false,playRecovery:null,pendingEpisodeIndex:0,epoch:0,authError:'',adultEnabled:localStorage.getItem('sanyuan:adult')==='true',showAgeGate:false,columns:['3','4','5','6'].includes(savedColumns)?savedColumns:'3',playbackRate:[0.5,0.75,1,1.25,1.5,2].includes(Number(read('playbackRate',1)))?Number(read('playbackRate',1)):1,diagnostics:read('diagnostics',[]),diagEngine:'AVPlayer',imageMap:new Map()};
Object.assign(state,{discoverTab:0,discoverYear:new Date().getFullYear(),discoverMonth:new Date().getMonth()+1,discoverGroups:[],discoverSections:[],discoverItems:[],discoverNext:'',meTab:'favorites'});
Object.assign(state,{liveLastPlaybackTime:null,livePlaybackProgressAt:0,liveVideoReady:false,liveVideoFormat:null});
Object.assign(state,{liveURL:localStorage.getItem('sanyuan:livePlaylistURL')||'https://fnipv.69574517.xyz/shiju19880215/interface.m3u',liveChannels:[],liveGroups:[],liveAlternateIndex:new Map(),liveEPGUrl:'',liveLoadedURL:'',livePanel:'channels',liveCategory:'',liveSearch:'',liveVisibleCount:80,liveNativeVisibleCount:40,liveCurrentIndex:-1,liveVariantIndex:0,liveRendererRetry:0,liveImportOpen:true,liveLoading:false,liveError:'',liveStatus:'',liveActive:false,liveResume:false,liveEPGLoading:false,liveEPGText:'',livePrograms:[],liveProgramDate:'',liveSelectedProgram:null,liveSelectedRoute:null,liveSheet:'',liveReturn:null,liveFavorites:read('liveFavorites',[]),liveImportController:null,liveGuideController:null,liveEPGCache:new Map(),liveTriedURLs:new Set(),liveCacheFound:false,liveInitialAttempted:false});
const clients=new Map(sites.map(site=>[site.id,createSourceClient(site,options=>native.request(options))]));
if(!clients.has(state.site))state.site=sites[0].id;
const client=()=>clients.get(state.site),site=()=>sites.find(s=>s.id===state.site);
const shelfOffsets=new Map(),liveScrollOffsets=new Map(),viewCache=new Map(),discoveryCache=new Map(),pageDOMCache=new Map(),pageScrollCache=new Map(),episodePrefetchCache=new Map();
const pageCursor=value=>value==null||value===0||value==='0'?'':String(value);
let controller,prefetchController=null,prefetchTimer=null,toastTimeout,hudTimeout,playbackSession=null,stopImages,nativeSession=null,activeRenderKey=null,activeRenderReady=false,scrollFramePending=false,nativeClearConfirm=false,heroTouchStartX=null,lastHeroInteractionAt=0;
function toast(text){clearTimeout(toastTimeout);$('#toast').textContent=text;$('#toast').classList.add('show');toastTimeout=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function showPlayerHUD(text){const hud=$('#player-hud');if(!hud)return;clearTimeout(hudTimeout);hud.textContent=text;hud.hidden=false;hud.classList.add('show');hudTimeout=setTimeout(()=>{hud.classList.remove('show');hud.hidden=true;},1400);}
function rememberSearch(keyword){const q=String(keyword||'').trim();if(!q)return;state.searchHistory=[q,...state.searchHistory.filter(x=>x!==q)].slice(0,8);write('searchHistory',state.searchHistory);}
function posterURLsFor(movie,source=state.site){return imageURLsForSource(movie,source,clients.get(source)?.config||{});}
function picture(movie,hero=false,source=state.site){const urls=posterURLsFor(movie,source),key=source+':'+movie.id,origin=sites.find(item=>item.id===source)?.origin||'';state.imageMap.set(key,{urls,referer:origin?new URL(origin).origin+'/':''});return urls.length?`<img ${hero?'':'loading="lazy"'} data-image="${e(key)}" data-attempt="0" alt="${e(movie.title)}">`:'';}
function liveLogo(channel){if(!channel?.logo)return '';const key=`live:${channel.index}`;state.imageMap.set(key,[channel.logo]);return `<img data-image="${key}" alt="" loading="lazy">`;}
function card(movie,source=state.site,subtitle,removableKey=''){return `<button class="card" data-act="${movie.route?'collection-link':'detail'}" data-route="${e(movie.route?.url||'')}" data-title="${e(movie.title)}" data-id="${e(movie.id)}" data-source="${e(source)}"><div class="poster"><span>${e(movie.title.slice(0,1))}</span>${picture(movie,false,source)}${movie.badge?`<div class="postbadge">${e(movie.badge)}</div>`:''}${removableKey?`<span class="card-remove" data-act="remove-saved-item" data-key="${e(removableKey)}" role="button" aria-label="移除 ${e(movie.title)}">×</span>`:''}<div class="postsub">${e(subtitle||movie.subtitle)}</div></div><strong>${e(movie.title)}</strong><small>${e(movie.labels?.slice(0,2).join(' · ')||sites.find(x=>x.id===source)?.name||'')}</small></button>`;}
function grid(items){return `<div class="grid">${items.map(movie=>card(movie)).join('')}</div>`;}
function loading(){return `<div class="grid" aria-label="加载中">${Array.from({length:9},()=>'<div><div class="skeleton poster"></div><p class="caption">正在加载…</p></div>').join('')}</div>`;}
function notice(title,text,action='refresh',label='重新加载'){return `<div class="notice"><h3>${e(title)}</h3><div>${e(text)}</div>${action?`<button class="secondary" data-act="${action}">${e(label)}</button>`:''}</div>`;}
function header(){return `<header class="top"><div class="topline"><div class="logo"><span class="brandmark">▶</span><div><span>三源影视</span><small class="logo-sub">${e(site().name)} · 沉浸影院</small></div></div><div class="top-actions"><button class="iconbutton" data-act="theme" data-id="${state.theme==='black'?'white':'black'}" aria-label="切换主题" title="切换深浅色主题">◐</button><button class="iconbutton" data-act="refresh" aria-label="刷新">${icon('refresh')}</button></div></div><div class="sources" aria-label="影视来源">${sites.map(s=>`<button class="${state.site===s.id?'active':''}" data-act="source" data-id="${s.id}">${e(s.name)}</button>`).join('')}</div>${['me','saved','settings'].includes(state.page)?'':`<form class="searchform" id="search-form"><label class="searchinput">${icon('search')}<input id="search-query" value="${e(state.query)}" placeholder="搜索影片、演员、导演" autocomplete="off" enterkeyhint="search" aria-label="搜索影片"><button type="button" class="search-clear" data-act="search-clear" ${state.query?'':'hidden'} aria-label="清空搜索词">×</button></label><button class="primary" type="submit">搜索</button></form>`}${['home','browse','search'].includes(state.page)&&state.searchHistory.length?`<div class="search-history" aria-label="搜索历史"><span class="subtle">最近搜索</span><div class="search-history-chips">${state.searchHistory.map(q=>`<button type="button" class="chip search-chip" data-act="search-chip" data-query="${e(q)}">${e(q)}</button>`).join('')}</div><button type="button" class="textbutton search-history-clear" data-act="search-history-clear">清空</button></div>`:''}</header>`;}
function nav(){return [['home','首页'],['discover','发现'],['browse','看啥片'],['live','直播'],['me','我的']].map(([id,label])=>`<button data-act="page" data-id="${id}" class="nav-item" aria-label="${label}"><span class="nav-icon">${icon(id)}</span><span class="nav-label">${label}</span></button>`).join('');}
function syncNav(){if(!navRoot.children.length)navRoot.innerHTML=nav();if(!$('#back-to-top'))root.insertAdjacentHTML('beforeend','<button id="back-to-top" type="button" class="back-to-top" data-act="scroll-top" hidden aria-label="回到顶部" title="回到顶部">↑ 顶部</button>');const topBtn=$('#back-to-top');if(topBtn)topBtn.hidden=window.scrollY<=360;navRoot.hidden=['detail','collection'].includes(state.page);for(const button of navRoot.children){const active=button.dataset.id===state.page||button.dataset.id==='me'&&['me','saved','settings'].includes(state.page);button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');}}
function viewKey(page=state.page){const filters=Object.keys(state.filters).sort().map(key=>`${key}=${state.filters[key]}`).join('&');return `${state.site}:${page}:${page==='browse'?state.channel+':'+filters:''}${page==='search'?':'+state.query:''}`;}
function pageRenderKey(){const adult=state.adultEnabled?'adult':'all';if(state.page==='home')return `${state.site}:home:${adult}`;if(state.page==='browse'||state.page==='search')return `${viewKey()}:${adult}`;if(state.page==='discover')return `${state.site}:discover:${state.discoverTab}:${state.discoverYear}:${state.discoverMonth}:${adult}`;if(state.page==='collection')return `${state.site}:collection:${state.collection?.kind||''}:${state.collection?.url||state.collection?.id||'root'}:${adult}`;return null;}
function invalidateHomeDOMCache(){for(const k of pageDOMCache.keys())if(k.includes(':home:'))pageDOMCache.delete(k);}
function cacheView(){if(state.loading||state.error||!['home','browse'].includes(state.page))return;viewCache.set(viewKey(),{items:state.items.slice(),sections:state.sections.slice(),next:state.next,error:state.error});}
function restoreView(page=state.page){const cached=viewCache.get(viewKey(page));if(!cached)return false;state.items=cached.items.slice();state.sections=cached.sections.slice();state.next=cached.next;state.error=cached.error;state.loading=false;return true;}
function detailPageSnapshot(){return {page:state.page,site:state.site,scrollY:window.scrollY,channel:state.channel,filters:{...state.filters},query:state.query,items:state.items.slice(),sections:state.sections.slice(),next:state.next,collection:state.collection,collectionGroups:state.collectionGroups.slice(),collectionStack:state.collectionStack.slice(),discoverTab:state.discoverTab,discoverYear:state.discoverYear,discoverMonth:state.discoverMonth,discoverGroups:state.discoverGroups.slice(),discoverSections:state.discoverSections.slice(),discoverItems:state.discoverItems.slice(),discoverNext:state.discoverNext};}
function restoreDetailPage(snapshot){Object.assign(state,snapshot,{detailReturn:null,detail:null,episode:null,playURLs:[],playError:'',loading:false,error:''});localStorage.setItem('sanyuan:site',state.site);render();requestAnimationFrame(()=>window.scrollTo({top:snapshot.scrollY||0,behavior:'instant'}));}
function quickCategories(){return `<div class="quickcats">${categories(client().config,{includeAdult:state.adultEnabled}).map(c=>`<button class="chip ${c.isAdult?'adultchip':''} ${state.page==='browse'&&state.channel===c.id?'active':''}" data-act="category" data-id="${c.id}">${e(c.name)}</button>`).join('')}</div>`;}
const filterName=query=>({sort:'排序',category:'类型',childChannelId:'类型',class:'类型',area:'地区',year:'年份',language:'语言'}[query]||query);
function filterDefinitions(){return client().config?.channelListQuery?.find(x=>Number(x.channelId)===state.channel)?.items||[];}
function filterDefault(filter){return String(filter.selected??(filter.query==='sort'?'3':''));}
function rememberFilters(){write('filters:'+state.site+':'+state.channel,state.filters);}
function restoreFilters(){const saved=read('filters:'+state.site+':'+state.channel,{});state.filters=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};}
function homePicks(){return [...new Map(state.sections.flatMap(section=>section.items).filter(movie=>!movie.route).map(movie=>[movie.id,movie])).values()].slice(0,5);}
function updateHeroCarouselDOM(){
 const picks=homePicks();if(picks.length<2)return false;
 const idx=state.heroIndex%picks.length,first=picks[idx];if(!first)return false;
 if(native.native()){native.syncPage(nativePageSnapshot());return true;}
 const heroNode=pageRoot.querySelector('.hero');if(!heroNode)return false;
 const key=state.site+':'+first.id,urls=posterURLsFor(first,state.site),origin=site()?.origin||'';
 state.imageMap.set(key,{urls,referer:origin?new URL(origin).origin+'/':''});
 const h1=heroNode.querySelector('.herocopy h1'),p=heroNode.querySelector('.herocopy p'),playBtn=heroNode.querySelector('[data-act="detail"]'),favBtn=heroNode.querySelector('[data-act="favorite"]'),badgeNode=heroNode.querySelector('.hero-score');
 if(h1)h1.textContent=first.title;
 if(p)p.textContent=first.labels?.join(' / ')||first.subtitle||'精选推荐';
 if(playBtn)playBtn.dataset.id=first.id;
 if(favBtn){favBtn.dataset.id=first.id;const isFav=validSavedRows('favorites').some(x=>x.siteId===state.site&&String(x.movie.id)===String(first.id));favBtn.textContent=isFav?'✓ 已在片单':'＋ 片单';favBtn.classList.toggle('active',isFav);}
 if(badgeNode){badgeNode.textContent=first.badge||'';badgeNode.hidden=!first.badge;}
 const img=heroNode.querySelector('img[data-image]');
 if(img&&urls.length){img.removeAttribute('src');img.dataset.image=key;img.alt=first.title;observeAppendedImages(heroNode);}
 for(const [i,btn] of [...pageRoot.querySelectorAll('.hero-switch button[data-act="hero-pick"]')].entries()){
  const active=i===idx;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
 }
 return true;
}
function home(){
 if(state.loading&&!state.sections.length)return loading();if(state.error&&!state.sections.length)return notice('暂时未能连接',state.error);
 const picks=homePicks();
 const first=picks[state.heroIndex%Math.max(picks.length,1)];if(!first)return notice('暂无影片','可以切换来源，或稍后刷新。');
 const favs=validSavedRows('favorites'),isFirstFav=favs.some(x=>x.siteId===state.site&&String(x.movie.id)===String(first.id));
 const recent=validSavedRows('history').filter(row=>row.siteId===state.site&&(state.adultEnabled||!(row.movie.isAdult||Number(row.movie.channelId)===5))).sort((a,b)=>b.updated-a.updated).slice(0,6);
 return `<section class="hero">${picture(first,true)}<div class="herocopy"><div class="hero-badges"><span class="tag">✦ 今日精选 · ${e(site().name)}</span>${first.badge?`<span class="tag hero-score">${e(first.badge)}</span>`:`<span class="tag hero-score" hidden></span>`}</div><h1>${e(first.title)}</h1><p>${e(first.labels?.join(' / ')||first.subtitle||'高清院线与热播剧集实时同步')}</p><div class="herobuttons"><button class="primary" data-act="detail" data-id="${first.id}">${icon('play')}查看选集</button><button class="secondary ${isFirstFav?'active':''}" data-act="favorite" data-id="${first.id}">${isFirstFav?'✓ 已在片单':'＋ 片单'}</button></div></div></section>${state.error?`<div class="home-stale-banner" role="status"><span>暂时无法更新，仍显示上次加载的内容</span><button data-act="refresh">重试</button></div>`:''}<div class="hero-switch" aria-label="切换首页推荐">${picks.map((movie,i)=>`<button data-act="hero-pick" data-id="${i}" aria-label="推荐 ${i+1}：${e(movie.title)}" aria-pressed="${state.heroIndex%picks.length===i}" class="${state.heroIndex%picks.length===i?'active':''}"><span></span></button>`).join('')}<span class="subtle">点选或左右滑动切换</span></div>${quickCategories()}
 ${recent.length?`<section class="continue-section"><div class="sectiontop row"><h2>继续观看 <span class="section-count">${recent.length} 部</span></h2><button class="textbutton" data-act="history-all">全部记录 ›</button></div><div class="continue-row">${recent.map(row=>{const denom=Number(row.duration)>60?Number(row.duration):2700,pct=row.time>0?Math.min(96,Math.max(8,Math.round((row.time/denom)*100))):18,timeText=row.time>0?` · 看到 ${formatDuration(row.time)}${Number(row.duration)>60?' / '+formatDuration(row.duration):''}`:'';return `<button class="continue-card" data-act="detail" data-id="${e(row.movie.id)}"><div class="continue-card-top"><strong>${e(row.movie.title)}</strong><span class="continue-remove" data-act="remove-history" data-key="${e(row.key||(row.siteId+':'+row.movie.id))}" role="button" aria-label="移除观看记录">×</span></div><span>${e(row.episodeTitle||'查看选集')}${timeText}</span><div class="continue-progress"><i style="width:${pct}%"></i></div><small>接着上次进度播放 ›</small></button>`;}).join('')}</div></section>`:''}
 ${state.sections.map((section,index)=>`<section class="home-section"><div class="sectiontop row"><h2>${e(section.title)} <span class="section-count">${section.items.length} 部</span></h2>${section.route?`<button class="textbutton" data-act="collection-link" data-route="${e(section.route.url)}" data-title="${e(section.title)}">更多 ›</button>`:`<span class="subtle">精选片单</span>`}</div><div class="shelf" data-shelf="${state.site}:${index}" tabindex="0" aria-label="${e(section.title)}，${section.items.length} 部">${section.items.map(movie=>card(movie)).join('')}</div></section>`).join('')}`;
}
function discoveryProfile(){return client().discoveryProfile();}
function discoveryTabs(){return discoveryProfile().tabs;}
function discoveryCacheKey(tab=state.discoverTab){return `${state.site}:${tab}:${state.adultEnabled?'adult':'safe'}`;}
function mergeDiscoveryGroups(existing,incoming){
 const map=new Map();
 for(const group of [...(existing||[]),...(incoming||[])]){
  if(!group||!Array.isArray(group.items))continue;
  const key=String(group.title||'近期更新'),prev=map.get(key);
  if(prev)prev.items=[...new Map([...prev.items,...group.items].map(item=>[item.id,item])).values()];
  else map.set(key,{...group,title:key,items:group.items.slice()});
 }
 return [...map.values()];
}
function discover(){
 const profile=discoveryProfile(),tabs=profile.tabs,activeTab=tabs.find(tab=>String(tab.id)===String(state.discoverTab)),tabMode=activeTab?.mode||'timeline',years=Array.from({length:5},(_,i)=>new Date().getFullYear()-i),months=Array.from({length:12},(_,i)=>i+1),sections=state.discoverSections;
 const topicSections=sections.filter(section=>['topic','topics'].includes(section.route?.kind));
 const groups=state.discoverGroups.length?state.discoverGroups:state.discoverItems.length?[{title:'近期更新',items:state.discoverItems}]:[];
 const visibleGroups=groups.filter(group=>{const title=String(group.title),current=new Date(),relative=/今天|昨天|今日/.test(title),match=title.match(/(20\d{2})\D{0,3}(\d{1,2})月|^(\d{1,2})月/);if(relative)return state.discoverYear===current.getFullYear()&&state.discoverMonth===current.getMonth()+1;if(!match)return true;const year=Number(match[1]||state.discoverYear),month=Number(match[2]||match[3]);return year===state.discoverYear&&month===state.discoverMonth;});
 let panel='';
 if(state.loading&&!groups.length&&!sections.length&&!state.discoverItems.length)panel=loading();
 else if(profile.sectionTab!=null&&String(profile.sectionTab)===String(state.discoverTab))panel=sections.length?sections.map((section,index)=>`<section class="home-section source-discovery-section" data-discovery-key="${e(section.route?.url||section.title)}"><div class="sectiontop row"><h2>${e(section.title)} <span class="section-count">${section.items.length} 部</span></h2>${section.route?`<button class="textbutton" data-act="collection-link" data-route="${e(section.route.url)}" data-title="${e(section.title)}">更多 ›</button>`:''}</div><div class="shelf" data-shelf="discovery:${e(site().id)}:${state.discoverTab}:${index}">${section.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):state.discoverItems.length?grid(state.discoverItems):state.error?notice('栏目暂时不可用',state.error,'refresh','重新加载'):notice('暂时没有内容','可切换上方栏目，或稍后刷新。','','');
 else if(profile.timeline&&String(profile.timelineTab??'0')===String(state.discoverTab))panel=`<div class="timeline-months">${months.map(month=>`<button class="month-chip ${month===state.discoverMonth?'active':''}" data-act="discover-month" data-id="${month}">${month}月</button>`).join('')}</div>${visibleGroups.length?visibleGroups.map((group,index)=>`<section class="timeline-group"><div class="timeline-mark"></div><div class="timeline-heading"><h2>${e(group.title)}</h2><span>${group.items.length} 部</span></div><div class="timeline-shelf" data-shelf="discovery:release:${index}">${group.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):state.error?notice('上映表暂时不可用',state.error,'refresh','重新加载'):groups.length?notice(`${state.discoverYear}年${state.discoverMonth}月暂无排期`,'可切换其他月份，或一键回到当前月份排期。','discover-reset-date','回到当月'):notice('此来源暂未提供上映表','切换其他影视来源，或稍后刷新片源目录。','','')}`;
 else if(tabMode==='topics')panel=state.discoverGroups.length?state.discoverGroups.map((group,index)=>`<section class="home-section discover-topic"><div class="sectiontop"><h2>${e(group.title||'专题')}</h2></div><div class="shelf" data-shelf="discovery:topic:${index}">${group.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):topicSections.length?topicSections.map((section,index)=>`<section class="home-section discover-topic"><div class="sectiontop row"><h2>${e(section.title)}</h2>${section.route?`<button class="textbutton" data-act="collection-link" data-route="${e(section.route.url)}" data-title="${e(section.title)}">更多 ›</button>`:''}</div><div class="shelf" data-shelf="discovery:topic:${index}">${section.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):notice('暂未找到专题','此来源没有提供专题目录。','','');
 else if(tabMode==='netflix'&&sections.length)panel=sections.map((section,index)=>`<section class="home-section"><div class="sectiontop"><h2>${e(section.title)}</h2></div><div class="shelf" data-shelf="discovery:netflix:${index}">${section.items.map(movie=>card(movie)).join('')}</div></section>`).join('');
 else panel=state.loading&&!state.discoverItems.length?loading():state.discoverItems.length?grid(state.discoverItems):state.error?notice('栏目暂时不可用',state.error,'refresh','重新加载'):notice(tabMode==='netflix'?'暂未找到 Netflix 专区':'暂未找到此栏目的影片','可切换影视来源后再试。','','');
 return `<div class="discover-page"><section class="discover-banner"><div class="discover-banner-top"><span>✦ 片库探索 · ${e(site().name)}</span><button class="discover-refresh" data-act="refresh" aria-label="刷新">${icon('refresh')}</button></div><div class="movie-time-word">CINEMA DISCOVERY</div><span class="discover-caption">RELEASES · CURATED TOPICS · TRENDING CHARTS</span><div class="discover-sources">${sites.map(source=>`<button data-act="source" data-id="${source.id}" class="${source.id===state.site?'active':''}">${e(source.name)}</button>`).join('')}</div></section><div class="discover-tabs" role="tablist" aria-label="发现栏目">${tabs.map(tab=>`<button role="tab" aria-selected="${String(state.discoverTab)===String(tab.id)}" class="${String(state.discoverTab)===String(tab.id)?'active':''}" data-act="discover-tab" data-id="${tab.id}">${e(tab.name)}</button>`).join('')}</div>${profile.timeline&&String(profile.timelineTab??'0')===String(state.discoverTab)?`<div class="timeline-years" aria-label="选择年份">${years.map(year=>`<button class="year-chip ${year===state.discoverYear?'active':''}" data-act="discover-year" data-id="${year}">${year}</button>`).join('')}</div>`:''}${panel}${state.discoverNext&&!state.loading?`<button class="secondary loadmore" data-act="discover-more">加载更多</button>`:''}</div>`;
}
async function loadDiscovery({refresh=false,more=false}={}){
 if(!discoveryTabs().some(t=>Number(t.id)===state.discoverTab))state.discoverTab=0;
 const profile=discoveryProfile(),tab=profile.tabs.find(item=>String(item.id)===String(state.discoverTab)),mode=tab?.mode||'timeline';
 const key=discoveryCacheKey(state.discoverTab),cached=discoveryCache.get(key);if(!refresh&&!more&&cached){Object.assign(state,cached,{loading:false,error:''});render();return;}
 const previousGroups=state.discoverGroups.length,previousItems=state.discoverItems.length,{signal,epoch}=cancel(),c=client();state.loading=true;state.error='';if(!more){state.discoverGroups=[];state.discoverSections=[];state.discoverItems=[];state.discoverNext='';render();}else{const button=pageRoot.querySelector('[data-act="discover-more"]');if(button){button.disabled=true;button.textContent='正在加载…';}}
 try{
  if(!c.config)await c.bootstrap(signal);
  if(typeof c.discovery==='function'){
   const data=await c.discovery(state.discoverTab,more?state.discoverNext||'page=1':'page=1',signal);if(epoch!==state.epoch)return;
   const sections=homeSections(data),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});
   if(more){const combined=new Map();for(const section of [...state.discoverSections,...sections]){const key=section.route?.url||section.title,previous=combined.get(key);combined.set(key,previous?{...previous,items:[...new Map([...previous.items,...section.items].map(item=>[item.id,item])).values()]}:section);}state.discoverSections=[...combined.values()];}else state.discoverSections=sections;
   state.discoverItems=more?[...new Map([...state.discoverItems,...items].map(item=>[item.id,item])).values()]:items;state.discoverNext=pageCursor(data?.next);
  }else{
  if(!state.sections.length){const home=await c.home(signal);state.sections=homeSections(home);}
  if(mode==='timeline'){
   const route=state.sections.find(section=>section.route?.kind==='timeline')?.route;
   if(route){const data=await c.collection(route,more?state.discoverNext||'page=1':'page=1',signal),groups=collectionGroups(data,{includeAdult:state.adultEnabled});state.discoverGroups=more?mergeDiscoveryGroups(state.discoverGroups,groups):groups;state.discoverNext=pageCursor(data?.next);}
   else{const category=categories(c.config,{includeAdult:state.adultEnabled})[0];if(category){const data=await c.channel(category.id,{},more?state.discoverNext||'page=1':'page=1',signal),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.discoverItems=more?[...state.discoverItems,...items]:items;state.discoverNext=pageCursor(data?.next);}}
  }
  else if(mode==='catalog'||mode==='latest'){const category=categories(c.config,{includeAdult:state.adultEnabled})[0];if(category){const data=await c.channel(category.id,{},more?state.discoverNext||'page=1':'page=1',signal),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.discoverItems=more?[...state.discoverItems,...items]:items;state.discoverNext=pageCursor(data?.next);}}
  else if(mode==='netflix'){const netflix=(c.config.vodTabs||[]).find(tab=>/netflix/i.test(String(tab.text||tab.name||''))&&Number(tab.channelId)>0);if(netflix){const data=await c.channel(Number(netflix.channelId),{},more?state.discoverNext||'page=1':'page=1',signal),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.discoverItems=more?[...state.discoverItems,...items]:items;state.discoverNext=pageCursor(data?.next);}else state.discoverSections=state.sections.filter(section=>/netflix/i.test(section.title));}
  else if(mode==='topics'){const topicRoute=state.sections.find(section=>section.route?.kind==='topics')?.route;state.discoverSections=state.sections.filter(section=>['topic','topics'].includes(section.route?.kind));if(topicRoute){const data=await c.collection(topicRoute,more?state.discoverNext||'page=1':'page=1',signal),groups=collectionGroups(data,{includeAdult:state.adultEnabled});state.discoverGroups=more?mergeDiscoveryGroups(state.discoverGroups,groups):groups;state.discoverNext=pageCursor(data?.next);}}
  else if(mode==='home'){state.discoverSections=state.sections;}
  else if(['ranking','hot','trending'].includes(mode)){const category=categories(c.config,{includeAdult:state.adultEnabled})[0],definition=c.config.channelListQuery?.find(row=>Number(row.channelId)===category?.id)?.items?.find(row=>row.query==='sort'),hot=definition?.data?.find(option=>/热|人气|排行/.test(option.name))?.id;if(category){const data=await c.channel(category.id,hot?{sort:String(hot)}:{},more?state.discoverNext||'page=1':'page=1',signal),items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.discoverItems=more?[...state.discoverItems,...items]:items;state.discoverNext=pageCursor(data?.next);}}
  }
  if(epoch!==state.epoch)return;
 }catch(error){if(error.name!=='AbortError'&&epoch===state.epoch)state.error=error.message;}
 finally{if(epoch===state.epoch){state.loading=false;if(!state.error)discoveryCache.set(key,{discoverGroups:state.discoverGroups.slice(),discoverSections:state.discoverSections.slice(),discoverItems:state.discoverItems.slice(),discoverNext:state.discoverNext});if(!more||native.native()||!appendDiscoveryResults(previousGroups,previousItems))render();else if(native.native())native.syncPage(nativePageSnapshot());}}
}
function observeAppendedImages(container){stopImages?.observe?.(container,new Map(state.imageMap));}
function appendDiscoveryResults(previousGroups,previousItems){
 if(state.error)return false;
 const page=pageRoot.querySelector('.discover-page');if(!page)return false;
 const template=document.createElement('div');template.innerHTML=discover();
 const more=page.querySelector('[data-act="discover-more"]');
 const profile=discoveryProfile();
 if(profile.sectionTab!=null&&String(profile.sectionTab)===String(state.discoverTab)&&state.discoverSections.length){
  for(const section of template.querySelectorAll('.source-discovery-section')){const existing=[...page.querySelectorAll('.source-discovery-section')].find(node=>node.dataset.discoveryKey===section.dataset.discoveryKey);if(!existing){if(more)more.insertAdjacentElement('beforebegin',section);else page.append(section);continue;}const shelf=existing.querySelector('.shelf'),known=new Set([...shelf.querySelectorAll('.card')].map(node=>node.dataset.id));for(const cardNode of section.querySelectorAll('.card'))if(!known.has(cardNode.dataset.id)){known.add(cardNode.dataset.id);shelf.append(cardNode);}}
  observeAppendedImages(page);if(more){if(state.discoverNext){more.disabled=false;more.textContent='加载更多';}else more.remove();}return true;
 }
 const addedItems=state.discoverItems.slice(previousItems),firstCard=page.querySelector('.card');
 if(addedItems.length&&firstCard){firstCard.parentElement.insertAdjacentHTML('beforeend',addedItems.map(item=>card(item)).join(''));observeAppendedImages(firstCard.parentElement);const button=page.querySelector('[data-act="discover-more"]');if(button){if(state.discoverNext){button.disabled=false;button.textContent='加载更多';}else button.remove();}return true;}
 const existingGrid=page.querySelector(':scope > .grid'),nextGrid=template.querySelector('.discover-page > .grid');
 if(existingGrid&&nextGrid){existingGrid.insertAdjacentHTML('beforeend',state.discoverItems.slice(previousItems).map(item=>card(item)).join(''));observeAppendedImages(existingGrid);}
 else{
  const selectors=profile.sectionTab!=null&&String(profile.sectionTab)===String(state.discoverTab)?['.source-discovery-section']:profile.timeline&&String(profile.timelineTab??'0')===String(state.discoverTab)?['.timeline-group']:discoveryProfile().tabs.find(item=>String(item.id)===String(state.discoverTab))?.mode==='topics'?['.discover-topic']:[];
  if(selectors.length){const selector=selectors[0],existingByTitle=new Map([...page.querySelectorAll(selector)].map(node=>[node.querySelector('h2')?.textContent||'',node])),incoming=[...template.querySelectorAll(selector)];for(const section of incoming){const title=section.querySelector('h2')?.textContent||'',existing=existingByTitle.get(title);if(!existing){if(more)more.insertAdjacentElement('beforebegin',section);else page.append(section);existingByTitle.set(title,section);continue;}const shelf=existing.querySelector('.shelf,.timeline-shelf'),known=new Set([...(shelf?.querySelectorAll('.card')||[])].map(node=>node.dataset.id));for(const cardNode of section.querySelectorAll('.card'))if(shelf&&!known.has(cardNode.dataset.id)){known.add(cardNode.dataset.id);shelf.append(cardNode);}}observeAppendedImages(page);}
 }
 const button=page.querySelector('[data-act="discover-more"]');if(button){if(state.discoverNext){button.disabled=false;button.textContent='加载更多';}else button.remove();}
 return true;
}
function browse(){
 const cats=categories(client().config,{includeAdult:state.adultEnabled}),category=cats.find(c=>c.id===state.channel),filters=filterDefinitions();
 const selected=filters.filter(f=>state.filters[f.query]!==undefined&&String(state.filters[f.query])!==filterDefault(f));
 const expansionKey=`sanyuan:filters-expanded:${state.site}:${state.channel}`,filtersExpanded=localStorage.getItem(expansionKey)==='true',visibleFilters=filtersExpanded?filters:filters.slice(0,2);
 return `<div class="browse-heading"><div class="browse-title-group"><h1 class="heading">${state.page==='search'?`“${e(state.query)}” 的搜索结果`:e(category?.name||'分类片库')}</h1>${state.page==='search'?`<button class="textbutton" data-act="page" data-id="browse">返回分类 ›</button>`:''}</div><label class="density-control">分栏 <select aria-label="海报分栏" data-grid-columns>${['3','4','5','6'].map(value=>`<option value="${value}" ${state.columns===value?'selected':''}>${value} 栏</option>`).join('')}</select></label></div>
 ${state.page==='browse'?quickCategories()+(filters.length?`<section class="filters" aria-label="筛选影片"><div class="row filter-heading"><strong>筛选条件${selected.length?` · ${selected.length}`:''}</strong><button class="textbutton" data-act="filters-reset" ${selected.length?'':'disabled'}>重置</button></div>${visibleFilters.map(filter=>`<div class="filterrow"><span class="filter-label">${e(filterName(filter.query))}</span><div class="filter-options" role="group" aria-label="${e(filterName(filter.query))}">${(filter.data||[]).map(option=>{const active=String(state.filters[filter.query]??filterDefault(filter))===String(option.id);return `<button class="filter-chip ${active?'active':''}" data-act="filter-option" data-key="${e(filter.query)}" data-id="${e(option.id)}" aria-pressed="${active}">${e(option.name)}</button>`;}).join('')}</div></div>`).join('')}${filters.length>2?`<button class="filter-expand" data-act="filters-expanded" aria-expanded="${filtersExpanded}">${filtersExpanded?'收起筛选':'更多筛选'} <span>${filtersExpanded?'⌃':'＋'}</span></button>`:''}</section>`:'')+(selected.length?`<div class="selected-filters" aria-label="已选条件">${selected.map(filter=>`<button data-act="filter-clear" data-key="${e(filter.query)}" aria-label="取消${e(filterName(filter.query))}筛选">${e(filterName(filter.query))}：${e(filter.data?.find(o=>String(o.id)===String(state.filters[filter.query]))?.name||state.filters[filter.query])} ×</button>`).join('')}</div>`:''):''}
 ${state.page==='search'&&state.items.length?`<div class="search-source-bar" aria-label="跨站搜索同关键词"><span class="subtle">换源同搜</span><div class="search-source-chips">${sites.filter(s=>s.id!==state.site).map(s=>`<button type="button" class="chip" data-act="source" data-id="${e(s.id)}">${e(s.name)}</button>`).join('')}</div></div>`:''}
 <div class="results-status" role="status" aria-live="polite">${state.loading?'正在加载影片…':state.items.length?'已显示 '+state.items.length+' 部'+(state.next?' · 下方可加载更多':' · 已全部显示'):''}</div>
 ${state.error?notice('请求未完成',state.error,state.error.includes('初始化')||state.error.includes('登录')?'account':'refresh',state.error.includes('初始化')||state.error.includes('登录')?'前往登录':'重试'):''}
 ${state.items.length?grid(state.items):state.loading?loading():!state.error?(state.page==='search'?`<div class="notice"><h3>在 ${e(site().name)} 中暂未找到 “${e(state.query)}”</h3><div>可点击下方片源直接跨站搜索同一关键词：</div><div class="cross-source-chips">${sites.filter(s=>s.id!==state.site).map(s=>`<button type="button" class="chip" data-act="source" data-id="${e(s.id)}">${e(s.name)}</button>`).join('')}</div></div>`:notice('还没有找到影片','试试减少筛选条件，或切换上方分类。',state.page==='browse'&&selected.length?'filters-reset':'', '清除筛选')):''}
 ${state.next&&state.items.length?`<button class="secondary loadmore" data-act="more" ${state.loading?'disabled':''}>${state.loading?'正在加载…':'加载更多影片'}</button>`:''}`;
}
function collectionSnapshot(){return {collection:state.collection,items:state.items,next:state.next,collectionGroups:state.collectionGroups,scrollY:window.scrollY};}
function openCollection(value,title){
 const route=sectionRoute(value);if(!route)return;if(activeRenderKey)pageScrollCache.set(activeRenderKey,window.scrollY);if(state.page==='home')state.homeScroll=window.scrollY;
 if(state.page==='collection'){if(state.collectionStack.length>=12)state.collectionStack.shift();state.collectionStack.push(collectionSnapshot());}else state.collectionStack=[];
 state.collection={...route,title:title||route.title||'专题片库'};state.items=[];state.collectionGroups=[];state.page='collection';window.scrollTo(0,0);load();
}
function collectionView(){
 const grouped=!['topic','channel'].includes(state.collection?.kind);
 return `<div class="content collection-content"><h1 class="heading">${e(state.collection?.title||'专题片库')}</h1>${state.error?notice('栏目加载失败',state.error):''}
 ${state.loading&&!state.items.length&&!state.collectionGroups.length?loading():grouped?state.collectionGroups.map((group,index)=>`<section class="collection-group"><div class="sectiontop row"><h2>${e(group.title)}</h2>${group.route?`<button class="textbutton" data-act="collection-link" data-route="${e(group.route.url)}" data-title="${e(group.title)}">全部影片 ›</button>`:''}</div><div class="shelf collection-shelf" data-shelf="collection:${e(state.collection?.id||'root')}:${index}" aria-label="${e(group.title)}">${group.items.map(movie=>card(movie)).join('')}</div></section>`).join(''):grid(state.items)}
 ${!state.loading&&!state.error&&!state.items.length&&!state.collectionGroups.length?notice('暂无内容','可返回首页浏览其他栏目。','',''):''}
 ${state.next&&(state.items.length||state.collectionGroups.length)?`<button class="secondary loadmore" data-act="more" ${state.loading?'disabled':''}>${state.loading?'正在加载…':'加载更多'}</button>`:''}</div>`;
}
function saved(){const allRows=validSavedRows(state.savedTab).filter(row=>state.adultEnabled||!(row.movie.isAdult||Number(row.movie.channelId)===5)).sort((a,b)=>b.updated-a.updated),sourceIds=[...new Set(allRows.map(r=>r.siteId).filter(Boolean))];if(state.savedSourceFilter!=='all'&&!sourceIds.includes(state.savedSourceFilter))state.savedSourceFilter='all';const filtered=state.savedSourceFilter==='all'?allRows:allRows.filter(r=>r.siteId===state.savedSourceFilter),rows=state.savedSort==='title'?filtered.slice().sort((a,b)=>String(a.movie?.title||'').localeCompare(String(b.movie?.title||''),'zh-CN')):filtered,label=state.savedTab==='history'?'观看记录':'收藏',empty=state.savedTab==='history'?'开始播放后，影片和集数会保存在这里。':'点击影片上的收藏按钮，方便稍后继续观看。';const sortPill=filtered.length>=4?`<button type="button" class="chip saved-sort-chip" data-act="saved-sort-toggle" title="切换排序">${state.savedSort==='title'?'⇅ 按片名':'⇅ 按时间'}</button>`:'';const filterBar=(sourceIds.length>1||sortPill)?`<div class="saved-source-filters" role="group" aria-label="按来源筛选">${sourceIds.length>1?`<button type="button" class="chip ${state.savedSourceFilter==='all'?'active':''}" data-act="saved-source-filter" data-id="all">全部 (${allRows.length})</button>${sourceIds.map(sid=>{const sname=sites.find(s=>s.id===sid)?.name||sid,cnt=allRows.filter(r=>r.siteId===sid).length;return `<button type="button" class="chip ${state.savedSourceFilter===sid?'active':''}" data-act="saved-source-filter" data-id="${e(sid)}">${e(sname)} (${cnt})</button>`;}).join('')}`:''}${sortPill}</div>`:'';return `<section class="my-library"><div class="my-library-heading"><div><span class="eyebrow">MY LIBRARY</span><h2>${label}</h2></div><span class="my-library-count">${rows.length} 部</span></div>${filterBar}${rows.length?`<div class="grid">${rows.map(row=>{const sub=state.savedTab==='history'?[row.episodeTitle,row.time>0?(Number(row.duration)>60?`${formatDuration(row.time)}/${formatDuration(row.duration)}`:formatDuration(row.time)):''].filter(Boolean).join(' · '):undefined;return card(row.movie,row.siteId,sub,row.key||(row.siteId+':'+row.movie.id));}).join('')}</div><button class="my-clear-button" data-act="clear-saved">${state.savedTab==='favorites'?'清空收藏':'清空观看记录'}</button>`:notice(state.savedTab==='history'?'还没有观看记录':'还没有收藏影片',empty,'', '')}<p class="caption">收藏与观看记录仅保存在本机。</p></section>`;}
function me(){const tabs=[['favorites','收藏'],['history','观看记录'],['settings','设置']];return `<div class="me-page"><header class="me-intro"><span class="eyebrow">PERSONAL SPACE</span><h1>我的</h1><p>收藏、观看记录与应用偏好</p></header><div class="me-tabs" role="tablist" aria-label="我的页面">${tabs.map(([id,label])=>`<button role="tab" aria-selected="${state.meTab===id}" class="${state.meTab===id?'active':''}" data-act="me-tab" data-id="${id}">${label}</button>`).join('')}</div>${state.meTab==='settings'?settings():saved()}</div>`;}
const liveChannel=()=>state.liveChannels[state.liveCurrentIndex]||null;
const liveFavorite=channel=>state.liveFavorites.includes(channel?.identity||'');
function liveGroupCounts(){const counts=new Map();for(const channel of state.liveChannels){counts.set(channel.group,(counts.get(channel.group)||0)+1);if(liveFavorite(channel))counts.set('__favorites__',(counts.get('__favorites__')||0)+1);}return counts;}
function dayKey(timestamp){const d=new Date(timestamp);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function clockTime(timestamp){return new Date(timestamp).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});}
function liveGroupsMarkup(){if(!state.liveChannels.length)return `<div class="live-empty">先导入 M3U 播放列表，再按分类浏览频道。</div>`;const counts=liveGroupCounts();return `<div class="live-group-grid"><button data-act="live-category" data-id="__all__" class="live-group-card ${state.liveCategory==='__all__'?'active':''}"><span>全部频道</span><small>${state.liveChannels.length} 个频道</small></button><button data-act="live-category" data-id="__favorites__" class="live-group-card ${state.liveCategory==='__favorites__'?'active':''}"><span>♥ 我的收藏</span><small>${counts.get('__favorites__')||0} 个频道</small></button>${state.liveGroups.map(group=>{const count=counts.get(group)||0;return `<button data-act="live-category" data-id="${e(group)}" class="live-group-card ${state.liveCategory===group?'active':''}"><span>${e(group)}</span><small>${count} 个频道</small></button>`;}).join('')}</div>`;}
function liveFilteredChannels(){
 let channels=state.liveChannels;
 if(state.liveCategory==='__favorites__')channels=channels.filter(liveFavorite);else if(state.liveCategory&&state.liveCategory!=='__all__')channels=channels.filter(channel=>channel.group===state.liveCategory);
 const query=state.liveSearch.trim().toLocaleLowerCase();if(query)channels=channels.filter(channel=>`${channel.name} ${channel.tvgId} ${channel.group}`.toLocaleLowerCase().includes(query));
 return channels;
}
function liveChannelList(){
 const channels=liveFilteredChannels();
 const visible=channels.slice(0,state.liveVisibleCount);
 return `<form id="live-search-form" class="live-search"><div class="live-search-input-wrap"><input name="query" value="${e(state.liveSearch)}" placeholder="搜索频道名称、分组" aria-label="搜索直播频道"><button type="button" class="search-clear live-search-clear" data-act="live-search-clear" ${state.liveSearch?'':'hidden'} aria-label="清除频道搜索">×</button></div><button type="submit">搜索</button></form><div class="live-channel-list">${visible.map(channel=>`<article class="live-channel-row ${channel.index===state.liveCurrentIndex?'active':''}"><button class="live-channel-main" data-act="live-channel" data-id="${channel.index}" aria-current="${channel.index===state.liveCurrentIndex?'true':'false'}"><span class="live-channel-number">${String(channel.index+1).padStart(2,'0')}</span><span class="live-channel-logo">${liveLogo(channel)||`<b>${e(channel.name.slice(0,2))}</b>`}</span><span class="live-channel-copy"><strong>${e(channel.name)}</strong><small>${e(channel.group)} · ${channel.secure?'HTTPS':'HTTP · 未加密'}</small></span></button><button class="live-favorite ${liveFavorite(channel)?'active':''}" data-act="live-favorite" data-id="${channel.index}" aria-label="${liveFavorite(channel)?'取消':'加入'}收藏">${liveFavorite(channel)?'♥':'♡'}</button></article>`).join('')||`<div class="live-empty">${state.liveCategory==='__favorites__'?'还没有收藏频道':'没有找到匹配频道'}</div>`}</div>${channels.length>visible.length?`<button class="secondary live-load-more" data-act="live-more">加载更多 · 还剩 ${channels.length-visible.length} 个</button>`:''}`;
}
function liveProgramsPanel(channel){
 if(!channel)return `<div class="live-empty">先从频道列表选择频道。</div>`;
 if(!state.liveEPGUrl)return `<div class="live-empty">此播放列表没有提供节目单地址。</div>`;
 if(state.liveEPGLoading)return `<div class="live-empty"><span class="spinner"></span>正在读取节目单…</div>`;
 if(state.liveError&&!state.livePrograms.length)return `<div class="live-empty">${e(state.liveError)}<button class="textbutton" data-act="live-epg-refresh">重试</button></div>`;
 const days=[...new Set(state.livePrograms.map(program=>dayKey(program.start)))],today=dayKey(Date.now()),selectedDate=days.includes(state.liveProgramDate)?state.liveProgramDate:days.includes(today)?today:days[0]||today;
 const dateBase=new Date(`${selectedDate}T12:00:00`),dateOptions=Array.from({length:8},(_,index)=>{const date=new Date(dateBase);date.setDate(dateBase.getDate()-6+index);return dayKey(date.getTime());});
 const programs=state.livePrograms.filter(program=>dayKey(program.start)===selectedDate),now=Date.now();
 return `<div class="live-date-tabs" data-live-scroll="program-dates">${dateOptions.map(day=>{const date=new Date(`${day}T12:00:00`),weekday=day===today?'今天':new Intl.DateTimeFormat('zh-CN',{weekday:'short'}).format(date);return `<button data-act="live-date" data-id="${day}" class="${selectedDate===day?'active':''}"><b>${date.getDate()}</b><small>${weekday}</small></button>`;}).join('')}</div><div class="live-program-list">${programs.map((program,index)=>{const current=now>=program.start&&now<program.stop,pct=current?Math.min(100,Math.max(4,Math.round((now-program.start)/Math.max(1,program.stop-program.start)*100))):0;return `<button class="live-program ${current?'current':''} ${state.liveSelectedProgram?.start===program.start?'selected':''}" data-act="live-program" data-id="${index}"><time>${clockTime(program.start)}</time><span><strong>${e(program.title)}</strong><small>${program.subtitle?e(program.subtitle)+' · ':''}${clockTime(program.start)} – ${clockTime(program.stop)}</small>${current?`<i class="live-prog-bar"><b style="width:${pct}%"></b></i>`:''}</span><em>${current?'正在播出':program.start>now?'未播':'已播'}</em></button>`;}).join('')||`<div class="live-empty">所选日期暂无节目数据</div>`}</div><div class="live-program-footer"><span>节目表 · ${e(channel.name)}</span><span><button class="textbutton" data-act="live-epg-info">来源详情</button><button class="textbutton" data-act="live-epg-refresh">刷新</button></span></div>`;
}
function liveRoutesPanel(channel){
 if(!channel)return `<div class="live-empty">先选择一个频道，查看它的播放线路。</div>`;
 const routes=liveCandidateList(channel);
 return `<div class="live-route-list">${routes.map((route,index)=>`<button class="live-route ${state.liveVariantIndex===index?'active':''}" data-act="live-route" data-id="${index}"><span class="live-route-order">${index===state.liveVariantIndex?'✓':index+1}</span><span><strong>${e(route.name)}</strong><small>${e(route.group)} · ${route.secure?'HTTPS':'HTTP · 未加密'}</small></span><span class="live-route-state">${index===state.liveVariantIndex&&state.liveActive?'正在播放':route.secure?'可播放':'未加密线路'}</span></button>`).join('')||`<div class="live-empty">没有其他播放线路。</div>`}</div>`;
}
async function loadLivePlaylist(value=state.liveURL){
 state.liveInitialAttempted=true;
 let url;try{url=normalizePlaylistURL(value);}catch{state.liveError='请输入有效的 HTTP 或 HTTPS M3U 地址。';state.liveImportOpen=true;render();return;}
 state.liveImportController?.abort();const controller=new AbortController();state.liveImportController=controller;state.liveURL=url.href;localStorage.setItem('sanyuan:livePlaylistURL',url.href);state.liveLoading=true;state.liveError='';render();
 try{const fetchURL=new URL(url.href);fetchURL.searchParams.set('_sanyuan_refresh',String(Date.now()));const response=await native.request({url:fetchURL.href,method:'GET',headers:{Accept:'application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*','Cache-Control':'no-cache','Pragma':'no-cache'},livePlaylist:true,signal:controller.signal});if(response.status<200||response.status>=300)throw Error(`播放列表请求失败（HTTP ${response.status}）`);const baseURL=normalizePlaylistURL(response.url||url.href).href,text=decodePlaylist(response.bodyBase64),parsed=await parseM3UIncremental(text,baseURL,{signal:controller.signal});if(controller.signal.aborted)return;
  let saved=true;try{await native.saveLiveCache(url.href,text,baseURL);if(controller.signal.aborted)return;state.liveCacheFound=true;}catch{saved=false;}
  if(controller.signal.aborted)return;
  applyLivePlaylist(parsed,url.href,baseURL);state.liveStatus=`${url.protocol==='http:'?'HTTP 列表未加密 · ':''}已导入 ${parsed.channels.length.toLocaleString()} 个频道${saved?' · 已保存在本机':' · 本地保存失败，请检查设备空间'}`;
  const preferred=liveChannel();if(state.page==='live'&&preferred)queueMicrotask(()=>playLiveVariant(0));
 }catch(error){if(error.name!=='AbortError'&&!controller.signal.aborted)state.liveError=error.message||'无法读取 M3U 播放列表';}
 finally{if(state.liveImportController===controller){state.liveLoading=false;state.liveImportController=null;render();}}
}
function applyLivePlaylist(parsed,url,baseURL=url){
 state.liveGuideController?.abort();state.liveGuideController=null;state.liveEPGCache.clear();state.liveEPGText='';state.livePrograms=[];
 state.liveChannels=parsed.channels;state.liveGroups=parsed.groups;state.liveAlternateIndex=indexChannelAlternates(parsed.channels);state.liveEPGUrl=parsed.epgUrl;state.liveLoadedURL=baseURL;state.liveURL=url;localStorage.setItem('sanyuan:livePlaylistURL',url);state.liveCategory='__all__';state.livePanel='channels';state.liveVisibleCount=80;state.liveNativeVisibleCount=40;state.liveSearch='';state.liveImportOpen=false;state.liveSelectedRoute=null;state.liveTriedURLs.clear();
 const preferred=parsed.channels.find(channel=>/CCTV\s*[- ]?1综合/i.test(channel.name))||parsed.channels[0];
 state.liveCurrentIndex=preferred?.index??-1;state.liveVariantIndex=0;state.livePrograms=[];state.liveProgramDate='';state.liveSelectedProgram=null;
}
async function restoreLivePlaylist(){
 try{const cached=await native.getLiveCache();if(state.liveInitialAttempted||!cached?.url||typeof cached.text!=='string'||!cached.text)return false;state.liveCacheFound=true;const baseURL=normalizePlaylistURL(cached.baseURL||cached.url).href,parsed=await parseM3UIncremental(cached.text,baseURL);if(state.liveInitialAttempted)return false;applyLivePlaylist(parsed,cached.url,baseURL);state.liveStatus=`${cached.url.startsWith('http:')?'HTTP 列表未加密 · ':''}已从本机读取 ${parsed.channels.length.toLocaleString()} 个频道`;if(state.page==='live')render();return true;}
 catch(error){state.liveCacheFound=true;state.liveError='本地直播列表读取失败，请手动更新。';return false;}
}
const liveCacheReady=restoreLivePlaylist();
async function loadLiveGuide({force=false}={}){
 const channel=liveChannel();if(!channel||!state.liveEPGUrl)return;state.liveGuideController?.abort();const controller=new AbortController();state.liveGuideController=controller;const identity=channel.identity,key=channel.tvgId||channel.name;if(force){state.liveEPGText='';state.liveEPGCache.clear();}const cached=state.liveEPGCache.get(key);if(cached){state.livePrograms=cached;state.liveProgramDate='';state.liveError='';state.liveEPGLoading=false;state.liveGuideController=null;render();return;}
 state.liveEPGLoading=true;state.liveError='';render();try{if(!state.liveEPGText){const response=await native.request({url:state.liveEPGUrl,method:'GET',headers:{Accept:'application/xml, text/xml, */*'},liveGuide:true,signal:controller.signal});if(response.status<200||response.status>=300)throw Error(`节目单请求失败（HTTP ${response.status}）`);const xml=decodePlaylist(response.bodyBase64);if(controller.signal.aborted||liveChannel()?.identity!==identity)return;state.liveEPGText=xml;}if(controller.signal.aborted||liveChannel()?.identity!==identity)return;const programs=parseXMLTV(state.liveEPGText,key);state.livePrograms=programs;state.liveEPGCache.set(key,programs);state.liveProgramDate='';if(!programs.length)state.liveError='节目单里没有找到这个频道（频道 ID：'+key+'）';}catch(error){if(error.name!=='AbortError'&&!controller.signal.aborted&&liveChannel()?.identity===identity)state.liveError=error.message||'无法读取节目单';}finally{if(state.liveGuideController===controller){state.liveGuideController=null;state.liveEPGLoading=false;render();}}
}
function liveCandidateList(channel){const seen=new Set();return channelAlternates(state.liveChannels,channel,state.liveAlternateIndex).slice().sort((a,b)=>a.index===channel.index?-1:b.index===channel.index?1:a.index-b.index).filter(r=>r?.url&&!seen.has(r.url)&&seen.add(r.url));}
async function playLiveVariant(variantIndex=0,{automatic=false,retrySame=false}={}){
 const channel=liveChannel();if(!channel)return;const routes=liveCandidateList(channel),route=routes[variantIndex];if(!route)return;
 state.liveVideoReady=false;state.liveVideoFormat=null;state.liveVariantIndex=variantIndex;state.liveTriedURLs.add(route.url);state.liveCurrentIndex=channel.index;state.liveActive=true;state.liveLastPlaybackTime=null;state.livePlaybackProgressAt=Date.now();if(!retrySame)state.liveRendererRetry=0;state.liveStatus=retrySame?'正在重建画面渲染，当前线路保持不变…':automatic?'正在切换备用线路…':route.secure?'正在连接…':'HTTP 未加密 · 正在连接…';state.liveError='';if(!['programs','routes'].includes(state.livePanel))state.livePanel='channels';render({liveFast:true});
 if(!native.native()){const video=$('#live-video');if(video)await video.play().catch(()=>{});return;}
 // Keep one playback context for all mirrors of this channel. The native bridge
 // can then replace the AVPlayerItem in place instead of tearing down the view.
 const context='live:'+channel.identity+':'+variantIndex;nativeSession={context,kind:'live',session:{channelId:channel.tvgId||channel.name,title:channel.name}};
 let referer=state.liveLoadedURL;try{referer=new URL(referer).origin+'/';}catch{}
 try{await native.play(route.url,{Referer:referer},{cleanHLS:false,context,frame:playerFrame(),title:channel.name});}catch(error){if(nativeSession?.context===context)await handleLivePlaybackFailure(error.message);}
}
async function handleLivePlaybackFailure(message=''){
 if(state.page!=='live')return;
 const channel=liveChannel(),routes=liveCandidateList(channel);state.liveActive=false;const next=nextUntriedRouteIndex(routes,state.liveTriedURLs);
 if(next>=0){state.liveStatus='线路异常，正在尝试备用源';toast('直播源连接失败，切换备用线路');await playLiveVariant(next,{automatic:true});return;}
 state.liveError=message||'直播源暂时无法播放。可重试或切换线路。';state.liveStatus='播放失败';state.liveActive=false;native.stopLive();nativeSession=null;render();
}
function nativeLiveSnapshot(){
 const channel=liveChannel(),routes=channel?liveCandidateList(channel):[],groupCounts=liveGroupCounts();
 let channels=state.liveChannels;if(state.liveCategory==='__favorites__')channels=channels.filter(liveFavorite);else if(state.liveCategory&&state.liveCategory!=='__all__')channels=channels.filter(item=>item.group===state.liveCategory);
 const query=state.liveSearch.trim().toLocaleLowerCase();if(query)channels=channels.filter(item=>`${item.name} ${item.tvgId} ${item.group}`.toLocaleLowerCase().includes(query));
 const days=[...new Set(state.livePrograms.map(item=>dayKey(item.start)))],today=dayKey(Date.now()),selectedDate=days.includes(state.liveProgramDate)?state.liveProgramDate:days.includes(today)?today:days[0]||today;
 const nativeCount=Math.min(state.liveNativeVisibleCount,state.liveVisibleCount),routesForChannel=channel?liveCandidateList(channel):[],categoryName=state.liveCategory==='__all__'?'全部频道':state.liveCategory==='__favorites__'?'我的收藏':state.liveCategory||'全部频道',groups=state.liveChannels.length?[{name:'全部频道',count:state.liveChannels.length,value:'__all__',active:state.liveCategory==='__all__'},{name:'♥ 我的收藏',count:groupCounts.get('__favorites__')||0,value:'__favorites__',active:state.liveCategory==='__favorites__'},...state.liveGroups.map(name=>({name,count:groupCounts.get(name)||0,value:name,active:state.liveCategory===name}))]:[];return {theme:state.theme,title:channel?.name||'直播',group:channel?.group||'',status:state.liveError||state.liveStatus||'',url:state.liveURL,loading:state.liveLoading,search:state.liveSearch,panel:state.livePanel,category:state.liveCategory,categoryName,filteredChannelCount:channels.length,active:state.liveActive,channelIndex:state.liveCurrentIndex,channelCount:state.liveChannels.length,favoriteCurrent:liveFavorite(channel),groups,channels:channels.slice(0,nativeCount).map(item=>({index:item.index,name:item.name,group:item.group,secure:item.secure,favorite:liveFavorite(item),active:item.index===state.liveCurrentIndex})),hasMore:channels.length>nativeCount,routes:routes.map(item=>({index:routesForChannel.findIndex(route=>route.url===item.url),name:item.name,group:item.group,secure:item.secure,active:item.url===routesForChannel[state.liveVariantIndex]?.url})),programs:state.livePrograms.filter(item=>dayKey(item.start)===selectedDate).map((item,index)=>({index,title:item.title,start:clockTime(item.start),subtitle:item.subtitle||'',description:item.description||''})),selectedProgram:state.liveSelectedProgram?{title:state.liveSelectedProgram.title,subtitle:state.liveSelectedProgram.subtitle||'',description:state.liveSelectedProgram.description||'',start:clockTime(state.liveSelectedProgram.start),stop:clockTime(state.liveSelectedProgram.stop)}:null,selectedRoute:state.liveSelectedRoute?{name:state.liveSelectedRoute.name,group:state.liveSelectedRoute.group,url:state.liveSelectedRoute.url,secure:state.liveSelectedRoute.secure}:null,sheet:state.liveSheet,channelInfo:channel?{name:channel.name,tvgId:channel.tvgId||'未提供',tvgName:channel.tvgName||channel.name,group:channel.group,url:channel.url,epgUrl:state.liveEPGUrl||'未提供'}:null,epgUrl:state.liveEPGUrl||'',epgLoading:state.liveEPGLoading,hasEPG:!!state.liveEPGUrl,selectedDate,days};
}
function liveCurrentProgram(channel=liveChannel()){if(!channel)return null;const key=channel.tvgId||channel.name,progs=state.livePrograms.length?state.livePrograms:(state.liveEPGCache.get(key)||[]),now=Date.now();return progs.find(p=>now>=p.start&&now<p.stop)||null;}
function liveNextProgram(channel=liveChannel()){if(!channel)return null;const key=channel.tvgId||channel.name,progs=state.livePrograms.length?state.livePrograms:(state.liveEPGCache.get(key)||[]),now=Date.now();return progs.find(p=>p.start>now)||null;}
function liveFormatLabel(format=state.liveVideoFormat){if(!format)return '';const dimensions=format.width&&format.height?`${format.width}×${format.height}`:'分辨率未知';return `${dimensions} ${format.codec||''}`.trim();}
window.NativeLiveRequestState=()=>native.syncLive(nativeLiveSnapshot());
window.NativeLiveSnapshot=nativeLiveSnapshot;
window.NativeLiveAction=(act,id='')=>{
 if(act==='live-import'){void loadLivePlaylist(String(id||''));return;}
 if(act==='live-search'){state.liveSearch=String(id||'').trim();state.liveVisibleCount=80;state.liveNativeVisibleCount=40;render();return;}
 if(act==='live-panel'){state.livePanel=String(id||'channels');render();if(state.livePanel==='programs')loadLiveGuide();return;}
 if(act==='live-native-route'){state.liveTriedURLs.clear();state.liveError='';void playLiveVariant(Number(id));return;}
 if(act==='live-more'){state.liveNativeVisibleCount+=40;state.liveVisibleCount=Math.max(state.liveVisibleCount,state.liveNativeVisibleCount);render();return;}
 const button=document.createElement('button');button.dataset.act=act;if(id!==undefined&&id!==null)button.dataset.id=String(id);button.hidden=true;root.append(button);button.click();button.remove();
};
function livePage(){
 const channel=liveChannel(),hasChannels=state.liveChannels.length>0,fmt=liveFormatLabel(),curProg=liveCurrentProgram(channel),nextProg=liveNextProgram(channel);
 const screen=native.native()?`<div id="native-player-slot" class="native-card live-native-card"><span>${channel?e(state.liveStatus||channel.name):'选择频道开始直播'}</span></div>`:state.liveActive&&channel?`<video id="live-video" data-aspect="${e(state.aspectMode)}" controls autoplay playsinline preload="none" src="${e(liveCandidateList(channel)[state.liveVariantIndex]?.url||channel.url)}"></video>`:`<div class="live-screen-placeholder"><span class="live-screen-mark">${channel?e(channel.name.slice(0,2)):'LIVE'}</span><strong>${channel?e(channel.name):'三源直播'}</strong><small>${channel?e(state.liveStatus||'点击播放，开始观看'):hasChannels?'请选择一个频道':'导入 M3U 播放列表即可开始'}</small>${channel&&!state.liveActive?`<button class="live-start" data-act="live-play">▶ 播放直播</button>`:''}</div>`;
 const importForm=`<form id="live-import-form" class="live-import-form" ${state.liveImportOpen?'':'hidden'}><label for="live-playlist-url">M3U 播放列表地址</label><div><input id="live-playlist-url" name="url" type="text" inputmode="url" autocapitalize="off" spellcheck="false" value="${e(state.liveURL)}" placeholder="https:// 或 http:// 播放列表地址" required><button class="live-import-button" type="submit">${state.liveLoading?'正在导入…':'导入 / 更新'}</button><button class="live-reset-button" type="button" data-act="live-reset-default" title="恢复默认直播源">默认源</button></div><small>可省略 http://；导入后保存到本机，打开直播时不自动更新。HTTP 传输未加密；建议优先使用 HTTPS。</small></form>`;
 const panelContent=state.liveLoading&&!hasChannels?`<div class="live-empty"><span class="spinner"></span>正在加载 M3U 频道…</div>`:state.liveError&&!hasChannels?`<div class="live-error"><strong>导入失败</strong><span>${e(state.liveError)}</span><button class="secondary" data-act="live-import-open">检查地址并重试</button></div>`:state.livePanel==='categories'?liveGroupsMarkup():state.livePanel==='programs'?liveProgramsPanel(channel):state.livePanel==='routes'?liveRoutesPanel(channel):liveChannelList();
 const routes=liveCandidateList(channel),routeIndex=routes.findIndex(item=>item.url===routes[state.liveVariantIndex]?.url),selectedRoute=state.liveSelectedRoute||routes[routeIndex>=0?routeIndex:0],programDays=[...new Set(state.livePrograms.map(program=>dayKey(program.start)))],today=dayKey(Date.now()),guideDate=programDays.includes(state.liveProgramDate)?state.liveProgramDate:programDays.includes(today)?today:programDays[0]||today;
 let sheet='';
 if(state.liveSheet==='channel'&&channel)sheet=`<span class="live-eyebrow">频道信息</span><h2>${e(channel.name)}</h2><dl><dt>频道 ID (tvg-id)</dt><dd>${e(channel.tvgId||'未提供')}</dd><dt>频道名称 (tvg-name)</dt><dd>${e(channel.tvgName||channel.name)}</dd><dt>频道分组</dt><dd>${e(channel.group)}</dd><dt>节目单 ID</dt><dd>${e(channel.tvgId||channel.name)}</dd><dt>播放地址</dt><dd class="live-sheet-url">${e(channel.url)}</dd>${state.liveEPGUrl?`<dt>节目单地址</dt><dd class="live-sheet-url">${e(state.liveEPGUrl)}</dd>`:''}</dl><button class="live-sheet-action" data-act="live-sheet-dismiss">完成</button>`;
 else if(state.liveSheet==='program'&&state.liveSelectedProgram)sheet=`<span class="live-eyebrow">节目单详情</span><h2>${e(state.liveSelectedProgram.title)}</h2>${state.liveSelectedProgram.subtitle?`<h3>${e(state.liveSelectedProgram.subtitle)}</h3>`:''}<p>${channel?e(channel.name):''} · ${clockTime(state.liveSelectedProgram.start)} – ${clockTime(state.liveSelectedProgram.stop)}</p>${state.liveSelectedProgram.description?`<p>${e(state.liveSelectedProgram.description)}</p>`:''}${state.liveSelectedProgram.categories?.length?`<div class="live-sheet-tags">${state.liveSelectedProgram.categories.map(label=>`<span>${e(label)}</span>`).join('')}</div>`:''}<button class="live-sheet-action" data-act="live-sheet-dismiss">完成</button>`;
 else if(state.liveSheet==='guide')sheet=`<span class="live-eyebrow">EPG 指南</span><h2>${e(channel?.name||'节目单来源')}</h2><dl><dt>频道 ID (tvg-id)</dt><dd>${e(channel?.tvgId||'未提供')}</dd><dt>频道名称 (tvg-name)</dt><dd>${e(channel?.tvgName||channel?.name||'')}</dd><dt>节目单匹配字段</dt><dd>${channel?.tvgId?'tvg-id':'频道名称'}</dd><dt>匹配值</dt><dd>${e(channel?.tvgId||channel?.name||'')}</dd><dt>选中日期</dt><dd>${e(guideDate)}</dd><dt>EPG 来源</dt><dd class="live-sheet-url">${e(state.liveEPGUrl||'此播放列表未提供')}</dd><dt>已读取节目</dt><dd>${state.livePrograms.length} 条</dd></dl><button class="live-sheet-action" data-act="live-sheet-dismiss">完成</button>`;
 else if(state.liveSheet==='route'&&selectedRoute)sheet=`<span class="live-eyebrow">播放线路</span><h2>${e(selectedRoute.name)}</h2><p>${e(selectedRoute.group)} · ${selectedRoute.secure?'HTTPS':'HTTP · 未加密'}</p><p class="live-sheet-url">${e(selectedRoute.url)}</p><button class="live-sheet-action" data-act="live-route-system" data-id="${selectedRoute.index}">系统播放器 · 自动硬件解码</button><button class="live-sheet-secondary" data-act="live-route-vlc" data-id="${selectedRoute.index}">在 VLC 播放</button><button class="live-sheet-secondary" data-act="live-route-copy" data-id="${selectedRoute.index}">复制线路地址</button>`;
 return `<div class="live-shell"><div class="live-pinned"><header class="live-topbar"><button class="live-back" data-act="live-back" aria-label="返回上一页">‹</button><div class="live-top-title"><strong>${channel?e(channel.name):'直播'}</strong><small>${channel?e(channel.group)+' · '+e(state.liveStatus||'频道'):hasChannels?'已导入 '+state.liveChannels.length+' 个频道':'M3U 直播频道'}</small></div><div class="live-top-actions"><button data-act="live-import-open" aria-label="管理播放源" title="管理 M3U 地址">⊕</button><button data-act="live-favorite-current" aria-label="收藏频道" class="${channel&&liveFavorite(channel)?'active':''}">${channel&&liveFavorite(channel)?'♥':'♡'}</button><button data-act="live-airplay" aria-label="AirPlay 投放">▣</button><button data-act="live-channel-info" aria-label="频道信息">ⓘ</button></div></header>${importForm}<section class="live-player-card"><div class="live-player-screen">${screen}<span class="live-live-badge">${state.liveActive?'● LIVE':'LIVE'}</span>${fmt?`<span class="live-format-badge">${e(fmt)}</span>`:''}${native.native()?'':`<button class="live-fullscreen" data-act="live-fullscreen" aria-label="全屏播放">⛶</button>`}</div><div class="live-now-row">${channel?`${liveLogo(channel)?`<span class="live-now-logo">${liveLogo(channel)}</span>`:`<span class="live-now-logo fallback">${e(channel.name.slice(0,2))}</span>`}<span class="live-now-copy"><strong>${e(channel.name)}</strong><small>${curProg?`正在播出：${e(curProg.title)}${nextProg?` · 即将：${e(nextProg.title)}`:''} · `:``}${e(channel.group)} · ${e(state.liveStatus||'已选择')}</small></span><div class="live-quick-actions"><button class="live-step-btn" data-act="live-step" data-id="-1" title="上一频道" aria-label="上一频道">⏮</button><button class="live-step-btn" data-act="live-step" data-id="1" title="下一频道" aria-label="下一频道">⏭</button><button class="live-step-btn" data-act="player-aspect" title="切换画面比例">${state.aspectMode==='fill'?'铺满':state.aspectMode==='stretch'?'拉伸':'适应'}</button><button class="live-now-play" data-act="live-play">${state.liveActive?'重连':'播放'}</button></div>`:`<span class="live-now-copy"><strong>选择频道开始观看</strong><small>${e(state.liveStatus||'支持 M3U / M3U8')}</small></span>`}</div></section>${state.liveError&&hasChannels?`<div class="live-inline-error" role="status">${e(state.liveError)}</div>`:''}<nav class="live-panel-tabs" data-live-scroll="panel-tabs" aria-label="直播内容"><button data-act="live-panel" data-id="categories" class="${state.livePanel==='categories'?'active':''}">分类</button><button data-act="live-panel" data-id="channels" class="${state.livePanel==='channels'?'active':''}">频道</button><button data-act="live-panel" data-id="programs" class="${state.livePanel==='programs'?'active':''}">节目</button><button data-act="live-panel" data-id="routes" class="${state.livePanel==='routes'?'active':''}">${routeIndex>=0?`${routeIndex+1}/${routes.length} `:'0/0 '}线路</button></nav></div>${state.livePanel==='channels'&&hasChannels?`<div class="live-category-row" data-live-scroll="channel-categories"><button data-act="live-category" data-id="__all__" class="${state.liveCategory==='__all__'?'active':''}">全部频道</button><button data-act="live-category" data-id="__favorites__" class="${state.liveCategory==='__favorites__'?'active':''}">♥ 收藏</button>${state.liveGroups.slice(0,12).map(group=>`<button data-act="live-category" data-id="${e(group)}" class="${state.liveCategory===group?'active':''}">${e(group)}</button>`).join('')}${state.liveGroups.length>12?`<button data-act="live-panel" data-id="categories">全部分类 ›</button>`:''}</div>`:''}<section class="live-panel-content">${panelContent}</section>${state.liveSheet?`<div class="live-sheet-backdrop" data-act="live-sheet-dismiss"><section class="live-sheet-card"><button class="live-sheet-close" data-act="live-sheet-dismiss" aria-label="关闭">×</button>${sheet}</section></div>`:''}</div>`;
}

const SITE_FEATURES = {
 kkapp:{tag:'主线片库 · 自动 HLS 净化',protocol:'AES-CBC 加密 · 静态 CDN 镜像'},
 ncat:{tag:'网飞专区 · 海外精选剧集',protocol:'AES-CBC 签名 · 专线端口'},
 happ:{tag:'经典院线 · 高清多线路',protocol:'AES-CBC 签名 · 备用多集群'},
 souju:{tag:'AI 智能索引 · 聚合直连',protocol:'HMAC-SHA256 · 动态令牌'},
 yqk:{tag:'蓝光秒播 · 多码率自适应',protocol:'动态 API 轮询 · 分布式 CDN'},
 qntv:{tag:'综合影视 · 体育竞技频道',protocol:'动态 API 轮询 · 双通道防盗链'},
 dyls:{tag:'4K 原画 · 院线大片首发',protocol:'RSA+AES 双重加密 · 接口混淆'},
 kanju:{tag:'聚合解析 · 智能冗余直连',protocol:'HMAC 签名鉴权 · 双通道解析'}
};

async function probeSite(siteObj,{timeout=6000}={}){
 const c=clients.get(siteObj.id);if(!c)return {ok:false,ms:0,status:'未注册'};
 const start=Date.now(),ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  if(!c.config)await c.bootstrap(ctrl.signal);
  else await c.home(ctrl.signal);
  const ms=Math.max(1,Date.now()-start);
  const result={ok:true,ms,status:'握手正常',timestamp:Date.now()};
  state.siteHealth[siteObj.id]=result;
  write('siteHealth',state.siteHealth);
  return result;
 }catch(error){
  const ms=Date.now()-start,isTimeout=error.name==='AbortError'||/超时/i.test(error.message);
  const result={ok:false,ms:isTimeout?timeout:ms,status:isTimeout?'响应超时':(error.message||'连接失败').slice(0,32),timestamp:Date.now()};
  state.siteHealth[siteObj.id]=result;
  write('siteHealth',state.siteHealth);
  return result;
 }finally{
  clearTimeout(timer);
 }
}

async function probeAllSites(){
 if(state.siteProbing)return;
 state.siteProbing=true;render();
 toast('正在并发探测全部 8 大片源连通性…');
 let fastName='',fastMs=Infinity;
 await Promise.all(sites.map(async s=>{
  const res=await probeSite(s);
  if(res.ok&&res.ms<fastMs){fastMs=res.ms;fastName=s.name;}
  if(['me','settings'].includes(state.page))render();
 }));
 state.siteProbing=false;render();
 if(native.native())native.syncPage(nativePageSnapshot());
 toast(fastName?`全网测速完成 · 最快片源：${fastName} (${fastMs} ms)`:'全网测速完成');
}

function settings(){
 const c=client(),user=c.user,supportsAcc=c.config?.supportsAccount!==false;
 const accountTitle=!supportsAcc?'公开直连片库':user?(c.sessionKind==='guest'?'访客会话已连接':'个人账号已登录'):'未建立会话';
 const accountDetail=!supportsAcc?'无需登录即可浏览与播放全部公开资源':user&&c.sessionKind!=='guest'?(`${user.nickname||user.account||'已登录'} · ${site().name}`):'搜索与播放会自动建立匿名访客会话；原站要求权限时可登录';
 const lineKinds=[['cache','片库数据节点'],['logic','搜索与鉴权节点']];
 const favCount=validSavedRows('favorites').length,histCount=validSavedRows('history').length,sec=state.settingsSection||'all';
 const showSec=id=>sec==='all'||sec===id?'':'hidden';
 const aspectLabel=state.aspectMode==='fill'?'铺满裁剪':state.aspectMode==='stretch'?'全屏拉伸':'适应比例';
 return `<div class="settings-page">
  <section class="settings-dashboard" aria-label="系统状态总览">
   <div class="settings-stat-card accent-card">
    <span class="stat-eyebrow">当前片源 · SOURCE</span>
    <strong>${e(site().name)}</strong>
    <small>${e(accountTitle)}</small>
   </div>
   <div class="settings-stat-card">
    <span class="stat-eyebrow">播放内核 · ENGINE</span>
    <strong>${state.playbackRate}× · ${aspectLabel}</strong>
    <small>片头 +${state.skipIntroSeconds}s · ${state.skipOutroSeconds>0?('片尾 -'+state.skipOutroSeconds+'s'):'片尾正常'}</small>
   </div>
   <div class="settings-stat-card">
    <span class="stat-eyebrow">广告净化 · GUARD</span>
    <strong>${state.cleanHLS?'智能守护已开启':'净化已暂停'}</strong>
    <small>${state.removedAdSegments>0?(`本次已拦截 ${state.removedAdSegments} 段 (${Math.round(state.removedAdSeconds)}s)`):'自动剥离切片广告'}</small>
   </div>
   <div class="settings-stat-card">
    <span class="stat-eyebrow">本机片库 · STORAGE</span>
    <strong>${favCount} 收藏 · ${histCount} 记录</strong>
    <small>搜索词 ${state.searchHistory.length} 条 · 独立沙盒存储</small>
   </div>
  </section>

  <nav class="settings-nav-pills" role="tablist" aria-label="设置分组筛选">
   ${[['all','全部设置'],['playback','▶ 播放引擎'],['appearance','◐ 外观与视图'],['network','⌁ 线路与账户'],['storage','◎ 存储与关于']].map(([id,label])=>`<button type="button" role="tab" aria-selected="${sec===id}" class="settings-pill ${sec===id?'active':''}" data-act="settings-section" data-id="${id}">${label}</button>`).join('')}
  </nav>

  <section class="settings-card" aria-labelledby="settings-playback-title" ${showSec('playback')}>
   <div class="settings-card-heading">
    <span class="settings-icon">▶</span>
    <div><h2 id="settings-playback-title">播放体验与引擎增强</h2><p>定制双核解码、智能去广告、连播及手势步长</p></div>
    <button type="button" class="settings-action quiet" data-act="reset-playback-prefs">恢复默认</button>
   </div>
   <div class="settings-switch-grid">
    <label class="settings-switch-tile ${state.cleanHLS?'is-on':''}">
     <div class="switch-tile-top">
      <strong>HLS 广告智能净化</strong>
      <input type="checkbox" data-clean-hls ${state.cleanHLS?'checked':''} aria-label="过滤播放清单广告">
     </div>
     <small>自动移除点播 M3U8 切片广告，保留正片时间轴${state.removedAdSegments>0?(` · 已净 ${state.removedAdSegments} 段`):''}</small>
    </label>
    <label class="settings-switch-tile ${state.autoNext?'is-on':''}">
     <div class="switch-tile-top">
      <strong>剧集自动无缝连播</strong>
      <input type="checkbox" data-auto-next ${state.autoNext?'checked':''} aria-label="自动连播下一集">
     </div>
     <small>单集播放完毕或到达片尾阈值时自动切入下一集</small>
    </label>
   </div>
   <div class="settings-note">提示：播放画面支持左右双击快进/快退 15 秒、长按画面开启 2.0× 临时倍速播放。如个别源出现跳段可关闭广告净化重试。</div>
   <div class="settings-option">
    <div class="settings-label"><strong>默认播放倍速</strong><small>支持播放中在座舱栏实时循环切换</small></div>
    <div class="settings-segmented">${[0.75,1,1.25,1.5,2].map(rate=>`<button type="button" class="${state.playbackRate===rate?'active':''}" data-act="playback-rate-btn" data-id="${rate}" aria-pressed="${state.playbackRate===rate}">${rate}×</button>`).join('')}</div>
    <select data-player-rate aria-label="默认播放倍速" hidden>${[0.5,0.75,1,1.25,1.5,2].map(rate=>`<option value="${rate}" ${rate===state.playbackRate?'selected':''}>${rate}×</option>`).join('')}</select>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>默认画面比例</strong><small>适应原始比例、全屏裁剪铺满或拉伸填充</small></div>
    <div class="settings-segmented">${[['fit','适应'],['fill','铺满'],['stretch','拉伸']].map(([mode,label])=>`<button type="button" class="${state.aspectMode===mode?'active':''}" data-act="aspect-setting" data-id="${mode}" aria-pressed="${state.aspectMode===mode}">${label}</button>`).join('')}</div>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>跳过片头步长</strong><small>点击座舱栏“跳过片头”单次快进秒数</small></div>
    <div class="settings-segmented">${[60,90,120].map(sec=>`<button type="button" class="${state.skipIntroSeconds===sec?'active':''}" data-act="skip-intro-setting" data-id="${sec}" aria-pressed="${state.skipIntroSeconds===sec}">${sec}秒</button>`).join('')}</div>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>自动跳过片尾</strong><small>长视频距结束剩余指定秒数时自动切下一集</small></div>
    <div class="settings-segmented">${[[0,'关闭'],[60,'60秒'],[90,'90秒'],[120,'120秒']].map(([sec,lbl])=>`<button type="button" class="${state.skipOutroSeconds===sec?'active':''}" data-act="skip-outro-setting" data-id="${sec}" aria-pressed="${state.skipOutroSeconds===sec}">${lbl}</button>`).join('')}</div>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>睡眠定时停播</strong><small>倒计时结束或本集播完后自动暂停点播与直播</small></div>
    <div class="settings-segmented">${[['off','关闭'],['episode','本集完'],['15','15分'],['30','30分'],['60','60分']].map(([m,lbl])=>`<button type="button" class="${state.sleepTimerMode===m?'active':''}" data-act="sleep-timer-setting" data-id="${m}" aria-pressed="${state.sleepTimerMode===m}">${lbl}</button>`).join('')}</div>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>播放诊断</strong><small>最近 20 条播放事件（开始播放、卡顿、改用软解、失败），仅保存在本机</small></div>
    <button type="button" class="settings-action" data-act="page" data-id="diagnostics">查看诊断日志</button>
   </div>
  </section>

  <section class="settings-card" aria-labelledby="settings-appearance-title" ${showSec('appearance')}>
   <div class="settings-card-heading">
    <span class="settings-icon">◐</span>
    <div><h2 id="settings-appearance-title">外观与片库视图</h2><p>切换沉浸式日夜主题、海报列数与内容分级</p></div>
   </div>
   <div class="theme-picker-grid" role="group" aria-label="全局主题选择">
    <button type="button" class="theme-card light-preview ${state.theme==='white'?'active':''}" data-act="theme" data-id="white" aria-pressed="${state.theme==='white'}">
     <div class="theme-swatch"><span class="sw-bg"></span><span class="sw-accent"></span></div>
     <div class="theme-meta"><strong>浅色晨曦</strong><small>明亮日间视图</small></div>
     <span class="theme-check">${state.theme==='white'?'✓':'○'}</span>
    </button>
    <button type="button" class="theme-card dark-preview ${state.theme==='black'?'active':''}" data-act="theme" data-id="black" aria-pressed="${state.theme==='black'}">
     <div class="theme-swatch"><span class="sw-bg"></span><span class="sw-accent"></span></div>
     <div class="theme-meta"><strong>深邃影院</strong><small>暗光沉浸视图</small></div>
     <span class="theme-check">${state.theme==='black'?'✓':'○'}</span>
    </button>
   </div>
   <div class="settings-option">
    <div class="settings-label"><strong>每行海报密度</strong><small>首页、发现与分类页网格列数 · 当前 ${state.columns} 列</small></div>
    <div class="settings-segmented four">${['3','4','5','6'].map(value=>`<button type="button" class="${state.columns===value?'active':''}" data-act="columns" data-id="${value}" aria-pressed="${state.columns===value}">${value}列</button>`).join('')}</div>
   </div>
   <div class="settings-option settings-age-row">
    <div class="settings-label"><strong>成人分类 (18+)</strong><small>${state.adultEnabled?'已启用 · 显示片源提供的 18+ 频道':'默认隐藏 · 过滤片源中的成人分级内容'}</small></div>
    <button type="button" class="settings-action ${state.adultEnabled?'quiet':''}" data-act="adult-toggle">${state.adultEnabled?'关闭 18+':'启用 18+'}</button>
   </div>
   ${state.showAgeGate?`<div class="agebackdrop" data-act="age-cancel"><section class="agegate" role="dialog" aria-modal="true" aria-labelledby="age-title"><span class="agebadge">18+</span><h2 id="age-title">成人分类提示</h2><p>此分类可能包含仅适合成年人的内容。继续前请确认你已年满 18 周岁，并愿意自行承担浏览后果。站点提供的内容仍受当地法律和站点规则约束。</p><button class="primary" data-act="age-confirm">我已年满 18 周岁，继续</button><button class="secondary" data-act="age-cancel">返回</button></section></div>`:''}
  </section>

  <section class="settings-card site-connectivity-card" aria-labelledby="settings-sites-connectivity-title" ${showSec('network')}>
   <div class="settings-card-heading">
    <span class="settings-icon">⚡</span>
    <div><h2 id="settings-sites-connectivity-title">全网片源连通性与健康监测</h2><p>实时并发探测全部 8 大内置片源 API 与 CDN 握手延迟 · 智能推荐极速低延迟片源</p></div>
    <div class="settings-heading-btns">
     <button type="button" class="settings-action" data-act="probe-all-sites" ${state.siteProbing?'disabled':''}>${state.siteProbing?'⚡ 探测中…':'⚡ 全网一键测速'}</button>
     <button type="button" class="settings-action quiet" data-act="clear-site-health" title="清空测速历史">重置</button>
    </div>
   </div>
   ${(()=>{
    const healthEntries=Object.entries(state.siteHealth||{}).map(([id,h])=>({id,...h,site:sites.find(s=>s.id===id)})).filter(x=>x.site);
    const healthy=healthEntries.filter(x=>x.ok).sort((a,b)=>a.ms-b.ms);
    const fastest=healthy[0],curHealth=state.siteHealth?.[state.site];
    if(!fastest)return '';
    if(fastest.id!==state.site){
     return `<div class="site-recommend-banner alert"><span class="recommend-badge">⚡ 极速推荐</span><div class="recommend-info"><strong>检测到【${e(fastest.site.name)}】响应最快 · 延迟仅 ${fastest.ms} ms</strong><small>当前【${e(site().name)}】${curHealth?(curHealth.ok?`延迟 ${curHealth.ms} ms`:`异常 (${e(curHealth.status)})`):'未测'}。一键切换可显著降低海报与视频加载等待时间。</small></div><button type="button" class="settings-action" data-act="source" data-id="${e(fastest.id)}">立即切换</button></div>`;
    }
    return `<div class="site-recommend-banner success"><span class="recommend-badge">✓ 状态极佳</span><div class="recommend-info"><strong>当前使用的【${e(site().name)}】连通性最优 (${fastest.ms} ms)</strong><small>接口握手与媒体分发延迟极低，建议继续作为主用片源。</small></div></div>`;
   })()}
   <div class="site-connectivity-grid" role="group" aria-label="全网片源健康度列表">
    ${sites.map(s=>{
     const h=state.siteHealth?.[s.id],isCurrent=s.id===state.site,feat=SITE_FEATURES[s.id]||{tag:'影视片源',protocol:'HTTPS 安全直连'};
     let originHost=s.origin;try{originHost=new URL(s.origin).host;}catch{}
     const latencyClass=!h?'none':h.ok?(h.ms<300?'fast':h.ms<800?'medium':'slow'):'error';
     const latencyText=!h?'○ 未检测':h.ok?`● ${h.ms} ms · ${h.ms<300?'极速':h.ms<800?'良好':'较慢'}`:`✕ ${e(h.status||'连接失败')}`;
     return `<div class="site-conn-tile ${isCurrent?'is-current':''} ${h?.ok?'is-healthy':''}">
      <div class="site-conn-header">
       <div class="site-conn-title-group">
        <strong>${e(s.name)}</strong>
        ${isCurrent?'<span class="site-curr-tag">当前主源</span>':''}
       </div>
       <span class="site-latency-pill ${latencyClass}">${latencyText}</span>
      </div>
      <div class="site-conn-meta">
       <span class="site-conn-domain" title="${e(s.origin)}">🌐 ${e(originHost)}</span>
       <span class="site-conn-feature">${e(feat.tag)}</span>
       <span class="site-conn-protocol">${e(feat.protocol)}</span>
      </div>
      <div class="site-conn-footer">
       <button type="button" class="site-probe-btn" data-act="probe-site" data-id="${e(s.id)}" title="测试此站点连通性">⚡ 测速</button>
       ${isCurrent?`<button type="button" class="site-switch-btn current" disabled>✓ 正在使用</button>`:`<button type="button" class="site-switch-btn" data-act="source" data-id="${e(s.id)}" title="切换为主片源">一键切换</button>`}
      </div>
     </div>`;
    }).join('')}
   </div>
  </section>

  <section class="settings-card" aria-labelledby="settings-network-title" ${showSec('network')}>
   <div class="settings-card-heading">
    <span class="settings-icon">⌁</span>
    <div><h2 id="settings-network-title">当前片源节点监测</h2><p>当前片源：${e(site().name)} · 点击节点可手动锁定优先线路</p></div>
    <button type="button" class="settings-action" data-act="probe-lines">⚡ 节点测速</button>
   </div>
   <div class="settings-lines">${lineKinds.map(([kind,label])=>`<div class="settings-line-group"><h3>${label}</h3>${(c.config?.urls?.[kind]||[]).filter(url=>{try{return new URL(url).protocol==='https:';}catch{return false;}}).slice(0,5).map(url=>{const health=c.health.find(item=>item.url===url&&item.kind===kind),preferred=c.preferred[kind]===url;return `<button type="button" class="settings-line ${preferred?'is-preferred':''}" data-act="prefer-line" data-kind="${kind}" data-url="${e(url)}"><span class="settings-line-state ${preferred?'preferred':health?.ok?'available':health?'unavailable':''}">${preferred?'★ 优先':health?health.ok?`● ${health.ms} ms`:'✕ 暂不可用':'○ 未检测'}</span><strong>${e(new URL(url).host)}</strong><span class="settings-line-mark">${preferred?'✓':'›'}</span></button>`;}).join('')||'<p class="settings-empty">暂无可用线路</p>'}</div>`).join('')}</div>
  </section>

  <section class="settings-card" aria-labelledby="settings-account-title" ${showSec('network')}>
   <div class="settings-card-heading">
    <span class="settings-icon">◎</span>
    <div><h2 id="settings-account-title">源站会话与账户授权</h2><p>${e(accountTitle)} · ${e(accountDetail)}</p></div>
   </div>
   ${!supportsAcc?`<div class="settings-public-banner"><span>✓</span><div><strong>当前片源采用公开直连协议</strong><small>所有公开剧集均可直接播放；若个别资源提示客户端或会员限制，为源站固有规则。</small></div></div>`:user&&c.sessionKind!=='guest'?`<div class="settings-account-state"><span class="settings-status-dot"></span><span>${e(user.nickname||user.account||'已连接')}</span><button class="settings-action quiet" data-act="logout">退出登录</button></div>`:`<p class="settings-help">搜索与播放会自动建立访客会话。原站明确要求账号时，可在这里登录。</p><form id="login-form" class="settings-login-form"><input name="account" placeholder="原站账号" autocomplete="username" required><input name="password" type="password" placeholder="原站密码" autocomplete="current-password" required><div><button class="primary" type="submit">登录账号</button><button class="secondary" type="button" data-act="anonymous">${user?'刷新访客会话':'启用访客模式'}</button></div></form>`}
   ${state.authError?`<p class="settings-error" role="alert">${e(state.authError)}</p>`:''}${!supportsAcc?'':`<p class="settings-footnote">密码不会保存。iPhone 登录会话加密保存在系统钥匙串，各来源相互隔离。</p>`}
  </section>

  <section class="settings-card settings-about" aria-labelledby="settings-storage-title" ${showSec('storage')}>
   <div class="settings-card-heading">
    <span class="settings-icon">✦</span>
    <div><h2 id="settings-storage-title">存储维护与关于应用</h2><p>版本 v${__SANYUAN_VERSION__} · iOS 15+ 双核渲染架构</p></div>
   </div>
   <div class="settings-maintenance-grid">
    <button type="button" class="maintenance-btn" data-act="clear-runtime-cache">
     <strong>清理运行缓存</strong>
     <small>释放内存海报与页面快照</small>
    </button>
    <button type="button" class="maintenance-btn" data-act="clear-search-history-settings">
     <strong>清空搜索记录</strong>
     <small>已存 ${state.searchHistory.length} 条搜索关键词</small>
    </button>
    <button type="button" class="maintenance-btn" data-act="refresh-config">
     <strong>同步站点配置</strong>
     <small>重新拉取当前片源接口目录</small>
    </button>
   </div>
   <p>内置八大独立影视片源适配器、本地 HLS 广告清洗代理与 AVPlayer / Cicada 硬件+软解双冗余播放引擎。</p>
  </section>
 </div>`;
}
function isPreviewPlayback(){return state.detail?.playSources?.[state.line]?.preview===true||state.playURLs[state.playIndex]?.preview===true;}
function resumeEntryForDetail(d=state.detail){
 if(!d)return null;
 const row=validSavedRows('history').find(x=>x.siteId===state.site&&String(x.movie?.id)===String(d.id));
 if(!row)return null;
 const list=d.playSources?.[state.line]?.list||[];
 let index=list.findIndex(ep=>String(ep.id)===String(row.episodeId));
 if(index<0&&row.episodeTitle)index=matchingEpisode({id:row.episodeId,title:row.episodeTitle},list,{singleMovie:Number(d.channelId)===1&&list.length===1,singleEpisodeSource:list.length===1});
 return {row,index,episode:index>=0?list[index]:null};
}
function sleepTimerLabel(){
 if(state.sleepTimerMode==='episode')return '🌙 播完本集';
 if(state.sleepTimerEndAt>Date.now()){const mins=Math.max(1,Math.ceil((state.sleepTimerEndAt-Date.now())/60000));return `🌙 ${mins}m`;}
 return '🌙 定时';
}
function applySleepTimer(mode){
 state.sleepTimerMode=mode;
 state.sleepTimerEndAt=['15','30','60'].includes(String(mode))?Date.now()+Number(mode)*60000:0;
 const label=mode==='off'?'已关闭睡眠定时':mode==='episode'?'已开启：播完本集后自动停播':`已开启：${mode} 分钟后自动暂停播放`;
 showPlayerHUD(label);toast(label);
 render({liveFast:state.page==='live'});
}
function cycleSleepTimer(){
 const modes=state.page==='detail'?['off','episode','15','30','60']:['off','15','30','60'];
 const cur=state.sleepTimerMode==='off'||(state.sleepTimerMode!=='episode'&&state.sleepTimerEndAt<=Date.now())?'off':state.sleepTimerMode;
 const next=modes[(modes.indexOf(cur)+1)%modes.length];
 applySleepTimer(next);
}
function cancelEpisodePrefetch(){
 clearTimeout(prefetchTimer);prefetchTimer=null;
 prefetchController?.abort();prefetchController=null;
}
function scheduleNextEpisodePrefetch(detailObj,lineIdx,nextEpIdx){
 cancelEpisodePrefetch();
 const line=detailObj?.playSources?.[lineIdx];
 if(!line?.list?.[nextEpIdx])return;
 const cacheKey=`${state.site}:${detailObj.id}:${lineIdx}:${nextEpIdx}`;
 const existing=episodePrefetchCache.get(cacheKey);
 if(existing&&Date.now()-existing.timestamp<180000){state.nextEpisodeReady=true;const badge=$('.cockpit-prefetch');if(badge)badge.hidden=false;return;}
 const siteId=state.site,vodId=detailObj.id,c=client();
 prefetchTimer=setTimeout(async()=>{
  if(state.page!=='detail'||state.site!==siteId||String(state.detail?.id)!==String(vodId))return;
  const ctrl=new AbortController();prefetchController=ctrl;
  try{
   const res=await resolvePlayableEpisode(c,detailObj,lineIdx,nextEpIdx,ctrl.signal,()=>{});
   if(ctrl.signal.aborted||state.site!==siteId||String(state.detail?.id)!==String(vodId))return;
   episodePrefetchCache.delete(cacheKey);
   episodePrefetchCache.set(cacheKey,{result:res,timestamp:Date.now()});
   while(episodePrefetchCache.size>8)episodePrefetchCache.delete(episodePrefetchCache.keys().next().value);
   state.nextEpisodeReady=true;
   const badge=$('.cockpit-prefetch');if(badge)badge.hidden=false;
  }catch{}
 },2200);
}

function detail(){
 const d=state.detail;
 if(state.loading&&!d)return `<div class="content detail-content">${loading()}</div>`;
 if(!d)return `<div class="content detail-content">${notice('无法读取详情',state.error)}</div>`;
 const movie={...d,id:String(d.id),labels:(d.labels||[]).map(x=>x.name||x),subtitle:d.bottomLabel,badge:d.scoreText},line=d.playSources?.[state.line],episodes=line?.list||[],favorite=validSavedRows('favorites').some(x=>x.siteId===state.site&&String(x.movie.id)===movie.id),resumeInfo=resumeEntryForDetail(d);
 const year=typeof d.year==='object'?(d.year?.name||d.year?.text||d.year?.id||''):d.year;
 const toList=v=>Array.isArray(v)?v.map(x=>x?.name||x):v?[v]:[];const metadata=[year,...toList(d.area),...toList(d.language),d.channelName].filter(Boolean).join(' · ');
 const activeURL=state.playURLs[state.playIndex]?.url||'',isHLS=/\.m3u8/i.test(activeURL),currentEpIdx=episodes.findIndex(x=>x.id===state.episode?.id),hasNextEp=currentEpIdx>=0&&currentEpIdx<episodes.length-1,bwText=state.playBandwidth>=1000000?`${(state.playBandwidth/1000000).toFixed(1)} Mbps`:state.playBandwidth>0?`${Math.round(state.playBandwidth/1000)} kbps`:'';
 const player=state.playURLs.length?`<div class="playerbox"><div class="player-video-wrap">${native.native()?`<div id="native-player-slot" class="native-card" aria-label="播放器"><span>正在加载播放器…</span></div>`:`<video id="video" data-aspect="${e(state.aspectMode)}" controls playsinline preload="auto" x-webkit-airplay="allow" src="${e(activeURL)}" poster="${e(posterURLsFor(movie,state.site)[0]||'')}"></video>`}<div id="player-hud" class="player-hud" hidden></div></div><div class="playtoolbar"><span class="playing-title">${e(state.episode?.title||'')}</span><select id="source-line" aria-label="切换播放源">${(d.playSources||[]).map((source,i)=>`<option value="${i}" ${state.line===i?'selected':''}>${e(source.name||'线路 '+(i+1))}</option>`).join('')}</select>${state.playURLs.length>1?`<select id="play-line" aria-label="当前集备用地址">${state.playURLs.map((p,i)=>`<option value="${i}" ${i===state.playIndex?'selected':''}>${e(p.name||'地址 '+(i+1))}</option>`).join('')}</select>`:''}${native.native()?'<span class="subtle">画面内可切换全屏</span>':'<button data-act="native-player">全屏</button>'}</div><div class="player-cockpit" role="toolbar" aria-label="增强播放控制"><div class="cockpit-controls"><button type="button" class="cockpit-btn" data-act="player-seek" data-id="-15" title="快退 15 秒">↺ -15s</button><button type="button" class="cockpit-btn accent" data-act="player-skip-intro" title="跳过片头">跳过片头</button><button type="button" class="cockpit-btn" data-act="player-seek" data-id="15" title="快进 15 秒">↻ +15s</button>${hasNextEp?`<button type="button" class="cockpit-btn accent" data-act="episode-step" data-id="1" title="播放下一集">⏭ 下一集</button>`:``}<button type="button" class="cockpit-btn" data-act="player-aspect" title="切换画面比例">画面: ${state.aspectMode==='fill'?'铺满':state.aspectMode==='stretch'?'拉伸':'适应'}</button><button type="button" class="cockpit-btn ${state.playerMuted?'accent':''}" data-act="player-mute" title="静音切换">${state.playerMuted?'🔇 已静音':'🔊 声音'}</button><button type="button" class="cockpit-btn ${state.sleepTimerMode!=='off'?'accent':''}" data-act="player-sleep-timer" title="睡眠定时关闭">${sleepTimerLabel()}</button><button type="button" class="cockpit-btn" data-act="player-copy-url" title="复制当前视频流地址">🔗 复制流</button>${native.native()?`<button type="button" class="cockpit-btn" data-act="player-offline-cache" title="缓存本集到本地">缓存本集</button><button type="button" class="cockpit-btn" data-act="player-open-vlc" title="在 VLC 中打开">VLC</button>`:`<button type="button" class="cockpit-btn ${state.playerMirrored?'accent':''}" data-act="player-mirror" title="水平镜像翻转">⇄ 镜像</button><button type="button" class="cockpit-btn" data-act="player-pip" title="画中画播放">画中画</button>`}</div><div class="cockpit-rates" role="group" aria-label="播放倍速">${[0.75,1,1.25,1.5,2].map(rate=>`<button type="button" class="cockpit-rate-btn ${state.playbackRate===rate?'active':''}" data-act="playback-rate-btn" data-id="${rate}" aria-pressed="${state.playbackRate===rate}">${rate}×</button>`).join('')}</div><div class="cockpit-telemetry"><span class="cockpit-badge">${isHLS?'HLS 直连':'MP4 直连'}${state.playQualityLabel?` · ${e(state.playQualityLabel)}`:''}${bwText?` (${bwText})`:''}${state.playLatencyMs?` · 响应 ${state.playLatencyMs}ms`:''}</span>${state.removedAdSegments>0?`<span class="cockpit-badge ad-clean">✓ 已净化 ${state.removedAdSegments} 段广告 (${Math.round(state.removedAdSeconds)}s)</span>`:state.cleanHLS&&isHLS?`<span class="cockpit-badge ad-clean">✓ 广告净化守护中</span>`:''}<span class="cockpit-badge prefetch-ready cockpit-prefetch" ${state.nextEpisodeReady?'':'hidden'}>⚡ 下集已预热</span></div></div></div>`:'';
 const directors=d.directors?.map(x=>x.name||x).filter(Boolean)||[],actors=d.actors?.map(x=>x.name||x).filter(Boolean)||[];
 const seasons=(Array.isArray(d.seasons)?d.seasons:[]).filter(season=>season&&season.id!=null&&String(season.id));
 return `<div class="content detail-content">${player}${state.error?notice('选集读取失败',state.error):''}${state.playError?notice('暂时无法播放',state.playError,/登录|账号|账户|会员|付费/.test(state.playError)?'account':'retry-play',/登录|账号|账户|会员|付费/.test(state.playError)?'账户设置':'重试播放'):''}
  <section class="detail-hero">${picture(movie,true)}<div class="detail-hero-shade"></div><div class="detail-hero-copy"><div class="detail-kicker">${e(site().name)} · ${e(d.channelName||'影片')}</div><h1>${e(d.title)}</h1><p class="detail-meta">${e(metadata||'')}</p>${d.scoreText?`<span class="detail-score">${e(d.scoreText)}</span>`:''}<div class="detail-actions"><button class="detail-play" data-act="play-first">${icon('play')}<span>${isPreviewPlayback()?'播放试看':state.episode?'继续播放':resumeInfo?.episode?`续播 ${e(resumeInfo.episode.title||resumeInfo.row.episodeTitle||'')}`:'播放'}</span></button><button class="detail-favorite" data-act="favorite-detail" aria-pressed="${favorite}">${icon('star')}<span>${favorite?'已收藏':'收藏'}</span></button><button class="detail-secondary-action" data-act="scroll-episodes">选集 <span>${Number(line?.total)||episodes.length} 集</span></button></div></div></section>
  ${movie.labels.length?`<div class="detail-tags">${movie.labels.slice(0,8).map(label=>`<span>${e(label)}</span>`).join('')}</div>`:''}
  <section class="detail-section synopsis-section"><div class="detail-section-heading"><h2>剧情简介</h2><span>${e(d.channelName||'')}</span></div><p class="detailsummary" id="summary">${e(d.summary||'暂无简介')}</p>${String(d.summary||'').length>68?`<button class="summary-toggle" data-act="expand-summary">展开简介 <span>⌄</span></button>`:``}</section>
  ${(directors.length||actors.length)?`<section class="detail-section cast-section"><div class="detail-section-heading"><h2>演职员</h2><span>${directors.length+actors.length} 位</span></div><div class="cast-list">${directors.slice(0,4).map(dir=>`<span role="button" tabindex="0" class="cast-chip director-chip" data-act="actor-search" data-id="${e(dir)}" title="搜索导演 ${e(dir)} 的作品">导演 · ${e(dir)}</span>`).join('')}${actors.slice(0,12).map(actor=>`<span role="button" tabindex="0" class="cast-chip" data-act="actor-search" data-id="${e(actor)}" title="搜索 ${e(actor)} 的作品">${e(actor)}</span>`).join('')}</div></section>`:''}
  ${seasons.length>1?`<section class="detail-section season-section"><div class="detail-section-heading"><h2>季度与版本</h2><span>${seasons.length} 项</span></div><div class="sourcebuttons route-grid" role="group" aria-label="季度与版本">${seasons.map(season=>{const selected=season.selected===true||String(season.id)===String(d.id);return `<button class="route-card ${selected?'active':''}" data-act="season" data-id="${e(season.id)}" aria-pressed="${selected}"><strong>${e(season.title||season.name||'季度')}</strong></button>`;}).join('')}</div></section>`:''}
  <section class="detail-section playback-section" id="episode-list"><div class="detail-section-heading"><div><h2>选集播放</h2><span class="section-note">${line?.name?e(line.name)+' · ':''}${Number(line?.total)||episodes.length} 集</span></div>${episodes.length?`<span class="selected-episode">${state.episode?`正在播放 ${e(state.episode.title||'')}`:'选择一集开始播放'}</span>`:''}</div><p class="caption route-help">播放出错时会尝试同一集的备用线路；手动换线也会尽量保留当前集数。</p><div class="sourcebuttons route-grid" role="group" aria-label="播放线路">${(d.playSources||[]).map((source,i)=>`<button class="route-card ${state.line===i?'active':''}" data-act="play-source" data-id="${i}" aria-pressed="${state.line===i}"><strong>${e(source.name||'线路 '+(i+1))}</strong><span>${state.line===i?'✓ 已选 · ':''}${Number(source.total)||source.list?.length?((Number(source.total)||source.list.length)+' 集'):'待加载选集'}${source.siteId===client().preferredPlaybackSiteId?' · 上次可用':''}</span></button>`).join('')}</div>${state.loading?`<span class="spinner"></span><p id="playback-status" class="caption playback-status" role="status">${e(state.playStatus||'正在加载选集…')}</p>`:''}${episodes.length?episodesPanel(line,episodes):notice('这条线路暂无选集','可尝试切换上方播放线路。','', '')}</section>
 </div>`;
}
function render(options={}){
 for(const row of pageRoot.querySelectorAll('[data-shelf]'))shelfOffsets.set(row.dataset.shelf,row.scrollLeft);
 for(const row of pageRoot.querySelectorAll('[data-live-scroll]'))liveScrollOffsets.set(row.dataset.liveScroll,row.scrollLeft);
 const renderKey=pageRenderKey(),previousKey=activeRenderKey,switched=renderKey!==previousKey;
 if(!native.native()&&switched&&previousKey&&activeRenderReady&&pageRoot.firstElementChild){pageDOMCache.set(previousKey,{node:pageRoot.firstElementChild,images:new Map(state.imageMap),scrollY:pageScrollCache.get(previousKey)??window.scrollY});while(pageDOMCache.size>3){const oldest=pageDOMCache.keys().next().value;pageDOMCache.delete(oldest);pageScrollCache.delete(oldest);}}
 document.documentElement.dataset.columns=state.columns;document.documentElement.dataset.theme=state.theme;document.documentElement.dataset.page=state.page;document.documentElement.dataset.playing=state.playURLs.length?'true':'false';native.statusStyle(state.theme==='black');
 stopImages?.();const video=$('#video'),activeVideoURL=state.page==='detail'&&!native.native()?state.playURLs[state.playIndex]?.url||'':'',preserveVideo=!!(video&&activeVideoURL&&video.getAttribute('src')===activeVideoURL);if(video){saveProgress(video.currentTime);if(!preserveVideo)video.pause();else video.remove();}
 if(!native.native()&&switched&&renderKey&&pageDOMCache.has(renderKey)){const cached=pageDOMCache.get(renderKey);pageDOMCache.delete(renderKey);pageDOMCache.set(renderKey,cached);state.imageMap=new Map(cached.images);pageRoot.replaceChildren(cached.node);for(const row of pageRoot.querySelectorAll('[data-shelf]'))row.scrollLeft=shelfOffsets.get(row.dataset.shelf)||row.scrollLeft;for(const row of pageRoot.querySelectorAll('[data-live-scroll]'))row.scrollLeft=liveScrollOffsets.get(row.dataset.liveScroll)||0;activeRenderKey=renderKey;activeRenderReady=true;syncNav();wireVideo();requestAnimationFrame(()=>{window.scrollTo({top:cached.scrollY||0,behavior:'instant'});syncNativePlayer();});stopImages=loadVisibleImages(pageRoot,new Map(state.imageMap),options=>native.request(options),site().origin+'/');return;}
 activeRenderKey=renderKey;activeRenderReady=!state.loading;state.imageMap.clear();
 if(native.native()&&!(state.page==='detail'&&state.playURLs.length)){
  pageRoot.replaceChildren();syncNav();native.syncPage(nativePageSnapshot());if(state.page==='live')native.syncLive(nativeLiveSnapshot(),{fast:options.liveFast===true});wireVideo();stopImages=()=>{};
  requestAnimationFrame(syncNativePlayer);return;
 }
 if(state.page==='collection')pageRoot.innerHTML=`<div class="shell"><div class="detailtop"><button class="iconbutton" data-act="collection-back" aria-label="返回上一页">${icon('back')}</button><span class="caption">专题片库</span><button class="iconbutton" data-act="page" data-id="home" aria-label="首页">${icon('home')}</button></div>${collectionView()}</div>`;
 else if(state.page==='detail'){pageRoot.innerHTML=`<div class="shell detail-shell ${state.playURLs.length?'is-playing':''}"><div class="detailtop"><button class="iconbutton" data-act="back" aria-label="返回上一页">${icon('back')}</button><span class="detailtop-title">${e(state.playURLs.length?(state.detail?.title||'正在播放')+' · '+(state.episode?.title||'播放中'):'影片详情')}</span><button class="iconbutton" data-act="page" data-id="saved" aria-label="片单">${icon('saved')}</button></div>${detail()}<div class="footer">SANYUAN · 让好故事继续</div></div>`;if(preserveVideo){const slot=pageRoot.querySelector('#video');if(slot)slot.replaceWith(video);}}
 else if(state.page==='discover')pageRoot.innerHTML=`<div class="shell discover-shell">${discover()}</div>`;
 else if(state.page==='live')pageRoot.innerHTML=native.native()?'<div id="native-player-slot" class="native-live-anchor"></div>':`<div class="shell live-shell-root">${livePage()}</div>`;
 else pageRoot.innerHTML=`<div class="shell">${header()}<main class="content">${state.page==='home'?home():state.page==='me'?me():state.page==='games'?notice('游戏频道暂未接入','当前版本连接的是影视点播片库，暂时没有游戏数据源。','',''):state.page==='saved'?saved():state.page==='settings'?settings():state.page==='diagnostics'?diagnosticsView():browse()}<div class="footer">SANYUAN · 让好故事继续</div></main></div>`;
 syncNav();if(native.native()){native.syncPage(nativePageSnapshot());if(state.page==='live')native.syncLive(nativeLiveSnapshot(),{fast:options.liveFast===true});}for(const row of pageRoot.querySelectorAll('[data-shelf]'))row.scrollLeft=shelfOffsets.get(row.dataset.shelf)||0;for(const row of pageRoot.querySelectorAll('[data-live-scroll]'))row.scrollLeft=liveScrollOffsets.get(row.dataset.liveScroll)||0;wireVideo();
 requestAnimationFrame(()=>{syncNativePlayer();for(const row of pageRoot.querySelectorAll('.filter-options,.route-grid,.timeline-months,.timeline-years,.discover-sources,.saved-source-filters')){const active=row.querySelector('.active');if(active)row.scrollLeft+=active.getBoundingClientRect().left-row.getBoundingClientRect().left-(row.clientWidth-active.clientWidth)/2;}});
 stopImages=native.native()?()=>{}:loadVisibleImages(pageRoot,new Map(state.imageMap),options=>native.request(options),site().origin+'/');
}
function cancel(){cancelEpisodePrefetch();controller?.abort();controller=new AbortController();state.epoch++;return {signal:controller.signal,epoch:state.epoch};}
async function load({more=false}={}){const {signal,epoch}=cancel(),c=client(),previousItemCount=state.items.length,previousGroupCount=state.collectionGroups.length;state.loading=true;state.error='';if(!more)state.next='page=1';if(more){const button=pageRoot.querySelector('[data-act="more"]');if(button){button.disabled=true;button.textContent='正在加载…';}}else render();try{if(!c.config&&state.page!=='home')await c.bootstrap(signal);
 if(state.page==='browse'){
  const available=categories(c.config,{includeAdult:state.adultEnabled});if(available.length&&!available.some(item=>item.id===state.channel)){state.channel=available[0].id;restoreFilters();}
  if(c.prepareChannel)await c.prepareChannel(state.channel,signal);
  const definitions=filterDefinitions(),valid={};
  for(const f of definitions){const value=state.filters[f.query]??filterDefault(f);if((f.data||[]).some(o=>String(o.id)===String(value)))valid[f.query]=String(value);}
  state.filters=valid;
 }
 let data;if(state.page==='home')data=await c.home(signal);else if(state.page==='browse')data=await c.channel(state.channel,state.filters,state.next,signal);else if(state.page==='collection')data=await c.collection(state.collection,state.next,signal);else if(state.page==='search')data=await c.search(state.query,state.next,signal);if(epoch!==state.epoch)return;if(state.page==='home')state.sections=homeSections(data);else if(state.page==='collection'){
 const options={includeAdult:state.adultEnabled},items=sectionItems(data?.items||[],options),groups=collectionGroups(data,options);
 state.items=more?[...new Map([...state.items,...items].map(x=>[x.id,x])).values()]:items;
 state.collectionGroups=more?[...state.collectionGroups,...groups]:groups;state.next=pageCursor(data?.next);
 }else if(['browse','search'].includes(state.page)){const items=collectMovies(data?.items||[],{includeAdult:state.adultEnabled});state.items=more?[...new Map([...state.items,...items].map(x=>[x.id,x])).values()]:items;state.next=pageCursor(data?.next);}}catch(error){if(error.name!=='AbortError'&&epoch===state.epoch){state.error=error.message;if(!more&&((state.page==='home'&&!state.sections.length)||(state.page==='browse'&&!state.items.length))){const cached=viewCache.get(viewKey(state.page));if(cached){state.items=cached.items.slice();state.sections=cached.sections.slice();state.next=cached.next;}}}}finally{if(epoch===state.epoch){state.loading=false;if(!state.error)cacheView();if(!more||!appendMoreResults(previousItemCount,previousGroupCount))render();else if(native.native())native.syncPage(nativePageSnapshot());}}}
function appendMoreResults(previousItemCount,previousGroupCount){
 if(state.error)return false;
 if(['browse','search'].includes(state.page)){
  const gridNode=pageRoot.querySelector('.content > .grid');if(!gridNode)return false;
  gridNode.insertAdjacentHTML('beforeend',state.items.slice(previousItemCount).map(item=>card(item)).join(''));
  observeAppendedImages(gridNode);
  const status=pageRoot.querySelector('.results-status');if(status)status.textContent=`已显示 ${state.items.length} 部${state.next?' · 下方可加载更多':' · 已全部显示'}`;
  const button=pageRoot.querySelector('[data-act="more"]');if(button){if(state.next){button.disabled=false;button.textContent='加载更多影片';}else button.remove();}
  return true;
 }
 if(state.page==='collection'&&['topic','channel'].includes(state.collection?.kind)){
  const gridNode=pageRoot.querySelector('.collection-content > .grid');if(!gridNode)return false;
  gridNode.insertAdjacentHTML('beforeend',state.items.slice(previousItemCount).map(item=>card(item)).join(''));
  observeAppendedImages(gridNode);
  const button=pageRoot.querySelector('[data-act="more"]');if(button){if(state.next){button.disabled=false;button.textContent='加载更多';}else button.remove();}
  return true;
 }
 if(state.page==='collection'&&state.collectionGroups.length>previousGroupCount){
  const content=pageRoot.querySelector('.collection-content'),button=content?.querySelector('[data-act="more"]');if(!content)return false;
  const markup=state.collectionGroups.slice(previousGroupCount).map((group,index)=>`<section class="collection-group"><div class="sectiontop row"><h2>${e(group.title)}</h2>${group.route?`<button class="textbutton" data-act="collection-link" data-route="${e(group.route.url)}" data-title="${e(group.title)}">全部影片 ›</button>`:''}</div><div class="shelf collection-shelf" data-shelf="collection:${e(state.collection?.id||'root')}:${previousGroupCount+index}" aria-label="${e(group.title)}">${group.items.map(movie=>card(movie)).join('')}</div></section>`).join('');
  if(button)button.insertAdjacentHTML('beforebegin',markup);else content.insertAdjacentHTML('beforeend',markup);
  observeAppendedImages(content);
  const more=content.querySelector('[data-act="more"]');if(more){if(state.next){more.disabled=false;more.textContent='加载更多';}else more.remove();}
  return true;
 }
 return false;
}
async function openDetail(id,source=state.site){if(activeRenderKey)pageScrollCache.set(activeRenderKey,window.scrollY);if(state.page!=='detail'||!state.detailReturn)state.detailReturn=detailPageSnapshot();saveProgress($('#video')?.currentTime,playbackSession,$('#video')?.duration);cancel();if(source!==state.site){state.site=source;localStorage.setItem('sanyuan:site',source);}state.page='detail';state.detail=null;state.line=0;state.episode=null;state.episodePage=0;state.episodeDesc=false;state.locatedEpisodeIndex=-1;state.pendingEpisodeIndex=0;if(native.native()&&nativeSession&&!nativeSession.kind){nativeSession=null;native.controlPlayer('stop');}state.playURLs=[];state.playError='';state.playLoading=false;state.playLoadingText='';state.playTime=0;state.playDuration=0;state.removedAdSegments=0;state.removedAdSeconds=0;state.playLatencyMs=0;state.playQualityLabel='';state.playBandwidth=0;state.playerMirrored=false;state.nextEpisodeReady=false;cancelEpisodePrefetch();state.loading=true;state.error='';const {signal,epoch}=cancel();render();window.scrollTo(0,0);try{const d=await client().detail(id,signal);if(epoch!==state.epoch)return;state.detail=d;if(!Array.isArray(d.playSources))d.playSources=[];const preferred=d.playSources.findIndex(x=>x.siteId===client().preferredPlaybackSiteId),selected=d.playSources.findIndex(x=>x.selected);state.line=preferred>=0?preferred:selected>=0?selected:0;await loadEpisodes(signal);const resumeInfo=resumeEntryForDetail(d);if(resumeInfo&&resumeInfo.index>=0)state.episodePage=Math.floor(resumeInfo.index/20);}catch(error){if(error.name!=='AbortError'&&epoch===state.epoch)state.error=error.message;}finally{if(epoch===state.epoch){state.loading=false;render();}}}
async function loadEpisodes(signal){const d=state.detail,c=client(),line=d?.playSources?.[state.line];if(!line)return;if(!Array.isArray(line.list)||line.list.length<Number(line.total||0)){const list=await c.episodes(d.id,line,signal);if(Array.isArray(list)&&list.length)line.list=list;}}
function favorite(movie){let list=validSavedRows('favorites');const index=list.findIndex(x=>x.siteId===state.site&&String(x.movie.id)===String(movie.id));if(index>=0){list.splice(index,1);toast('已移出片单');}else{list.push({siteId:state.site,movie:{...movie,id:String(movie.id),imageURLs:posterURLsFor(movie,state.site)},updated:Date.now()});toast('已加入片单');}write('favorites',list);invalidateHomeDOMCache();}
function detailMovie(){const d=state.detail;return {id:String(d.id),title:d.title,imagePath:d.imagePath,imageGroup:d.imageGroup,imageURL:d.imageURL,imageURLs:imageURLsForSource(d,state.site,client().config),channelId:d.channelId,isAdult:d.isAdult===true||Number(d.channelId)===5,labels:(d.labels||[]).map(x=>x.name||x),subtitle:d.bottomLabel||'',badge:d.scoreText||''};}
function nativeMovieCard(movie,source=state.site,subtitle){
 if(!movie)return null;
 const sourceSite=sites.find(item=>item.id===source);
 return {...movie,id:String(movie.id||''),source,subtitle:subtitle||movie.subtitle||'',imageURLs:posterURLsFor(movie,source),imageReferer:sourceSite?.origin?new URL(sourceSite.origin).origin+'/':'',route:movie.route||null};
}
// 播放诊断（K1/K2）：最近 20 条播放事件，记在本机，供详情页诊断行与
// 设置里的“播放诊断”页使用。只记事件不记进度，避免高频写入。
const diagKindLabels={play:'开始播放',ready:'可以播放',failed:'播放失败',cicada:'改用软解',cicadaReady:'软解出画面',audioOnly:'无视频轨道',ended:'播完',switch:'切换线路',stall:'卡顿'};
function recordDiag(kind,detail='',overrides={}){
 const now=new Date(),pad=n=>String(n).padStart(2,'0');
 const entry={t:pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds()),kind,kindLabel:diagKindLabels[kind]||kind,title:overrides.title??(state.detail?.title||''),episode:overrides.episode??(state.episode?.title||''),line:overrides.line??(state.detail?.playSources?.[state.line]?.name||''),quality:overrides.quality??(state.playQualityLabel||''),engine:overrides.engine??(state.diagEngine||'AVPlayer'),detail:String(detail||'').slice(0,120)};
 state.diagnostics=[entry,...(Array.isArray(state.diagnostics)?state.diagnostics:[])].slice(0,20);
 write('diagnostics',state.diagnostics);
 if(native.native())native.syncPage(nativePageSnapshot());
}
function diagLine(){
 const last=Array.isArray(state.diagnostics)?state.diagnostics[0]:null;
 const line=state.detail?.playSources?.[state.line]?.name||'';
 const base=(state.playQualityLabel?state.playQualityLabel+' · ':'')+(state.diagEngine||'AVPlayer')+(line?' · '+line:'');
 if(!last)return state.playURLs.length?base+' · 未播放':'';
 return base+' · 最近：'+(last.kindLabel||last.kind)+(last.detail?' · '+last.detail.slice(0,24):'');
}
function diagnosticsText(){
 const head='三源影视 播放诊断 · '+new Date().toLocaleString('zh-CN');
 const rows=(state.diagnostics||[]).map(entry=>[entry.t,entry.kindLabel||entry.kind,entry.title,entry.episode,entry.line,entry.quality,entry.engine,entry.detail].filter(Boolean).join(' | '));
 return [head,...rows].join('\n');
}
function diagnosticsView(){
 const rows=(state.diagnostics||[]).map(entry=>`<li><strong>${e(entry.t)} · ${e(entry.kindLabel||entry.kind)}</strong><span>${e([entry.title,entry.episode].filter(Boolean).join(' · '))}${e(entry.line?' · '+entry.line:'')}${e(entry.quality?' · '+entry.quality:'')}${e(' · '+(entry.engine||'AVPlayer'))}</span>${entry.detail?`<small>${e(entry.detail)}</small>`:''}</li>`).join('');
 return `<div class="content diagnostics-content"><div class="detailtop"><button class="iconbutton" data-act="page" data-id="me" aria-label="返回我的">‹</button><span class="detailtop-title">播放诊断</span></div><p class="caption">最近 20 条播放事件，仅保存在本机；复制后可发给开发者定位问题。</p><div class="diagnostics-actions"><button type="button" class="secondary" data-act="diagnostics-copy">📋 复制诊断日志</button><button type="button" class="secondary" data-act="diagnostics-clear">清空记录</button></div>${rows?`<ul class="diagnostics-list">${rows}</ul>`:'<p class="caption">暂无播放记录，播放一次视频后这里会显示事件时间线。</p>'}</div>`;
}
function nativePageSnapshot(){
 const source=state.site,detailData=state.detail,origin=site()?.origin||'',posterReferer=/^https:\/\//i.test(origin)?new URL(origin).origin+'/':'',posterKeysBySite=Object.fromEntries(sites.filter(item=>Array.isArray(item.assetKeys)&&item.assetKeys.length).map(item=>[item.id,item.assetKeys])),base={page:state.page,theme:state.theme,site:source,siteName:site().name,posterReferer,posterKeysBySite,sites:sites.map(item=>({id:item.id,name:item.name})),loading:state.loading,error:state.error||'',columns:state.columns,adultEnabled:state.adultEnabled,query:state.query,clearConfirm:nativeClearConfirm,playbackRate:state.playbackRate,playerMuted:state.playerMuted,sleepTimerMode:state.sleepTimerMode,sleepTimerEndAt:state.sleepTimerEndAt||0,siteHealth:state.siteHealth};
 if(state.page==='home'){
  const picks=homePicks(),hero=picks[state.heroIndex%Math.max(1,picks.length)];
  const recent=validSavedRows('history').filter(row=>row.siteId===source&&(state.adultEnabled||!(row.movie.isAdult||Number(row.movie.channelId)===5))).sort((a,b)=>b.updated-a.updated).slice(0,8).map(row=>nativeMovieCard(row.movie,row.siteId,row.episodeTitle));
  return {...base,categories:categories(client().config,{includeAdult:state.adultEnabled}),hero:nativeMovieCard(hero),picks:picks.map(item=>nativeMovieCard(item)),heroIndex:state.heroIndex,recent,sections:state.sections.map(section=>({title:section.title,route:section.route,items:section.items.map(item=>nativeMovieCard(item))}))};
 }
 if(state.page==='browse'||state.page==='search'){
  const defs=filterDefinitions().map(filter=>({query:filter.query,name:filterName(filter.query),selected:String(state.filters[filter.query]??filterDefault(filter)),options:(filter.data||[]).map(option=>({id:String(option.id),name:option.name}))}));
  const expansionKey=`sanyuan:filters-expanded:${state.site}:${state.channel}`;
  return {...base,title:state.page==='search'?'“'+state.query+'” 的搜索结果':categories(client().config,{includeAdult:state.adultEnabled}).find(item=>item.id===state.channel)?.name||'分类片库',categories:categories(client().config,{includeAdult:state.adultEnabled}),filters:state.page==='browse'?defs:[],filtersExpanded:localStorage.getItem(expansionKey)==='true',items:state.items.map(item=>nativeMovieCard(item)),next:pageCursor(state.next),selectedFilters:state.filters};
 }
 if(state.page==='discover'){
  const groups=state.discoverGroups.map(group=>({title:group.title||'近期更新',items:(group.items||[]).map(item=>nativeMovieCard(item))}));
  const sections=state.discoverSections.map(section=>({title:section.title,route:section.route,items:(section.items||[]).map(item=>nativeMovieCard(item))}));
  return {...base,discoverTabs:discoveryTabs(),discoverTimeline:discoveryProfile().timeline,discoverTab:state.discoverTab,discoverYear:state.discoverYear,discoverMonth:state.discoverMonth,years:Array.from({length:5},(_,i)=>new Date().getFullYear()-i),groups,sections,items:state.discoverItems.map(item=>nativeMovieCard(item)),next:pageCursor(state.discoverNext)};
 }
 if(state.page==='collection'){
  const groups=state.collectionGroups.length?state.collectionGroups:[{title:state.collection?.title||'专题片库',items:state.items}];
  return {...base,title:state.collection?.title||'专题片库',groups:groups.map(group=>({title:group.title,items:(group.items||[]).map(item=>nativeMovieCard(item))})),items:state.items.map(item=>nativeMovieCard(item)),next:pageCursor(state.next),stackDepth:state.collectionStack.length};
 }
 if(state.page==='detail'&&detailData){
  const movie={...detailMovie(),...detailData,id:String(detailData.id),labels:(detailData.labels||[]).map(item=>item.name||item),imageURLs:imageURLsForSource(detailData,source,client().config),actors:(detailData.actors||[]).map(item=>item.name||item).filter(Boolean),metadata:[typeof detailData.year==='object'?(detailData.year.name||detailData.year.text||detailData.year.id||''):detailData.year,...(detailData.area||[]).map(item=>item.name||item),...(detailData.language||[]).map(item=>item.name||item),detailData.channelName].filter(Boolean).join(' · ')};
  const saved=validSavedRows('favorites').some(item=>item.siteId===source&&String(item.movie.id)===String(detailData.id));
  return {...base,movie,detailReady:true,previewPlayback:isPreviewPlayback(),saved,line:state.line,episodePage:state.episodePage,episodeDesc:state.episodeDesc,seasons:(Array.isArray(detailData.seasons)?detailData.seasons:[]).filter(season=>season&&season.id!=null&&String(season.id)).map(season=>({id:String(season.id),title:String(season.title||season.name||'季度'),name:String(season.title||season.name||'季度'),selected:season.selected===true||String(season.id)===String(detailData.id)})),playSources:(detailData.playSources||[]).map((line,index)=>{const mapped=(line.list||[]).map((episode,epIdx)=>({index:epIdx,title:episode.title||'第'+(epIdx+1)+'集',selected:state.episode?.id===episode.id}));return {index,name:line.name||'线路 '+(index+1),siteId:line.siteId,preview:line.preview===true,total:Number(line.total)||line.list?.length||0,selected:index===state.line,episodes:state.episodeDesc?mapped.slice().reverse():mapped};}),episode:state.episode?{title:state.episode.title||'',index:(detailData.playSources?.[state.line]?.list||[]).findIndex(item=>item.id===state.episode.id)}:null,playError:state.playError||'',playStatus:state.playStatus||'',playURLs:state.playURLs.map((item,index)=>({name:item.name||'',url:item.url,selected:index===state.playIndex})),playIndex:state.playIndex,diagLine:diagLine(),playLoading:!!state.playLoading,playLoadingText:state.playLoadingText||'',playTime:state.playTime||0,playDuration:state.playDuration||0,summaryExpanded:!!state.summaryExpanded};
 }
 if(state.page==='me'||state.page==='saved'){
  const tab=state.page==='saved'?state.savedTab:state.meTab,allRows=validSavedRows(tab==='history'?'history':'favorites').filter(row=>state.adultEnabled||!(row.movie.isAdult||Number(row.movie.channelId)===5)).sort((a,b)=>b.updated-a.updated),sourceIds=[...new Set(allRows.map(r=>r.siteId).filter(Boolean))];
  if(state.savedSourceFilter!=='all'&&!sourceIds.includes(state.savedSourceFilter))state.savedSourceFilter='all';
  const filteredRows=state.savedSourceFilter==='all'?allRows:allRows.filter(r=>r.siteId===state.savedSourceFilter);
  const sourceFilters=sourceIds.length>1?[{id:'all',name:`全部 (${allRows.length})`},...sourceIds.map(sid=>({id:sid,name:`${sites.find(s=>s.id===sid)?.name||sid} (${allRows.filter(r=>r.siteId===sid).length})`}))]:[];
  const list=filteredRows.map(row=>nativeMovieCard(row.movie,row.siteId,tab==='history'?row.episodeTitle:undefined)),c=client();
  return {...base,meTab:state.page==='saved'?'saved':state.meTab,savedTab:tab,savedSourceFilter:state.savedSourceFilter,sourceFilters,items:list,columns:state.columns,showAgeGate:state.showAgeGate,authError:state.authError||'',user:c.user?{nickname:c.user.nickname||c.user.account||'',sessionKind:c.sessionKind}:null,config:c.config&&typeof c.config==='object'?c.config:{},health:c.health||[],preferred:c.preferred||{},cleanHLS:state.cleanHLS,autoNext:state.autoNext,skipIntroSeconds:state.skipIntroSeconds,skipOutroSeconds:state.skipOutroSeconds,aspectMode:state.aspectMode,playbackRate:state.playbackRate,version:__SANYUAN_VERSION__};
 }
 if(state.page==='diagnostics'){
  return {...base,title:'播放诊断',diagnostics:state.diagnostics||[]};
 }
 return {...base};
}
function applyLivePlaybackRate(rate){
 state.playbackRate=rate;write('playbackRate',rate);
 const video=$('#video');if(video)video.playbackRate=rate;
 if(native.native())native.controlPlayer('rate',{rate});
}
function seekActivePlayer(delta){
 const video=$('#video');
 if(video){video.currentTime=Math.max(0,Math.min(Number.isFinite(video.duration)?video.duration:Infinity,video.currentTime+delta));}
 if(native.native())native.controlPlayer('seekDelta',{delta});
 showPlayerHUD(delta>0?`快进 +${delta}s`:`快退 ${delta}s`);
}
function cycleAspectMode(){
 const modes=['fit','fill','stretch'],labels={fit:'适应画面',fill:'铺满裁剪',stretch:'全屏拉伸'},shortLabels={fit:'适应',fill:'铺满',stretch:'拉伸'};
 const next=modes[(modes.indexOf(state.aspectMode)+1)%modes.length];
 state.aspectMode=next;localStorage.setItem('sanyuan:aspectMode',next);
 const video=$('#video')||$('#live-video');if(video)video.dataset.aspect=next;
 if(native.native())native.controlPlayer('gravity',{mode:next});
 showPlayerHUD(`画面比例：${labels[next]}`);
 toast(`画面比例已切换为：${labels[next]}`);
 if(state.page==='detail'&&!native.native()&&$('#video')){
  const btn=pageRoot.querySelector('.cockpit-btn[data-act="player-aspect"]');
  if(btn)btn.textContent=`画面: ${shortLabels[next]}`;
  return;
 }
 render({liveFast:state.page==='live'});
}
window.NativePageAction=(action,payload={})=>{
 if(action==='page'&&!['home','discover','browse','live','me','saved','settings','diagnostics'].includes(String(payload.id||'')))return;
 if(action==='search-submit'||action==='actor-search'){const query=String(payload.query||payload.id||'').trim();if(!query)return;rememberSearch(query);state.query=query;state.page='search';state.items=[];load();return;}
 if(action==='login-submit'){const account=String(payload.account||'').trim(),password=String(payload.password||'');if(!account||!password)return;state.authError='';void client().login(account,password).then(()=>toast('登录成功')).catch(error=>{state.authError=error.message;}).finally(()=>render());return;}
 if(action==='toggle-clean-hls'){state.cleanHLS=!state.cleanHLS;write('cleanHLS',state.cleanHLS);toast('已更新，下次播放生效');render();return;}
 if(action==='toggle-auto-next'){state.autoNext=!state.autoNext;write('autoNext',state.autoNext);toast(state.autoNext?'已开启自动连播':'已关闭自动连播');render();return;}
 if(action==='skip-intro-setting'){const sec=Number(payload.id);if([60,90,120].includes(sec)){state.skipIntroSeconds=sec;write('skipIntroSeconds',sec);toast(`跳过片头已设为 ${sec} 秒`);render();}return;}
 if(action==='skip-outro-setting'){const sec=Number(payload.id);if([0,60,90,120].includes(sec)){state.skipOutroSeconds=sec;write('skipOutroSeconds',sec);toast(sec>0?`已开启片尾剩余 ${sec} 秒自动连播`:'已关闭自动跳过片尾');render();}return;}
 if(action==='aspect-setting'){const m=String(payload.id||'');if(['fit','fill','stretch'].includes(m)){state.aspectMode=m;localStorage.setItem('sanyuan:aspectMode',m);if(native.native())native.controlPlayer('gravity',{mode:m});toast('默认画面比例已更新');render();}return;}
 if(action==='playback-rate'){const rate=Number(payload.id);if([0.5,0.75,1,1.25,1.5,2].includes(rate)){applyLivePlaybackRate(rate);toast(`播放倍速已设为 ${rate}×`);render();}return;}
 if(action==='player-seek'){const delta=Number(payload.id||0);if(delta)seekActivePlayer(delta);return;}
 if(action==='player-skip-intro'){seekActivePlayer(state.skipIntroSeconds||90);return;}
 if(action==='player-aspect'){cycleAspectMode();return;}
 if(action==='player-mute'){state.playerMuted=!state.playerMuted;const v=$('#video');if(v)v.muted=state.playerMuted;if(native.native())native.controlPlayer('mute',{muted:state.playerMuted});showPlayerHUD(state.playerMuted?'🔇 已静音':'🔊 已开启声音');render();return;}
 if(action==='player-sleep-timer'){cycleSleepTimer();return;}
 if(action==='player-switch-line'){
  // B3：座舱换线。不等 15 秒宽限耗尽，让恢复流程跳过当前地址与线路。
  if(state.page!=='detail'||!state.episode||!state.playURLs.length)return;
  const session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title};
  if(!state.playRecovery||state.playRecovery.key!==sessionKey(session))state.playRecovery={key:sessionKey(session),failedURLs:new Set(),failedLines:new Set(),triedLines:new Set([state.line]),running:false};
  state.playRecovery.failedURLs.add(state.playURLs[state.playIndex]?.url);
  state.playRecovery.failedLines.add(state.line);
  state.playRecovery.triedLines.add(state.line);
  toast('正在换线…');
  void recoverPlayback(session,'用户手动换线');
  return;
 }
 if(action==='sleep-timer-setting'){const mode=String(payload.id||'');if(['off','episode','15','30','60'].includes(mode))applySleepTimer(mode);return;}
 // I3：原生睡眠定时到点后通知 JS 清状态。暂停本身已在原生侧完成，
 // 这里只同步状态；若 JS 的 5 秒定时器先到了，mode 已是 off，直接返回。
 if(action==='sleep-timer-fired'){if(state.sleepTimerMode==='off')return;state.sleepTimerMode='off';state.sleepTimerEndAt=0;toast('🌙 睡眠定时已到，已为你自动暂停播放');render();return;}
 if(action==='episode-order'){state.episodeDesc=!state.episodeDesc;state.episodePage=0;render();return;}
 if(action==='summary-toggle'){state.summaryExpanded=!state.summaryExpanded;render();return;}
 if(action==='play-line'){const index=Number(payload.id);if(!Number.isInteger(index)||!state.playURLs[index])return;saveProgress(undefined);state.playIndex=index;const entry=state.playURLs[index],session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title};state.playRecovery={key:sessionKey(session),failedURLs:new Set(),failedLines:new Set(),triedLines:new Set([state.line]),running:false};void verifyMedia(client(),entry.url,controller?.signal,entry.headers,entry.referrerPolicy).then(meta=>{if(meta?.warmPlaylists?.length)entry.warmPlaylists=meta.warmPlaylists;entry.cicadaURL=meta?.variants?.[0]?.href||'';state.playQualityLabel=meta?.qualityLabel||'';state.playBandwidth=meta?.bandwidth||0;render();if(native.native())return launchNativePlayer();return $('#video')?.play().catch(()=>{});}).catch(error=>recoverPlayback(session,error.message));return;}
 if(action==='more'){
  if(!state.loading&&state.next&&['browse','search','collection'].includes(state.page))load({more:true});
  return;
 }
 if(action==='discover-more'){
  if(!state.loading&&state.discoverNext&&state.page==='discover')loadDiscovery({more:true});
  return;
 }
 if(action==='episode-page'){state.episodePage=Math.max(0,Number(payload.id)||0);render();return;}
 const identityKeys=action==='collection-link'?['route','title']:action==='detail'?['id','source']:['id','key','kind','url','route','title'];
 const actualControl=[...navRoot.querySelectorAll('[data-act]'),...pageRoot.querySelectorAll('[data-act]')].find(button=>button.dataset.act===action&&identityKeys.every(key=>payload[key]===undefined||button.dataset[key]===String(payload[key])));
 if(actualControl){actualControl.click();return;}
 if(action==='clear-saved'){const confirmed=nativeClearConfirm;nativeClearConfirm=!nativeClearConfirm;const button=document.createElement('button');button.dataset.act='clear-saved';if(confirmed)button.dataset.confirm='yes';button.hidden=true;root.append(button);button.click();button.remove();native.syncPage(nativePageSnapshot());return;}
 if(action==='probe-all-sites'){void probeAllSites();return;}
 if(action==='clear-site-health'){state.siteHealth={};write('siteHealth',{});render();native.syncPage(nativePageSnapshot());toast('已清空全网片源连通性记录');return;}
 if(action==='diagnostics-copy'){if(!(state.diagnostics||[]).length){toast('暂无诊断记录');return;}native.copyText(diagnosticsText()).then(()=>toast('已复制诊断日志')).catch(error=>toast(error?.message||'复制失败'));return;}
 if(action==='diagnostics-clear'){state.diagnostics=[];write('diagnostics',[]);render();native.syncPage(nativePageSnapshot());toast('已清空诊断记录');return;}
 if(action==='probe-site'){const target=sites.find(s=>s.id===String(payload.id||''));if(target){void probeSite(target).then(()=>{render();native.syncPage(nativePageSnapshot());});}return;}
 if(action==='me-settings'){const button=document.createElement('button');button.dataset.act='me-tab';button.dataset.id='settings';root.append(button);button.click();button.remove();return;}
 const button=document.createElement('button');button.dataset.act=action;for(const [key,value] of Object.entries(payload||{}))if(value!==undefined&&value!==null)button.dataset[key]=String(value);button.hidden=true;root.append(button);button.click();button.remove();
};
window.NativePageRequestState=()=>native.syncPage(nativePageSnapshot());
function episodesPanel(line,episodes){
 const pageSize=20,pageCount=Math.max(1,Math.ceil(episodes.length/pageSize)),page=Math.min(state.episodePage,pageCount-1),start=page*pageSize,current=episodes.findIndex(x=>x.id===state.episode?.id),total=Math.max(episodes.length,Number(line?.total||0));
 const indexed=episodes.map((episode,index)=>({episode,index})),ordered=state.episodeDesc?indexed.slice().reverse():indexed,slice=ordered.slice(start,start+pageSize);
 const rangeStart=slice[0]?slice[0].index+1:start+1,rangeEnd=slice.length?slice[slice.length-1].index+1:Math.min(start+pageSize,episodes.length);
 return `<section class="episode-section"><div class="episodes-heading"><div><h2 class="smallheading">选集</h2><span class="subtle">已载入 ${episodes.length}${total>episodes.length?` / 共 ${total}`:''} 集${current>=0?` · 正在播放 ${e(episodes[current].title||`第${current+1}集`)}`:''}</span></div><div class="episode-steps">${episodes.length>1?`<button type="button" class="secondary episode-order-btn" data-act="episode-order" aria-pressed="${state.episodeDesc}">${state.episodeDesc?'↓ 倒序':'↑ 正序'}</button>`:''}${pageCount>2&&current>=0&&Math.floor((state.episodeDesc?episodes.length-1-current:current)/pageSize)!==page?`<button type="button" class="secondary" data-act="episode-locate" title="跳转到正在播放的集数所在页">定位当前集</button>`:''}${current>=0?`<button class="secondary" data-act="episode-step" data-id="-1" ${current===0?'disabled':''}>上一集</button><button class="secondary" data-act="episode-step" data-id="1" ${current===episodes.length-1?'disabled':''}>下一集</button>`:''}</div></div>${pageCount>1?`<div class="episode-pages" role="group" aria-label="选集分页"><span>页码</span><div class="episode-page-options">${Array.from({length:pageCount},(_,i)=>`<button type="button" class="episode-page-chip ${i===page?'active':''}" data-act="episode-page" data-id="${i}" aria-current="${i===page?'page':'false'}" aria-label="第 ${i+1} 页，第 ${i*pageSize+1} 至 ${Math.min((i+1)*pageSize,episodes.length)} 集">${i+1}</button>`).join('')}</div><small>第 ${page+1} / ${pageCount} 页 · ${rangeStart}–${rangeEnd} 集</small><input type="number" min="1" max="${episodes.length}" class="episode-jump-input" data-episode-jump placeholder="跳集" aria-label="输入集数跳转到对应页"></div>`:''}<div class="episodes">${slice.map(({episode,index:i})=>{const active=state.episode?.id===episode.id,located=i===state.locatedEpisodeIndex;return `<button class="episode ${active?'active':''} ${located?'is-located':''}" data-act="episode" data-id="${i}" aria-current="${active?'true':'false'}" aria-label="${e(episode.title||'第'+(i+1)+'集')}${active?'，正在播放':'，点击播放'}"><span class="episode-title">${e(episode.title||'第'+(i+1)+'集')}</span>${active?'<small>正在播放</small>':''}</button>`;}).join('')}</div></section>`;
}
function saveProgress(time=native.native()?(state.playTime||undefined):$('#video')?.currentTime,session=playbackSession||(!nativeSession?.kind?nativeSession?.session:null),duration=native.native()?(state.playDuration||undefined):$('#video')?.duration){if(!session)return;if(session.preview)time=undefined;const key=sourceKey(session.siteId,session.movie.id);let list=validSavedRows('history'),row=list.find(x=>x.key===key);const prior=row?.episodeId===session.episodeId?row.time:0,priorDuration=row?.episodeId===session.episodeId?row.duration:0;const entry={key,...session,time:Number.isFinite(time)?time:prior||0,...(Number.isFinite(duration)&&duration>0?{duration:Math.round(duration)}:priorDuration>0?{duration:priorDuration}:{}),updated:Date.now()};list=[entry,...list.filter(x=>x.key!==key)].slice(0,100);write('history',list);invalidateHomeDOMCache();}

function playerFrame(){
 const slot=$('#native-player-slot');if(!slot)return {visible:false};
 const rect=slot.getBoundingClientRect();
 return {visible:true,x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewportWidth:window.innerWidth};
}
function syncNativePlayer(){if(native.native()&&nativeSession&&state.page!=='live')native.layoutPlayer(nativeSession.context,playerFrame());}
window.addEventListener('resize',()=>requestAnimationFrame(syncNativePlayer));
window.addEventListener('scroll',()=>{if(scrollFramePending)return;scrollFramePending=true;requestAnimationFrame(()=>{scrollFramePending=false;if(activeRenderKey)pageScrollCache.set(activeRenderKey,window.scrollY);$('.detail-shell .detailtop')?.classList.toggle('scrolled',window.scrollY>36);$('.detail-content .playerbox')?.classList.toggle('is-compact',window.scrollY>90);const topBtn=$('#back-to-top');if(topBtn)topBtn.hidden=window.scrollY<=360;syncNativePlayer();});},{passive:true});
async function launchNativePlayer(){
 const entry=state.playURLs[state.playIndex],url=entry?.url;if(!url||!state.episode)return;
 $('#video')?.pause();
 const preview=state.playURLs[state.playIndex]?.preview===true,session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title,preview};
 const context=state.epoch+':'+Date.now();nativeSession={context,session};
 state.diagEngine='AVPlayer';state.playLoading=true;state.playLoadingText='正在加载播放器…';recordDiag('play','开始播放');
 const row=validSavedRows('history').find(x=>x.siteId===session.siteId&&String(x.movie.id)===String(session.movie.id)&&String(x.episodeId)===String(session.episodeId));
 const startAt=computeResumeStartAt({preview,time:row?.time,duration:row?.duration});
 if(startAt>0){state.playTime=startAt;if(row?.duration>0)state.playDuration=row.duration;}
 saveProgress(undefined,session);
 await native.play(url,mediaHeaders(client(),state.playURLs[state.playIndex]),{cleanHLS:state.cleanHLS,warmPlaylists:state.playURLs[state.playIndex]?.warmPlaylists||[],cicadaURL:entry?.cicadaURL||'',context,frame:playerFrame(),startAt,rate:state.playbackRate,muted:state.playerMuted,title:session.movie.title+' · '+(session.episodeTitle||'')});
}
const authorizationFailure=message=>/unauthori[sz]ed|forbidden|HTTP\s*(?:401|403)|(?:401|403)\b|权限|授权|会员|付费|登录|账号|账户/i.test(String(message||''));
const sessionKey=session=>`${session.siteId}:${session.movie.id}:${session.episodeId}`;
async function recoverPlayback(session,message=''){
 const key=sessionKey(session),recovery=state.playRecovery;
 if(state.page!=='detail'||state.site!==session.siteId||String(state.detail?.id)!==session.movie.id||state.episode?.id!==session.episodeId||!recovery||recovery.key!==key||recovery.running)return;
 if(authorizationFailure(message)){state.playError='原站返回了权限或账号限制，请按原站提示处理。';render();return;}
 // 恢复总时限：同一集从第一次失败起 90 秒内没播起来就停手报错。
 // 15 条线路每条都验一遍 + 原生 15 秒宽限 + 软解 10 秒，跑满要
 // 好几分钟，用户看到的只是无尽转圈；时限一到直接给明确结论。
 // 首帧一出就清零（ready 事件里），中途播起来又卡住重新计时。
 if(!recovery.startedAt)recovery.startedAt=Date.now();
 if(Date.now()-recovery.startedAt>90000){state.playLoading=false;state.playError='当前播放线路中断，已尝试可用备用地址和同集线路。可稍后重试或手动换线。'+(message&&!authorizationFailure(message)?' '+message:'');render();recordDiag('failed',message||'恢复超时，已尝试全部备用地址和线路');return;}
 recovery.running=true;recovery.failedURLs.add(state.playURLs[state.playIndex]?.url);recovery.failedLines.add(state.line);recovery.triedLines.add(state.line);
 let lastError=message;
 const stillCurrent=()=>state.playRecovery===recovery&&state.page==='detail'&&state.site===session.siteId&&String(state.detail?.id)===session.movie.id&&state.episode?.id===session.episodeId;
 // C1：同集备用地址两两并行验证（已知死掉的地址已在 failedURLs 里跳过，
 // 已验证过的用 verifiedMeta 不再重复验），先通过的先播。
 const candidates=[];
 for(let index=0;index<Math.min(state.playURLs.length,4);index++){
  const candidate=state.playURLs[index];if(!candidate?.url||recovery.failedURLs.has(candidate.url))continue;
  recovery.failedURLs.add(candidate.url);candidates.push({index,candidate});
 }
 for(let base=0;base<candidates.length;base+=2){
  const batch=candidates.slice(base,base+2);
  if(!stillCurrent())return;
  state.playError='当前地址连接不稳定，正在尝试备用地址…';state.playStatus='正在尝试备用地址…';state.playLoading=true;state.playLoadingText=state.playStatus;render();
  const outcomes=await Promise.all(batch.map(({index,candidate})=>candidate.verifiedMeta?Promise.resolve({index,candidate,meta:candidate.verifiedMeta,error:null}):verifyMedia(client(),candidate.url,controller?.signal,candidate.headers,candidate.referrerPolicy).then(meta=>({index,candidate,meta,error:null}),error=>({index,candidate,meta:null,error}))));
  for(const {index,candidate,meta,error} of outcomes){
   if(!stillCurrent())return;
   if(error){if(error.name==='AbortError'){recovery.running=false;return;}lastError=error.message;if(authorizationFailure(lastError))break;continue;}
   state.playIndex=index;if(meta?.warmPlaylists?.length)candidate.warmPlaylists=meta.warmPlaylists;candidate.cicadaURL=meta?.cicadaURL||meta?.variants?.[0]?.href||'';state.playQualityLabel=meta?.qualityLabel||'';state.playBandwidth=meta?.bandwidth||0;state.playError='';state.playStatus='';recovery.running=false;render();if(native.native())await launchNativePlayer();else await $('#video')?.play().catch(()=>{});return;
  }
  if(authorizationFailure(lastError))break;
 }
 if(authorizationFailure(lastError)){if(stillCurrent()){recovery.running=false;state.playLoading=false;state.playError='原站返回了权限或账号限制，请按原站提示处理。';render();}return;}
 const detail=state.detail,requested=state.episode,lines=detail?.playSources||[],order=orderLinesByHealth(lines,-1,client().preferredPlaybackSiteId,state.lineHealth,state.site);
 let lineTries=0;
 for(const target of order){if(recovery.triedLines.has(target)||recovery.failedLines.has(target)||lines[target]?.preview===true)continue;recovery.triedLines.add(target);const line=lines[target];try{if(!Array.isArray(line.list)||!line.list.length||line.list.length<Number(line.total||0)){const list=await client().episodes(detail.id,line,controller?.signal);if(Array.isArray(list)&&list.length)line.list=list;}if(!stillCurrent())return;const at=matchingEpisode(requested,line.list||[],{singleMovie:Number(detail.channelId)===1&&lines[state.line]?.list?.length===1,singleEpisodeSource:lines[state.line]?.list?.length===1});if(at<0)continue;lineTries++;state.line=target;state.episodePage=Math.floor(at/20);state.playError='正在切换到另一条同集线路…';state.playStatus='正在试第 '+lineTries+' 条线路…';state.playLoading=true;state.playLoadingText=state.playStatus;render();recordDiag('switch','切换到'+(line.name||('线路 '+(target+1))));toast('原线路连接中断，正在尝试同一集的备用线路');recovery.running=false;await playEpisode(at,{automatic:true});return;}catch(error){if(error.name==='AbortError'){recovery.running=false;return;}lastError=error.message;if(authorizationFailure(lastError))break;}}
 if(!stillCurrent())return;recovery.running=false;state.playLoading=false;state.playError='当前播放线路中断，已尝试可用备用地址和同集线路。可稍后重试或手动换线。'+(lastError&&!authorizationFailure(lastError)?' '+lastError:'');render();recordDiag('failed',lastError||'已尝试全部备用地址和线路');
}
native.onPlaybackEvent=event=>{
 if(event.context!==nativeSession?.context)return;const {session}=nativeSession;
 if(nativeSession.kind==='live'){
  const formatLabel=liveFormatLabel();
  if(event.status==='ready'){state.liveLastPlaybackTime=null;state.livePlaybackProgressAt=Date.now();state.liveStatus='播放已连接，画面加载中';state.liveError='';state.diagEngine='AVPlayer';recordDiag('ready','直播已连接',{title:liveChannel()?.name||'直播'});render({liveFast:true});}
  else if(event.status==='videoTrack'){state.liveVideoFormat={width:Number(event.width)||0,height:Number(event.height)||0,codec:String(event.codec||'')};state.liveStatus=state.liveVideoReady?`正在直播 · ${liveFormatLabel()}`:`检测到视频轨道 · ${liveFormatLabel()||'分辨率未知'}`;render({liveFast:true});}
  else if(event.status==='videoReady'){state.liveVideoReady=true;state.liveRendererRetry=0;state.liveStatus=`正在直播${formatLabel?' · '+formatLabel:''}`;state.liveError='';render({liveFast:true});}
  else if(event.status==='audioOnly'){state.liveVideoReady=false;state.livePlaybackProgressAt=Date.now();state.liveLastPlaybackTime=null;state.liveStatus='该线路没有可识别的视频轨道';state.liveError='已保留当前线路，没有自动切换。可手动选择其他线路，或检查源站是否提供视频流。';recordDiag('audioOnly','无视频轨道',{title:liveChannel()?.name||'直播'});render({liveFast:true});}
  else if(event.status==='videoTrackUnknown'){state.liveVideoReady=false;state.liveStatus='暂时无法确认该线路的视频轨道';state.liveError='当前线路保持播放，未自动切换。请检查网络后重试或手动查看其他线路。';render({liveFast:true});}
  else if(event.status==='rendererAttached'){state.liveStatus='已启用 AVPlayerLayer 直接渲染，等待首帧…';state.liveError='';render({liveFast:true});}
  else if(event.status==='rendererRecovery'){state.liveStatus=`正在重建画面渲染${formatLabel?' · '+formatLabel:''}，当前线路保持不变…`;state.liveError='';render({liveFast:true});}
  else if(event.status==='cicadaFallback'){state.liveVideoReady=false;state.liveStatus='正在尝试软解播放，当前线路保持不变…';state.liveError='';state.livePlaybackProgressAt=Date.now();state.liveLastPlaybackTime=null;state.diagEngine='Cicada';recordDiag('cicada','改用软解',{title:liveChannel()?.name||'直播'});render({liveFast:true});}
  else if(event.status==='cicadaVideoReady'){state.liveVideoReady=true;state.liveRendererRetry=0;state.livePlaybackProgressAt=Date.now();state.liveLastPlaybackTime=null;if(event.width&&event.height)state.liveVideoFormat={width:Number(event.width)||0,height:Number(event.height)||0,codec:'hevc'};state.liveStatus=`正在用软解播放${liveFormatLabel()?' · '+liveFormatLabel():''}`;state.liveError='';recordDiag('cicadaReady','软解出画面',{title:liveChannel()?.name||'直播'});render({liveFast:true});}
  else if(event.status==='rendererFailed'){const retries=(state.liveRendererRetry||0);if(retries<2){state.liveRendererRetry=retries+1;void playLiveVariant(state.liveVariantIndex,{automatic:true,retrySame:true});}else{state.liveVideoReady=false;state.liveStatus=`检测到视频轨道，但 AVPlayer 未输出画面${formatLabel?' · '+formatLabel:''}`;state.liveError='当前线路未自动切换。可手动选择其他线路，或在 VLC 播放以对比设备解码支持。';recordDiag('failed','AVPlayer 未输出画面',{title:liveChannel()?.name||'直播'});render({liveFast:true});}}
  else if(event.status==='progress'){
   if(!state.liveActive||state.page!=='live'||document.visibilityState==='hidden')return;
   const time=Number(event.time),now=Date.now();if(!Number.isFinite(time))return;
   if(state.liveLastPlaybackTime===null||time>state.liveLastPlaybackTime+.2){state.liveLastPlaybackTime=time;state.livePlaybackProgressAt=now;}
   else if(state.livePlaybackProgressAt&&now-state.livePlaybackProgressAt>18000){state.livePlaybackProgressAt=now;void handleLivePlaybackFailure('直播画面停止推进，正在尝试备用线路');}
  }
  else if(event.status==='failed'){recordDiag('failed',event.error||'直播源无法播放',{title:liveChannel()?.name||'直播'});void handleLivePlaybackFailure(event.error||'直播源无法播放');}
  else if(event.status==='ended'){recordDiag('ended','直播流意外结束，正在尝试备用线路',{title:liveChannel()?.name||'直播'});void handleLivePlaybackFailure('直播流意外结束，正在尝试备用线路');}
  return;
 }
 if(event.status==='progress'&&state.playURLs[state.playIndex]?.preview!==true){
  if(Number(event.removedAdSegments)>0){state.removedAdSegments=Number(event.removedAdSegments);state.removedAdSeconds=Number(event.removedAdSeconds)||0;}
  state.playTime=Number(event.time)||0;state.playDuration=Number(event.duration)||state.playDuration||0;
  if(native.native())native.syncProgress(state.playTime,state.playDuration);
  saveProgress(Number(event.time),session,Number(event.duration)||undefined);
  if(shouldAutoSkipOutro({preview:false,outroSkipped:nativeSession.outroSkipped,autoNext:state.autoNext,skipOutroSeconds:state.skipOutroSeconds,duration:state.playDuration,currentTime:state.playTime})){
   const list=state.detail?.playSources?.[state.line]?.list||[],idx=list.findIndex(x=>x.id===session.episodeId);
   if(idx>=0&&idx<list.length-1){nativeSession.outroSkipped=true;toast('已自动跳过片尾，切入下一集');void playEpisode(idx+1);}
  }
 }
 if(event.status==='ready'&&state.playRecovery?.key===sessionKey(session)){state.playRecovery.running=false;state.playRecovery.startedAt=0;if(state.playError){state.playError='';render();}}
 if(event.status==='ready') {state.playLoading=false;recordDiag('ready','首帧已出');const curLine=state.detail?.playSources?.[state.line];if(curLine){state.lineHealth=recordLineOutcome(state.lineHealth,state.site,curLine,{ok:true,latencyMs:state.playLatencyMs||0});write('lineHealth',state.lineHealth);}}
 if(event.status==='cicadaFallback'){state.diagEngine='Cicada';state.playLoading=true;state.playLoadingText='正在尝试软解播放…';state.playError='';if(state.playRecovery)state.playRecovery.running=false;recordDiag('cicada','卡顿后改用软解，清晰度不变');toast('当前线路改用软解播放，清晰度不变');render();}
 // J1：点播流没有视频轨道（Cicada 也起不来时才到这里）。只留声音，
 // 不自动换线——换不换由用户决定，和直播的 audioOnly 一致。
 if(event.status==='audioOnly'){recordDiag('audioOnly','无视频轨道，当前仅播放声音');toast('该视频没有可识别的视频轨道，仅播放声音');render();}
 if(event.status==='failed'){state.playLoading=false;recordDiag('failed',event.error||'播放器无法读取当前线路');const curLine=state.detail?.playSources?.[state.line];if(curLine){state.lineHealth=recordLineOutcome(state.lineHealth,state.site,curLine,{ok:false});write('lineHealth',state.lineHealth);}void recoverPlayback(session,event.error||'播放器无法读取当前线路');}
 if(event.status==='ended'){state.playLoading=false;recordDiag('ended','本集播完');saveProgress(0,session,state.playDuration||undefined);state.playTime=0;if(native.native())native.syncProgress(0,state.playDuration||0);if(state.sleepTimerMode==='episode'){state.sleepTimerMode='off';native.controlPlayer('pause');toast('🌙 本集已播完，睡眠定时已自动暂停播放');render();return;}if(state.autoNext&&state.site===session.siteId&&String(state.detail?.id)===session.movie.id){const list=state.detail?.playSources?.[state.line]?.list||[],index=list.findIndex(x=>x.id===session.episodeId);if(index>=0&&index<list.length-1)playEpisode(index+1);}}
};
function applyResolvedEpisode(d,result,{prefetch=false}={}){
 state.line=result.lineIndex;state.episode=result.episode;state.pendingEpisodeIndex=result.episodeIndex;
 const totalEps=d.playSources?.[result.lineIndex]?.list?.length||0;
 state.episodePage=Math.floor((state.episodeDesc&&totalEps>0?totalEps-1-result.episodeIndex:result.episodeIndex)/20);
 state.playURLs=result.urls.slice(0,4);state.playIndex=0;state.playLatencyMs=prefetch?1:(result.latencyMs||0);state.playQualityLabel=result.qualityLabel||'';state.playBandwidth=result.bandwidth||0;state.playRecovery.triedLines.add(result.lineIndex);if(result.urls[0]?.url)state.playRecovery.failedURLs.add(result.urls[0].url);
 state.loading=false;state.playStatus='';render();
 if(result.switched)toast('已切换至可用线路：'+d.playSources[result.lineIndex].name);
 else if(prefetch)showPlayerHUD('⚡ 已命中下一集预热缓存，秒速起播');
}
async function verifyInBackground(client,detail,lineIndex,episodeIndex,signal,epoch){
 // A1 的后半段：起播后在后台验证候选地址，把画质/软解地址/预热
 // 清单合并到正在播的地址上。正在播的地址验死且首帧未出时，不等
 // 播放器自己超时（15 秒宽限 + 软解重建），直接走恢复流程换线；
 // 已经出画面的不打断——验证失败很可能只是瞬时抖动。
 try{
  const activeLine=Number.isInteger(state.line)?state.line:lineIndex,activeEp=Number.isInteger(state.pendingEpisodeIndex)?state.pendingEpisodeIndex:episodeIndex;
  const result=await resolvePlayableEpisode(client,detail,activeLine,activeEp,signal,()=>{},{excludedLines:[...state.playRecovery.failedLines],initialLineIndex:activeLine,initialUrls:state.playURLs,lineHealth:state.lineHealth});
  if(epoch!==state.epoch)return;
  if(state.page!=='detail'||!state.episode||String(state.detail?.id)!==String(detail.id))return;
  const verifiedByUrl=new Map(result.urls.filter(u=>u.verifiedMeta).map(u=>[u.url,u.verifiedMeta]));
  for(const entry of state.playURLs){const meta=verifiedByUrl.get(entry.url);if(meta){entry.verifiedMeta=meta;entry.cicadaURL=meta.cicadaURL||entry.cicadaURL||'';if(meta.warmPlaylists?.length)entry.warmPlaylists=meta.warmPlaylists;}}
  if(!result.switched){for(const u of result.urls)if(u?.url&&!state.playURLs.some(x=>x.url===u.url)&&state.playURLs.length<4)state.playURLs.push(u);}
  if(result.qualityLabel){state.playQualityLabel=result.qualityLabel;state.playBandwidth=result.bandwidth||0;}
  const playing=state.playURLs[state.playIndex];
  if(playing&&verifiedByUrl.has(playing.url)&&native.native())native.controlPlayer('updateMeta',{cicadaURL:playing.cicadaURL||'',warmPlaylists:playing.warmPlaylists||[]});
  if(playing&&verifiedByUrl.has(playing.url)){render();return;}
  // 后台验证只在“还在等首帧、没进软解回退、恢复流程没在跑”时才
  // 能打断播放：软解回退有自己的 10 秒首帧看门狗，验证中途换线
  // 会直接杀掉它；恢复流程正在跑时也不抢，它自己会按失败集合推进。
  const recovery=state.playRecovery;
  if(playing&&state.playLoading&&state.diagEngine!=='Cicada'&&recovery&&!recovery.running){
   if(result.switched){
    // 换线前把被放弃的线路记死：不记的话，下一次后台验证可能
    // 又切回来，两条时好时坏的线路会在验证里无限对跳（走马上任
    // 就是这么空转的）。每集最多后台换线 2 次，超过就把决定权
    // 还给播放器和恢复流程，不再主动切。
    const abandoned=state.line;
    if((recovery.backgroundSwitches||0)>=2){render();return;}
    recovery.failedLines.add(abandoned);recovery.triedLines.add(abandoned);
    if(playing.url)recovery.failedURLs.add(playing.url);
    recovery.backgroundSwitches=(recovery.backgroundSwitches||0)+1;
    state.line=result.lineIndex;recordDiag('switch','后台验证发现当前线路不可用，已切换到'+(detail.playSources?.[result.lineIndex]?.name||'可用线路'));toast('当前线路验证失败，已切换到可用线路');await playEpisode(result.episodeIndex,{automatic:true});return;}
   const session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title};
   recordDiag('failed','当前地址验证失败，正在尝试备用地址');
   void recoverPlayback(session,'当前地址验证失败，正在尝试备用地址');
   return;
  }
  render();
 }catch(error){/* 后台验证失败不打断正在播的画面；播放器自己会报失败 */}
}
async function playEpisode(index,{automatic=false}={}){
 const d=state.detail,selected=state.line,line=d?.playSources?.[selected];if(!line?.list?.[index])return;
 cancelEpisodePrefetch();state.nextEpisodeReady=false;
 const requested=line.list[index],recoveryKey=`${state.site}:${d.id}:${requested.id}`,prefetchKey=`${state.site}:${d.id}:${selected}:${index}`;
 if(!automatic||state.playRecovery?.key!==recoveryKey)state.playRecovery={key:recoveryKey,failedURLs:new Set(),failedLines:new Set(),triedLines:new Set(),running:false};
 const c=client(),{signal,epoch}=cancel();saveProgress($('#video')?.currentTime);if(!automatic){state.playTime=0;state.playDuration=0;}state.playURLs=[];state.episode=null;state.playError='';state.pendingEpisodeIndex=index;
 const cachedPrefetch=!automatic?episodePrefetchCache.get(prefetchKey):null;
 const usePrefetch=cachedPrefetch&&(Date.now()-cachedPrefetch.timestamp<180000);
 if(usePrefetch)episodePrefetchCache.delete(prefetchKey);
 else{state.loading=true;state.playStatus='正在准备播放…';state.playLoading=true;state.playLoadingText=state.playStatus;render();}
 try{
  if(usePrefetch){
   const result=cachedPrefetch.result;
   if(epoch!==state.epoch)return;
   applyResolvedEpisode(d,result,{prefetch:true});
   if(native.native())await launchNativePlayer();else $('#video')?.play().catch(()=>{});
   scheduleNextEpisodePrefetch(d,result.lineIndex,result.episodeIndex+1);
   window.scrollTo({top:0,behavior:'smooth'});
   return;
  }
  // A1 先播后验：先拿第一条基本有效的地址起播，验证在后台并行跑。
  const fast=await resolveFirstCandidate(c,d,selected,index,signal,{excludedLines:automatic?[...state.playRecovery.failedLines]:[],lineHealth:state.lineHealth});
  if(epoch!==state.epoch)return;
  applyResolvedEpisode(d,{...fast,latencyMs:0,qualityLabel:'',bandwidth:0});
  if(native.native())await launchNativePlayer();else $('#video')?.play().catch(()=>{});
  scheduleNextEpisodePrefetch(d,fast.lineIndex,fast.episodeIndex+1);
  window.scrollTo({top:0,behavior:'smooth'});
  void verifyInBackground(c,d,selected,index,signal,epoch);
 }catch(error){if(epoch===state.epoch&&error.name!=='AbortError'){if(state.playRecovery)state.playRecovery.running=false;state.playError=error.message;state.loading=false;state.playLoading=false;state.playStatus='';render();}}
 finally{if(epoch===state.epoch&&state.loading){state.loading=false;state.playStatus='';render();}}
}

function wireVideo(){
 const liveVideo=$('#live-video');
 if(liveVideo&&!native.native()){
  liveVideo.dataset.aspect=state.aspectMode;
  liveVideo.addEventListener('loadedmetadata',()=>{if(state.page==='live'&&state.liveActive){state.liveVideoReady=true;state.liveStatus='正在直播';}});
  liveVideo.addEventListener('error',()=>{if(state.page==='live'&&state.liveActive)void handleLivePlaybackFailure('网页直播流连接中断，正在尝试备用线路');});
 }
 const video=$('#video');if(!video){playbackSession=null;return;}
 video.playbackRate=state.playbackRate;
 video.muted=state.playerMuted;
 video.dataset.aspect=state.aspectMode;
 video.classList.toggle('is-mirrored',state.playerMirrored);
 if(video.dataset.wiredUrl===video.getAttribute('src'))return;
 video.dataset.wiredUrl=video.getAttribute('src')||'';
 const preview=state.playURLs[state.playIndex]?.preview===true,session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title,preview};
 playbackSession=session;saveProgress(undefined,session);
 video.addEventListener('loadedmetadata',()=>{if(preview)return;if(Number.isFinite(video.duration)&&video.duration>0)saveProgress(undefined,session,video.duration);const row=validSavedRows('history').find(x=>x.siteId===session.siteId&&String(x.movie.id)===String(session.movie.id)&&String(x.episodeId)===String(session.episodeId));if(row?.time>3&&row.time<video.duration-5){video.currentTime=row.time;showPlayerHUD('已续播至 '+formatDuration(row.time));}});
 let last=0,outroSkipped=false;video.addEventListener('timeupdate',()=>{if(!preview&&Date.now()-last>5000){saveProgress(video.currentTime,session,video.duration);last=Date.now();}if(shouldAutoSkipOutro({preview,outroSkipped,autoNext:state.autoNext,skipOutroSeconds:state.skipOutroSeconds,duration:video.duration,currentTime:video.currentTime})){const list=state.detail?.playSources?.[state.line]?.list||[],idx=list.findIndex(x=>x.id===state.episode?.id);if(idx>=0&&idx<list.length-1){outroSkipped=true;toast('已自动跳过片尾，切入下一集');playEpisode(idx+1);}}});
 video.addEventListener('error',()=>void recoverPlayback(session,'网页播放器无法读取当前线路'));
 video.addEventListener('ended',()=>{saveProgress(0,session,video.duration);if(state.sleepTimerMode==='episode'){state.sleepTimerMode='off';video.pause();toast('🌙 本集已播完，睡眠定时已自动暂停播放');render();return;}if(!state.autoNext)return;const list=state.detail?.playSources?.[state.line]?.list||[],index=list.findIndex(x=>x.id===state.episode?.id);if(index>=0&&index<list.length-1)playEpisode(index+1);});
 video.addEventListener('dblclick',e=>{
  const rect=video.getBoundingClientRect(),ratio=(e.clientX-rect.left)/Math.max(1,rect.width);
  if(ratio<0.33){e.preventDefault();seekActivePlayer(-15);}
  else if(ratio>0.67){e.preventDefault();seekActivePlayer(15);}
 });
 let holdTimer=null,boosting=false;
 const startHold=()=>{clearTimeout(holdTimer);holdTimer=setTimeout(()=>{if(!video.paused&&video.playbackRate!==2){boosting=true;video.playbackRate=2;showPlayerHUD('⚡ 2.0× 长按倍速播放中');}},420);};
 const endHold=()=>{clearTimeout(holdTimer);if(boosting){boosting=false;video.playbackRate=state.playbackRate;showPlayerHUD(`已恢复 ${state.playbackRate}× 倍速`);}};
 video.addEventListener('pointerdown',startHold,{passive:true});
 video.addEventListener('pointerup',endHold,{passive:true});
 video.addEventListener('pointercancel',endHold,{passive:true});
 video.addEventListener('pointerleave',endHold,{passive:true});
}
root.addEventListener('touchstart',e=>{const hero=e.target.closest('.hero');heroTouchStartX=hero&&e.touches?.[0]?e.touches[0].clientX:null;},{passive:true});
root.addEventListener('touchend',e=>{if(heroTouchStartX===null||state.page!=='home')return;const endX=e.changedTouches?.[0]?.clientX,dx=endX!=null?endX-heroTouchStartX:0;heroTouchStartX=null;if(Math.abs(dx)<45)return;const picks=homePicks();if(picks.length<2)return;lastHeroInteractionAt=Date.now();state.heroIndex=(state.heroIndex+(dx<0?1:picks.length-1))%picks.length;if(!updateHeroCarouselDOM())render();},{passive:true});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  if(state.showAgeGate){state.showAgeGate=false;render();return;}
  if(state.page==='live'&&state.liveSheet){state.liveSheet='';state.liveSelectedRoute=null;state.liveSelectedProgram=null;render();return;}
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)){document.activeElement.blur();return;}
 }
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
  const searchInput=$('#search-query')||$('#live-search-form input');
  if(searchInput){e.preventDefault();searchInput.focus();searchInput.select?.();return;}
 }
 if(state.page!=='detail'||!state.playURLs.length)return;
 const video=$('#video');
 if(e.key==='ArrowRight'){e.preventDefault();seekActivePlayer(15);}
 else if(e.key==='ArrowLeft'){e.preventDefault();seekActivePlayer(-15);}
 else if(e.key===' '&&video){e.preventDefault();if(video.paused){video.play().catch(()=>{});showPlayerHUD('▶ 播放');}else{video.pause();showPlayerHUD('⏸ 暂停');}}
 else if((e.key==='f'||e.key==='F')&&video){e.preventDefault();video.webkitEnterFullscreen?.()||video.requestFullscreen?.();}
 else if((e.key==='m'||e.key==='M')&&video){e.preventDefault();video.muted=!video.muted;state.playerMuted=video.muted;showPlayerHUD(video.muted?'🔇 已静音':'🔊 已取消静音');}
 else if(e.key==='ArrowUp'&&video){e.preventDefault();video.muted=false;video.volume=Math.min(1,Math.round((video.volume+0.1)*10)/10);showPlayerHUD(`🔊 音量 ${Math.round(video.volume*100)}%`);}
 else if(e.key==='ArrowDown'&&video){e.preventDefault();video.volume=Math.max(0,Math.round((video.volume-0.1)*10)/10);showPlayerHUD(`🔉 音量 ${Math.round(video.volume*100)}%`);}
 else if((e.key==='n'||e.key==='N')){const list=state.detail?.playSources?.[state.line]?.list||[],idx=list.findIndex(x=>x.id===state.episode?.id);if(idx>=0&&idx<list.length-1){e.preventDefault();playEpisode(idx+1);}}
});
root.addEventListener('click',async event=>{const button=event.target.closest('[data-act]');if(!button)return;const {act,id}=button.dataset;try{if(act==='source'){if(!sites.some(item=>item.id===id))return;cacheView();saveProgress($('#video')?.currentTime);cancel();localStorage.setItem('sanyuan:channel:'+state.site,String(state.channel));state.site=id;state.channel=Number(localStorage.getItem('sanyuan:channel:'+id)||1);state.discoverTab=0;state.heroIndex=0;state.collectionStack=[];restoreFilters();localStorage.setItem('sanyuan:site',id);state.detail=null;state.playURLs=[];state.episode=null;state.authError='';if(state.page==='detail')state.page='home';state.sections=[];state.items=[];state.loading=false;if(state.page==='discover')loadDiscovery();else if(!client().config||!restoreView())load();else render();}
else if(act==='page'||act==='account'){if(act==='page'&&!['home','discover','browse','live','me','saved','settings','diagnostics'].includes(id))return;if(activeRenderKey)pageScrollCache.set(activeRenderKey,window.scrollY);cacheView();if(id==='live'&&state.page!=='live')state.liveReturn={page:state.page,scrollY:window.scrollY};if(state.page==='live'&&id!=='live'){native.closeLive();state.liveGuideController?.abort();state.liveGuideController=null;state.liveEPGLoading=false;if(state.liveActive){state.liveResume=true;state.liveActive=false;}}cancel();state.page=act==='account'?'me':id;if(act==='account')state.meTab='settings';state.error='';state.loading=false;window.scrollTo(0,0);if(state.page==='discover')loadDiscovery();else if(['home','browse'].includes(state.page)){if(!client().config||!restoreView())load();else render();}else{render();if(state.page==='live'){native.openLive();liveCacheReady.then(()=>{if(state.page!=='live')return;if(state.liveChannels.length)render();else if(!state.liveCacheFound&&!state.liveInitialAttempted)loadLivePlaylist();});if(state.liveResume&&liveChannel()){state.liveResume=false;state.liveTriedURLs.clear();playLiveVariant(state.liveVariantIndex);}}}}
else if(act==='live-back'){if(state.liveActive){state.liveResume=true;state.liveActive=false;}native.closeLive();state.liveSheet='';state.liveGuideController?.abort();state.liveGuideController=null;state.liveEPGLoading=false;const previous=state.liveReturn||{page:'home',scrollY:0};state.liveReturn=null;state.page=previous.page;render();requestAnimationFrame(()=>window.scrollTo({top:previous.scrollY||0,behavior:'instant'}));}
else if(act==='live-import-open'){state.liveImportOpen=!state.liveImportOpen;render();}
else if(act==='live-refresh')loadLivePlaylist();
else if(act==='live-panel'){state.livePanel=id;render();if(id==='programs')loadLiveGuide();}
else if(act==='live-category'){state.liveCategory=id;state.liveSearch='';state.liveVisibleCount=80;state.liveNativeVisibleCount=40;state.liveSelectedRoute=null;if(state.livePanel==='categories')state.livePanel='channels';render();}
else if(act==='live-more'){state.liveVisibleCount+=80;render();}
else if(act==='live-channel'){const index=Number(id),channel=state.liveChannels[index];if(channel){state.liveGuideController?.abort();state.liveGuideController=null;state.liveEPGLoading=false;state.liveCurrentIndex=index;state.liveTriedURLs.clear();state.liveVariantIndex=0;state.liveError='';state.livePrograms=[];state.liveProgramDate='';state.liveSelectedRoute=null;await playLiveVariant(0);}}
else if(act==='live-step'){
 if(!state.liveChannels.length)return;
 const step=Number(id)||1,filtered=liveFilteredChannels(),inFiltered=filtered.findIndex(ch=>ch.index===state.liveCurrentIndex);
 const pool=inFiltered>=0&&filtered.length>1?filtered:state.liveChannels,currentPos=pool===filtered?inFiltered:Math.max(0,state.liveCurrentIndex),targetChannel=pool[(currentPos+step+pool.length)%pool.length];
 const next=targetChannel?targetChannel.index:0;
 state.liveCurrentIndex=next;state.liveTriedURLs.clear();state.liveVariantIndex=0;state.liveError='';state.livePrograms=[];state.liveProgramDate='';state.liveSelectedRoute=null;
 toast('已切台：'+(state.liveChannels[next]?.name||'频道'));
 await playLiveVariant(0);
}
else if(act==='live-play'){state.liveTriedURLs.clear();await playLiveVariant(state.liveVariantIndex);}
else if(act==='live-route'){const routes=liveCandidateList(liveChannel()),index=Number(id);if(routes[index]){state.liveSelectedRoute=routes[index];state.liveSheet='route';render();}}
else if(act==='live-route-system'){const route=state.liveSelectedRoute;state.liveSheet='';state.liveSelectedRoute=null;if(route){state.liveTriedURLs.clear();state.liveError='';const index=liveCandidateList(liveChannel()).findIndex(item=>item.url===route.url);if(index>=0)await playLiveVariant(index);}}
else if(act==='live-route-vlc'){const route=state.liveSelectedRoute;state.liveSheet='';render();if(route){try{await native.openExternal(route.url,{live:true});toast('已切换到 VLC');}catch(error){toast(error.message||'未检测到 VLC，请先安装 VLC');}}}
else if(act==='live-route-copy'){const route=state.liveSelectedRoute;state.liveSheet='';render();if(route){if(native.native())await native.copyText(route.url);else if(navigator.clipboard)await navigator.clipboard.writeText(route.url);else throw Error('此设备不允许复制播放地址');toast('已复制播放地址');}}
else if(act==='live-favorite'){const channel=state.liveChannels[Number(id)];if(channel){state.liveFavorites=liveFavorite(channel)?state.liveFavorites.filter(item=>item!==channel.identity):[...state.liveFavorites,channel.identity];write('liveFavorites',state.liveFavorites);render();}}
else if(act==='live-favorite-current'){const channel=liveChannel();if(channel){state.liveFavorites=liveFavorite(channel)?state.liveFavorites.filter(item=>item!==channel.identity):[...state.liveFavorites,channel.identity];write('liveFavorites',state.liveFavorites);render();}}
else if(act==='live-airplay'){if(native.native()){const rect=button.getBoundingClientRect();native.showAirPlay({x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewportWidth:innerWidth});}else toast('AirPlay 投放需在 iPhone 原生 App 中使用');}
else if(act==='live-channel-info'){state.liveSheet='channel';render();}
else if(act==='live-epg-info'){state.liveSheet='guide';render();}
else if(act==='live-sheet-dismiss'){if(button.classList.contains('live-sheet-backdrop')&&event.target!==button)return;state.liveSheet='';state.liveSelectedRoute=null;render();}
else if(act==='live-date'){state.liveProgramDate=id;render();}
else if(act==='live-program'){const channel=liveChannel(),days=[...new Set(state.livePrograms.map(program=>dayKey(program.start)))],today=dayKey(Date.now()),selectedDate=days.includes(state.liveProgramDate)?state.liveProgramDate:days.includes(today)?today:days[0]||today;state.liveSelectedProgram=state.livePrograms.filter(program=>dayKey(program.start)===selectedDate)[Number(id)]||null;state.liveSheet='program';render();}
else if(act==='live-program-dismiss'){state.liveSelectedProgram=null;state.liveSheet='';render();}
else if(act==='live-epg-refresh'){state.livePrograms=[];loadLiveGuide({force:true});}
else if(act==='live-fullscreen'){if(!native.native())$('#live-video')?.webkitEnterFullscreen?.();}
else if(act==='discover-tab'){state.discoverTab=Number(id);if(!discoveryCache.has(discoveryCacheKey(state.discoverTab)))state.discoverGroups=[];loadDiscovery();}
else if(act==='discover-month'){state.discoverMonth=Number(id);render();}
else if(act==='discover-year'){state.discoverYear=Number(id);render();}
else if(act==='discover-reset-date'){state.discoverYear=new Date().getFullYear();state.discoverMonth=new Date().getMonth()+1;render();}
else if(act==='discover-more')loadDiscovery({more:true});
else if(act==='me-tab'){nativeClearConfirm=false;if(state.meTab!==id)window.scrollTo({top:0,behavior:'instant'});state.page='me';state.meTab=id;if(id==='favorites'||id==='history')state.savedTab=id;render();}
else if(act==='hero-pick'){lastHeroInteractionAt=Date.now();state.heroIndex=Number(id);if(!updateHeroCarouselDOM())render();}
else if(act==='remove-history'){event.stopPropagation();const key=button.dataset.key;write('history',read('history').filter(r=>(r.key||(r.siteId+':'+r.movie.id))!==key));invalidateHomeDOMCache();toast('已移除观看记录');render();}
else if(act==='remove-saved-item'){event.stopPropagation();const key=button.dataset.key;write(state.savedTab,read(state.savedTab).filter(r=>(r.key||(r.siteId+':'+r.movie.id))!==key));invalidateHomeDOMCache();toast('已移除条目');render();}
else if(act==='search-clear'){state.query='';const input=$('#search-query');if(input){input.value='';input.focus();}button.hidden=true;}
else if(act==='search-chip'){const q=button.dataset.query||'';if(q){rememberSearch(q);state.query=q;state.page='search';state.items=[];load();}}
else if(act==='search-history-clear'){state.searchHistory=[];write('searchHistory',[]);render();}
else if(act==='collection-link')openCollection(button.dataset.route,button.dataset.title);
else if(act==='collection-back'){
 cancel();const previous=state.collectionStack.pop();
 if(previous){Object.assign(state,previous,{page:'collection',loading:false,error:''});render();requestAnimationFrame(()=>window.scrollTo({top:previous.scrollY||0,behavior:'instant'}));}
 else{state.page='home';state.loading=false;state.error='';restoreView();render();requestAnimationFrame(()=>window.scrollTo({top:state.homeScroll||0,behavior:'instant'}));}
}
else if(act==='history-all'){state.savedTab='history';state.meTab='history';state.page='me';render();window.scrollTo(0,0);}
else if(act==='filter-option'||act==='filter-clear'||act==='filters-reset'){
 cacheView();
 if(act==='filters-reset')state.filters={};else if(act==='filter-clear')delete state.filters[button.dataset.key];else state.filters[button.dataset.key]=id;
 rememberFilters();state.items=[];if(!restoreView())load();else render();
}
else if(act==='filters-expanded'){const key=`sanyuan:filters-expanded:${state.site}:${state.channel}`;localStorage.setItem(key,localStorage.getItem(key)==='true'?'false':'true');render();}
else if(act==='category'){cacheView();state.channel=Number(id);state.episodePage=0;restoreFilters();state.items=[];state.page='browse';if(!restoreView())load();else render();}
else if(act==='refresh'||act==='refresh-config'){const currentClient=client();if(act==='refresh-config')currentClient.config=null;if(state.page==='detail')openDetail(state.detail?.id);else if(state.page==='discover')loadDiscovery({refresh:true});else load();}
else if(act==='detail')openDetail(id,button.dataset.source||state.site);
else if(act==='season'){if(String(state.detail?.id)!==String(id))await openDetail(id);}
else if(act==='back'){cancel();state.playURLs=[];if(state.detailReturn){const previous=state.detailReturn;restoreDetailPage(previous);}else{state.page='home';state.loading=false;if(!restoreView())load();else render();}}
else if(act==='more')load({more:true});
else if(act==='favorite'){const movie=state.sections.flatMap(x=>x.items).find(x=>x.id===id);if(movie){favorite(movie);updateHeroCarouselDOM();}}
else if(act==='favorite-detail'){favorite(detailMovie());render();}
else if(act==='play-first'){const list=state.detail?.playSources?.[state.line]?.list||[],current=list.findIndex(ep=>ep.id===state.episode?.id),resumeIdx=current<0?(resumeEntryForDetail(state.detail)?.index??-1):-1;if(list.length)await playEpisode(current>=0?current:resumeIdx>=0?resumeIdx:0);else $('#episode-list')?.scrollIntoView({behavior:'smooth',block:'start'});}
else if(act==='scroll-episodes')$('#episode-list')?.scrollIntoView({behavior:'smooth',block:'start'});
else if(act==='saved-tab'){nativeClearConfirm=false;state.savedTab=id;state.meTab=id==='history'?'history':'favorites';state.page='me';render();}
else if(act==='scroll-top'){window.scrollTo({top:0,behavior:'smooth'});}
else if(act==='clear-saved'){if(button.dataset.confirm==='yes'){nativeClearConfirm=false;write(state.savedTab,[]);invalidateHomeDOMCache();toast(state.savedTab==='favorites'?'已清空收藏':'已清空观看记录');render();}else{button.dataset.confirm='yes';button.textContent='⚠️ 再次点击确认清空';setTimeout(()=>{if(button.isConnected&&button.dataset.confirm==='yes'){delete button.dataset.confirm;button.textContent=state.savedTab==='favorites'?'清空收藏':'清空观看记录';}},4000);}}
else if(act==='expand-summary'){const s=$('#summary');if(s){const exp=s.classList.toggle('expanded');button.innerHTML=exp?'收起简介 <span>⌃</span>':'展开简介 <span>⌄</span>';}}
else if(act==='actor-search'){const q=String(id||'').trim();if(q){rememberSearch(q);state.query=q;state.page='search';state.items=[];window.scrollTo(0,0);load();}}
else if(act==='saved-source-filter'){nativeClearConfirm=false;state.savedSourceFilter=id||'all';render();}
else if(act==='live-search-clear'){state.liveSearch='';state.liveVisibleCount=80;render();}
else if(act==='live-reset-default'){const defURL='https://fnipv.69574517.xyz/shiju19880215/interface.m3u';state.liveURL=defURL;const inp=$('#live-playlist-url');if(inp)inp.value=defURL;toast('已填入默认直播源地址');}
else if(act==='skip-outro-setting'){const sec=Number(id);if([0,60,90,120].includes(sec)){state.skipOutroSeconds=sec;write('skipOutroSeconds',sec);toast(sec>0?`已开启片尾剩余 ${sec} 秒自动连播`:'已关闭自动跳过片尾');render();}}
else if(act==='player-mute'){state.playerMuted=!state.playerMuted;const v=$('#video');if(v)v.muted=state.playerMuted;if(native.native())native.controlPlayer('mute',{muted:state.playerMuted});showPlayerHUD(state.playerMuted?'🔇 已静音':'🔊 已开启声音');button.textContent=state.playerMuted?'🔇 已静音':'🔊 声音';button.classList.toggle('accent',state.playerMuted);}
else if(act==='player-mirror'){state.playerMirrored=!state.playerMirrored;const v=$('#video');if(v)v.classList.toggle('is-mirrored',state.playerMirrored);showPlayerHUD(state.playerMirrored?'⇄ 已开启镜像画面':'⇄ 已恢复正常画面');button.classList.toggle('accent',state.playerMirrored);}
else if(act==='adult-toggle'){if(state.adultEnabled){state.adultEnabled=false;localStorage.setItem('sanyuan:adult','false');state.showAgeGate=false;if(state.channel===5){state.channel=1;state.filters={};state.items=[];state.next='page=1';}toast('已隐藏 18+ 分类');render();}else{state.showAgeGate=true;render();}}
else if(act==='age-confirm'){state.adultEnabled=true;state.showAgeGate=false;localStorage.setItem('sanyuan:adult','true');toast('已启用 18+ 分类');render();}
else if(act==='age-cancel'){if(button.classList.contains('agebackdrop')&&event.target!==button)return;state.showAgeGate=false;render();}
else if(act==='columns'){state.columns=id;localStorage.setItem('sanyuan:columns',id);render();}
else if(act==='theme'){state.theme=id==='black'?'black':'white';localStorage.setItem('sanyuan:theme',state.theme);render();}
else if(act==='settings-section'){state.settingsSection=id||'all';render();}
else if(act==='playback-rate-btn'){const r=Number(id);if([0.5,0.75,1,1.25,1.5,2].includes(r)){applyLivePlaybackRate(r);toast(`播放倍速已设为 ${r}×`);render();}}
else if(act==='reset-playback-prefs'){state.cleanHLS=true;state.autoNext=true;state.playbackRate=1;state.skipIntroSeconds=90;state.skipOutroSeconds=0;state.aspectMode='fit';write('cleanHLS',true);write('autoNext',true);write('playbackRate',1);write('skipIntroSeconds',90);write('skipOutroSeconds',0);localStorage.setItem('sanyuan:aspectMode','fit');toast('已恢复默认播放设置');render();}
else if(act==='clear-runtime-cache'){viewCache.clear();discoveryCache.clear();pageDOMCache.clear();pageScrollCache.clear();episodePrefetchCache.clear();toast('已清理内存与页面缓存');render();}
else if(act==='clear-search-history-settings'){state.searchHistory=[];write('searchHistory',[]);toast('已清空搜索记录');render();}
else if(act==='skip-intro-setting'){const sec=Number(id);if([60,90,120].includes(sec)){state.skipIntroSeconds=sec;write('skipIntroSeconds',sec);toast(`跳过片头已设为 ${sec} 秒`);render();}}
else if(act==='aspect-setting'){if(['fit','fill','stretch'].includes(id)){state.aspectMode=id;localStorage.setItem('sanyuan:aspectMode',id);if(native.native())native.controlPlayer('gravity',{mode:id});toast('默认画面比例已更新');render();}}
else if(act==='player-seek'){seekActivePlayer(Number(id)||15);}
else if(act==='player-skip-intro'){seekActivePlayer(state.skipIntroSeconds||90);}
else if(act==='player-aspect'){cycleAspectMode();}
else if(act==='player-sleep-timer'){cycleSleepTimer();}
else if(act==='sleep-timer-setting'){if(['off','episode','15','30','60'].includes(id))applySleepTimer(id);}
else if(act==='player-offline-cache'){
 const entry=state.playURLs[state.playIndex];
 if(!entry?.url||!state.episode){toast('暂无可缓存的视频地址');return;}
 if(!native.native()){toast('离线缓存仅在 iPhone 原生 App 中可用');return;}
 const cacheKey=`${state.site}_${state.detail?.id}_${state.episode.id}`,title=`${state.detail?.title||''} ${state.episode.title||''}`.trim();
 toast('正在缓存播放清单…');
 try{await native.saveOfflineEpisode(cacheKey,title,entry.url,mediaHeaders(client(),entry));toast('已缓存到本地');}catch(err){toast(err.message||'缓存失败');}
}
else if(act==='player-copy-url'){
 const url=state.playURLs[state.playIndex]?.url;
 if(url){await native.copyText(url);toast('已复制当前播放流地址');}
}
else if(act==='player-open-vlc'){
 const url=state.playURLs[state.playIndex]?.url;
 if(url){try{await native.openExternal(url,{live:false});toast('已唤起 VLC 播放');}catch(err){toast(err.message||'未检测到 VLC');}}
}
else if(act==='player-pip'){
 const video=$('#video');
 if(video){
  if(document.pictureInPictureElement)await document.exitPictureInPicture().catch(()=>{});
  else if(video.requestPictureInPicture)await video.requestPictureInPicture().catch(()=>toast('当前浏览器不支持画中画'));
  else if(video.webkitSetPresentationMode)video.webkitSetPresentationMode(video.webkitPresentationMode==='picture-in-picture'?'inline':'picture-in-picture');
 }
}
else if(act==='episode-order'){state.episodeDesc=!state.episodeDesc;state.episodePage=0;render();}
else if(act==='episode-locate'){const list=state.detail?.playSources?.[state.line]?.list||[],cur=list.findIndex(x=>x.id===state.episode?.id);if(cur>=0){state.episodePage=Math.floor((state.episodeDesc?list.length-1-cur:cur)/20);render();}}
else if(act==='saved-sort-toggle'){state.savedSort=state.savedSort==='title'?'recent':'title';render();}
else if(act==='episode-step'){const list=state.detail?.playSources?.[state.line]?.list||[],index=list.findIndex(x=>x.id===state.episode?.id)+Number(id);if(index>=0&&index<list.length)await playEpisode(index);}
else if(act==='episode-page'){state.episodePage=Math.max(0,Number(id)||0);render();}
else if(act==='play-source'){
 const target=Number(id);if(target===state.line)return;
 const requested=state.episode,oldLine=state.detail?.playSources?.[state.line],{signal,epoch}=cancel();
 saveProgress($('#video')?.currentTime);state.line=target;state.episodePage=0;state.playURLs=[];state.episode=null;state.loading=true;state.playError='';state.error='';render();
 try{
  await loadEpisodes(signal);if(epoch!==state.epoch)return;
  const list=state.detail?.playSources?.[target]?.list||[],at=requested?matchingEpisode(requested,list,{singleMovie:Number(state.detail?.channelId)===1&&oldLine?.list?.length===1,singleEpisodeSource:oldLine?.list?.length===1}):-1;
  state.loading=false;
  if(requested&&at>=0){await playEpisode(at);return;}
  if(requested)toast('这条线路没有对应集数，请重新选择选集。');
 }catch(error){if(epoch===state.epoch&&error.name!=='AbortError')state.error=error.message;}
 finally{if(epoch===state.epoch){state.loading=false;render();}}
}
else if(act==='episode')await playEpisode(Number(id));
else if(act==='native-player'){if(!native.native()){$('#video')?.webkitEnterFullscreen?.();return;}await launchNativePlayer();}
else if(act==='retry-play')await playEpisode(state.pendingEpisodeIndex);
else if(act==='anonymous'){state.authError='';button.disabled=true;try{await client().anonymous();toast('访客模式已启用');}catch(error){state.authError=error.message;}render();}
else if(act==='logout'){await client().logout();toast('已退出本站会话');render();}
else if(act==='prefer-line'){client().preferred[button.dataset.kind]=button.dataset.url;toast('优先线路已更新');render();}
else if(act==='probe-all-sites'){await probeAllSites();}
else if(act==='probe-site'){
 const target=sites.find(s=>s.id===id);
 if(target){
  button.disabled=true;
  toast(`正在测试【${target.name}】连通性…`);
  const res=await probeSite(target);
  render();
  if(native.native())native.syncPage(nativePageSnapshot());
  toast(res.ok?`【${target.name}】握手正常 · 延迟 ${res.ms} ms`:`【${target.name}】测试未通过：${res.status}`);
 }
}
else if(act==='clear-site-health'){
 state.siteHealth={};write('siteHealth',{});render();
 if(native.native())native.syncPage(nativePageSnapshot());
 toast('已清空全网片源连通性记录');
}
else if(act==='probe-lines'){button.disabled=true;const c=client();if(site().provider){await c.home();render();toast('当前片库线路检测完成');return;}if(!c.config)await c.bootstrap();let bestMs=Infinity;for(const kind of ['cache','logic']){const urls=(c.config?.urls?.[kind]||[]).filter(u=>{try{return new URL(u).protocol==='https:';}catch{return false;}}).slice(0,5);await Promise.all(urls.map(async url=>{const start=Date.now(),ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000);try{const r=await native.request({url:url.replace(/\/$/,'')+'/heartbeat.check',method:'GET',headers:{},signal:ctrl.signal});const ms=Date.now()-start,ok=r.status>=200&&r.status<300;c.recordHealth(url,kind,ms,ok);if(ok&&ms<bestMs)bestMs=ms;}catch{c.recordHealth(url,kind,Date.now()-start,false);}finally{clearTimeout(timer);}}));const fastest=c.health.filter(h=>h.kind===kind&&h.ok).sort((a,b)=>a.ms-b.ms)[0];if(fastest&&(!c.preferred[kind]||!c.health.some(h=>h.kind===kind&&h.url===c.preferred[kind]&&h.ok)))c.preferred[kind]=fastest.url;}render();toast(Number.isFinite(bestMs)?`线路检测完成 · 最快 ${bestMs} ms`:'线路检测完成');}
}catch(error){toast(error.message);}});
root.addEventListener('input',event=>{if(event.target.id==='search-query'){const clear=$('.search-clear');if(clear)clear.hidden=!event.target.value;}else if(event.target.closest('#live-search-form')){const clear=$('.live-search-clear');if(clear)clear.hidden=!event.target.value;}});
root.addEventListener('submit',async event=>{event.preventDefault();if(event.target.id==='live-import-form'){await loadLivePlaylist(event.target.elements.url.value);}
else if(event.target.id==='live-search-form'){state.liveSearch=event.target.elements.query.value.trim();state.liveVisibleCount=80;render();}
else if(event.target.id==='search-form'){const query=$('#search-query').value.trim();if(!query)return;rememberSearch(query);state.query=query;state.page='search';state.items=[];load();}else if(event.target.id==='login-form'){const form=event.target,account=form.elements.account.value.trim(),password=form.elements.password.value;if(!account||!password)return;form.querySelector('button').disabled=true;state.authError='';try{await client().login(account,password);form.reset();toast('登录成功');}catch(error){state.authError=error.message;}render();}});
root.addEventListener('change',async event=>{if(event.target.dataset.cleanHls!==undefined){state.cleanHLS=event.target.checked;write('cleanHLS',state.cleanHLS);toast('已更新，下次播放生效');}if(event.target.dataset.autoNext!==undefined){state.autoNext=event.target.checked;write('autoNext',state.autoNext);toast(state.autoNext?'已开启自动连播':'已关闭自动连播');}if(event.target.dataset.gridColumns!==undefined){state.columns=event.target.value;localStorage.setItem('sanyuan:columns',state.columns);render();}if(event.target.dataset.playerRate!==undefined){const rate=Number(event.target.value);if([0.5,0.75,1,1.25,1.5,2].includes(rate)){applyLivePlaybackRate(rate);toast('默认倍速已更新');}}if(event.target.dataset.episodePage!==undefined){state.episodePage=Number(event.target.dataset.episodePage);render();}if(event.target.dataset.episodeJump!==undefined){const num=Math.floor(Number(event.target.value));if(Number.isFinite(num)&&num>=1){const list=state.detail?.playSources?.[state.line]?.list||[];if(list.length){const targetIdx=Math.max(0,Math.min(list.length-1,num-1));state.locatedEpisodeIndex=targetIdx;state.episodePage=Math.floor((state.episodeDesc?list.length-1-targetIdx:targetIdx)/20);render();toast('已定位至第 '+(targetIdx+1)+' 集');requestAnimationFrame(()=>pageRoot.querySelector('.episode[data-id="'+targetIdx+'"]')?.scrollIntoView({behavior:'smooth',block:'nearest'}));}}}if(event.target.dataset.filter){cacheView();state.filters[event.target.dataset.filter]=event.target.value;state.items=[];if(!restoreView())load();else render();}if(event.target.id==='source-line'){root.querySelector('[data-act="play-source"][data-id="'+Number(event.target.value)+'"]')?.click();}if(event.target.id==='play-line'){saveProgress($('#video')?.currentTime);state.playIndex=Number(event.target.value);const entry=state.playURLs[state.playIndex],session={siteId:state.site,movie:detailMovie(),episodeId:state.episode.id,episodeTitle:state.episode.title};state.playRecovery={key:sessionKey(session),failedURLs:new Set(),failedLines:new Set(),triedLines:new Set([state.line]),running:false};try{const meta=await verifyMedia(client(),entry.url,controller?.signal,entry.headers,entry.referrerPolicy);if(meta?.warmPlaylists?.length)entry.warmPlaylists=meta.warmPlaylists;entry.cicadaURL=meta?.variants?.[0]?.href||'';state.playQualityLabel=meta?.qualityLabel||'';state.playBandwidth=meta?.bandwidth||0;render();if(native.native())await launchNativePlayer();else $('#video')?.play().catch(()=>{});}catch(error){await recoverPlayback(session,error.message);}}});
window.addEventListener('pagehide',()=>saveProgress($('#video')?.currentTime,playbackSession,$('#video')?.duration));
window.addEventListener('online',()=>{if(!state.error||state.loading)return;toast('网络已恢复，正在重新加载');if(state.page==='discover')loadDiscovery({refresh:true});else if(['home','browse','search','collection'].includes(state.page))load();});
setInterval(()=>{
 if(state.sleepTimerEndAt>0&&Date.now()>=state.sleepTimerEndAt){
  state.sleepTimerEndAt=0;state.sleepTimerMode='off';
  $('#video')?.pause();$('#live-video')?.pause();
  if(native.native()){native.controlPlayer('pause');if(state.page==='live')native.stopLive();}
  state.liveActive=false;
  toast('🌙 睡眠定时已到，已为你自动暂停播放');
  render({liveFast:state.page==='live'});
 }
 if(state.page!=='home'||state.loading||heroTouchStartX!==null||Date.now()-lastHeroInteractionAt<4500||document.visibilityState==='hidden'||document.activeElement?.tagName==='INPUT')return;const picks=homePicks();if(picks.length<2)return;state.heroIndex=(state.heroIndex+1)%picks.length;if(!updateHeroCarouselDOM())render();
},5000);
restoreFilters();render();load();
