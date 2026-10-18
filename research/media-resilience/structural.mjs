// Offline experiment only. Never loaded by the QX build or runtime.
import {tokenizer} from 'acorn';

function key(token) {
  const value = token.type.label === 'regexp'
    ? [token.value.pattern, token.value.flags] : token.value;
  return token.type.label + ':' + JSON.stringify(value);
}

export function tokenize(source) {
  const tokens = [];
  for (const token of tokenizer(source, {ecmaVersion: 'latest', allowHashBang: true})) {
    tokens.push({key: key(token), name: token.type.label === 'name' ? token.value : null,
      start: token.start, end: token.end, raw: source.slice(token.start, token.end)});
  }
  return tokens;
}

export function compile(old, replacement) {
  const tokens = tokenize(old), output = tokenize(replacement);
  const pattern = tokens.map(t => /^_0x[0-9a-f]+$/.test(t.name || '') ? {variable: t.name} : {key: t.key});
  const variables = new Set(pattern.flatMap(t => t.variable ? [t.variable] : []));
  if (output.some(t => /^_0x[0-9a-f]+$/.test(t.name || '') && !variables.has(t.name))) {
    throw Error('Replacement introduces an unbound obfuscated identifier');
  }
  return {pattern, output, replacement};
}

export function indexTokens(tokens) {
  const index = new Map();
  tokens.forEach((t, i) => {
    if (!index.has(t.key)) index.set(t.key, []);
    index.get(t.key).push(i);
  });
  return index;
}

export function findMatches(source, tokens, index, rule) {
  const fixed = rule.pattern.flatMap((t, i) => t.key ? [{i, key: t.key}] : []);
  if (!fixed.length) throw Error('A structural rule must have literal tokens');
  const anchor = fixed.reduce((best, next) =>
    (index.get(next.key)?.length || 0) < (index.get(best.key)?.length || 0) ? next : best);
  const matches = [];
  for (const at of index.get(anchor.key) || []) {
    const start = at - anchor.i;
    if (start < 0 || start + rule.pattern.length > tokens.length) continue;
    const names = new Map(), inverse = new Map();
    let valid = true;
    for (let offset = 0; offset < rule.pattern.length; offset++) {
      const expected = rule.pattern[offset], actual = tokens[start + offset];
      if (expected.key) {
        if (expected.key !== actual.key) { valid = false; break; }
      } else {
        if (!actual.name || (names.has(expected.variable) && names.get(expected.variable).name !== actual.name)
          || (inverse.has(actual.name) && inverse.get(actual.name) !== expected.variable)) {
          valid = false; break;
        }
        names.set(expected.variable, {name: actual.name, raw: actual.raw});
        inverse.set(actual.name, expected.variable);
      }
    }
    if (!valid) continue;
    let cursor = 0, replacement = '';
    for (const token of rule.output) {
      replacement += rule.replacement.slice(cursor, token.start);
      replacement += names.get(token.name)?.raw ?? rule.replacement.slice(token.start, token.end);
      cursor = token.end;
    }
    replacement += rule.replacement.slice(cursor);
    const begin = tokens[start].start, end = tokens[start + rule.pattern.length - 1].end;
    matches.push({start: begin, end, before: source.slice(begin, end), replacement});
  }
  return matches;
}

export function applyEdits(source, edits) {
  // A conflicting or nested candidate needs human review; never pick one arbitrarily.
  const unique = new Map();
  for (const edit of edits) {
    const key = edit.start + ':' + edit.end;
    if (unique.has(key) && unique.get(key).replacement !== edit.replacement) throw Error('Conflicting replacements');
    unique.set(key, edit);
  }
  const ordered = [...unique.values()].sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].start < ordered[i - 1].end) throw Error('Overlapping replacements');
  }
  let output = source;
  for (const edit of ordered.reverse()) output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  return output;
}
