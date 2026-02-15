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
const LOG_QUEUE = [];
let logFlushTimer = null;
const LOG_FLUSH_INTERVAL = 20000;
const LOG_MAX_BATCH = 50;
let preferDirectLog = false;

function getClientFingerprint() {
  try {
    if (typeof navigator === 'undefined') return 'unknown';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'na';
    const screenSize = typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'na';
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? String(window.devicePixelRatio) : '1';
    const parts = [
      navigator.userAgent || '',
      navigator.language || '',
      navigator.platform || '',
      tz,
      screenSize,
      dpr
    ];
    const raw = parts.join('|');
    let hash = 5381;
    for (let i = 0; i < raw.length; i += 1) {
      hash = ((hash << 5) + hash) + raw.charCodeAt(i);
    }
    return `fp-${(hash >>> 0).toString(16)}`;
  } catch (error) {
    return 'unknown';
  }
}

const CLIENT_FP = getClientFingerprint();

function buildHeaders(extra = {}) {
  let appVersion = '';
  try {
    appVersion = (document.getElementById('appVersion')?.textContent || localStorage.getItem('appVersion') || '').trim();
  } catch (error) {
    appVersion = '';
  }
  return Object.assign(
    {
      'X-Auth-Token': PN_MAPPINGS_API_TOKEN,
      'X-Client-FP': CLIENT_FP,
      ...(appVersion ? { 'X-App-Version': appVersion } : {})
    },
    extra
  );
}

async function flushLogQueue() {
  if (!LOG_QUEUE.length) return;
  const batch = LOG_QUEUE.splice(0, LOG_MAX_BATCH);
  try {
    if (preferDirectLog) {
      await sendLogsIndividually(batch);
      return;
    }
    const resp = await fetch(`${PN_MAPPINGS_API_URL}/log-batch`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ logs: batch })
    });
    if (!resp.ok) {
      preferDirectLog = true;
      await sendLogsIndividually(batch);
    }
  } catch (error) {
    preferDirectLog = true;
    await sendLogsIndividually(batch);
  }
}

function scheduleLogFlush() {
  if (logFlushTimer) return;
  logFlushTimer = setInterval(() => {
    flushLogQueue();
  }, LOG_FLUSH_INTERVAL);
}

function enqueueLog(type, meta = {}) {
  LOG_QUEUE.push({ type, meta, ts: Date.now() });
  scheduleLogFlush();
}

async function sendLogsIndividually(batch) {
  for (const entry of batch) {
    try {
      await fetch(`${PN_MAPPINGS_API_URL}/log`, {
        method: 'POST',
        headers: buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ type: entry.type, meta: entry.meta })
      });
    } catch (error) {
      // drop if direct logging fails
    }
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushLogQueue();
    }
  });
}

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
  let exactSource = raw.exact;
  let patternsSource = raw.patterns;
  if (!raw.exact && !raw.patterns) {
    exactSource = raw;
    patternsSource = structuredClone(DEFAULT_PN_DATA.patterns);
  }

  const exact = {};
  if (exactSource && typeof exactSource === 'object') {
    for (const [key, vendor] of Object.entries(exactSource)) {
      const normalizedKey = normalizePnKey(String(key || ''));
      if (!normalizedKey || !vendor) continue;
      exact[normalizedKey] = vendor;
    }
  }

  const patterns = Array.isArray(patternsSource) ? patternsSource : [];
  const normalizedPatterns = patterns
    .map((rule) => ({
      pattern: normalizePattern(String(rule?.pattern || '')),
      vendor: String(rule?.vendor || '').trim()
    }))
    .filter((rule) => rule.pattern && rule.vendor);

  return {
    exact,
    patterns: normalizedPatterns
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
  const normalized = normalizeData(data);
  pnCache = normalized;
  localStorage.setItem(PN_MAPPINGS_STORAGE_KEY, JSON.stringify(normalized));
  syncPnData(normalized);
}

async function loadPnData() {
  try {
    const resp = await fetch(PN_MAPPINGS_API_URL, {
      headers: buildHeaders()
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
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
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
    .replace(/__STAR__/g, '[^\\s]')
    .replace(/__PLUS__/g, '[^\\s]+');
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
  load: loadPnData,
  log: enqueueLog,
  request: (path, options = {}) => {
    const headers = buildHeaders(options.headers || {});
    return fetch(`${PN_MAPPINGS_API_URL}${path}`, { ...options, headers });
  }
};
