import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {loadTemplateManifest} from '../../scripts/lib/template-manifest.mjs';
import {tokenize, compile, indexTokens, findMatches, applyEdits} from './structural.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));
if (!args.before || !args.after || !args.out) throw Error('Use --before=DIR --after=DIR --out=FILE');
const manifest = loadTemplateManifest(root);
const currentInventory = read('tests/media-current-sources.json');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory()
    ? files(path.join(dir, entry.name)) : entry.name.endsWith('.js') ? [path.join(dir, entry.name)] : []);
}
function stableGuard(marker) {
  // These are build identities, not business semantics. Dropping them here is an
  // experiment, not permission to widen production rules.
  return !marker.includes("'appVersion':") && !/_0x[0-9a-f]+/.test(marker)
    && !/^0x[0-9a-f]+:function$/.test(marker);
}
function signature(rule) {
  const variables = new Map();
  return JSON.stringify(rule.pattern.map(t => {
    if (!t.variable) return t.key;
    if (!variables.has(t.variable)) variables.set(t.variable, variables.size);
    return ['identifier', variables.get(t.variable)];
  }));
}
const report = {checkedAt: new Date().toISOString(), mode: 'OFFLINE_EXPERIMENT_NOT_IN_QX', sites: []};
for (const id of ['kkapp', 'ncat', 'happ']) {
  const template = manifest.templates.find(t => t.id === id);
  const oldInfo = [...read('tests/' + id + '-sources.json'),
    ...read('tests/download-hardening-sources.json').filter(i => i.template === id),
    ...read('tests/media-layout-sources.json').filter(i => i.template === id)];
  const oldActions = [...new Set(oldInfo.map(i => i.action))].map(i => template.actions[i]);
  const blueprints = [], inspectionBlueprints = [], rejectedBlueprints = [];
  for (const action of oldActions) {
    for (const [old, replacement] of action.pairs) {
      try {
        blueprints.push({...compile(old, replacement), requires: action.requires.filter(stableGuard),
          helper: action.helper, original: old});
      } catch (e) {
        rejectedBlueprints.push({sample: old.slice(0, 100), reason: e.message});
        inspectionBlueprints.push({...compile(old, ''), requires: action.requires.filter(stableGuard)});
      }
    }
  }
  // Every blueprint comes exclusively from pre-update actions. No current pairs
  // are used for matching: the current inventory is an independent oracle below.
  const site = {id, beforeModules: 0, beforeGroupsVerified: 0, afterModules: 0,
    oldPairBlueprints: blueprints.length, rejectedBlueprints,
    structuralShapes: new Set(blueprints.map(signature)).size,
    expectedRanges: 0, coveredRanges: 0, detectableRanges: 0, extraCandidates: [], missingTargets: [],
    rawSyntaxFailures: [], rawConflicts: [], sameFilename: 0, sameFilenameDifferentBytes: 0,
    assets: [], tokenizationMs: [], matchingMs: []};
  report.sites.push(site);
  const beforeFiles = files(path.join(args.before, id));
  const afterFiles = files(path.join(args.after, id));
  site.beforeModules = beforeFiles.length;
  const beforeHashes = new Set(beforeFiles.map(p => sha(fs.readFileSync(p))));
  const oldByName = new Map(beforeFiles.map(p => [path.basename(p), fs.readFileSync(p, 'utf8')]));
  for (const info of oldInfo) {
    const action = template.actions[info.action], body = oldByName.get(info.file);
    if (!body || !action.requires.every(r => body.includes(r))
      || !action.pairs.every(([old, , count = 1]) => body.split(old).length - 1 === count)) {
      throw Error('Old source cannot substantiate old rule: ' + id + '/' + info.file);
    }
    site.beforeGroupsVerified++;
  }
  for (const file of afterFiles) {
    const source = fs.readFileSync(file, 'utf8'), name = path.basename(file);
    if (oldByName.has(name)) {
      site.sameFilename++;
      if (oldByName.get(name) !== source) site.sameFilenameDifferentBytes++;
    }
    const start = performance.now(), tokens = tokenize(source), index = indexTokens(tokens);
    site.tokenizationMs.push(performance.now() - start);
    const beganMatching = performance.now(), candidates = new Map(), inspection = new Set();
    for (const rule of blueprints) {
      if (!rule.requires.every(r => source.includes(r))) continue;
      for (const edit of findMatches(source, tokens, index, rule)) {
        const key = edit.start + ':' + edit.end;
        if (candidates.has(key) && candidates.get(key).replacement !== edit.replacement) {
          site.rawConflicts.push({file: name, kind: 'different replacements', start: edit.start});
        } else candidates.set(key, edit);
      }
    }
    for (const rule of inspectionBlueprints) {
      if (!rule.requires.every(r => source.includes(r))) continue;
      for (const edit of findMatches(source, tokens, index, rule)) inspection.add(edit.start + ':' + edit.end);
    }
    site.matchingMs.push(performance.now() - beganMatching);
    const expected = new Map();
    for (const info of currentInventory.filter(i => i.template === id && i.file === name)) {
      for (const [old, replacement] of template.actions[info.action].pairs) {
        let cursor = 0;
        while ((cursor = source.indexOf(old, cursor)) >= 0) {
          expected.set(cursor + ':' + (cursor + old.length), {start: cursor, end: cursor + old.length, replacement});
          cursor += old.length;
        }
      }
    }
    for (const [key, edit] of expected) {
      site.expectedRanges++;
      if (candidates.has(key) || inspection.has(key)) site.detectableRanges++;
      if (candidates.get(key)?.replacement === edit.replacement) site.coveredRanges++;
      else site.missingTargets.push({file: name, start: edit.start,
        kind: candidates.has(key) ? 'replacement differs' : 'no structural candidate'});
    }
    for (const [key, edit] of candidates) {
      if (!expected.has(key)) site.extraCandidates.push({file: name, start: edit.start, sample: edit.before.slice(0, 140)});
    }
    if (candidates.size) {
      try { new vm.Script(applyEdits(source, [...candidates.values()])); }
      catch (e) {
        if (/Conflicting|Overlapping/.test(e.message)) site.rawConflicts.push({file: name, kind: e.message});
        else site.rawSyntaxFailures.push({file: name, kind: e.message});
      }
    }
    site.assets.push({file: name, sha256: sha(source), bytes: Buffer.byteLength(source),
      unchangedBytes: beforeHashes.has(sha(source)), currentTargets: expected.size, candidates: candidates.size});
    site.afterModules++;
  }
  for (const field of ['tokenizationMs', 'matchingMs']) {
    const values = site[field].sort((a, b) => a - b);
    site[field] = {total: +values.reduce((a, b) => a + b, 0).toFixed(2),
      median: +values[Math.floor(values.length / 2)].toFixed(2), max: +values.at(-1).toFixed(2)};
  }
  console.log(id, JSON.stringify({oldGroups: site.beforeGroupsVerified, afterModules: site.afterModules,
    expected: site.expectedRanges, detected: site.detectableRanges, covered: site.coveredRanges, extra: site.extraCandidates.length,
    conflicts: site.rawConflicts.length, syntaxFailures: site.rawSyntaxFailures.length}));
}
fs.writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n');
