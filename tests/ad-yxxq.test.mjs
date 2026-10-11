import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
const manifest=readJSON(new URL('../universal/templates.json',import.meta.url));
const hosts=manifest.templates.find(t=>t.id==='yxxq').bindings[0].domains.names;
const fixture=readJSON(new URL('../universal/fixtures/yxxq.json',import.meta.url));
const url='https://www.yxxq65.cc/static/js/site-ads.js?v=20260919a';
const source='(function(){ window.__MAC_SITE_ADS_READY__=true; function initFloat(){} function initNavAds(){} function initAdModal(){} })();';
test('YXXQ dedicated JS requires every advertising fingerprint and a verified host/path',()=>{
 assert.equal(runCleaner(code,url,source),'/* For-ADM: verified YXXQ advertising module disabled. */');
 for(const marker of ['__MAC_SITE_ADS_READY__','function initFloat()','function initNavAds()','function initAdModal()'])assert.equal(runCleaner(code,url,source.replace(marker,'unknown')),source.replace(marker,'unknown'));
 for(const changed of [url.replace('65','99'),url.replace('site-ads','player'),url.replace('www.','')])assert.equal(runCleaner(code,changed,source),source);
 assert.equal(runCleaner(code,url,source,{statusCode:403}),source);
});
test('YXXQ HTML is guarded, covers all explicitly registered sites, and leaves discovery/player responses intact',()=>{
 for(const host of hosts){
  const target=fixture.url.replace('www.yxxq65.cc',host);
  assert(!runCleaner(code,target,fixture.body).includes('fixture-banner-ad'));
 }
 for(const marker of ['var maccms=','/mxtheme/js/home.js','/static/js/site-ads.js']){
  const changed=fixture.body.replace(marker,'unknown');
  assert.equal(runCleaner(code,fixture.url,changed),changed);
 }
 for(const path of ['/api.php/frontend/domainStatusDiscovery','/static/js/player.js','/static/js/playerconfig.js','/static/js/site-domain-status-ddys.js','/movie.m3u8'])assert.equal(runCleaner(code,'https://www.yxxq65.cc'+path,fixture.body),fixture.body);
});

test('YXXQ all 15 discovered backups have HTML/JS rules, MITM and absolute ad entry cleanup',()=>{
 const backups=['35','51','52','53','54','55','56','57','59','61','62','63','64','41','25'].map(n=>'www.yxxq'+n+'.cc');
 assert.equal(hosts.length,16);
 const conf=fs.readFileSync(new URL('../universal/quantumult-x-snippet.conf',import.meta.url),'utf8');
 const rules=conf.split('\n').filter(line=>line.includes(' url script-response-body ')).map(line=>new RegExp(line.split(' url ')[0]));
 const mitm=conf.split('\n').find(line=>line.startsWith('hostname = ')).slice(11).split(', ');
 for(const host of backups){
  assert(hosts.includes(host));assert(mitm.includes(host));
  for(const target of ['https://'+host+'/?utm_source=kly','https://'+host+'/static/js/site-ads.js?v=20260919a'])assert(rules.some(re=>re.test(target)));
  assert.equal(runCleaner(code,url.replace('www.yxxq65.cc',host),source),'/* For-ADM: verified YXXQ advertising module disabled. */');
  const body=fixture.body.replace('src="/static/js/site-ads.js?v=20260919a"','src="https://'+host+'/static/js/site-ads.js?v=20260919a"');
  const out=runCleaner(code,fixture.url.replace('www.yxxq65.cc',host),body);
  assert(!out.includes('fixture-banner-ad'));assert(!out.includes('src="https://'+host+'/static/js/site-ads.js'));
 }
});
