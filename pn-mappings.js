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
const LOG_MAX_QUEUE = 300;
const LOG_DEDUP_WINDOW_MS = 5000;
const LOG_MAX_META_CHARS = 3500;
const LOG_MAX_STRING_CHARS = 1200;
const LOG_MAX_ARRAY_ITEMS = 20;
const LOG_MAX_OBJECT_KEYS = 40;
let preferDirectLog = false;
let isLogFlushInProgress = false;
const recentLogMap = new Map();

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
  if (!LOG_QUEUE.length || isLogFlushInProgress) return;
  isLogFlushInProgress = true;
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
  } finally {
    isLogFlushInProgress = false;
    if (LOG_QUEUE.length) {
      setTimeout(() => {
        flushLogQueue();
      }, 0);
    }
  }
}

function scheduleLogFlush() {
  if (logFlushTimer) return;
  logFlushTimer = setInterval(() => {
    flushLogQueue();
  }, LOG_FLUSH_INTERVAL);
}

function truncateString(value, maxLength = LOG_MAX_STRING_CHARS) {
  const text = String(value ?? '');
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function sanitizeMetaValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncateString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 3) return truncateString(JSON.stringify(value));

  if (Array.isArray(value)) {
    return value.slice(0, LOG_MAX_ARRAY_ITEMS).map((item) => sanitizeMetaValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out = {};
    const keys = Object.keys(value).slice(0, LOG_MAX_OBJECT_KEYS);
    for (const key of keys) {
      out[key] = sanitizeMetaValue(value[key], depth + 1);
    }
    return out;
  }

  return truncateString(value);
}

function sanitizeLogMeta(meta = {}) {
  const safe = sanitizeMetaValue(meta, 0) || {};
  try {
    let serialized = JSON.stringify(safe);
    if (serialized.length <= LOG_MAX_META_CHARS) return safe;
    const compact = {};
    for (const [key, val] of Object.entries(safe)) {
      if (typeof val === 'string') {
        compact[key] = truncateString(val, 300);
      } else if (val && typeof val === 'object') {
        compact[key] = truncateString(JSON.stringify(val), 500);
      } else {
        compact[key] = val;
      }
    }
    serialized = JSON.stringify(compact);
    if (serialized.length <= LOG_MAX_META_CHARS) return compact;
    return { note: truncateString(serialized, LOG_MAX_META_CHARS) };
  } catch (error) {
    return { note: truncateString(String(meta), 500) };
  }
}

function buildLogFingerprint(type, meta) {
  try {
    return `${type}|${JSON.stringify(meta).slice(0, 500)}`;
  } catch (error) {
    return `${type}|unserializable`;
  }
}

function enqueueLog(type, meta = {}) {
  const safeMeta = sanitizeLogMeta(meta);
  const fingerprint = buildLogFingerprint(type, safeMeta);
  const now = Date.now();
  const lastTs = recentLogMap.get(fingerprint) || 0;
  if (now - lastTs < LOG_DEDUP_WINDOW_MS) return;
  recentLogMap.set(fingerprint, now);
  if (recentLogMap.size > 300) {
    const threshold = now - (LOG_DEDUP_WINDOW_MS * 2);
    for (const [key, ts] of recentLogMap.entries()) {
      if (ts < threshold) recentLogMap.delete(key);
    }
  }

  LOG_QUEUE.push({ type, meta: safeMeta, ts: now });
  if (LOG_QUEUE.length > LOG_MAX_QUEUE) {
    LOG_QUEUE.splice(0, LOG_QUEUE.length - LOG_MAX_QUEUE);
  }
  scheduleLogFlush();
  if (LOG_QUEUE.length >= LOG_MAX_BATCH) {
    flushLogQueue();
  }
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
  const raw = value.replace(/\s+/g, '');
  let out = '';
  for (const ch of raw) {
    if (ch === 'x' || ch === '*' || ch === '+' || ch === '-' || /\d/.test(ch)) {
      out += ch;
      continue;
    }
    if (/[a-z]/.test(ch)) {
      out += ch.toUpperCase();
      continue;
    }
    out += ch;
  }
  return out;
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
    .replace(/x/g, '__X__')
    .replace(/\*/g, '__STAR__')
    .replace(/\+/g, '__PLUS__');
  const escaped = placeholders.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escaped
    .replace(/__X__/g, '\\d')
    .replace(/__STAR__/g, '[^\\s]')
    .replace(/__PLUS__/g, '[^\\s]+');
  const regex = new RegExp(`^${regexPattern}$`);
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
