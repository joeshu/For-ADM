import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {canonical, mutate, parseSource} from './update-mutations.mjs';

test('formatting mutations preserve a small executable example including instanceof adjacency', () => {
  const source = "var _0xa={data:3},_0xb={n:_0xa['data'],isObject:_0xa['data']instanceof Number};_0xb;";
  const expected = JSON.stringify(vm.runInNewContext(source));
  for (const scenario of ['asset-location', 'identifier-renaming', 'whitespace-comments', 'literal-spelling',
    'dot-properties', 'declaration-splitting', 'combined-build']) {
    const changed = mutate(source, scenario, {});parseSource(changed);
    assert.equal(JSON.stringify(vm.runInNewContext(changed)), expected, scenario);
  }
});
test('differential comparison ignores declaration grouping and literal spelling but detects changed behavior', () => {
  assert.equal(canonical('var a=0x1,b="value";'), canonical("var a=1;var b='value';"));
  assert.equal(canonical("var a=store['ads'];"), canonical('var a=store.ads;'));
  assert.notEqual(canonical('var a=1;'), canonical('var a=2;'));
  assert.notEqual(canonical('var a=store.ads;'), canonical('var a=store.user;'));
  assert.notEqual(canonical('var a=store?.ads;'), canonical('var a=store.ads;'));
});
