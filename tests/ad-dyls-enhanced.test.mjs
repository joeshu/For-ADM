import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
const manifest=readJSON(new URL('../universal/templates.json',import.meta.url));
const template=manifest.templates.find(t=>t.id==='dyls');
const sources=readJSON(new URL('./dyls-enhanced-sources.json',import.meta.url));
function patch(fragment,action){return action.pairs.reduce((s,[old,next,count])=>{if(s.includes(old))return s.replace(old,next);return s;},fragment);}
const service=template.actions.find(a=>a.requires.includes('function ae(e,t,n,r)'));
const player=template.actions.find(a=>a.requires.includes('function Uc(e)'));
test('Dyls cache migration deletes only adapted same-origin JS and preserves accounts/history/normal assets',async()=>{
 const origin='https://dyls1.mbxqnb.cn',handlers={},stores=new Map();
 const unrelated=[origin+'/assets/apiClient-C8Ny06Am.js',origin+'/assets/react-core-Bgz3Urnl.js',origin+'/assets/app.css',origin+'/home',origin+'/api/v1/user/info','https://other.example/assets/index-abc.js'];
 stores.set('precache',new Map([...unrelated,origin+'/assets/index-BSCFNKjP.js',origin+'/assets/player-B4L3j5Ck.js'].map(url=>[url,{old:true}])));
 stores.set('images',new Map([[origin+'/cover.jpg',{image:true}]]));
 function cache(name){if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return{keys:async()=>[...data.keys()].map(url=>({url})),delete:async req=>data.delete(req.url),match:async req=>data.get(req.url),put:async(req,value)=>data.set(req.url,value)};}
 const response={ok:true,status:200,headers:{get:()=> 'application/javascript'},clone(){return this;},rewritten:true};let network=0,fail=false,fetchOptions;
 const context={URL,self:{location:{origin},addEventListener(name,fn){handlers[name]=fn;}},caches:{keys:async()=>[...stores.keys()],open:async name=>cache(name),match:async req=>{for(const data of stores.values())if(data.has(req.url))return data.get(req.url);}},fetch:async(req,options)=>{network++;fetchOptions=options;if(fail)throw Error('offline');return response;}};
 vm.runInNewContext(sources.cachePrefix,context);
 let activation;handlers.activate({waitUntil(p){activation=p;}});await activation;
 assert.equal(stores.get('precache').size,unrelated.length);assert.equal(stores.get('images').size,1);for(const url of unrelated)assert.ok(stores.get('precache').has(url));
 let pending,stopped=0;const request={method:'GET',url:origin+'/assets/index-BSCFNKjP.js?ver=1'};
 handlers.fetch({request,stopImmediatePropagation(){stopped++;},respondWith(p){pending=p;}});assert.equal(await pending,response);assert.equal(network,1);assert.equal(stopped,1);assert.equal(fetchOptions.cache,'no-store');
 fail=true;handlers.fetch({request,stopImmediatePropagation(){stopped++;},respondWith(p){pending=p;}});assert.equal(await pending,response);assert.equal(network,2);
 for(const url of unrelated){let intercepted=false;handlers.fetch({request:{method:'GET',url},stopImmediatePropagation(){intercepted=true;},respondWith(){intercepted=true;}});assert.equal(intercepted,false);}
});
test('Dyls startup requests a distinct worker revision and explicitly checks its update',async()=>{
 const fixture=readJSON(new URL('../universal/fixtures/dyls-index-js.json',import.meta.url));let registered,updates=0;
 const context=vm.createContext({navigator:{serviceWorker:{register:async(url,options)=>{registered={url,options};return{update:async()=>{updates++;}};}}}});
 vm.runInContext(runCleaner(code,fixture.url,fixture.body),context);await context.fixtureRegisterWorker('/sw.js?ver=3.0.0');
 assert.match(registered.url,/^\/sw\.js\?ver=3\.0\.0&for_adm=dyls-v2-[a-f0-9]{12}$/);assert.equal(registered.options.updateViaCache,'none');assert.equal(updates,1);
});
test('Dyls scores recover from old history and recent failures cool down without penalizing later success',()=>{
 let now=2e12;const context=vm.createContext({Date:{now:()=>now},g:(root,key)=>({...root[key]}),ee:(root,device,key)=>({...root.contextSourceStats[device][key]})});
 vm.runInContext(patch(sources.scoreFunctions,service),context);
 const record={successCount:20,failureCount:0,manualSelectCount:0,manualSwitchAwayCount:0,startupSamples:1,totalStartupMs:1000,bufferingPenaltyCount:0,bufferingSamples:0,totalBufferingMs:0,seekFailureCount:0,lastUsedAt:now,lastSuccessAt:now,lastFailureAt:0};
 const fresh=context.v(record);now+=28*864e5;const old=context.v(record);assert.ok(old>0&&old<fresh/2);
 const failed={...record,lastFailureAt:now,lastUsedAt:now};const store={globalSourceStats:{a:failed},contextSourceStats:{phone:{a:failed}}};assert.ok(context.ae('a',0,'phone',store)<-999999);
 now+=600001;assert.ok(context.ae('a',0,'phone',store)>-999999);
 store.globalSourceStats.a.lastFailureAt=now-1000;store.globalSourceStats.a.lastSuccessAt=now;assert.ok(context.ae('a',0,'phone',store)>-999999);
});
test('Dyls probes at most three alternatives, carries resume progress and rejects a different episode',async()=>{
 const attempts=[],failed=new Set();const context=vm.createContext({setTimeout,clearTimeout,AbortController,__forAdmManualPending:{current:false},h:{from_code:'current'},i:{current:failed},me:[{code:'current'},{code:'a'},{code:'b'},{code:'c'},{code:'d'}],c:{current:1},a:{current:120},N:40,_:2,Ae:()=>false,console:{error(){}},We:async(source,index,signal,resume)=>{attempts.push({source:source.code,index,resume});return null;}});
 vm.runInContext(template.jsHelpers.playback.source+';var '+patch(sources.probeExpression,player)+';',context);assert.equal(await context.Ze(1,{aborted:false}),null);assert.equal(attempts.length,3);assert.ok(attempts.every(x=>x.resume===120));
 attempts.length=0;failed.clear();context.We=async(source,index,signal,resume)=>{attempts.push({source:source.code,index,resume});return{preferredEpisodeIndex:source.code==='a'?0:index,resumeTime:resume};};
 const candidate=await context.Ze(1,{aborted:false});assert.equal(candidate.preferredEpisodeIndex,2);assert.equal(candidate.resumeTime,120);assert.equal(attempts.length,2);
 attempts.length=0;assert.equal(await context.Ze(2,{aborted:false}),null);assert.equal(attempts.length,0);
});
test('Dyls counts successful automatic transitions and explicit reset restarts the budget',()=>{
 const budget={current:0};const context=vm.createContext({__forAdmAutoAttempts:budget,__forAdmManualPending:{current:false},He:()=>true,je:()=>1,Ce(){},I(){},u:{current:null},c:{current:1},J(){},Te(){},o:{current:false},K(){}});
 vm.runInContext('var '+patch(sources.autoCommitExpression,player)+';var '+patch(sources.resetExpression,player)+';',context);
 for(let i=0;i<3;i++)assert.equal(context.$e({sourceCode:'a'}),'switched');assert.equal(budget.current,3);
 context.He=()=>false;assert.equal(context.$e({sourceCode:'a'}),'cancelled');assert.equal(budget.current,3);
 context.De();assert.equal(budget.current,0);assert.equal(context.c.current,2);
});
test('Dyls resumed seeks stay below duration rather than triggering immediate episode completion',()=>{
 const context=vm.createContext({E:{currentTime:0},a:{current:false},r:180,e:100,zt:(time,duration)=>duration>0?Math.min(Math.max(0,time),duration):Math.max(0,time)});
 vm.runInContext(patch(sources.resumeAssignment,player),context);assert.equal(context.E.currentTime,98);assert.equal(context.a.current,true);
 context.e=100;context.r=50;vm.runInContext(patch(sources.resumeAssignment,player),context);assert.equal(context.E.currentTime,50);
});
test('Dyls page wrapper deletion and carousel filtering are source-guarded on adapted families',()=>{
 for(const name of ['home','explorer','results','search','player-ads','service','player-features','sw']){
  const f=readJSON(new URL('../universal/fixtures/dyls-enhanced-'+name+'.json',import.meta.url));const out=runCleaner(code,f.url,f.body);assert.notEqual(out,f.body);assert.equal(runCleaner(code,f.url,out),out);
  for(const url of [f.url.replace('dyls1.','dyls2.'),f.url.replace(/\/(?:assets\/)?[^/]+$/,'/assets/unrelated.js')])assert.equal(runCleaner(code,url,f.body),f.body);
 }
});
