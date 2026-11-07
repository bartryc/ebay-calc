let rateCurrencyAllowlistCache = {
  expiresAt: 0,
  codes: ['EUR', 'USD', 'GBP']
};

async function getAllowedRateCurrencies(env) {
  if (rateCurrencyAllowlistCache.expiresAt > Date.now()) {
    return new Set(rateCurrencyAllowlistCache.codes);
  }
  let codes = ['EUR', 'USD', 'GBP'];
  try {
    const raw = await env.PN_MAPPINGS.get('note:currencies-config-v1');
    const config = raw ? JSON.parse(raw) : null;
    const configured = Array.isArray(config?.currencies)
      ? config.currencies
          .filter((item) => item?.enabled !== false)
          .map((item) => String(item?.code || '').trim().toUpperCase())
          .filter((code) => /^[A-Z]{3}$/.test(code))
      : [];
    if (configured.length) codes = configured;
  } catch (_error) {
    // Keep built-in currencies available if the optional config is unavailable.
  }
  rateCurrencyAllowlistCache = {
    expiresAt: Date.now() + 5 * 60_000,
    codes
  };
  return new Set(codes);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCors(new Response('', { status: 204 }));
    }

    try {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ua = request.headers.get('User-Agent') || 'unknown';
      const clientFp = request.headers.get('X-Client-FP') || 'unknown';
      const appVersion = request.headers.get('X-App-Version') || '';
      const country = request.headers.get('CF-IPCountry') || 'unknown';
      const ray = request.headers.get('CF-Ray') || 'unknown';
      const cf = request.cf || {};

      const geo = {
        city: cf.city || 'unknown',
        region: cf.region || 'unknown',
        country: cf.country || country,
        asn: cf.asn || 'unknown',
        colo: cf.colo || 'unknown'
      };

      if (url.pathname === '/api/pn-mappings/usage') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        if (request.method !== 'GET') {
          return withCors(new Response('Method Not Allowed', {
            status: 405
          }));
        }

        const usage = await getCloudflareUsage(env);
        return withCors(json(usage));
      }

      if (url.pathname === '/api/pn-mappings') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        if (request.method === 'GET') {
          const stored = await env.PN_MAPPINGS.get('data');

          const payload = stored
            ? JSON.parse(stored)
            : { exact: {}, patterns: [] };

          return withCors(json(payload));
        }

        if (request.method === 'PUT') {
          const body = await request.json();

          await env.PN_MAPPINGS.put(
            'data',
            JSON.stringify(body)
          );

          return withCors(json({ ok: true }));
        }

        return withCors(new Response('Method Not Allowed', {
          status: 405
        }));
      }

      if (url.pathname === '/api/pn-mappings/backup') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        const cooldownKey = `backup:${ip}`;
        const last = Number(
          await env.PN_MAPPINGS.get(cooldownKey)
        ) || 0;

        const now = Date.now();

        if (now - last < 30_000) {
          return withCors(json({ error: 'Cooldown' }, 429));
        }

        await env.PN_MAPPINGS.put(
          cooldownKey,
          String(now),
          { expirationTtl: 60 }
        );

        const stored = await env.PN_MAPPINGS.get('data');

        const payload = stored
          ? JSON.parse(stored)
          : { exact: {}, patterns: [] };

        await logEvent(env, {
          type: 'backup',
          ip,
          ua,
          ray,
          clientFp,
          geo,
          appVersion
        });

        return withCors(json(payload));
      }

      if (url.pathname === '/api/pn-mappings/backup/full') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        const cooldownKey = `backupfull:${ip}`;
        const last = Number(
          await env.PN_MAPPINGS.get(cooldownKey)
        ) || 0;

        const now = Date.now();

        if (now - last < 30_000) {
          return withCors(json({ error: 'Cooldown' }, 429));
        }

        await env.PN_MAPPINGS.put(
          cooldownKey,
          String(now),
          { expirationTtl: 60 }
        );

        const data = await env.PN_MAPPINGS.get('data');
        const audit = await env.PN_MAPPINGS.get('audit');
        const notes = await env.PN_MAPPINGS.get('notes-index');
        const reportKinds = await env.PN_MAPPINGS.get(
          'report-kinds'
        );

        await logEvent(env, {
          type: 'backup-full',
          ip,
          ua,
          ray,
          clientFp,
          geo,
          appVersion
        });

        return withCors(json({
          data: data
            ? JSON.parse(data)
            : { exact: {}, patterns: [] },

          audit: audit
            ? JSON.parse(audit)
            : [],

          notesIndex: notes
            ? JSON.parse(notes)
            : [],

          reportKinds: reportKinds
            ? JSON.parse(reportKinds)
            : {}
        }));
      }

      if (url.pathname === '/api/pn-mappings/logs/backup') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        const raw = await env.PN_MAPPINGS.get('audit_backup');

        const payload = raw
          ? JSON.parse(raw)
          : [];

        const timestamp =
          await env.PN_MAPPINGS.get('audit_backup_ts') || '';

        return withCors(json({
          logs: payload,
          ts: timestamp
        }));
      }

      if (
        url.pathname ===
        '/api/pn-mappings/logs/backup/update'
      ) {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        if (request.method !== 'POST') {
          return withCors(new Response('Method Not Allowed', {
            status: 405
          }));
        }

        const raw = await env.PN_MAPPINGS.get('audit');

        const logs = raw
          ? JSON.parse(raw)
          : [];

        await env.PN_MAPPINGS.put(
          'audit_backup',
          JSON.stringify(logs)
        );

        await env.PN_MAPPINGS.put(
          'audit_backup_ts',
          new Date().toISOString()
        );

        await logEvent(env, {
          type: 'backup-logs',
          ip,
          ua,
          ray,
          clientFp,
          geo,
          appVersion
        });

        return withCors(json({
          ok: true,
          count: logs.length
        }));
      }

      if (
        url.pathname ===
        '/api/pn-mappings/logs/restore'
      ) {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        if (request.method !== 'POST') {
          return withCors(new Response('Method Not Allowed', {
            status: 405
          }));
        }

        const body = await request.json();

        const logs = Array.isArray(body.logs)
          ? body.logs
          : [];

        await env.PN_MAPPINGS.put(
          'audit',
          JSON.stringify(logs)
        );

        await logEvent(env, {
          type: 'restore-logs',
          ip,
          ua,
          ray,
          clientFp,
          geo,
          appVersion
        });

        return withCors(json({
          ok: true,
          count: logs.length
        }));
      }

      if (url.pathname === '/api/pn-mappings/logs') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        const limit = Math.min(
          200,
          Math.max(
            1,
            Number(url.searchParams.get('limit')) || 20
          )
        );

        const offset = Math.max(
          0,
          Number(url.searchParams.get('offset')) || 0
        );

        const typeFilter = (
          url.searchParams.get('type') || ''
        ).trim();

        const query = (
          url.searchParams.get('query') || ''
        ).trim().toLowerCase();

        const raw = await env.PN_MAPPINGS.get('audit');

        const allLogs = raw
          ? JSON.parse(raw)
          : [];

        let filtered = allLogs;

        if (typeFilter) {
          if (typeFilter === 'mapping-report') {
            filtered = filtered.filter((entry) => {
              if (!entry) return false;

              const type = entry.type || '';

              if (
                type === 'backup-logs'
                || type === 'restore-logs'
              ) {
                return false;
              }

              if (type === 'mapping-report') {
                return true;
              }

              const meta = entry?.meta || {};
              const report = meta.report || {};

              return !!(
                meta.reportId
                || report.reportId
                || meta.reason
                || meta.query
                || meta.suggestedVendor
                || meta.detail
                || report.reason
                || report.query
                || report.suggestedVendor
                || report.detail
                || meta.kind
                || report.kind
              );
            });
          } else {
            filtered = filtered.filter(
              (entry) => entry.type === typeFilter
            );
          }
        }

        if (query) {
          filtered = filtered.filter(
            (entry) =>
              JSON.stringify(entry)
                .toLowerCase()
                .includes(query)
          );
        }

        const total = filtered.length;
        const ordered = filtered.slice().reverse();
        const page = ordered.slice(offset, offset + limit);

        return withCors(json({
          logs: page,
          total
        }));
      }

      if (url.pathname === '/api/pn-mappings/log') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        if (request.method !== 'POST') {
          return withCors(new Response('Method Not Allowed', {
            status: 405
          }));
        }

        const body = await request.json();

        await logEvent(env, {
          type: body.type || 'action',
          ip,
          ua,
          ray,
          clientFp,
          geo,
          appVersion,
          meta: body.meta || {}
        });

        return withCors(json({ ok: true }));
      }

      if (url.pathname === '/api/pn-mappings/log-batch') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        if (request.method !== 'POST') {
          return withCors(new Response('Method Not Allowed', {
            status: 405
          }));
        }

        const body = await request.json();

        const logs = Array.isArray(body.logs)
          ? body.logs
          : [];

        await logEvents(env, logs.map((entry) => ({
          type: entry.type || 'action',
          ip,
          ua,
          ray,
          clientFp,
          geo,
          appVersion,
          meta: entry.meta || {}
        })));

        return withCors(json({ ok: true }));
      }

      if (url.pathname === '/api/pn-mappings/rates/history') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        const allowedCurrencies = await getAllowedRateCurrencies(env);

        if (request.method === 'GET') {
          const currency = String(url.searchParams.get('currency') || '').trim().toUpperCase();
          if (!/^[A-Z]{3}$/.test(currency) || !allowedCurrencies.has(currency)) {
            return withCors(json({ error: 'Invalid currency' }, 400));
          }
          const raw = await env.PN_MAPPINGS.get(`rate-history:${currency}`);
          let history = [];
          try {
            history = raw ? JSON.parse(raw) : [];
          } catch (_error) {
            history = [];
          }
          if (!Array.isArray(history)) history = [];
          return withCors(json({ currency, history: history.slice(-400) }));
        }

        if (request.method !== 'POST') {
          return withCors(new Response('Method Not Allowed', { status: 405 }));
        }

        const body = await request.json();
        const currency = String(body?.currency || '').trim().toUpperCase();
        const rate = Number(body?.rate);
        const date = String(body?.date || '').trim();
        const source = String(body?.source || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
        if (!/^[A-Z]{3}$/.test(currency) || !allowedCurrencies.has(currency)
          || !Number.isFinite(rate) || rate <= 0 || rate > 1000) {
          return withCors(json({ error: 'Invalid currency or rate' }, 400));
        }
        const requestedDate = Date.parse(`${date}T00:00:00.000Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(requestedDate)
          || new Date(requestedDate).toISOString().slice(0, 10) !== date) {
          return withCors(json({ error: 'Invalid date' }, 400));
        }
        const now = new Date();
        const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const dayOffset = Math.round((requestedDate - utcToday) / 86_400_000);
        if (Math.abs(dayOffset) > 1) {
          return withCors(json({ error: 'Date outside allowed range' }, 400));
        }

        const key = `rate-history:${currency}`;
        const raw = await env.PN_MAPPINGS.get(key);
        let history = [];
        try {
          history = raw ? JSON.parse(raw) : [];
        } catch (_error) {
          history = [];
        }
        if (!Array.isArray(history)) history = [];
        const existingIndex = history.findIndex((item) => item?.date === date);
        const existing = existingIndex >= 0 ? history[existingIndex] : null;
        let recorded = false;
        let updated = false;
        let today = existing || null;
        const roundedRate = Number(rate.toFixed(4));
        if (!existing) {
          today = { date, rate: roundedRate, ...(source ? { source } : {}) };
          history.push(today);
          recorded = true;
        } else if (Number(existing.rate) !== roundedRate) {
          today = { ...existing, rate: roundedRate, ...(source ? { source } : {}) };
          history[existingIndex] = today;
          updated = true;
        }
        if (recorded || updated) {
          history.sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
          history = history.slice(-400);
          await env.PN_MAPPINGS.put(key, JSON.stringify(history));
        }
        const previous = history
          .filter((item) => item?.date < date && Number.isFinite(Number(item?.rate)))
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;

        return withCors(json({ currency, date, recorded, updated, today, previous }));
      }

      if (
        url.pathname ===
        '/api/pn-mappings/internal-access'
      ) {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        if (request.method !== 'GET') {
          return withCors(new Response('Method Not Allowed', {
            status: 405
          }));
        }

        const raw = await env.PN_MAPPINGS.get(
          'note:hd-network-whitelist-v1'
        );

        let config = { ips: [] };

        try {
          config = raw
            ? JSON.parse(raw)
            : { ips: [] };
        } catch (_error) {
          config = { ips: [] };
        }

        const ips = Array.isArray(config.ips)
          ? config.ips
              .map((item) => String(item || '').trim())
              .filter(Boolean)
          : [];

        return withCors(json({
          allowed: ips.includes(ip)
        }));
      }

      if (url.pathname === '/api/pn-mappings/notes') {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        const id = url.searchParams.get('id');

        if (!id) {
          return withCors(json({
            error: 'Missing id'
          }, 400));
        }

        const key = `note:${id}`;

        if (request.method === 'GET') {
          const note = await env.PN_MAPPINGS.get(key);

          return withCors(json({
            id,
            note: note || ''
          }));
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          const note = String(body?.note || '');

          if (note) {
            await env.PN_MAPPINGS.put(key, note);
          } else {
            await env.PN_MAPPINGS.delete(key);
          }

          return withCors(json({ ok: true }));
        }

        if (request.method === 'DELETE') {
          await env.PN_MAPPINGS.delete(key);
          return withCors(json({ ok: true }));
        }

        return withCors(new Response('Method Not Allowed', {
          status: 405
        }));
      }

      if (
        url.pathname ===
        '/api/pn-mappings/report-kind'
      ) {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        const id = url.searchParams.get('id');

        if (!id) {
          return withCors(json({
            error: 'Missing id'
          }, 400));
        }

        const raw = await env.PN_MAPPINGS.get(
          'report-kinds'
        );

        const map = raw
          ? JSON.parse(raw)
          : {};

        if (request.method === 'GET') {
          return withCors(json({
            id,
            kind: map[id] || ''
          }));
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          const kind = String(body?.kind || '');

          if (kind) {
            map[id] = kind;
          } else {
            delete map[id];
          }

          await env.PN_MAPPINGS.put(
            'report-kinds',
            JSON.stringify(map)
          );

          return withCors(json({ ok: true }));
        }

        return withCors(new Response('Method Not Allowed', {
          status: 405
        }));
      }

      if (
        url.pathname ===
        '/api/pn-mappings/migrate-logs'
      ) {
        const token = request.headers.get('X-Auth-Token');

        if (!token || token !== env.AUTH_TOKEN) {
          return withCors(json({ error: 'Unauthorized' }, 401));
        }

        if (request.method !== 'POST') {
          return withCors(new Response('Method Not Allowed', {
            status: 405
          }));
        }

        const body = await request.json();
        const targetVersion = String(body?.version || '');
        const apply = !!body?.apply;
        const dedup = !!body?.dedup;
        const mode = String(body?.mode || 'full');

        const raw = await env.PN_MAPPINGS.get('audit');

        const logs = raw
          ? JSON.parse(raw)
          : [];

        await env.PN_MAPPINGS.put(
          'audit_backup',
          JSON.stringify(logs)
        );

        await env.PN_MAPPINGS.put(
          'audit_backup_ts',
          new Date().toISOString()
        );

        let updated = 0;
        const previewItems = [];
        const dedupCandidates = [];

        const isReportLike = (entry) => {
          if (!entry) return false;
          if (entry.type === 'mapping-report') return true;

          const meta = entry?.meta || {};

          return !!(
            meta.report
            || meta.reportId
            || meta.reason
            || meta.query
            || meta.suggestedVendor
            || meta.kind
          );
        };

        const buildSafeDedupKey = (entry) => {
          const meta = entry?.meta || {};
          const report = meta.report || {};
          const id = report.reportId || meta.reportId || '';

          if (!id) return '';

          const action = meta.action || '';

          return `RID:${id}|ACT:${action}`;
        };

        let dedupedLogs = logs;

        if (dedup || mode === 'dedup') {
          const reportLogs = logs.filter(isReportLike);
          const map = new Map();

          for (const entry of reportLogs) {
            const key = buildSafeDedupKey(entry);

            if (!key) continue;

            const previous = map.get(key);

            if (!previous) {
              map.set(key, entry);
              continue;
            }

            const previousTimestamp = previous.ts
              ? Date.parse(previous.ts)
              : 0;

            const nextTimestamp = entry.ts
              ? Date.parse(entry.ts)
              : 0;

            if (nextTimestamp >= previousTimestamp) {
              map.set(key, entry);
            }
          }

          const keep = new Set(map.values());

          dedupedLogs = logs.filter(
            (entry) =>
              !isReportLike(entry) || keep.has(entry)
          );

          if (!apply) {
            reportLogs.forEach((entry) => {
              const key = buildSafeDedupKey(entry);

              if (key && !keep.has(entry)) {
                dedupCandidates.push(entry);
              }
            });
          }
        }

        const logsToProcess =
          mode === 'dedup'
            ? dedupedLogs
            : logs;

        const migrated = logsToProcess.map((entry) => {
          const meta = entry?.meta || {};
          const report = meta.report || {};

          const current =
            report.appVersion
            || meta.appVersion
            || '';

          const needVersion =
            targetVersion
            && current !== targetVersion;

          const needId = !entry.logId;

          if (needVersion || needId) {
            const next = structuredClone(entry);

            if (!next.logId) {
              next.logId = genLogId();
            }

            if (needVersion) {
              if (!next.meta) next.meta = {};
              if (!next.meta.report) {
                next.meta.report = {};
              }

              next.meta.report.appVersion =
                targetVersion;
            }

            updated += 1;

            if (!apply) {
              previewItems.push({
                before: entry,
                after: next,
                id: next.logId,
                ts: next.ts
              });
            }

            return next;
          }

          return entry;
        });

        if (apply) {
          const finalLogs =
            mode === 'dedup'
              ? dedupedLogs
              : (
                  dedup
                    ? dedupedLogs.map((entry) => {
                        const meta = entry?.meta || {};
                        const report = meta.report || {};

                        const current =
                          report.appVersion
                          || meta.appVersion
                          || '';

                        const needVersion =
                          targetVersion
                          && current !== targetVersion;

                        const needId = !entry.logId;

                        if (needVersion || needId) {
                          const next =
                            structuredClone(entry);

                          if (!next.logId) {
                            next.logId = genLogId();
                          }

                          if (needVersion) {
                            if (!next.meta) {
                              next.meta = {};
                            }

                            if (!next.meta.report) {
                              next.meta.report = {};
                            }

                            next.meta.report.appVersion =
                              targetVersion;
                          }

                          return next;
                        }

                        return entry;
                      })
                    : migrated
                );

          await env.PN_MAPPINGS.put(
            'audit',
            JSON.stringify(finalLogs)
          );
        }

        return withCors(json({
          updated,
          items: previewItems,
          dedup: dedupCandidates,
          targetVersion
        }));
      }

      return withCors(json({
        error: 'Not Found'
      }, 404));
    } catch (err) {
      const status = Number(err?.status) || 500;

      return withCors(json({
        error: err?.message || 'Server error',
        code: err?.code || 'SERVER_ERROR'
      }, status));
    }
  }
};

const USAGE_GRAPHQL_ENDPOINT =
  'https://api.cloudflare.com/client/v4/graphql';

const USAGE_CACHE_TTL_MS = 60_000;

let usageMemoryCache = {
  key: '',
  expiresAt: 0,
  payload: null
};

async function getCloudflareUsage(env) {
  const required = {
    CF_ACCOUNT_ID: env.CF_ACCOUNT_ID,
    CF_API_TOKEN: env.CF_API_TOKEN,
    CF_WORKER_SCRIPT_NAME: env.CF_WORKER_SCRIPT_NAME,
    CF_KV_NAMESPACE_ID: env.CF_KV_NAMESPACE_ID
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !String(value || '').trim())
    .map(([key]) => key);

  if (missing.length) {
    const error = new Error(
      `Brak zmiennych: ${missing.join(', ')}`
    );

    error.status = 503;
    error.code = 'USAGE_NOT_CONFIGURED';

    throw error;
  }

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const start = `${day}T00:00:00.000Z`;
  const end = now.toISOString();

  const cacheKey = [
    day,
    required.CF_ACCOUNT_ID,
    required.CF_WORKER_SCRIPT_NAME,
    required.CF_KV_NAMESPACE_ID,
    String(env.CF_PLAN || 'free').toLowerCase()
  ].join(':');

  if (
    usageMemoryCache.key === cacheKey
    && usageMemoryCache.payload
    && usageMemoryCache.expiresAt > Date.now()
  ) {
    return {
      ...usageMemoryCache.payload,
      cached: true
    };
  }

  const query = `
    query WorkerAndKvUsage(
      $accountTag: string!
      $scriptName: string!
      $datetimeStart: string!
      $datetimeEnd: string!
      $date: Date!
      $namespaceId: string!
    ) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 10000
            filter: {
              scriptName: $scriptName
              datetime_geq: $datetimeStart
              datetime_leq: $datetimeEnd
            }
          ) {
            sum {
              requests
            }
          }

          kvOperationsAdaptiveGroups(
            limit: 100
            filter: {
              namespaceId: $namespaceId
              date_geq: $date
              date_leq: $date
            }
          ) {
            sum {
              requests
            }

            dimensions {
              actionType
            }
          }
        }
      }
    }
  `;

  const response = await fetch(
    USAGE_GRAPHQL_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Authorization:
          `Bearer ${required.CF_API_TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        variables: {
          accountTag: required.CF_ACCOUNT_ID,
          scriptName:
            required.CF_WORKER_SCRIPT_NAME,
          datetimeStart: start,
          datetimeEnd: end,
          date: day,
          namespaceId:
            required.CF_KV_NAMESPACE_ID
        }
      })
    }
  );

  const result = await response
    .json()
    .catch(() => null);

  if (
    !response.ok
    || !result
    || (
      Array.isArray(result.errors)
      && result.errors.length
    )
  ) {
    const details = Array.isArray(result?.errors)
      ? result.errors
          .map((item) => item?.message)
          .filter(Boolean)
          .join('; ')
      : '';

    const error = new Error(
      details
      || `Cloudflare Analytics HTTP ${response.status}`
    );

    error.status = 502;
    error.code = 'USAGE_ANALYTICS_ERROR';

    throw error;
  }

  const account =
    result?.data?.viewer?.accounts?.[0];

  if (!account) {
    const error = new Error(
      'Cloudflare Analytics returned no account data'
    );

    error.status = 502;
    error.code = 'USAGE_ANALYTICS_EMPTY';

    throw error;
  }

  const workerRequests = sumAnalyticsRequests(
    account.workersInvocationsAdaptive
  );

  const kv = sumKvOperations(
    account.kvOperationsAdaptiveGroups
  );

  const plan =
    String(env.CF_PLAN || 'free').toLowerCase()
      === 'paid'
      ? 'paid'
      : 'free';

  const limits = plan === 'free'
    ? {
        workerRequests: 100000,
        kvReads: 100000,
        kvWrites: 1000,
        kvDeletes: 1000,
        kvLists: 1000
      }
    : {
        workerRequests: null,
        kvReads: null,
        kvWrites: null,
        kvDeletes: null,
        kvLists: null
      };

  const resetAt = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  )).toISOString();

  const payload = {
    date: day,
    plan,
    source: 'cloudflare-graphql',
    measuredAt: end,
    resetAt,

    worker: {
      requests: workerRequests,
      limit: limits.workerRequests
    },

    kv: {
      ...kv,

      limits: {
        reads: limits.kvReads,
        writes: limits.kvWrites,
        deletes: limits.kvDeletes,
        lists: limits.kvLists
      }
    }
  };

  usageMemoryCache = {
    key: cacheKey,
    expiresAt:
      Date.now() + USAGE_CACHE_TTL_MS,
    payload
  };

  return payload;
}

function sumAnalyticsRequests(rows) {
  return (
    Array.isArray(rows)
      ? rows
      : []
  ).reduce(
    (total, row) =>
      total + (Number(row?.sum?.requests) || 0),
    0
  );
}

function sumKvOperations(rows) {
  const totals = {
    reads: 0,
    writes: 0,
    deletes: 0,
    lists: 0
  };

  for (
    const row of Array.isArray(rows)
      ? rows
      : []
  ) {
    const action = String(
      row?.dimensions?.actionType || ''
    ).toLowerCase();

    const requests =
      Number(row?.sum?.requests) || 0;

    if (action.includes('read')) {
      totals.reads += requests;
    } else if (action.includes('write')) {
      totals.writes += requests;
    } else if (action.includes('delete')) {
      totals.deletes += requests;
    } else if (action.includes('list')) {
      totals.lists += requests;
    }
  }

  return totals;
}

function genLogId() {
  const random = Math.random()
    .toString(36)
    .slice(2, 8);

  return `L-${Date.now().toString(36)}${random}`;
}

function json(payload, status = 200) {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8'
      }
    }
  );
}

function withCors(response) {
  response.headers.set(
    'Access-Control-Allow-Origin',
    '*'
  );

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, PUT, POST, DELETE, OPTIONS'
  );

  response.headers.set(
    'Access-Control-Allow-Headers',
    [
      'Content-Type',
      'X-Auth-Token',
      'X-Client-FP',
      'X-App-Version'
    ].join(', ')
  );

  return response;
}

async function logEvent(env, entry) {
  return logEvents(env, [entry]);
}

async function logEvents(env, entries) {
  const incoming = Array.isArray(entries)
    ? entries
    : [];

  if (!incoming.length) return;

  const key = 'audit';

  const raw = await env.PN_MAPPINGS.get(key);

  const logs = raw
    ? JSON.parse(raw)
    : [];

  for (const entry of incoming) {
    logs.push({
      logId: genLogId(),
      type: entry.type,
      ip: entry.ip || 'unknown',
      ua: entry.ua || 'unknown',
      ray: entry.ray || 'unknown',
      clientFp: entry.clientFp || 'unknown',
      geo: entry.geo || {},

      meta: {
        ...(entry.meta || {}),

        ...(entry.appVersion
          ? { appVersion: entry.appVersion }
          : {})
      },

      ts: new Date().toISOString()
    });
  }

  const trimmed = logs.slice(-2000);

  await env.PN_MAPPINGS.put(
    key,
    JSON.stringify(trimmed)
  );
}
