import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {canonical, mutate, scenarios} from './update-mutations.mjs';
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
        semanticUnits: actual.diagnostic.semanticUnits || 0, semanticDownloadGroups: actual.diagnostic.semanticDownloadGroups || 0,
        baselinePairs: baseline.diagnostic.structuralPairs || 0});
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
