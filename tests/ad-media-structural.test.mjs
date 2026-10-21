import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runCleaner, readJSON} from '../scripts/lib/ad-sites.mjs';
import {resolveStructuralTemplate} from '../scripts/lib/media-structural.mjs';
import {loadTemplateManifest} from '../scripts/lib/template-manifest.mjs';
import {resolveMediaTemplate} from '../scripts/lib/shared-media.mjs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url);
const profile = readJSON(new URL('universal/profiles/media-structural.json', root));
const boot = "self['webpackChunkmovie']=self['webpackChunkmovie']||[];";
const banner = "var hints=['FSImage','click_advert_','banner'];var visible=store['appAdvertisements'];";
const protectedCode = "var account={id:'keep'},media='https://media.example/film.m3u8?sign=keep';";

for (const [id, host] of [['kkapp', 'a.kkapp06.com'], ['ncat', 'a.napp03.com:51111'], ['happ', 'a.happ3.com:51111']]) {
  const code = fs.readFileSync(new URL(id + '/ad-clean.js', root), 'utf8');
  const url = 'https://' + host + '/static/v99999/js/app.ffffffff.js';
  test(id + ' future renamed app cleans cached banners and preserves account/media', () => {
    const body = boot + banner + protectedCode, out = runCleaner(code, url, body);
    assert.ok(out.includes('visible=[]'));
    assert.ok(out.includes(protectedCode));
    assert.equal(runCleaner(code, url, out), out);
    assert.equal(runCleaner(code, url.replace(host, 'unregistered.example'), body), body);
    for (const statusCode of [403, 502]) assert.equal(runCleaner(code, url, body, {statusCode}), body);
  });
  test(id + ' future card cleanup injects its helper and retains genuine film entries', () => {
    const body = boot + "var hints=['VodVerticalItem'];var out=(0,lib['pI'])(state['list'],render);" + protectedCode;
    const out = runCleaner(code, url, body);
    assert.ok(out.includes('function __forAdmKKCleanV2('));
    const film = {title: 'film', url: 'vod/detail?id=1'};
    const context = vm.createContext({self: {}, state: {list: [{type: 'ad'}, film]},
      lib: {pI: (items, render) => items.map(render)}, render: item => item, URL, URLSearchParams});
    vm.runInContext(out, context);
    assert.deepEqual(Array.from(context.out), [film]);
    assert.equal(context.account.id, 'keep');
  });
  test(id + ' future getter returns no cached ad without modifying account state', () => {
    const pair = profile.rules.find(r => r.before.startsWith("'getAdvertiseById'("));
    const getter = pair.before.replace(/_0x([0-9a-f]+)/g, (_, n) => 'future' + n);
    const body = boot + 'var appInfo=' + JSON.stringify({appName: profile.brands[id], FLOATING_WINDOW: 1, VOD_START: 1})
      + ';var store={' + getter + '};' + protectedCode;
    const out = runCleaner(code, url, body), context = vm.createContext({self: {}});
    assert.notEqual(out, body);
    vm.runInContext(out, context);
    context.store.appAdvertisements = [{id: 'ad'}];
    assert.equal(context.store.getAdvertiseById('ad'), undefined);
    assert.equal(context.account.id, 'keep');
  });
  test(id + ' future HTML refreshes only app entries using the site revision', () => {
    const html = '<title>' + profile.brands[id] + '</title><script src="static/v99999/js/app.ffffffff.js"></script>'
      + '<script src="static/v99999/js/chunk-vendors.12345678.js"></script><div id="app"></div>';
    const out = runCleaner(code, 'https://' + host + '/', html);
    assert.ok(out.includes('app.ffffffff.js?for_adm='));
    assert.ok(out.includes('src="static/v99999/js/chunk-vendors.12345678.js"'));
    assert.equal(runCleaner(code, 'https://' + host + '/', out), out);
    const revision = out.match(/for_adm=([^"&]+)/)[1];
    const app = boot + 'var info=' + JSON.stringify({appName: profile.brands[id]})
      + ";var error='ChunkLoadError';var runtime={};runtime['u']=function(chunk){return 'js/'+chunk+'.'+{1:'12345678'}[chunk]+'.js';};";
    const changed = runCleaner(code, url, app);
    assert.ok(changed.includes('for_adm=' + revision));
  });
}

const code = fs.readFileSync(new URL('kkapp/ad-clean.js', root), 'utf8');
const url = 'https://a.kkapp06.com/static/v99999/js/app.ffffffff.js';
test('structural fallback ignores fake code in comments/strings and changed business fields', () => {
  for (const body of ['/* ' + boot + banner + ' */', JSON.stringify(boot + banner),
    '/* ' + boot + ' */' + banner, boot + banner.replace("['appAdvertisements']", "['user']"),
    boot + banner + '/* unterminated']) assert.equal(runCleaner(code, url, body), body);
});
test('size limits preserve oversized unknown responses', () => {
  const body = boot + banner + '/*' + ' '.repeat(2097152) + '*/';
  assert.equal(runCleaner(code, url, body), body);
});
test('unverified units exports remain untouched by structural fallback', () => {
  const body = boot + "var hints=['/v2/config/units.capi','/app/announcements','getCacheUrl'];var api={'so':function(){return anotherFunction;}};";
  assert.equal(runCleaner(code, url, body), body);
});
test('a consumed time budget preserves the original and does not leak helpers', () => {
  const template = resolveStructuralTemplate(resolveMediaTemplate(loadTemplateManifest(fileURLToPath(root)).templates.find(t => t.id === 'kkapp')), fileURLToPath(root));
  const context = {admMediaAcorn: () => createRequire(import.meta.url)('../vendor/acorn/acorn-8.15.0.js'),
    Date: {now: (() => {let clock = 0;return () => clock += 500;})()}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('universal/src/media-structural.js', root), 'utf8'), context);
  const audit = {}, body = boot + banner;
  const result = context.admMediaStructural(body, template.structuralRules, audit);
  assert.equal(result.body, body);
  assert.equal(result.helpers.length, 0);
  assert.equal(audit.structuralStatus, 'budget-limit');
});

test('dot and bracket lookups clean identically without generalizing optional or dynamic access', () => {
  const dotted = "self.webpackChunkmovie=self.webpackChunkmovie||[];var hints=['FSImage','click_advert_','banner'];var visible=store.appAdvertisements;" + protectedCode;
  const output = runCleaner(code, url, dotted);
  assert.ok(output.includes('visible=[]'));
  assert.ok(output.includes(protectedCode));
  assert.equal(runCleaner(code, url, output), output);
  for (const changed of [dotted.replace('store.appAdvertisements', 'store?.appAdvertisements'),
    dotted.replace('store.appAdvertisements', 'store[field]'),
    dotted.replace('store.appAdvertisements', 'store.user'),
    dotted.replaceAll('self.webpackChunkmovie', 'self[someKey]')]) assert.equal(runCleaner(code, url, changed), changed);
  for (const body of [JSON.stringify(dotted), '/* ' + dotted + ' */',
    '/* self.webpackChunkmovie=[]; */' + banner]) assert.equal(runCleaner(code, url, body), body);
});
