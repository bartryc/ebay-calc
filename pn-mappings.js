const PN_MAPPINGS_STORAGE_KEY = 'pnMappings';
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
  try {
    const stored = localStorage.getItem(PN_MAPPINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return normalizeData(parsed);
    }
  } catch (error) {
    return structuredClone(DEFAULT_PN_DATA);
  }
  return structuredClone(DEFAULT_PN_DATA);
}

function setPnData(data) {
  localStorage.setItem(PN_MAPPINGS_STORAGE_KEY, JSON.stringify(data));
}

function matchPattern(pattern, value) {
  const normalized = normalizePattern(pattern);
  const target = normalizePnKey(value);
  if (!normalized) return false;
  const escaped = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/x/g, '\\d')
    .replace(/\*/g, '[A-Z0-9-]')
    .replace(/\+/g, '[A-Z0-9-]+');
  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(target);
}

window.PN_MAPPINGS_API = {
  get: getPnData,
  set: setPnData,
  normalize: normalizePnKey,
  normalizePattern,
  matchPattern,
  normalizeData
};
