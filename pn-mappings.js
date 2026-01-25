const PN_MAPPINGS_STORAGE_KEY = 'pnMappings';
const PN_MAPPINGS_API_URL = 'https://calc.bartryc.workers.dev/api/pn-mappings';
const PN_MAPPINGS_API_TOKEN = 'bartryc_AD43le1lRi50DWVJrlGmmVhYQBaHuHxQ-Hhdcg5Bo-qfCnpaebd7JmOtKGS-ofhe';
const DEFAULT_PN_DATA = {
  exact: {
    R7515: 'Dell'
  },
  patterns: [
    { pattern: 'xxxxx', vendor: 'Dell' },
    { pattern: '0xxxxx', vendor: 'Dell' },
    { pattern: 'xxxxxx-xxx', vendor: 'HPE' }
  ]
};
let pnCache = null;

function normalizePnKey(value) {
  return value.replace(/\s+/g, '').toUpperCase();
}

function normalizePattern(value) {
  return value.replace(/\s+/g, '').toUpperCase();
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_PN_DATA);
  }
  if (!raw.exact && !raw.patterns) {
    return { exact: raw, patterns: structuredClone(DEFAULT_PN_DATA.patterns) };
  }
  return {
    exact: raw.exact || {},
    patterns: Array.isArray(raw.patterns) ? raw.patterns : []
  };
}

function getPnData() {
  if (pnCache) return pnCache;
  try {
    const stored = localStorage.getItem(PN_MAPPINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      pnCache = normalizeData(parsed);
      return pnCache;
    }
  } catch (error) {
    pnCache = structuredClone(DEFAULT_PN_DATA);
    return pnCache;
  }
  pnCache = structuredClone(DEFAULT_PN_DATA);
  return pnCache;
}

function setPnData(data) {
  pnCache = data;
  localStorage.setItem(PN_MAPPINGS_STORAGE_KEY, JSON.stringify(data));
  syncPnData(data);
}

async function loadPnData() {
  try {
    const resp = await fetch(PN_MAPPINGS_API_URL, {
      headers: {
        'X-Auth-Token': PN_MAPPINGS_API_TOKEN
      }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    pnCache = normalizeData(data);
    localStorage.setItem(PN_MAPPINGS_STORAGE_KEY, JSON.stringify(pnCache));
    return pnCache;
  } catch (error) {
    return getPnData();
  }
}

async function syncPnData(data) {
  try {
    await fetch(PN_MAPPINGS_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': PN_MAPPINGS_API_TOKEN
      },
      body: JSON.stringify(data)
    });
  } catch (error) {
    // Keep local copy if sync fails.
  }
}

function matchPattern(pattern, value) {
  const normalized = normalizePattern(pattern);
  const target = normalizePnKey(value);
  if (!normalized) return false;
  const placeholders = normalized
    .replace(/x/gi, '__X__')
    .replace(/\*/g, '__STAR__')
    .replace(/\+/g, '__PLUS__');
  const escaped = placeholders.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escaped
    .replace(/__X__/g, '\\d')
    .replace(/__STAR__/g, '[A-Z0-9-]')
    .replace(/__PLUS__/g, '[A-Z0-9-]+');
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(target);
}

window.PN_MAPPINGS_API = {
  get: getPnData,
  set: setPnData,
  normalize: normalizePnKey,
  normalizePattern,
  matchPattern,
  normalizeData,
  load: loadPnData
};
