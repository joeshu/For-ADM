import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const root = new URL('../../', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map(s => {const [k, ...v] = s.replace(/^--/, '').split('=');return [k, v.join('=')];}));
if (!args.out) throw Error('Use --out=report.json');
const archive = new URL('research/media-resilience/sources/', root);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', archive), 'utf8'));
const scripts = new Map(['kkapp', 'ncat', 'happ'].map(id => [id,
  new vm.Script(fs.readFileSync(new URL(id + '/ad-clean.js', root), 'utf8'))]));
const report = {checkedAt: new Date().toISOString(), files: 0, semanticUnits: 0, semanticDownloadGroups: 0,
  idempotent: 0, syntaxChecked: 0, protectedLiteralsChecked: 0, failures: [], timings: []};
function clean(id, url, body) {
  let result, record;const start = performance.now();
  scripts.get(id).runInNewContext({$request: {url}, $response: {body}, console: {log() {}},
    $prefs: {valueForKey: key => key === 'ForADM.DebugUntil' ? String(Date.now() + 60000) : null,
      setValueForKey: (value, key) => {if (key === 'ForADM.Debug.' + id) record = JSON.parse(value);}},
    $done: value => {result = value;}}, {timeout: 3000});
  report.timings.push(performance.now() - start);
  if (!result || !record || record.status === 'runtime-error') throw Error('Cleaner did not complete');
  if (['rejected', 'budget-limit', 'size-limit'].includes(record.semanticStatus)) throw Error('Semantic analysis incomplete');
  return {body: result.body ?? body, record};
}
for (const entry of manifest.files) {
  const source = fs.readFileSync(new URL(entry.path, archive));
  if (crypto.createHash('sha256').update(source).digest('hex') !== entry.sha256) throw Error('Original archive changed');
  const body = source.toString('utf8');
  try {
    const out = clean(entry.site, entry.sourceUrl, body);
    new vm.Script(out.body);report.syntaxChecked++;
    if (clean(entry.site, entry.sourceUrl, out.body).body !== out.body) throw Error('Not idempotent');
    report.idempotent++;
    for (const match of body.matchAll(/(['"])([^'"\n]*(?:\/app\/announcements|\/user\/|\/login|m3u8|\.mpd|setNetdisks)[^'"\n]*)\1/g)) {
      if (body.split(match[0]).length > out.body.split(match[0]).length) throw Error('Protected literal removed');
      report.protectedLiteralsChecked++;
    }
    report.semanticUnits += out.record.semanticUnits || 0;
    report.semanticDownloadGroups += out.record.semanticDownloadGroups || 0;
    report.files++;
  } catch (error) {report.failures.push({path: entry.path, error: error.message});}
}
report.timings.sort((a, b) => a - b);
report.timingMs = {median: +report.timings[Math.floor(report.timings.length / 2)].toFixed(2), max: +report.timings.at(-1).toFixed(2)};
delete report.timings;
fs.writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;
