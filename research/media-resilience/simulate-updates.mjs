import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {canonical, mutate, scenarios, parseSource, walk} from './update-mutations.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(s => {const [k, ...v] = s.replace(/^--/, '').split('=');return [k, v.join('=')];}));
if (!args.out || Object.keys(args).some(k => !['out', 'runtime-dir'].includes(k))) throw Error('Use --out=FILE [--runtime-dir=DIR]');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'tests/media-reviewed-sources.json')));
const records = JSON.parse(fs.readFileSync(path.join(root, 'tests/media-countdown-sources.json')));
for (const site of inventory.sites) {
  for (const sample of site.modules.filter(m => /^app(?:-legacy)?\./.test(m.file))) records.push({...sample, site: site.id, kind: 'app'});
  for (const legacy of [false, true]) {
    const sample = site.modules.filter(m => !/^app/.test(m.file) && m.file.includes('-legacy') === legacy
      && !records.some(r => r.site === site.id && r.archive === m.archive))
      .sort((a, b) => b.expected.structuralPairs - a.expected.structuralPairs || a.file.localeCompare(b.file))[0];
    if (!sample || !sample.expected.structuralPairs) throw Error('Missing representative view module');
    records.push({...sample, site: site.id, kind: 'view'});
  }
}
const runtimes = new Map(inventory.sites.map(s => [s.id, new vm.Script(fs.readFileSync(path.join(args['runtime-dir'] || root, s.id, 'ad-clean.js'), 'utf8'))]));
const report = {schemaVersion: 1, checkedAt: new Date().toISOString(), sampleFiles: records.length,
  methodology: 'Mutate original and reviewed cleaned source identically; compare complete parsed output, syntax, idempotence and diagnostics. Does not execute site business code.',
  runtimes: Object.fromEntries(inventory.sites.map(s => [s.id, crypto.createHash('sha256').update(fs.readFileSync(path.join(args['runtime-dir'] || root, s.id, 'ad-clean.js'))).digest('hex')])),
  scenarios: [], cases: [], failures: []};
function run(site, url, body) {
  let result, diagnostic;const start = performance.now();
  runtimes.get(site).runInNewContext({$request: {url}, $response: {body}, console: {log() {}},
    $prefs: {valueForKey: key => key === 'ForADM.DebugUntil' ? String(Date.now() + 60000) : null,
      setValueForKey: (value, key) => {if (key === 'ForADM.Debug.' + site) diagnostic = JSON.parse(value);}},
    $done: value => {result = value;}}, {timeout: 3000});
  if (!result || !diagnostic || diagnostic.status === 'runtime-error') throw Error('Cleaner did not finish');
  if (['rejected', 'budget-limit', 'size-limit'].includes(diagnostic.structuralStatus) || ['rejected', 'budget-limit', 'size-limit'].includes(diagnostic.semanticStatus)) throw Error('Incomplete analysis');
  const out = result.body ?? body;new vm.Script(out);
  return {body: out, diagnostic, timeMs: +(performance.now() - start).toFixed(2)};
}
function adPredicateContract(input, output) {
  function functions(body) {
    const out=[];walk(parseSource(body), node => {
      if(node.type==='VariableDeclarator'&&['FunctionExpression','ArrowFunctionExpression'].includes(node.init?.type))out.push(node);
    });return out;
  }
  const before=functions(input).filter(node=>{
    if(node.init.params.length!==1||node.init.body.type!=='BlockStatement')return false;
    const fields=new Set();walk(node.init.body,n=>{
      if(n.type==='MemberExpression')fields.add(n.computed?n.property.value:n.property.name);
    });return fields.has('appAdvertisements')&&fields.has('some');
  });
  if(before.length!==1)throw Error('Reviewed ad predicate not found uniquely');
  const after=functions(output).find(node=>node.id.name===before[0].id.name);
  const statements=after?.init.body.body;
  const disabled=!!statements&&[1,2].includes(statements.length)&&statements.at(-1).type==='ReturnStatement'&&
    statements.at(-1).argument?.type==='Literal'&&statements.at(-1).argument.value===false&&
    (statements.length===1||statements[0].type==='ExpressionStatement');
  const call=before[0].init.body.body[0].declarations[0].init;
  const preserved=disabled&&statements.length===2&&canonical(input.slice(call.start,call.end)+';')===
    canonical(output.slice(statements[0].expression.start,statements[0].expression.end)+';');
  return {disabled,sharedInitializationPreserved:preserved};
}
const baselines = records.map(record => {
  const source = fs.readFileSync(path.join(root, 'research/media-resilience/sources', record.archive), 'utf8');
  if (crypto.createHash('sha256').update(source).digest('hex') !== record.sha256) throw Error('Archive hash differs');
  const baseline = run(record.site, record.url, source);if (baseline.body === source) throw Error('Baseline has no verified edit');
  return {record, source, baseline};
});
for (const scenario of scenarios) {
  const summary = {id: scenario.id, compatible: scenario.compatible, cases: 0, equivalent: 0, misses: 0, declined: 0};
  for (const {record, source, baseline} of baselines) {
    if (scenario.kind && scenario.kind !== record.kind) continue;
    const result = {scenario: scenario.id, site: record.site, archive: record.archive};summary.cases++;
    try {
      const input = mutate(source, scenario, record), expected = mutate(baseline.body, scenario, record);
      const url = scenario.id === 'asset-location' || scenario.id === 'combined-build'
        ? record.url.replace(/v\d+\/js\/[^/]+$/, 'v99999/js/' + (record.kind === 'app' ? (record.archive.includes('legacy') ? 'app-legacy' : 'app') : '7777') + '.ffffffff.js') : record.url;
      const actual = run(record.site, url, input);
      result.equivalent = canonical(actual.body) === canonical(expected);
      result.idempotent = run(record.site, url, actual.body).body === actual.body;
      if (!result.idempotent) throw Error('Second pass changes output');
      Object.assign(result, {timeMs: actual.timeMs, structuralPairs: actual.diagnostic.structuralPairs || 0,
        semanticAdFunctions: actual.diagnostic.semanticAdFunctions || 0,
        semanticUnits: actual.diagnostic.semanticUnits || 0, semanticDownloadGroups: actual.diagnostic.semanticDownloadGroups || 0,
        baselinePairs: baseline.diagnostic.structuralPairs || 0});
      if(record.kind==='app')result.adPredicateContract=adPredicateContract(input,actual.body);
      if (result.equivalent) summary.equivalent++;else summary.misses++;
      if (!scenario.compatible) {
        result.declined = scenario.id === 'webpack-global' ? !result.structuralPairs && !result.semanticUnits && !result.semanticDownloadGroups
          : scenario.id === 'units-endpoint' ? !result.semanticUnits : !result.semanticDownloadGroups;
        if (result.declined) summary.declined++;else throw Error('Changed identification/contract was not declined');
      }
    } catch (error) {result.error = error.message;report.failures.push({scenario: scenario.id, site: record.site, archive: record.archive, error: error.message});}
    report.cases.push(result);
  }
  report.scenarios.push(summary);console.log(JSON.stringify(summary));
}
fs.writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n');
if (report.failures.length) {console.error(report.failures);process.exitCode = 1;}
