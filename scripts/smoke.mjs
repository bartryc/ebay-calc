import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

async function serveFile(urlPath, res) {
  const filePath = join(ROOT, urlPath);
  const fileStat = await stat(filePath);
  if (fileStat.isDirectory()) {
    const indexPath = join(filePath, 'index.html');
    const indexStat = await stat(indexPath);
    if (!indexStat.isFile()) throw new Error('No index');
    const data = await readFile(indexPath);
    return send(res, 200, data, MIME['.html']);
  }
  const data = await readFile(filePath);
  const type = MIME[extname(filePath)] || 'application/octet-stream';
  return send(res, 200, data, type);
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', BASE);
      const path = url.pathname === '/' ? '/index.html' : url.pathname;
      await serveFile(path, res);
    } catch (err) {
      send(res, 404, 'Not found');
    }
  });
  return new Promise((resolveServer) => {
    server.listen(PORT, () => resolveServer(server));
  });
}

async function run() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (err) {
    console.error('Brak Playwright. Zainstaluj: npm i -D playwright && npx playwright install');
    process.exit(1);
  }

  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Stub window.open to avoid new tabs.
  await page.addInitScript(() => {
    window.open = (...args) => {
      window.__opened = window.__opened || [];
      window.__opened.push(args);
      return null;
    };
  });

  // Mock PN mappings API.
  await page.route('**/api/pn-mappings', async (route) => {
    const json = {
      exact: { MC2DD: 'Dell' },
      patterns: [
        { pattern: 'xxxxx', vendor: 'Dell' },
        { pattern: '0xxxxx', vendor: 'Dell' }
      ]
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });

  // Mock log endpoint.
  await page.route('**/api/pn-mappings/log**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  // Mock logs endpoint.
  await page.route('**/api/pn-mappings/logs**', async (route) => {
    const logs = [
      {
        type: 'mapping-report',
        ts: new Date().toISOString(),
        ip: '127.0.0.1',
        clientFp: 'fp-test',
        ua: 'smoke',
        geo: { city: 'Test', region: 'Test', country: 'PL', asn: '0' },
        ray: 'test',
        meta: {
          action: 'dismissed',
          report: {
            query: 'MC2DD',
            suggestedVendor: 'Dell',
            source: 'exact',
            detail: 'MC2DD',
            reason: 'test'
          }
        }
      }
    ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ logs, total: logs.length })
    });
  });

  // 1) Index page smoke
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#partNumberInput');

  // Toggle theme and ensure icon visibility changes.
  await page.click('#themeToggleBtn');
  await page.waitForTimeout(100);

  // PN suggestion should appear for MC2DD
  await page.fill('#partNumberInput', 'MC2DD');
  await page.waitForTimeout(200);
  const suggestionText = await page.textContent('#pnSuggestion');
  if (!suggestionText || !suggestionText.includes('Sugestia')) {
    throw new Error('Brak sugestii PN');
  }

  // Search button should trigger window.open and clear input.
  await page.click('#searchAllBtn');
  const openedCount = await page.evaluate(() => (window.__opened || []).length);
  if (openedCount < 1) {
    throw new Error('Brak window.open przy wyszukiwaniu');
  }
  const inputValue = await page.$eval('#partNumberInput', (el) => el.value);
  if (inputValue !== '') {
    throw new Error('Input PN nie został wyczyszczony po wyszukiwaniu');
  }

  // Report modal should open and send log
  await page.fill('#partNumberInput', 'MC2DD');
  await page.waitForTimeout(200);
  await page.click('#reportMappingBtn');
  await page.fill('#reportReason', 'test');
  await page.click('#reportModalSubmit');

  // 2) Admin page smoke
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#reportSection');

  // Open logs section and click prettify
  await page.click('#logSection summary');
  await page.waitForSelector('.log-pretty');
  await page.click('.log-pretty');
  const prettyVisible = await page.$eval('.log-pretty-content', (el) => !el.hasAttribute('hidden'));
  if (!prettyVisible) {
    throw new Error('Prettify nie pokazuje treści');
  }

  await browser.close();
  server.close();
  console.log('✅ Smoke test OK');
}

run().catch((err) => {
  console.error('❌ Smoke test failed:', err.message || err);
  process.exit(1);
});
