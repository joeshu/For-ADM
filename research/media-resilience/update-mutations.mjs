import {createRequire} from 'node:module';
const {parse, tokenizer} = createRequire(import.meta.url)('../../vendor/acorn/acorn-8.15.0.js');
export const parseSource = source => parse(source, {ecmaVersion: 'latest'});
export function walk(node, visit, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {for (const item of node) walk(item, visit, parent);return;}
  if (node.type) visit(node, parent);
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value, visit, node);
}
function edits(source, changes) {
  changes.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < changes.length; i++) if (changes[i].start < changes[i - 1].end) throw Error('Mutation edits overlap');
  const parts = [];let cursor = 0;for (const edit of changes) {parts.push(source.slice(cursor, edit.start), edit.text);cursor = edit.end;}
  parts.push(source.slice(cursor));return parts.join('');
}
// Compare parsed output, including all helpers and protected code, independent
// of whitespace and literal spelling. This is a differential oracle, not proof
// of whole-site execution or correctness for arbitrary future programs.
export function canonical(source) {
  return JSON.stringify(parseSource(source), (key, value) => {
    if (['start', 'end', 'raw'].includes(key)) return undefined;
    if (value?.type === 'MemberExpression' && value.computed && value.property.type === 'Literal'
      && typeof value.property.value === 'string' && /^[A-Za-z_$][\w$]*$/.test(value.property.value))
      return {...value, computed: false, property: {type: 'Identifier', name: value.property.value}};
    if ((key === 'body' || key === 'consequent') && Array.isArray(value)) return value.flatMap(node => node.type === 'VariableDeclaration'
      ? node.declarations.map(declaration => ({type: 'VariableDeclaration', kind: node.kind, declarations: [declaration]})) : [node]);
    return value;
  });
}
export const scenarios = [
  {id: 'asset-location', compatible: true},
  {id: 'identifier-renaming', compatible: true},
  {id: 'whitespace-comments', compatible: true},
  {id: 'literal-spelling', compatible: true},
  {id: 'dot-properties', compatible: true},
  {id: 'framework-export-aliases', compatible: true},
  {id: 'declaration-splitting', compatible: true},
  {id: 'units-function-form', compatible: true, kind: 'startup'},
  {id: 'download-return-order', compatible: true, kind: 'download'},
  {id: 'combined-build', compatible: true},
  // These alter identification/contracts. A miss is an intentional boundary,
  // not permission to infer an API schema or widen the registered domains.
  {id: 'webpack-global', compatible: false},
  {id: 'units-endpoint', compatible: false, kind: 'startup'},
  {id: 'download-contract', compatible: false, kind: 'download'},
];
export function mutate(source, scenario, record) {
  const changes = [], ast = parseSource(source), name = scenario.id || scenario;
  if (name === 'asset-location') return source;
  if (name === 'combined-build') return ['identifier-renaming', 'literal-spelling', 'dot-properties', 'declaration-splitting']
    .reduce((body, id) => mutate(body, id, record), source);
  if (name === 'whitespace-comments') {
    let i = 0;for (const token of tokenizer(source, {ecmaVersion: 'latest'})) if (++i % 17 === 0) changes.push({start: token.end, end: token.end, text: ' /*update*/ '});
  } else walk(ast, (node, parent) => {
    if (name === 'identifier-renaming' && node.type === 'Identifier' && /^_0x[0-9a-f]+$/.test(node.name)) {
      if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
      if (parent?.type === 'Property' && parent.key === node && !parent.computed) return;
      if (parent?.type === 'Property' && parent.shorthand) throw Error('Unsupported shorthand rename');
      changes.push({start: node.start, end: node.end, text: 'future_' + node.name.slice(1)});
    }
    if (name === 'literal-spelling' && node.type === 'Literal' && ['string', 'number'].includes(typeof node.value)) {
      changes.push({start: node.start, end: node.end, text: JSON.stringify(node.value)});
    }
    if (name === 'dot-properties' && node.type === 'MemberExpression' && node.computed && node.property.type === 'Literal'
      && typeof node.property.value === 'string' && /^[A-Za-z_$][\w$]*$/.test(node.property.value)) {
      const start = node.object.end;
      // Numeric member access needs parentheses; never rewrite that case.
      if (node.object.type === 'Literal' && typeof node.object.value === 'number') return;
      if (source.slice(start, node.property.start).trim() !== '[' || source.slice(node.property.end, node.end).trim() !== ']') return;
      changes.push({start, end: node.end, text: '.' + node.property.value + ' '});
    }
    if (name === 'framework-export-aliases' && node.type === 'MemberExpression' && node.computed
      && node.property.type === 'Literal' && /^(KR|EW|wB|hi|P|c8|en|pI|so)$/.test(node.property.value)) {
      changes.push({start: node.property.start, end: node.property.end, text: JSON.stringify('futureExport_' + node.property.value)});
    }
    if (name === 'declaration-splitting' && node.type === 'VariableDeclaration' && node.declarations.length > 1
      && (parent?.type === 'BlockStatement' || parent?.type === 'Program')) {
      for (let i = 1; i < node.declarations.length; i++) changes.push({start: node.declarations[i - 1].end,
        end: node.declarations[i].start, text: ';' + node.kind + ' '});
    }
    if (name === 'units-function-form' && node.type === 'VariableDeclarator' && node.id.name === record.api) {
      const fn = node.init;if (!fn || !['ArrowFunctionExpression', 'FunctionExpression'].includes(fn.type) || fn.async || fn.generator) throw Error('Unknown units function');
      changes.push({start: fn.start, end: fn.body.start, text: fn.type === 'ArrowFunctionExpression'
        ? 'function(' + fn.params.map(p => source.slice(p.start, p.end)).join(',') + ')' : '(' + fn.params.map(p => source.slice(p.start, p.end)).join(',') + ')=>'});
    }
    if (name === 'download-return-order' && node.type === 'VariableDeclarator' && node.id.name === record.factory) {
      const ret = node.init.body.body.find(n => n.type === 'ReturnStatement');
      let object = ret.argument;if (object.type === 'SequenceExpression') object = object.expressions.at(-1);
      if (object.type !== 'ObjectExpression' || object.properties.some(p => p.type !== 'Property' || p.computed || p.method || p.kind !== 'init' || p.value.type !== 'Identifier')) throw Error('Unknown download return');
      changes.push({start: object.start, end: object.end, text: '{' + object.properties.map(p => source.slice(p.start, p.end)).reverse().join(',') + '}'});
    }
    if (name === 'webpack-global' && node.type === 'MemberExpression' && node.computed && node.property.value === 'webpackChunkmovie')
      changes.push({start: node.property.start, end: node.property.end, text: "'webpackChunkfuture'"});
    if (name === 'units-endpoint' && node.type === 'Literal' && node.value === '/v2/config/units.capi')
      changes.push({start: node.start, end: node.end, text: "'/v3/config/units.capi'"});
    if (name === 'download-contract' && node.type === 'Property' && !node.computed && (node.key.value || node.key.name) === 'countdown')
      changes.push({start: node.key.start, end: node.key.end, text: "'remainingSeconds'"});
  });
  return edits(source, changes);
}
