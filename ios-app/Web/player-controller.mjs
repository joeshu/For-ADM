// Pure playback orchestration, line health scoring, and resume/outro rules shared
// between Native UIKit playback events, Web <video>, and headless state-machine tests.

export function lineHealthKey(siteId, line) {
  const lineId = line?.siteId ?? line?.name ?? '';
  return `${siteId || 'default'}:${lineId}`;
}

export function lineHealthScore(healthMap = {}, siteId = '', line = {}) {
  const entry = healthMap?.[lineHealthKey(siteId, line)];
  if (!entry) return 0;
  const ok = Number(entry.ok) || 0;
  const fail = Number(entry.fail) || 0;
  const avgMs = Number(entry.avgMs) || 1200;
  const rate = ok / Math.max(1, ok + fail + 1);
  const latencyBonus = Math.max(0, 1 - Math.min(avgMs, 5000) / 5000) * 0.25;
  const recentFailPenalty = entry.lastOk === false && Date.now() - (Number(entry.updatedAt) || 0) < 300000 ? 0.5 : 0;
  return rate + latencyBonus - recentFailPenalty;
}

export function recordLineOutcome(healthMap = {}, siteId = '', line = {}, { ok = true, latencyMs = 0 } = {}) {
  const key = lineHealthKey(siteId, line);
  const prev = healthMap?.[key] || { ok: 0, fail: 0, avgMs: 0, lastOk: true, updatedAt: 0 };
  const nextOk = prev.ok + (ok ? 1 : 0);
  const nextFail = prev.fail + (ok ? 0 : 1);
  const ms = Number(latencyMs) > 0 ? Number(latencyMs) : prev.avgMs || 800;
  const nextAvg = ok && prev.avgMs > 0 ? Math.round(prev.avgMs * 0.6 + ms * 0.4) : ok ? Math.round(ms) : prev.avgMs;
  return {
    ...healthMap,
    [key]: {
      ok: nextOk,
      fail: nextFail,
      avgMs: nextAvg,
      lastOk: !!ok,
      updatedAt: Date.now(),
    },
  };
}

export function orderLinesByHealth(lines = [], lineIndex = 0, preferredSiteId = '', healthMap = {}, siteId = '', excludedLines = []) {
  const preferred = lines.findIndex(x => x.siteId === preferredSiteId);
  const base = [...new Set([lineIndex, preferred, ...lines.map((_, i) => i)].filter(i => i >= 0))];
  const filtered = base.filter(i => (i === lineIndex || lines[i]?.preview !== true) && !excludedLines.includes(i));
  const head = filtered.slice(0, lineIndex >= 0 ? 1 : 0);
  const rest = filtered.slice(head.length).sort((a, b) => {
    if (a === preferred && b !== preferred) return -1;
    if (b === preferred && a !== preferred) return 1;
    return lineHealthScore(healthMap, siteId, lines[b]) - lineHealthScore(healthMap, siteId, lines[a]);
  });
  return [...head, ...rest].slice(0, 5);
}

export function computeResumeStartAt({ preview = false, time = 0, duration = 0 } = {}) {
  if (preview) return 0;
  const t = Number(time) || 0;
  const d = Number(duration) || 0;
  if (t <= 0) return 0;
  if (d > 0 && t >= d - 5) return 0;
  return t;
}

export function shouldAutoSkipOutro({ preview = false, outroSkipped = false, autoNext = true, skipOutroSeconds = 0, duration = 0, currentTime = 0 } = {}) {
  if (preview || outroSkipped || !autoNext) return false;
  const threshold = Number(skipOutroSeconds) || 0;
  const dur = Number(duration) || 0;
  const cur = Number(currentTime) || 0;
  if (threshold <= 0 || !Number.isFinite(dur) || dur <= 600 || cur <= 300) return false;
  return dur - cur <= threshold;
}
