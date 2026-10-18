import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {tokenize, compile, indexTokens, findMatches, applyEdits} from './structural.mjs';

function match(source, rule) {
  const tokens = tokenize(source);
  return findMatches(source, tokens, indexTokens(tokens), rule);
}
const original = "_0xabc=_0xdef=>{return _0xdef['appAdvertisements'].length>0x0;}";
const replacement = '_0xabc=_0xdef=>{return false;}';
const rule = compile(original, replacement);

test('names, spacing, comments, string escapes and numeric representation may change', () => {
  const source = 'const r0 = /*changed*/ p$ => {return p$["appAdvertise\\x6dents"].length > 0;};';
  const edits = match(source, rule);
  assert.equal(edits.length, 1);
  const out = applyEdits(source, edits);
  assert.equal(out, 'const r0=p$=>{return false;};');
  new vm.Script(out);
  assert.equal(match(out, rule).length, 0);
});

test('repeated identifiers keep the same name mapping; distinct identifiers cannot alias', () => {
  const repeated = compile("_0xa=_0xb=>_0xb['items']", '_0xa=_0xb=>[]');
  assert.equal(match("a=b=>c['items']", repeated).length, 0);
  assert.equal(match("a=a=>a['items']", repeated).length, 0);
  assert.equal(match("a=b=>b['items']", repeated).length, 1);
});

test('text inside strings, comments, templates and regex literals is never executable code', () => {
  for (const source of [JSON.stringify(original), '/* ' + original + ' */',
    '`' + original + '`', '/appAdvertisements/; // ' + original]) {
    assert.equal(match(source, rule).length, 0);
  }
});

test('changed business fields, operations and return expressions are not guessed', () => {
  for (const source of [original.replace('appAdvertisements', 'user'),
    original.replace('>0x0', '>=0x0'), original.replace('.length', '.remaining')]) {
    assert.equal(match(source, rule).length, 0);
  }
});

test('unknown cross-rule bindings are rejected instead of leaving stale variable names', () => {
  assert.throws(() => compile(original, '_0xabc=_0xdef=>_0x123.value=0'), /unbound/);
});

test('the same literal sequence can be found independently of entry filename or version', () => {
  const source = "const url='/static/v99999/js/app.ffffffff.js';" + original;
  assert.equal(match(source, rule).length, 1);
});

test('conflicting or nested edits are rejected; identical edits are deduplicated', () => {
  const edit = {start: 0, end: 3, replacement: 'b'};
  assert.equal(applyEdits('abc', [edit, edit]), 'b');
  assert.throws(() => applyEdits('abc', [edit, {...edit, replacement: 'c'}]), /Conflicting/);
  assert.throws(() => applyEdits('abc', [edit, {start: 1, end: 2, replacement: 'c'}]), /Overlapping/);
});
