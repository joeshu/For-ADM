export const SOURCE_ADAPTER_PROVIDERS = Object.freeze(['yqk', 'dyls', 'souju', 'kanju']);
export const SOURCE_DISCOVERY_MODES = Object.freeze([
  'timeline', 'netflix', 'topics', 'ranking', 'catalog', 'hot', 'latest', 'trending', 'home'
]);
export const SOURCE_CLIENT_METHODS = Object.freeze([
  'bootstrap', 'home', 'channel', 'collection', 'search', 'detail',
  'episodes', 'play', 'anonymous', 'login', 'logout', 'discoveryProfile'
]);

const PROVIDER_FIELDS = {
  yqk: ['protocol.appId', 'protocol.appKey', 'protocol.version', 'protocol.apiOrigins'],
  dyls: ['protocol.publicKey', 'protocol.signKey', 'protocol.aesKey', 'protocol.aesIV', 'protocol.clientVersion'],
  souju: ['protocol.signingKey'],
  kanju: ['protocol.signingKey', 'protocol.clientName', 'protocol.clientVersion', 'protocol.buildVersion', 'protocol.protocolVersion', 'protocol.apiOrigins']
};
const BASE_FIELDS = ['appId', 'signKey', 'initKey', 'initIV', 'responseKeys'];

function field(value, path) {
  return path.split('.').reduce((node, key) => node && node[key], value);
}

function validOrigin(value, allowHTTP = false) {
  try {
    const url = new URL(value);
    return Boolean(
      (url.protocol === 'https:' || (allowHTTP && url.protocol === 'http:')) &&
      !url.username && !url.password && url.hostname &&
      url.pathname === '/' && !url.search && !url.hash
    );
  } catch {
    return false;
  }
}

export function validateSiteManifest(sites) {
  const errors = [];
  const seen = new Set();
  if (!Array.isArray(sites) || !sites.length) throw Error('站点清单必须是非空数组');

  for (const [index, site] of sites.entries()) {
    const label = `sites[${index}]`;
    if (!site || typeof site !== 'object' || Array.isArray(site)) {
      errors.push(`${label} 必须是对象`);
      continue;
    }

    if (typeof site.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,31}$/.test(site.id)) {
      errors.push(`${label}.id 格式无效`);
    } else if (seen.has(site.id)) {
      errors.push(`${label}.id 重复`);
    } else {
      seen.add(site.id);
    }

    if (typeof site.name !== 'string' || !site.name.trim() || site.name.length > 40) {
      errors.push(`${label}.name 缺失或过长`);
    }
    if (typeof site.version !== 'string' || !site.version.trim()) {
      errors.push(`${label}.version 缺失`);
    }

    const allowHTTP = site.allowInsecureOrigin === true;
    if (!validOrigin(site.origin, allowHTTP)) {
      errors.push(`${label}.origin 必须是无路径的 HTTPS 源站地址；HTTP 源站需显式设置 allowInsecureOrigin`);
    }
    if (site.provider && !SOURCE_ADAPTER_PROVIDERS.includes(site.provider)) {
      errors.push(`${label}.provider 未注册：${String(site.provider)}`);
    }
    if (site.sourceSha256 && !/^[a-f0-9]{64}$/.test(site.sourceSha256)) {
      errors.push(`${label}.sourceSha256 必须是 SHA-256`);
    }

    const fields = site.provider ? (PROVIDER_FIELDS[site.provider] || []) : BASE_FIELDS;
    for (const path of fields) {
      const value = field(site, path);
      const valid = path.endsWith('Origins')
        ? Array.isArray(value) && value.length > 0
        : value !== undefined && value !== null && value !== '';
      if (!valid) errors.push(`${label}.${path} 缺失或无效`);
    }

    const apiOrigins = site.protocol?.apiOrigins;
    if (apiOrigins !== undefined && (
      !Array.isArray(apiOrigins) ||
      apiOrigins.length > 32 ||
      new Set(apiOrigins).size !== apiOrigins.length ||
      apiOrigins.some(origin => !validOrigin(origin, allowHTTP))
    )) {
      errors.push(`${label}.protocol.apiOrigins 必须是最多 32 个不重复的无路径源站地址；HTTP 需显式设置 allowInsecureOrigin`);
    }

    if (!site.provider && (!Array.isArray(site.responseKeys) || !site.responseKeys.length)) {
      errors.push(`${label}.responseKeys 必须包含解码配置`);
    }
    if (!site.provider && Array.isArray(site.responseKeys)) {
      const indexes = site.responseKeys.map(key => Number(key?.index));
      if (site.responseKeys.some(key => !Number.isSafeInteger(Number(key?.index)) || !key?.key || !key?.iv)) {
        errors.push(`${label}.responseKeys 条目必须包含有效 index、key 和 iv`);
      }
      if (new Set(indexes).size !== indexes.length) errors.push(`${label}.responseKeys index 不能重复`);
    }
  }

  if (errors.length) throw Error(`站点清单校验失败：\n${errors.join('\n')}`);
  return sites;
}

export function assertSourceClientContract(site, client) {
  if (!site || typeof site.id !== 'string' || !client || client.site?.id !== site.id) {
    throw TypeError('片源适配器必须绑定对应的站点描述');
  }

  const missing = SOURCE_CLIENT_METHODS.filter(method => typeof client[method] !== 'function');
  if (missing.length) throw TypeError(`片源适配器缺少统一接口：${missing.join(', ')}`);

  const profile = client.discoveryProfile();
  if (!profile || typeof profile.timeline !== 'boolean' || !Array.isArray(profile.tabs) || !profile.tabs.length) {
    throw TypeError('片源发现页配置不符合统一契约');
  }
  if (profile.timeline && profile.timelineTab == null) {
    throw TypeError('开启时间轴的来源必须指定 timelineTab');
  }

  const ids = new Set();
  for (const tab of profile.tabs) {
    const tabId = tab?.id == null ? '' : String(tab.id);
    const numericTabId = Number(tabId);
    if (!tab || !tabId.trim() || !Number.isSafeInteger(numericTabId) || tabId !== String(numericTabId) ||
        typeof tab.name !== 'string' || !tab.name.trim() ||
        typeof tab.mode !== 'string' || !SOURCE_DISCOVERY_MODES.includes(tab.mode)) {
      throw TypeError('发现页栏目必须提供数值 id、name 和 mode');
    }
    const id = String(tab.id);
    if (ids.has(id)) throw TypeError('发现页栏目 id 不能重复');
    ids.add(id);
    if (tab.mode === 'timeline' && (!profile.timeline || id !== String(profile.timelineTab))) {
      throw TypeError('timeline 模式必须对应来源声明的 timelineTab');
    }
    if (tab.mode === 'home' && id !== String(profile.sectionTab)) {
      throw TypeError('home 模式必须对应来源声明的 sectionTab');
    }
  }

  if (profile.timeline && !ids.has(String(profile.timelineTab))) {
    throw TypeError('发现页 timelineTab 必须引用已声明的栏目');
  }
  if (profile.sectionTab != null && !ids.has(String(profile.sectionTab))) {
    throw TypeError('发现页 sectionTab 必须引用已声明的栏目');
  }
  return client;
}
