import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readJSON, runCleaner} from '../scripts/lib/ad-sites.mjs';
import {auditReviewedModule} from '../scripts/audit-media-sites.mjs';
import {mutate} from '../research/media-resilience/update-mutations.mjs';
const require = createRequire(import.meta.url), acorn = require('../vendor/acorn/acorn-8.15.0.js');
const root = new URL('../', import.meta.url), records = readJSON(new URL('./media-countdown-sources.json', import.meta.url));
const scripts = Object.fromEntries(['kkapp', 'ncat', 'happ'].map(id => [id, fs.readFileSync(new URL(id + '/ad-clean.js', root), 'utf8')]));
const helper = readJSON(new URL('universal/profiles/shared-media.json', root)).jsHelpers.download.source;
function walk(node, visit, ancestors = []) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {for (const item of node) walk(item, visit, ancestors);return;}
  if (node.type) visit(node, ancestors);
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value, visit, [...ancestors, node]);
}
function declaration(source, name) {
  const found = [];walk(acorn.parse(source, {ecmaVersion: 'latest'}), n => {
    if (n.type === 'VariableDeclarator' && n.id.name === name) found.push(n.init);
  });assert.equal(found.length, 1);return found[0];
}
function original(record) {return fs.readFileSync(new URL('research/media-resilience/sources/' + record.archive, root), 'utf8');}

async function verifyDownload(record, source, out) {
  const fn = declaration(out, record.factory), returns = fn.body.body.filter(n => n.type === 'ReturnStatement');
  let object = returns[0].argument;if (object.type === 'SequenceExpression') object = object.expressions.at(-1);
  const instrumented = out.slice(fn.start, object.end - 1)
    + ',__testInit:' + record.initializer + ',__testDispatch:' + record.dispatcher + out.slice(object.end - 1, fn.end);
  const data = {units: {type: 'splash,video,dhz', countdown: 10, splash: [{url: 'promo'}], video: [{url: 'promo'}], dhz: [{url: 'promo'}]},
    magnets: [{id: 'real-magnet', items: [{fileName: 'film', fileSize: 10}]}], netdisk: [{url: 'https://drive.example/file'}], account: {id: 'preserve'}};
  const snapshot = JSON.stringify(data), watchers = [], store = {setNetdisks(value) {this.netdisks = value;}};
  let intervals = 0, dom = 0, rejectFetch = false;const errors = [];
  const namespace = new Proxy({}, {get(_target, key) {
    const values = {
      P: () => store, KR: value => ({value}), EW: callback => ({get value() {return callback();}}),
      wB: (ref, callback, options) => {watchers.push({ref, callback});if (options?.immediate) callback(ref(), undefined);},
      hi() {}, c8: () => rejectFetch ? Promise.reject(Error('login required')) : Promise.resolve({data}), D0: () => ({close() {}}),
      A: (...args) => args.length ? () => {throw Error('legacy ad coroutine must not run');}
        : {m: fn => fn, w() {throw Error('legacy ad coroutine must not run');}},
      xr(message) {errors.push(message);}, Rp() {},
    };
    if (!(key in values)) throw Error('Unexpected dependency: ' + String(key));
    return values[key];
  }});
  const context = {console: {log() {}, error() {}}, history: {back() {}},
    window: {setInterval() {intervals++;return 1;}}, clearInterval() {},
    document: {getElementById() {dom++;throw Error('ad DOM must not render');}},
    localStorage: {getItem: () => '{"status":"pending","timestamp":0}', setItem() {}}};
  walk(acorn.parse('(' + instrumented + ')', {ecmaVersion: 'latest'}), n => {
    if (n.type === 'Identifier' && /^_0x/.test(n.name)) context[n.name] = namespace;
  });
  vm.createContext(context);vm.runInContext(helper, context);
  const factory = vm.runInContext('(' + instrumented + ')', context), model = factory({id: 'real-resource'});
  assert.equal(model.countdown.value, 0);
  assert.equal(model.isAdVisible.value, false);
  await Promise.resolve();await Promise.resolve();
  assert.equal(model.data.value.magnets, data.magnets);
  assert.equal(model.data.value.netdisk, data.netdisk);
  assert.equal(store.netdisks, data.netdisk);
  assert.equal(model.data.value.account, data.account);
  assert.equal(model.data.value.units.countdown, 0);
  for (const type of ['splash', 'video', 'dhz']) assert.equal(model.data.value.units[type].length, 0);
  for (const watcher of watchers.filter(w => w.ref === model.data)) watcher.callback(model.data.value, null);
  model.isAdVisible.value = true;model.countdown.value = 9;
  model.__testInit(data);
  assert.equal(model.isAdVisible.value, false);assert.equal(model.countdown.value, 0);
  model.isAdVisible.value = true;model.countdown.value = 9;
  model.__testDispatch({}, data.units);
  assert.equal(model.isAdVisible.value, false);assert.equal(model.countdown.value, 0);
  model.onClickRight();
  assert.equal(intervals, 0);assert.equal(dom, 0);assert.equal(JSON.stringify(data), snapshot);
  assert.deepEqual(errors, []);
  rejectFetch = true;
  const denied = factory({id: 'needs-login'});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(denied.data.value, undefined, 'failed authentication must not produce resources');
  assert.deepEqual(errors, ['login required']);
}

for (const record of records) {
  test(record.site + ' ' + record.kind + ' actual ' + record.archive.split('/').at(-1), async () => {
    const source = original(record), out = runCleaner(scripts[record.site], record.url, source);
    new vm.Script(out);
    assert.equal(runCleaner(scripts[record.site], record.url, out), out);
    if (record.kind === 'startup') {
      const api = declaration(out, record.api);
      const request = vm.runInNewContext('(' + out.slice(api.start, api.end) + ')');
      const response = await request({package: 'sample'});
      assert.deepEqual(JSON.parse(JSON.stringify(response)), {data: []});
      const consumer = source.slice(record.consumer.start, record.consumer.end);
      assert.ok(out.includes(consumer), 'startup consumer/readiness logic should be preserved');
      const context = {console: {log() {}}, setInterval() {throw Error('ad clock must not start');}};
      walk(acorn.parse('(' + consumer + ')', {ecmaVersion: 'latest'}), n => {
        if (n.type === 'Identifier' && /^_0x/.test(n.name)) context[n.name] = {value: undefined, appAdvertisements: [{id: 'cached-ad'}]};
      });
      const callback = vm.runInNewContext('(' + consumer + ')', context);
      callback(response);
      const assignment = Object.values(context).find(v => v && Array.isArray(v.appAdvertisements) && v.appAdvertisements.length === 0);
      assert.ok(assignment, 'cached store ad list should become empty');
      // Dedicated announcement requests are not modified or blocked.
      walk(acorn.parse(source, {ecmaVersion: 'latest'}), (n, parents) => {
        if (n.type === 'Literal' && typeof n.value === 'string' && n.value.startsWith('/app/announcements')) {
          const fn = [...parents].reverse().find(p => /FunctionExpression$/.test(p.type));
          assert.ok(out.includes(source.slice(fn.start, fn.end)));
        }
      });
      return;
    }
    await verifyDownload(record, source, out);
  });
}

for (const record of records.filter(r => r.kind === 'download')) {
  test(record.site + ' download keeps behavior after comments and member syntax changes ' + record.archive.split('/').at(-1), async () => {
    const source = mutate(mutate(original(record), 'whitespace-comments', record), 'dot-properties', record);
    const out = runCleaner(scripts[record.site], record.url, source);
    assert.notEqual(out, source);
    new vm.Script(out);
    assert.equal(runCleaner(scripts[record.site], record.url, out), out);
    await verifyDownload(record, source, out);
  });
}

test('missing download return/cleanup/resource bindings reject the complete semantic group', () => {
  const record = records.find(r => r.site === 'kkapp' && r.kind === 'download' && !r.archive.includes('legacy'));
  const source = original(record), runtime = {admMediaAcorn: () => acorn};
  vm.createContext(runtime);vm.runInContext(fs.readFileSync(new URL('universal/src/media-semantic.js', root), 'utf8'), runtime);
  for (const changed of [source.replace("'countdown':", "'unknownCountdown':"),
    source.replaceAll('clearInterval', 'unverifiedCleanup'), source.replaceAll('setNetdisks', 'unverifiedDisks')]) {
    const audit = {}, result = runtime.admMediaSemantic(changed, audit);
    assert.equal(result.body, changed);assert.equal(result.helpers.length, 0);assert.equal(audit.semanticDownloadGroups, 0);
  }
});
test('a units-looking function with a mutated URL or missing request contract is preserved', () => {
  const runtime = {admMediaAcorn: () => acorn};vm.createContext(runtime);
  vm.runInContext(fs.readFileSync(new URL('universal/src/media-semantic.js', root), 'utf8'), runtime);
  for (const suffix of ["u='/account/init.capi';", '']) {
    const body = "self['webpackChunkmovie']=[];var api=()=>{let m='get',u='/v2/config/units.capi';" + suffix
      + "return http({url:u,method:m,headers:{},baseURL:store.getCacheUrl});};";
    const input = suffix ? body : body.replace('getCacheUrl', 'unverifiedBase');
    assert.equal(runtime.admMediaSemantic(input, {}).body, input);
  }
});
test('reviewed hashes alone cannot claim PASS when the cleaner leaves countdown ads untouched', () => {
  const sample = readJSON(new URL('tests/media-reviewed-sources.json', root)).sites.find(s => s.id === 'kkapp').modules.find(s => s.file.startsWith('1946.'));
  const body = fs.readFileSync(new URL('research/media-resilience/sources/' + sample.archive, root), 'utf8');
  const result = auditReviewedModule(body, sample, '$done({});', sample.url);
  assert.equal(result.hashMatches, true);assert.equal(result.status, 'CHANGED');
  assert.equal(auditReviewedModule(body + '\n', sample, 'throw Error("must not run")', sample.url).status, 'CHANGED');
});

test('factory comparison retains namespace, member and call-binding boundaries', () => {
  const record = records.find(r => r.site === 'kkapp' && r.kind === 'download' && !r.archive.includes('legacy'));
  const source = original(record), fn = declaration(source, record.factory);
  let returned = fn.body.body.find(n => n.type === 'ReturnStatement').argument;
  if (returned.type === 'SequenceExpression') returned = returned.expressions.at(-1);
  const count = returned.properties.find(p => (p.key.value || p.key.name) === 'countdown').value.name;
  const callee = declaration(source, count).callee, originalCallee = source.slice(callee.start, callee.end);
  const differentMember = originalCallee.replace("'KR'", "'differentFactory'");
  assert.notEqual(differentMember, originalCallee);
  const runtime = {admMediaAcorn: () => acorn};vm.createContext(runtime);
  vm.runInContext(fs.readFileSync(new URL('universal/src/media-semantic.js', root), 'utf8'), runtime);
  for (const replacement of [differentMember, originalCallee.replace(/_0x[0-9a-f]+/, 'differentNamespace'),
    originalCallee.replace(/^(?:0x0|0),/, '1,')]) {
    assert.notEqual(replacement, originalCallee);
    const changed = source.slice(0, callee.start) + replacement + source.slice(callee.end);
    new vm.Script(changed);
    const audit = {}, result = runtime.admMediaSemantic(changed, audit);
    assert.equal(audit.semanticDownloadGroups, 0);assert.equal(result.body, changed);assert.equal(result.helpers.length, 0);
  }
});
