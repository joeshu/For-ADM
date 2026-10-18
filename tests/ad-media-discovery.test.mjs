import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {discoverMediaChunks, auditDiscoveredMedia} from '../scripts/lib/media-discovery.mjs';

const loader = "runtime['u']=function(id){return 'js/'+id+'.'+{0x1:'12345678',2:'abcdef01'}[id]+'.js';};";
test('static discovery reads current loader filenames without executing code', () => {
  assert.deepEqual(discoverMediaChunks('throw Error("must not run");' + loader), ['js/1.12345678.js', 'js/2.abcdef01.js']);
  assert.deepEqual(discoverMediaChunks(loader.replace("+'.'+", "+'-legacy.'+")), ['js/1-legacy.12345678.js', 'js/2-legacy.abcdef01.js']);
});
test('dynamic expressions and third-party asset paths cannot be evaluated', () => {
  for (const source of [loader.replace("'js/'", "'https://other.example/'"),
    "runtime.u=function(id){return fetch('https://other.example/'+id)};", 'var innocent="u";']) {
    assert.throws(() => discoverMediaChunks(source));
  }
});
test('new entry discovery probes new module URLs rather than the registered old directory', async () => {
  const code = fs.readFileSync(new URL('../kkapp/ad-clean.js', import.meta.url), 'utf8');
  const seen = [];
  const body = "self['webpackChunkmovie']=[];var hints=['FSImage','click_advert_','banner'];var ads=store['appAdvertisements'];";
  const report = await auditDiscoveredMedia({entry: 'https://a.kkapp06.com/',
    entries: ['static/v99999/js/app.ffffffff.js'], code,
    fetchText: async url => {seen.push(url);return url.endsWith('app.ffffffff.js') ? loader : body;}});
  assert.equal(report.status, 'COMPLETE');
  assert.equal(report.modules.length, 3);
  assert.ok(seen.every(url => url.includes('/static/v99999/')));
  assert.ok(report.modules.filter(m => m.path.includes('/1.') || m.path.includes('/2.')).every(m => m.structuralPairs === 1));
});
test('discovery preserves unavailable/unknown outcomes and rejects external entry origins', async () => {
  let fetched = false;
  const report = await auditDiscoveredMedia({entry: 'https://a.kkapp06.com/',
    entries: ['https://other.example/static/v99999/js/app.ffffffff.js'], code: '',
    fetchText: async () => {fetched = true;throw Error('must not fetch');}});
  assert.equal(fetched, false);
  assert.equal(report.status, 'PARTIAL');
  assert.equal(report.unavailable, 1);
});
