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
const BACKFILL_MAX_LOG_PAGES = 20;
const BACKFILL_PAGE_SIZE = 200;

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

function normalizeCreatedAt(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const ts = Date.parse(text);
  if (Number.isNaN(ts)) return '';
  return new Date(ts).toISOString();
}

function normalizeExactMetaEntry(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const createdAt = normalizeCreatedAt(value.createdAt);
    const updatedAt = normalizeCreatedAt(value.updatedAt) || createdAt;
    return { createdAt, updatedAt };
  }
  const createdAt = normalizeCreatedAt(value);
  return { createdAt, updatedAt: createdAt };
}

function extractExactEntry(entry) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const vendor = String(entry.vendor || '').trim();
    const createdAt = normalizeCreatedAt(entry.createdAt);
    const updatedAt = normalizeCreatedAt(entry.updatedAt) || createdAt;
    return { vendor, createdAt, updatedAt };
  }
  return { vendor: String(entry || '').trim(), createdAt: '', updatedAt: '' };
}

function getExactVendorFromData(data, key) {
  if (!data || !data.exact) return '';
  const normalizedKey = normalizePnKey(String(key || ''));
  const entry = data.exact[normalizedKey];
  return extractExactEntry(entry).vendor;
}

function getExactCreatedAtFromData(data, key) {
  if (!data) return '';
  const normalizedKey = normalizePnKey(String(key || ''));
  const fromMeta = normalizeExactMetaEntry(data.exactMeta?.[normalizedKey]);
  if (fromMeta.createdAt) return fromMeta.createdAt;
  const entry = data.exact?.[normalizedKey];
  return extractExactEntry(entry).createdAt;
}

function getExactUpdatedAtFromData(data, key) {
  if (!data) return '';
  const normalizedKey = normalizePnKey(String(key || ''));
  const fromMeta = normalizeExactMetaEntry(data.exactMeta?.[normalizedKey]);
  if (fromMeta.updatedAt) return fromMeta.updatedAt;
  const entry = data.exact?.[normalizedKey];
  return extractExactEntry(entry).updatedAt;
}

function setExactEntry(data, key, vendor, options = '') {
  if (!data || typeof data !== 'object') return '';
  const normalizedKey = normalizePnKey(String(key || ''));
  const cleanVendor = String(vendor || '').trim();
  if (!normalizedKey || !cleanVendor) return '';
  const nowIso = new Date().toISOString();
  const opt = (options && typeof options === 'object' && !Array.isArray(options))
    ? options
    : { createdAt: options };
  const existingMeta = normalizeExactMetaEntry(data.exactMeta?.[normalizedKey]);
  const existingCreated = existingMeta.createdAt || getExactCreatedAtFromData(data, normalizedKey);
  const normalizedCreatedAt = normalizeCreatedAt(opt.createdAt)
    || existingCreated
    || nowIso;
  const normalizedUpdatedAt = normalizeCreatedAt(opt.updatedAt)
    || (opt.touch === false ? (existingMeta.updatedAt || normalizedCreatedAt) : nowIso);
  data.exact = data.exact || {};
  data.exactMeta = data.exactMeta || {};
  data.exact[normalizedKey] = cleanVendor;
  data.exactMeta[normalizedKey] = {
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedUpdatedAt
  };
  return { createdAt: normalizedCreatedAt, updatedAt: normalizedUpdatedAt };
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_PN_DATA);
  }
  let exactSource = raw.exact;
  let exactMetaSource = raw.exactMeta;
  let patternsSource = raw.patterns;
  if (!raw.exact && !raw.patterns) {
    exactSource = raw;
    exactMetaSource = {};
    patternsSource = structuredClone(DEFAULT_PN_DATA.patterns);
  }

  const exact = {};
  const exactMeta = {};
  if (exactSource && typeof exactSource === 'object') {
    for (const [key, entry] of Object.entries(exactSource)) {
      const normalizedKey = normalizePnKey(String(key || ''));
      if (!normalizedKey) continue;
      const parsedEntry = extractExactEntry(entry);
      const { vendor, createdAt } = parsedEntry;
      if (!vendor) continue;
      exact[normalizedKey] = vendor;
      const fromMeta = normalizeExactMetaEntry(exactMetaSource?.[normalizedKey] || exactMetaSource?.[key]);
      const normalizedCreatedAt = fromMeta.createdAt || createdAt;
      const normalizedUpdatedAt = fromMeta.updatedAt || parsedEntry.updatedAt || normalizedCreatedAt;
      if (normalizedCreatedAt || normalizedUpdatedAt) {
        exactMeta[normalizedKey] = {
          createdAt: normalizedCreatedAt || '',
          updatedAt: normalizedUpdatedAt || normalizedCreatedAt || ''
        };
      }
    }
  }

  const patterns = Array.isArray(patternsSource) ? patternsSource : [];
  const normalizedPatterns = patterns
    .map((rule) => ({
      pattern: normalizePattern(String(rule?.pattern || '')),
      vendor: String(rule?.vendor || '').trim(),
      createdAt: normalizeCreatedAt(rule?.createdAt),
      updatedAt: normalizeCreatedAt(rule?.updatedAt) || normalizeCreatedAt(rule?.createdAt)
    }))
    .filter((rule) => rule.pattern && rule.vendor);

  return {
    exact,
    exactMeta,
    patterns: normalizedPatterns
  };
}

function hasMissingCreatedAt(data) {
  if (!data || typeof data !== 'object') return false;
  const exactKeys = Object.keys(data.exact || {});
  for (const key of exactKeys) {
    if (!getExactCreatedAtFromData(data, key)) return true;
    if (!getExactUpdatedAtFromData(data, key)) return true;
  }
  const patterns = Array.isArray(data.patterns) ? data.patterns : [];
  for (const rule of patterns) {
    if (!normalizeCreatedAt(rule?.createdAt)) return true;
    if (!normalizeCreatedAt(rule?.updatedAt)) return true;
  }
  return false;
}

function isMappingAddAction(action) {
  return action === 'add-exact'
    || action === 'add-pattern'
    || action === 'creator-exact'
    || action === 'creator-pattern'
    || action === 'apply-report-exact'
    || action === 'apply-report-pattern';
}

async function fetchLogsForBackfill() {
  const all = [];
  for (let page = 0; page < BACKFILL_MAX_LOG_PAGES; page += 1) {
    const offset = page * BACKFILL_PAGE_SIZE;
    const resp = await fetch(
      `${PN_MAPPINGS_API_URL}/logs?limit=${BACKFILL_PAGE_SIZE}&offset=${offset}&type=mapping`,
      { headers: buildHeaders() }
    );
    if (!resp.ok) break;
    const payload = await resp.json();
    const logs = Array.isArray(payload?.logs) ? payload.logs : [];
    if (!logs.length) break;
    all.push(...logs);
    if (logs.length < BACKFILL_PAGE_SIZE) break;
  }
  return all;
}

function backfillCreatedAtFromLogs(data, logs) {
  if (!data || typeof data !== 'object' || !Array.isArray(logs) || !logs.length) return false;
  const ordered = logs.slice().reverse();
  let changed = false;
  data.exactMeta = data.exactMeta || {};
  const patterns = Array.isArray(data.patterns) ? data.patterns : [];
  const patternByKey = new Map();
  for (const rule of patterns) {
    const key = normalizePattern(String(rule?.pattern || ''));
    if (key) patternByKey.set(key, rule);
  }
  for (const entry of ordered) {
    const meta = entry?.meta || {};
    const action = String(meta?.action || '').trim();
    if (!isMappingAddAction(action)) continue;
    const createdAt = normalizeCreatedAt(meta?.createdAt || entry?.ts);
    if (!createdAt) continue;
    const mappingType = String(meta?.mappingType || '').trim();
    const key = normalizePnKey(String(meta?.key || ''));
    const pattern = normalizePattern(String(meta?.pattern || ''));
    if ((mappingType === 'exact' || key) && key && data.exact && data.exact[key]) {
      const meta = normalizeExactMetaEntry(data.exactMeta?.[key]);
      if (!meta.createdAt || !meta.updatedAt) {
        data.exactMeta[key] = {
          createdAt: meta.createdAt || createdAt,
          updatedAt: meta.updatedAt || meta.createdAt || createdAt
        };
        changed = true;
      }
      continue;
    }
    if ((mappingType === 'pattern' || pattern) && patternByKey.has(pattern)) {
      const rule = patternByKey.get(pattern);
      if (!normalizeCreatedAt(rule?.createdAt)) {
        rule.createdAt = createdAt;
        rule.updatedAt = normalizeCreatedAt(rule?.updatedAt) || createdAt;
        changed = true;
      } else if (!normalizeCreatedAt(rule?.updatedAt)) {
        rule.updatedAt = rule.createdAt;
        changed = true;
      }
    }
  }
  return changed;
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
    if (hasMissingCreatedAt(pnCache)) {
      try {
        const logs = await fetchLogsForBackfill();
        const changed = backfillCreatedAtFromLogs(pnCache, logs);
        if (changed) {
          await syncPnData(pnCache);
        }
      } catch (error) {
        // keep best-effort backfill silent
      }
    }
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
  getExactVendor: getExactVendorFromData,
  getExactCreatedAt: getExactCreatedAtFromData,
  getExactUpdatedAt: getExactUpdatedAtFromData,
  setExactEntry,
  normalizeCreatedAt,
  load: loadPnData,
  log: enqueueLog,
  request: (path, options = {}) => {
    const headers = buildHeaders(options.headers || {});
    return fetch(`${PN_MAPPINGS_API_URL}${path}`, { ...options, headers });
  }
};
