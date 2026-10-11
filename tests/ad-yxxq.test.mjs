import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runCleaner,readJSON} from '../scripts/lib/ad-sites.mjs';
const code=fs.readFileSync(new URL('../universal/ad-clean.js',import.meta.url),'utf8');
const fixture=readJSON(new URL('../universal/fixtures/yxxq.json',import.meta.url));
const url='https://www.yxxq65.cc/static/js/site-ads.js?v=20260919a';
const source='(function(){ window.__MAC_SITE_ADS_READY__=true; function initFloat(){} function initNavAds(){} function initAdModal(){} })();';
test('YXXQ dedicated JS requires every advertising fingerprint and a verified host/path',()=>{
 assert.equal(runCleaner(code,url,source),'/* For-ADM: verified YXXQ advertising module disabled. */');
 for(const marker of ['__MAC_SITE_ADS_READY__','function initFloat()','function initNavAds()','function initAdModal()'])assert.equal(runCleaner(code,url,source.replace(marker,'unknown')),source.replace(marker,'unknown'));
 for(const changed of [url.replace('65','51'),url.replace('site-ads','player'),url.replace('www.','')])assert.equal(runCleaner(code,changed,source),source);
 assert.equal(runCleaner(code,url,source,{statusCode:403}),source);
});
test('YXXQ HTML is guarded, covers both verified sites, and leaves discovery/player responses intact',()=>{
 for(const host of ['www.yxxq65.cc','www.yxxq35.cc']){
  const target=fixture.url.replace('www.yxxq65.cc',host);
  assert(!runCleaner(code,target,fixture.body).includes('fixture-banner-ad'));
 }
 for(const marker of ['var maccms=','/mxtheme/js/home.js','/static/js/site-ads.js']){
  const changed=fixture.body.replace(marker,'unknown');
  assert.equal(runCleaner(code,fixture.url,changed),changed);
 }
 for(const path of ['/api.php/frontend/domainStatusDiscovery','/static/js/player.js','/static/js/playerconfig.js','/static/js/site-domain-status-ddys.js','/movie.m3u8'])assert.equal(runCleaner(code,'https://www.yxxq65.cc'+path,fixture.body),fixture.body);
});
