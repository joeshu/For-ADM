import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {runCleaner} from '../scripts/lib/ad-sites.mjs';
import {mutate, parseSource, walk} from '../research/media-resilience/update-mutations.mjs';
const acorn = createRequire(import.meta.url)('../vendor/acorn/acorn-8.15.0.js');
const root = new URL('../', import.meta.url), source = fs.readFileSync(new URL('universal/src/media-semantic.js', root), 'utf8');
const brands = {kkapp: '可可影视', ncat: '网飞猫', happ: '好好看'};
function analyze(body, site = 'kkapp', clock = Date) {
  const context = {admMediaAcorn: () => acorn, Date: clock};vm.createContext(context);vm.runInContext(source, context);
  const audit = {}, result = context.admMediaSemantic(body, audit, site);return {...result, audit};
}
function shell(body, site = 'kkapp') {
  return "self['webpackChunkmovie']=[];var info={appName:" + JSON.stringify(brands[site]) + "};var markers=['FLOATING_WINDOW','VOD_START'];" + body;
}
const getter = "var store={getAdvertiseById(id){if(!id||0==id.length)return;const ads=this.appAdvertisements;return ads&&ads.length>0?ads.find(item=>item.id==id):void 0;},user:{id:'preserved'}};";
const predicate = "var exists=id=>{const state=(0,shared.futureStore)();const ads=state.appAdvertisements;return!!(ads&&ads.length>0&&id&&id.length>0)&&ads.some(item=>item.id==id);};";
const protectedCode = "function loadResource(){return backend.fetchResource();}function login(){return auth.requireLogin();}var media='film.m3u8';";

test('dedicated ad lookups are cut while shared initialization and neighboring account/resource code remain', () => {
  for (const site of Object.keys(brands)) {
    const input = shell(getter + predicate + protectedCode, site), result = analyze(input, site);
    assert.equal(result.audit.semanticAdFunctions, 2);
    assert.ok(result.body.includes(protectedCode));assert.ok(result.body.includes("user:{id:'preserved'}"));
    let initializations = 0, reads = 0;
    const state = {get appAdvertisements() {reads++;throw Error('advertisement collection must not be read');}};
    const context = {self: {}, shared: {futureStore() {initializations++;return state;}}};
    vm.createContext(context);vm.runInContext(result.body, context);
    for (const id of [undefined, '', 'advertisement']) assert.equal(context.exists(id), false);
    assert.equal(initializations, 3);assert.equal(reads, 0);
    Object.defineProperty(context.store, 'appAdvertisements', {get() {throw Error('advertisement lookup must not execute');}});
    assert.equal(context.store.getAdvertiseById('advertisement'), undefined);
    context.shared.futureStore = () => {throw Error('shared initialization failed');};
    assert.throws(() => context.exists('advertisement'), /shared initialization failed/);
    assert.equal(analyze(result.body, site).body, result.body);
  }
});

test('unverified branches, business fields, effects and changed lookup contracts are preserved', () => {
  const changes = [
    predicate.replace('appAdvertisements', 'userPermissions'),
    predicate.replace('ads.some', 'ads.every'),
    predicate.replace('item.id==id', 'item.id==id&&auth.requireLogin()'),
    predicate.replace('item=>item.id==id', 'function id(item){return item.id==id;}'),
    predicate.replace('const ads=', 'auth.requireLogin();const ads='),
    predicate.replace('return!!', 'state.account.enabled=true;return!!'),
    predicate.replace('const state=(0,shared.futureStore)()', 'const state=(0,shared.futureStore)(id)'),
    predicate.replace('shared.futureStore', 'shared[key]'),
    predicate.replace('shared.futureStore', 'state.futureStore'),
    predicate.replace('const state=', 'const ads=').replace('const ads=state.', 'const state=ads.'),
    predicate.replace('state.appAdvertisements', 'state?.appAdvertisements'),
    predicate.replace('id=>', 'async id=>'),
  ];
  for (const changed of changes) {
    const input = shell(getter.replace('ads.find(item=>item.id==id)', 'ads.find(item=>auth.check(item.id,id))') + changed);
    new vm.Script(input);
    const result = analyze(input);assert.equal(result.audit.semanticAdFunctions, 0);assert.equal(result.body, input);
  }
  for (const changed of [getter.replace('appAdvertisements', 'userPermissions'),
    getter.replace('return ads&&', 'auth.requireLogin();return ads&&'),
    getter.replace('ads.find', 'ads.filter'), getter.replace('item.id==id', 'item.id==id&&backend.fetchResource()'),
    getter.replace('void 0', 'backend.fallback()'), getter.replace('getAdvertiseById(id)', '[dynamicKey](id)')]) {
    const input = shell(changed);assert.equal(analyze(input).body, input);
  }
});

test('brand, genuine webpack registration and finite budget remain required', () => {
  const input = shell(getter + predicate);
  assert.equal(analyze(input, 'ncat').body, input);
  assert.equal(analyze(input.replace('可可影视', '\\u53ef\\u53ef\\u5f71\\u89c6')).audit.semanticAdFunctions, 2);
  for (const changed of [input.replace('FLOATING_WINDOW', 'UNKNOWN_KIND'),
    input.replace("self['webpackChunkmovie']=[];", "/* self['webpackChunkmovie']=[]; */"),
    JSON.stringify(input), '/*' + input + '*/']) assert.equal(analyze(changed).body, changed);
  const result = analyze(input, 'kkapp', {now: (() => {let time = 0;return () => time += 700;})()});
  assert.equal(result.audit.semanticStatus, 'budget-limit');assert.equal(result.audit.semanticAdFunctions, 0);
  assert.equal(result.body, input);assert.equal(result.helpers.length, 0);
});

function property(node) {return node.computed || node.key?.type === 'Literal' || node.property?.type === 'Literal' ? (node.key || node.property).value : (node.key || node.property).name;}
function declarations(body) {const list = [];walk(parseSource(body), node => {if (node.type === 'VariableDeclarator' && ['ArrowFunctionExpression', 'FunctionExpression'].includes(node.init?.type)) list.push(node);});return list;}
function runFunction(body, node, context) {
  return vm.runInNewContext('(function(' + node.params.map(p => body.slice(p.start, p.end)).join(',') + ')' + body.slice(node.body.start, node.body.end) + ')', context);
}
const inventory = JSON.parse(fs.readFileSync(new URL('tests/media-reviewed-sources.json', root), 'utf8'));
for (const site of inventory.sites) for (const sample of site.modules.filter(m => /^app(?:-legacy)?\./.test(m.file))) {
  test(site.id + ' original ad predicate remains disabled after aliases/layout changes ' + sample.file, () => {
    const original = fs.readFileSync(new URL('research/media-resilience/sources/' + sample.archive, root), 'utf8');
    const code = fs.readFileSync(new URL(site.id + '/ad-clean.js', root), 'utf8');
    for (const scenario of ['framework-export-aliases', 'declaration-splitting', 'combined-build']) {
      const input = mutate(original, scenario, sample), predicates = declarations(input).filter(n => {
        const text = input.slice(n.init.body.start, n.init.body.end);
        return n.init.params.length === 1 && /appAdvertisements/.test(text) && /(?:\['some'\]|\.some\b)/.test(text);
      });
      assert.equal(predicates.length, 1);
      const before = predicates[0], out = runCleaner(code, sample.url, input);
      new vm.Script(out);assert.equal(runCleaner(code, sample.url, out), out);
      const after = declarations(out).find(n => n.id.name === before.id.name);assert.ok(after);
      const call = before.init.body.body[0].declarations[0].init;
      let callee = call.callee;if (callee.type === 'SequenceExpression') callee = callee.expressions.at(-1);
      assert.equal(callee.type, 'MemberExpression');assert.equal(callee.object.type, 'Identifier');
      let sharedCalls = 0, adReads = 0;
      const context = {[callee.object.name]: {[property(callee)]() {sharedCalls++;return {get appAdvertisements() {adReads++;throw Error('ad read');}};}}};
      const callback = runFunction(out, after.init, context);
      assert.equal(callback('advertisement'), false);
      assert.equal(sharedCalls, 1, 'unknown shared store initialization must be kept');assert.equal(adReads, 0);
      context[callee.object.name][property(callee)] = () => {throw Error('original initialization error');};
      assert.throws(() => callback('advertisement'), /original initialization error/);
      // Other real main-bundle actions remain byte-identical.
      const kept = [];walk(parseSource(input), n => {
        if (n.type === 'Property' && !n.computed && ['fetchInitFromSign', 'setNetdisks'].includes(property(n))) kept.push(input.slice(n.start, n.end));
      });assert.ok(kept.length >= 2);for (const block of kept) assert.ok(out.includes(block));
    }
    // Both real original pure lookup functions are independently recognized,
    // even when no historical exact/lexical replacement has run first.
    const standalone = analyze(original, site.id);assert.equal(standalone.audit.semanticAdFunctions, 2);
    const getters = [];walk(parseSource(standalone.body), n => {if (n.type === 'Property' && !n.computed && property(n) === 'getAdvertiseById') getters.push(n.value);});
    assert.equal(getters.length, 1);
    const getterFn = runFunction(standalone.body, getters[0], {});
    assert.equal(getterFn.call({get appAdvertisements() {throw Error('ad getter must be removed');}}, 'advertisement'), undefined);
  });
}
