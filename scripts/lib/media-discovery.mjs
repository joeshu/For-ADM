import {createRequire} from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const {parse} = require('../../vendor/acorn/acorn-8.15.0.js');

// Evaluate only literals, the loader's numeric argument, object lookups and +.
// Never execute the site's loader or accept arbitrary third-party asset URLs.
export function discoverMediaChunks(body) {
  if (body.length > 2097152) throw Error('Entry exceeds discovery size limit');
  const ast = parse(body, {ecmaVersion: 'latest'}), assets = new Set();
  function evaluate(node, parameter, id, depth = 0) {
    if (!node || depth > 40) throw Error('Unsupported loader expression');
    if (node.type === 'Literal' && ['string', 'number'].includes(typeof node.value)) return node.value;
    if (node.type === 'Identifier' && node.name === parameter) return id;
    if (node.type === 'BinaryExpression' && node.operator === '+') return evaluate(node.left, parameter, id, depth + 1) + evaluate(node.right, parameter, id, depth + 1);
    if (node.type === 'MemberExpression' && node.computed && node.object.type === 'ObjectExpression') {
      const key = evaluate(node.property, parameter, id, depth + 1);
      const property = node.object.properties.find(p => p.type === 'Property' && !p.computed && p.key.value === key);
      if (property) return evaluate(property.value, parameter, id, depth + 1);
    }
    throw Error('Unsupported loader expression');
  }
  function walk(node, visit) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
    if (node.type) visit(node);
    for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value, visit);
  }
  walk(ast, node => {
    if (node.type !== 'AssignmentExpression' || node.left.type !== 'MemberExpression'
      || (node.left.computed ? node.left.property.value : node.left.property.name) !== 'u'
      || node.right.type !== 'FunctionExpression' || node.right.params.length !== 1
      || node.right.params[0].type !== 'Identifier') return;
    const returned = node.right.body.body.find(n => n.type === 'ReturnStatement');
    if (!returned) return;
    const ids = new Set();
    walk(returned.argument, n => {
      if (n.type === 'ObjectExpression') for (const p of n.properties) {
        if (p.type === 'Property' && !p.computed && Number.isSafeInteger(p.key.value) && p.key.value >= 0) ids.add(p.key.value);
      }
    });
    if (ids.size > 512) throw Error('Chunk count exceeds discovery limit');
    for (const id of ids) {
      const asset = evaluate(returned.argument, node.right.params[0].name, id);
      if (!/^js\/[0-9]+(?:-legacy)?\.[a-f0-9]{8}\.js$/.test(asset)) throw Error('Unsupported chunk path');
      assets.add(asset);
    }
  });
  if (!assets.size) throw Error('Supported webpack loader absent');
  return [...assets].sort();
}

export function probeMediaSource(code, url, body) {
  let result, record;
  vm.runInNewContext(code, {$request: {url}, $response: {body}, console: {log() {}},
    $prefs: {valueForKey: k => k === 'ForADM.DebugUntil' ? String(Date.now() + 60000) : null,
      setValueForKey: (value, key) => {if (/^ForADM\.Debug\.[^.]+$/.test(key)) record = JSON.parse(value);}},
    $done: value => {result = value;}}, {timeout: 2500});
  if (!result || record?.status === 'runtime-error') throw Error('Cleaner probe failed');
  const output = result.body ?? body;
  if (output !== body) new vm.Script(output);
  return {status: output === body ? 'NO_MATCH' : 'MODIFIED',
    structuralStatus: record?.structuralStatus || 'not-applicable',
    structuralPairs: record?.structuralPairs || 0,
    semanticStatus: record?.semanticStatus || 'not-applicable',
    semanticUnits: record?.semanticUnits || 0,
    semanticDownloadGroups: record?.semanticDownloadGroups || 0,
    exactPairs: record?.pairs || 0};
}

export async function auditDiscoveredMedia({entry, entries, code, fetchText}) {
  const report = {status: 'COMPLETE', modules: [], unavailable: 0};
  const pending = new Map();
  for (const reference of entries) {
    try {
      const url = new URL(reference, entry);
      if (url.origin !== new URL(entry).origin || !/^\/static\/v[0-9]+\/js\/app(?:-legacy)?\.[a-f0-9]{8}\.js$/.test(url.pathname)) throw Error('Unregistered entry location');
      const body = await fetchText(url.href), base = new URL('../', url);
      pending.set(url.href, body);
      for (const relative of discoverMediaChunks(body)) pending.set(new URL(relative, base).href, null);
    } catch {
      report.unavailable++; report.status = 'PARTIAL';
    }
  }
  const work = [...pending], workers = 4; let cursor = 0;
  await Promise.all(Array.from({length: workers}, async () => {
    while (cursor < work.length) {
      const [url, cached] = work[cursor++], record = {path: new URL(url).pathname}; report.modules.push(record);
      try { Object.assign(record, probeMediaSource(code, url, cached ?? await fetchText(url))); }
      catch {record.status = 'UNAVAILABLE'; report.unavailable++; report.status = 'PARTIAL';}
    }
  }));
  if (!report.modules.length) report.status = 'PARTIAL';
  report.modules.sort((a, b) => a.path.localeCompare(b.path));
  return report;
}
