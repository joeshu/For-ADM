import fs from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {tokenizer} = require('../../vendor/acorn/acorn-8.15.0.js');

function tokens(source) {
  return [...tokenizer(source, {ecmaVersion: 'latest'})];
}
function key(t) {
  return t.type.label + ':' + JSON.stringify(t.type.label === 'regexp'
    ? [t.value.pattern, t.value.flags] : t.value);
}

export function resolveStructuralTemplate(template, root) {
  if (template.structuralFallback === undefined) return template;
  const profile = JSON.parse(fs.readFileSync(root + '/universal/profiles/media-structural.json', 'utf8'));
  if (template.structuralFallback !== profile.id || !Object.hasOwn(profile.brands, template.id)
    || template.adapter !== 'declarative' || !Array.isArray(profile.rules) || !profile.rules.length) {
    throw Error('Invalid media structural profile');
  }
  const probes = new Set();
  const rules = profile.rules.map(rule => {
    if (!Array.isArray(rule.guards) || !rule.guards.length || (rule.helper && !template.jsHelpers?.[rule.helper])) {
      throw Error('Invalid structural guards/helper');
    }
    const variables = new Map();
    const after = rule.after.replaceAll('{{siteId}}', template.id);
    if (/\{\{/.test(after)) throw Error('Unknown structural replacement placeholder');
    const p = tokens(rule.before).map(t => {
      if (t.type.label !== 'name' || !/^_0x[0-9a-f]+$/.test(t.value)) return key(t);
      if (!variables.has(t.value)) variables.set(t.value, -variables.size - 1);
      return variables.get(t.value);
    });
    const cardProperty = p.length >= 4 && rule.helper === 'cards'
      && p.some(t => t === 'string:"data-source"' || t === 'string:"dataSource"');
    if ((!cardProperty && p.length < 6) || !p.some(t => typeof t === 'string')) throw Error('Structural pattern too broad');
    const r = []; let cursor = 0;
    for (const t of tokens(after)) {
      if (t.type.label !== 'name' || !/^_0x[0-9a-f]+$/.test(t.value)) continue;
      if (!variables.has(t.value)) throw Error('Unbound structural replacement variable');
      r.push(after.slice(cursor, t.start), variables.get(t.value)); cursor = t.end;
    }
    r.push(after.slice(cursor));
    const g = rule.guards.map(group => {
      if (!Array.isArray(group) || group.length < 3) throw Error('Structural rules need independent guards');
      const markers = group.map(marker => {
        if (typeof marker !== 'string' || !marker) throw Error('Invalid structural marker');
        marker = marker.replaceAll('{{appName}}', profile.brands[template.id]);
        return /['"\[\]:=]/.test(marker) ? {t: tokens(marker).map(key)} : {v: marker};
      });
      const words = markers.flatMap(m => m.v ? [m.v] : m.t.flatMap(k => {
        if (!k.startsWith('string:')) return [];
        return [JSON.parse(k.slice(7))];
      })).filter(s => s.length >= 6 && s !== 'webpackChunkmovie');
      if (!words.length) throw Error('Structural group needs a cheap business prefilter');
      probes.add(words.sort((a, b) => b.length - a.length)[0]);
      return markers;
    });
    return {p, r, g, ...(rule.helper ? {h: rule.helper} : {})};
  });
  const {structuralFallback, ...rest} = template;
  return {...rest, structuralRules: {profile: profile.id, probes: [...probes], rules}};
}
