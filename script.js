let lastChanged = null;
let originalEbayPrice = null;
let originalCurrency = 'EUR';
let originalExchangeRate = 4.3;
let lastCurrency = 'EUR';
let currentExchangeRate = 4.3;
const VAT23 = 0.23;
const DEFAULT_RATES = { EUR: 4.3, USD: 3.9, GBP: 5.0 };
const RATE_PROVIDERS = {
  frankfurter: {
    label: 'Frankfurter',
    buildUrl: (currency) => `https://api.frankfurter.app/latest?from=PLN&to=${currency}`,
    readRate: (data, currency) => data?.rates?.[currency]
  },
  exchangerate: {
    label: 'exchangerate.host',
    buildUrl: (currency) => `https://api.exchangerate.host/latest?base=PLN&symbols=${currency}`,
    readRate: (data, currency) => data?.rates?.[currency]
  },
  erapi: {
    label: 'open.er-api.com',
    buildUrl: () => 'https://open.er-api.com/v6/latest/PLN',
    readRate: (data, currency) => data?.rates?.[currency]
  }
};
const rateStatusCache = {};
let isPresetApplied = false;
const numberFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
let selfTestHideTimer = null;
const historyEntries = [];
const historyTimers = {};
let lastHistorySignature = '';
let lastClearedHistory = [];
let restoreHistoryTimer = null;
const fieldBaselines = {};
const lastLoggedValues = {};
const mainToastStack = document.getElementById('mainToastStack');
const activityLogCache = {};

function getFieldElement(source) {
  const map = {
    netto: 'plnNetto',
    brutto: 'plnBrutto',
    ebayPrice: 'ebayPrice',
    vatRate: 'vatRate',
    exchangeRate: 'exchangeRate',
    commission: 'commission'
  };
  const id = map[source] || source;
  return document.getElementById(id);
}

function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0';
  return numberFormatter.format(value);
}

function hideSelfTestDetails() {}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(2);
}

function updateBaseMultiplier() {
  const multiplierEl = document.getElementById('baseMultiplierValue');
  if (!multiplierEl) return;
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const vatRateRaw = parseNumber(document.getElementById('vatRate').value);
  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw / 100 : NaN;

  if (!Number.isFinite(exchangeRate) || !Number.isFinite(commission) || !Number.isFinite(vatRate)) {
    multiplierEl.textContent = '—';
    multiplierEl.dataset.value = '';
    return;
  }

  const bruttoClient = 1 * (1 + vatRate);
  const priceInCurrency = bruttoClient * exchangeRate;
  const finalPriceMultiplier = priceInCurrency * (1 + commission);
  const multiplierBrutto = finalPriceMultiplier / (1 + VAT23);
  const formatted = multiplierBrutto.toFixed(4);
  multiplierEl.textContent = formatted;
  multiplierEl.dataset.value = formatted;
}

function openSearch(urlBase, query) {
  const trimmed = query.trim();
  if (!trimmed) return false;
  const url = `${urlBase}${encodeURIComponent(trimmed)}`;
  window.open(url, '_blank', 'noopener');
  return true;
}

function showMainToast(message, variant = 'info') {
  if (!mainToastStack) return;
  const maxToasts = 6;
  while (mainToastStack.children.length >= maxToasts) {
    mainToastStack.firstElementChild?.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'mapping-toast';
  if (variant === 'warn') toast.classList.add('is-warn');
  if (variant === 'info') toast.classList.add('is-info');
  if (variant === 'success' || variant === 'ok') toast.classList.add('is-ok');
  toast.textContent = message || '';
  mainToastStack.append(toast);
  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 200);
  }, 6000);
}

function logActivity(type, meta = {}) {
  if (!window.PN_MAPPINGS_API?.log) return;
  const key = `${type}:${JSON.stringify(meta).slice(0, 200)}`;
  const now = Date.now();
  if (activityLogCache[key] && now - activityLogCache[key] < 10000) {
    return;
  }
  activityLogCache[key] = now;
  window.PN_MAPPINGS_API.log(type, meta);
}

function normalizePnValue(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function getBestPatternMatch(patterns, normalized) {
  if (!Array.isArray(patterns) || !window.PN_MAPPINGS_API?.matchPattern) return null;
  const scored = [];
  for (const rule of patterns) {
    if (!rule?.pattern || !rule?.vendor) continue;
    if (!window.PN_MAPPINGS_API.matchPattern(rule.pattern, normalized)) continue;
    const pattern = String(rule.pattern).toUpperCase();
    let literalCount = 0;
    let wildcardCount = 0;
    for (const char of pattern) {
      if (char === 'X' || char === '*' || char === '+') {
        wildcardCount += 1;
      } else {
        literalCount += 1;
      }
    }
    scored.push({
      vendor: rule.vendor,
      pattern,
      literalCount,
      wildcardCount,
      length: pattern.length
    });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => {
    if (b.literalCount !== a.literalCount) return b.literalCount - a.literalCount;
    if (b.length !== a.length) return b.length - a.length;
    return a.wildcardCount - b.wildcardCount;
  });
  return scored[0];
}

function resolvePnManufacturer(value) {
  const normalized = normalizePnValue(value);
  if (!normalized) return { vendor: '', source: '' };
  if (/^\d{6}-\d{3}$/.test(normalized)) {
    return { vendor: 'HPE', source: 'rule', detail: 'xxxxxx-xxx' };
  }
  const data = window.PN_MAPPINGS_API?.get?.() || { exact: {}, patterns: [] };
  const hasMappings = (data.exact && Object.keys(data.exact).length > 0)
    || (Array.isArray(data.patterns) && data.patterns.length > 0);
  if (data.exact && data.exact[normalized]) {
    return { vendor: data.exact[normalized], source: 'exact', detail: normalized };
  }
  if (normalized.length < 5) return { vendor: '', source: '' };
  const best = getBestPatternMatch(data.patterns, normalized);
  if (best) {
    return { vendor: best.vendor, source: 'pattern', detail: best.pattern };
  }
  if (hasMappings) return { vendor: '', source: '' };
  if (normalized.length === 5) return { vendor: 'Dell', source: 'fallback', detail: 'xxxxx' };
  if (normalized.length === 6 && normalized.startsWith('0')) {
    return { vendor: 'Dell', source: 'fallback', detail: '0xxxxx' };
  }
  return { vendor: '', source: '' };
}

function enforceTwoDecimals(inputEl) {
  const raw = inputEl.value;
  if (!raw) return;
  const normalized = raw.replace(',', '.');
  const match = normalized.match(/^-?\d*(?:\.\d{0,2})?/);
  if (!match) return;
  const next = match[0];
  if (next !== raw) {
    inputEl.value = next;
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const restoreBtn = document.getElementById('restoreHistoryBtn');
  if (!list) return;
  if (!historyEntries.length) {
    list.innerHTML = '<div class="history-item"><strong>Brak wpisów</strong><div class="history-meta">Wprowadź dane, aby pojawiła się historia.</div></div>';
    if (!lastClearedHistory.length) {
      restoreBtn.style.display = 'none';
    }
    return;
  }
  list.innerHTML = historyEntries
    .slice(0, 8)
    .map((entry, index) => (
      `<div class="history-item">
        <div class="history-row">
          <strong>${entry.title}</strong>
          <div class="history-actions-inline">
            <button type="button" class="history-copy" data-index="${index}" aria-label="Kopiuj brutto">
              <svg class="history-copy-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
              </svg>
            </button>
            <button type="button" class="history-remove" data-index="${index}" aria-label="Usuń wpis">×</button>
          </div>
        </div>
        <div class="history-summary">${entry.summary}</div>
        <div class="history-meta">${entry.meta} · ${entry.timestamp}</div>
      </div>`
    ))
    .join('');
}

const baseMultiplierValue = document.getElementById('baseMultiplierValue');
if (baseMultiplierValue) {
  baseMultiplierValue.addEventListener('click', () => {
    const value = baseMultiplierValue.dataset.value;
    if (!value) {
      showMainToast('Brak wartości do skopiowania.', 'warn');
      return;
    }
    navigator.clipboard.writeText(value)
      .then(() => {
        showMainToast('Skopiowano mnożnik do schowka.', 'success');
      })
      .catch(() => {
        showMainToast('Nie udało się skopiować mnożnika.', 'warn');
      });
  });
}

function addHistoryEntry(source) {
  const netto = parseNumber(document.getElementById('plnNetto').value);
  const brutto = parseNumber(document.getElementById('plnBrutto').value);
  const ebayPrice = parseNumber(document.getElementById('ebayPrice').value);
  const currency = document.getElementById('currency').value;
  const vatRateRaw = parseNumber(document.getElementById('vatRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);

  const sourceLabel = {
    netto: 'ERP netto',
    brutto: 'ERP brutto',
    ebayPrice: 'eBay',
    vatRate: 'VAT',
    currency: 'Waluta',
    exchangeRate: 'Kurs',
    commission: 'Prowizja',
    preset: 'Preset'
  }[source] || 'Przeliczenie';

  const timestamp = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const details = [
    `Netto <span class="history-value">${formatCurrency(netto)}</span> PLN`,
    `Brutto <span class="history-value">${formatCurrency(brutto)}</span> PLN`,
    `eBay <span class="history-value">${formatCurrency(ebayPrice)}</span> ${currency}`
  ].join(' <span class="history-dot">•</span> ');
  const meta = [
    `VAT ${Number.isFinite(vatRateRaw) ? vatRateRaw.toFixed(1) : '-'}%`,
    `Prowizja ${Number.isFinite(commissionRaw) ? commissionRaw.toFixed(1) : '-'}%`,
    `Kurs 1 PLN = ${Number.isFinite(exchangeRate) ? exchangeRate.toFixed(4) : '-'} ${currency}`
  ].join(' <span class="history-dot">•</span> ');

  if (!Number.isFinite(netto) && !Number.isFinite(brutto) && !Number.isFinite(ebayPrice)) {
    return;
  }

  const signature = `${sourceLabel}|${details}|${meta}`;
  if (signature === lastHistorySignature) {
    return;
  }
  lastHistorySignature = signature;
  const loggedEl = getFieldElement(source);
  if (loggedEl) {
    lastLoggedValues[source] = loggedEl.value;
  }

  historyEntries.unshift({
    title: sourceLabel,
    summary: details,
    meta,
    bruttoValue: Number.isFinite(brutto) ? brutto.toFixed(2) : '',
    timestamp
  });

  if (historyEntries.length > 20) {
    historyEntries.pop();
  }
  renderHistory();
  logActivity('calc', {
    source: sourceLabel,
    netto: Number.isFinite(netto) ? netto.toFixed(2) : null,
    brutto: Number.isFinite(brutto) ? brutto.toFixed(2) : null,
    ebay: Number.isFinite(ebayPrice) ? ebayPrice.toFixed(2) : null,
    currency,
    vat: Number.isFinite(vatRateRaw) ? vatRateRaw.toFixed(1) : null,
    commission: Number.isFinite(commissionRaw) ? commissionRaw.toFixed(1) : null,
    rate: Number.isFinite(exchangeRate) ? exchangeRate.toFixed(4) : null
  });
}

function setFieldBaseline(source) {
  const el = getFieldElement(source);
  if (!el) return;
  fieldBaselines[source] = el.value;
}

function hasFieldChanged(source) {
  const el = getFieldElement(source);
  if (!el) return false;
  const baseline = fieldBaselines[source];
  if (baseline === undefined) return el.value !== '';
  return el.value !== baseline;
}

function hasValueChangedSinceLog(source) {
  const el = getFieldElement(source);
  if (!el) return false;
  const lastLogged = lastLoggedValues[source];
  return el.value !== lastLogged;
}

function scheduleHistoryLog(source) {
  if (!hasValueChangedSinceLog(source)) return;
  if (historyTimers[source]) {
    clearTimeout(historyTimers[source]);
  }
  historyTimers[source] = setTimeout(() => {
    addHistoryEntry(source);
    historyTimers[source] = null;
  }, 700);
}

function flushHistoryLog(source) {
  if (historyTimers[source]) {
    clearTimeout(historyTimers[source]);
    historyTimers[source] = null;
  }
  if (!hasFieldChanged(source)) return;
  addHistoryEntry(source);
}

// Dark mode functionality
const themeToggleBtn = document.getElementById('themeToggleBtn');
const body = document.body;

// Load theme from localStorage
if (localStorage.getItem('theme') === 'dark') {
  body.classList.add('dark-mode');
  themeToggleBtn.textContent = 'Włącz tryb jasny';
}

themeToggleBtn.addEventListener('click', () => {
  body.classList.toggle('dark-mode');
  if (body.classList.contains('dark-mode')) {
    themeToggleBtn.textContent = 'Włącz tryb jasny';
    localStorage.setItem('theme', 'dark');
  } else {
    themeToggleBtn.textContent = 'Włącz tryb ciemny';
    localStorage.setItem('theme', 'light');
  }
});

// Advanced options toggle
const advancedOptionsToggle = document.getElementById('advancedOptionsToggle');
const advancedOptions = document.getElementById('advancedOptions');
const exchangeRateInput = document.getElementById('exchangeRate');
const ebayCurrencyLabel = document.getElementById('ebayCurrencyLabel');

advancedOptionsToggle.addEventListener('change', () => {
  advancedOptions.style.display = advancedOptionsToggle.checked ? 'block' : 'none';
  exchangeRateInput.disabled = !advancedOptionsToggle.checked;
  hideSelfTestDetails();
  calculatePrice();
  if (advancedOptionsToggle.checked) {
    checkRateProvidersStatus(document.getElementById('currency').value);
  }
});

// Update eBay currency label with VAT rate
function updateEbayCurrencyLabel() {
  const currency = document.getElementById('currency').value;
  const vatRateInput = document.getElementById('vatRate');
  const vatRate = parseNumber(vatRateInput.value);
  const vatRateDisplay = Number.isFinite(vatRate) ? vatRate : 0;
  ebayCurrencyLabel.innerText = `${currency} (z VAT ${formatPercent(vatRateDisplay)}%)`;
}

// Clear button handler
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('plnNetto').value = '';
  document.getElementById('plnBrutto').value = '';
  document.getElementById('ebayPrice').value = '';
  document.getElementById('vatRate').value = '23';
  document.getElementById('commission').value = '15';
  document.getElementById('productId').value = '';
  document.getElementById('currency').value = 'EUR';
  document.getElementById('currencyLabel').innerText = 'EUR';
  updateEbayCurrencyLabel(); // Ensure label updates with default VAT 23%
  advancedOptionsToggle.checked = false;
  advancedOptions.style.display = 'none';
  exchangeRateInput.disabled = true;
  lastChanged = null;
  originalEbayPrice = null;
  originalCurrency = 'EUR';
  lastCurrency = 'EUR';
  hideSelfTestDetails();
  historyEntries.length = 0;
  renderHistory();
  fetchExchangeRate('EUR');
});

function syncFields(source) {
  const nettoInput = document.getElementById('plnNetto');
  const bruttoInput = document.getElementById('plnBrutto');
  const ebayPriceInput = document.getElementById('ebayPrice');
  const vatRateInput = document.getElementById('vatRate');
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const vatRateRaw = parseNumber(vatRateInput.value);
  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw / 100 : NaN;
  const resultDiv = document.getElementById('result');

  // Validate negative inputs
  if (source === 'netto' && Number.isFinite(parseNumber(nettoInput.value)) && parseNumber(nettoInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Kwota netto nie może być ujemna.</span>';
    return;
  }
  if (source === 'brutto' && Number.isFinite(parseNumber(bruttoInput.value)) && parseNumber(bruttoInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Kwota brutto nie może być ujemna.</span>';
    return;
  }
  if (source === 'ebayPrice' && Number.isFinite(parseNumber(ebayPriceInput.value)) && parseNumber(ebayPriceInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Cena na eBay nie może być ujemna.</span>';
    return;
  }
  if (source === 'vatRate' && Number.isFinite(parseNumber(vatRateInput.value)) && parseNumber(vatRateInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Stawka VAT nie może być ujemna.</span>';
    return;
  }

  if (source === 'netto' && Number.isFinite(parseNumber(nettoInput.value))) {
    const netto = parseNumber(nettoInput.value);
    bruttoInput.value = (netto * (1 + VAT23)).toFixed(2);
    if (validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
      const bruttoClient = netto * (1 + vatRate);
      const priceInCurrency = bruttoClient * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'brutto' && Number.isFinite(parseNumber(bruttoInput.value))) {
    const brutto = parseNumber(bruttoInput.value);
    const netto = brutto / (1 + VAT23);
    nettoInput.value = netto.toFixed(2);
    if (validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
      const bruttoClient = netto * (1 + vatRate);
      const priceInCurrency = bruttoClient * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'ebayPrice' && Number.isFinite(parseNumber(ebayPriceInput.value))) {
    const ebayPrice = parseNumber(ebayPriceInput.value);
    if (validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
      const priceInCurrency = ebayPrice / (1 + commission);
      const bruttoClient = priceInCurrency / exchangeRate;
      const netto = bruttoClient / (1 + vatRate);
      nettoInput.value = netto.toFixed(2);
      bruttoInput.value = (netto * (1 + VAT23)).toFixed(2);
      originalEbayPrice = ebayPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'vatRate' && Number.isFinite(parseNumber(vatRateInput.value))) {
    const vatRatePercent = Math.max(0, Math.min(100, parseNumber(vatRateInput.value)));
    vatRateInput.value = vatRatePercent.toString();
    updateEbayCurrencyLabel();
    const vatRateDecimal = vatRatePercent / 100;
    let netto = parseNumber(nettoInput.value);
    if (!Number.isFinite(netto)) {
      const brutto = parseNumber(bruttoInput.value);
      if (Number.isFinite(brutto)) {
        netto = brutto / (1 + VAT23);
        nettoInput.value = netto.toFixed(2);
      }
    }
    if (Number.isFinite(netto) && netto > 0 && validateInputs(exchangeRate, commission, vatRateDecimal, resultDiv)) {
      const bruttoClient = netto * (1 + vatRateDecimal);
      const priceInCurrency = bruttoClient * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
      bruttoInput.value = (netto * (1 + VAT23)).toFixed(2);
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    } else {
      resultDiv.innerHTML = '<span class="error">Wpisz kwotę netto lub brutto, aby przeliczyć cenę z nową stawką VAT.</span>';
      return;
    }
  }

  calculatePrice();
}

function validateInputs(exchangeRate, commission, vatRate, resultDiv) {
  if (isNaN(exchangeRate) || exchangeRate <= 0) {
    resultDiv.innerHTML = '<span class="error">Kurs waluty musi być dodatni.</span>';
    return false;
  }
  if (isNaN(commission) || commission < 0) {
    resultDiv.innerHTML = '<span class="error">Prowizja nie może być ujemna.</span>';
    return false;
  }
  if (isNaN(vatRate) || vatRate < 0 || vatRate > 1) {
    resultDiv.innerHTML = '<span class="error">Stawka VAT musi być w przedziale 0-100%.</span>';
    return false;
  }
  return true;
}

function calculatePrice() {
  const netto = parseNumber(document.getElementById('plnNetto').value);
  const brutto = parseNumber(document.getElementById('plnBrutto').value);
  const ebayPrice = parseNumber(document.getElementById('ebayPrice').value);
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const vatRateRaw = parseNumber(document.getElementById('vatRate').value);
  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw / 100 : NaN;
  const currency = document.getElementById('currency').value;
  const resultDiv = document.getElementById('result');

  if (!validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
    return;
  }

  const bruttoClient = 1 * (1 + vatRate);
  const priceInCurrency = bruttoClient * exchangeRate;
  const finalPriceMultiplier = priceInCurrency * (1 + commission);

  const multiplierNetto = finalPriceMultiplier;
  const multiplierBrutto = finalPriceMultiplier / (1 + VAT23);
  updateBaseMultiplier();

  let resultHTML = ``;

  if (isNaN(netto) && isNaN(brutto) && isNaN(ebayPrice)) {
    resultDiv.innerHTML = `<span class="error">Wprowadź kwotę netto, brutto lub cenę na eBay, aby zobaczyć cenę końcową.</span>`;
    resultDiv.classList.add('is-visible');
    return;
  }

  resultDiv.innerHTML = resultHTML;
  resultDiv.classList.toggle('is-visible', resultHTML.trim().length > 0);
}

function applyPreset(currency, vat) {
  isPresetApplied = true;
  document.getElementById('currency').value = currency;
  document.getElementById('vatRate').value = parseNumber(vat).toString();
  document.getElementById('currencyLabel').innerText = currency;
  ebayCurrencyLabel.innerText = `${currency} (z VAT ${formatPercent(parseNumber(vat))}%)`;
  lastChanged = 'vatRate';
  fetchExchangeRate(currency);
}

function convertEbayPrice(newRate) {
  if (originalEbayPrice === null || isNaN(originalEbayPrice) || originalExchangeRate === null) return null;
  return (originalEbayPrice / originalExchangeRate) * newRate;
}

function updateEbayPriceFromNettoOrBrutto() {
  const nettoInput = document.getElementById('plnNetto');
  const bruttoInput = document.getElementById('plnBrutto');
  const ebayPriceInput = document.getElementById('ebayPrice');
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const vatRateRaw = parseNumber(document.getElementById('vatRate').value);
  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw / 100 : NaN;

  if (lastChanged === 'netto' && Number.isFinite(parseNumber(nettoInput.value))) {
    const netto = parseNumber(nettoInput.value);
    if (validateInputs(exchangeRate, commission, vatRate, document.getElementById('result'))) {
      const bruttoClient = netto * (1 + vatRate);
      const priceInCurrency = bruttoClient * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
    }
  } else if (lastChanged === 'brutto' && Number.isFinite(parseNumber(bruttoInput.value))) {
    const brutto = parseNumber(bruttoInput.value);
    if (validateInputs(exchangeRate, commission, vatRate, document.getElementById('result'))) {
      const netto = brutto / (1 + VAT23);
      nettoInput.value = netto.toFixed(2);
      const bruttoClient = netto * (1 + vatRate);
      const priceInCurrency = bruttoClient * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
    }
  }
}

function fetchExchangeRate(currency, options = {}) {
  const exchangeInfo = document.getElementById('exchangeInfo');
  const exchangeRateInp = document.getElementById('exchangeRate');
  const ebayPriceInput = document.getElementById('ebayPrice');
  const rateSourceSelect = document.getElementById('rateSource');
  const providerKey = rateSourceSelect?.value || 'frankfurter';
  const provider = RATE_PROVIDERS[providerKey] || RATE_PROVIDERS.frankfurter;
  const notify = options.notify === true;
  exchangeInfo.innerText = 'Pobieranie kursu...';

  const ebayPriceValue = parseNumber(ebayPriceInput.value);
  const convertEbayPriceNeeded = Number.isFinite(ebayPriceValue) && lastChanged === 'ebayPrice' && lastCurrency !== currency && !isPresetApplied;
  const nettoValue = parseNumber(document.getElementById('plnNetto').value);
  const bruttoValue = parseNumber(document.getElementById('plnBrutto').value);
  const updateFromNettoOrBrutto = (Number.isFinite(nettoValue) || Number.isFinite(bruttoValue)) && (lastChanged === 'netto' || lastChanged === 'brutto');
  const oldCurrency = lastCurrency;
  lastCurrency = currency;

  const applyRate = (rate, providerLabel, providerKeyUsed) => {
    exchangeRateInp.value = rate.toFixed(4);
    currentExchangeRate = rate;
    const now = new Date();
    exchangeInfo.innerText = `Kurs PLN/${currency}: ${rate.toFixed(4)} (${now.toLocaleString('pl-PL')})`;
    if (notify && providerLabel) {
      showMainToast(`Kurs pobrany z: ${providerLabel}`, 'info');
    }
    if (rateSourceSelect && providerKeyUsed && rateSourceSelect.value !== providerKeyUsed) {
      rateSourceSelect.value = providerKeyUsed;
    }
    updateBaseMultiplier();

    if (convertEbayPriceNeeded) {
      const newEbayPrice = convertEbayPrice(rate);
      if (newEbayPrice !== null) {
        ebayPriceInput.value = newEbayPrice.toFixed(2);
        if (originalCurrency === currency) {
          ebayPriceInput.value = originalEbayPrice.toFixed(2);
        }
        lastChanged = 'ebayPrice';
        syncFields('ebayPrice');
      }
    } else if (updateFromNettoOrBrutto) {
      updateEbayPriceFromNettoOrBrutto();
      syncFields(lastChanged);
    } else if (Number.isFinite(ebayPriceValue) && lastChanged === 'ebayPrice') {
      syncFields('ebayPrice');
    } else if (isPresetApplied || lastChanged === 'vatRate') {
      syncFields('vatRate');
      if (isPresetApplied) {
        addHistoryEntry('preset');
      }
    } else {
      calculatePrice();
    }
    isPresetApplied = false;
  };

  const fetchRateFrom = (providerToUse) => fetch(providerToUse.buildUrl(currency))
    .then(response => {
      if (!response.ok) throw new Error('Błąd sieci');
      return response.json();
    })
    .then(data => {
      const rate = providerToUse.readRate(data, currency);
      if (!rate) throw new Error('Brak kursu dla wybranej waluty');
      return { rate, label: providerToUse.label };
    });

  fetchRateFrom(provider)
    .then(({ rate, label }) => {
      applyRate(rate, label, providerKey);
    })
    .catch(() => {
      const fallbackProvider = RATE_PROVIDERS.frankfurter;
      if (providerKey !== 'frankfurter' && fallbackProvider) {
        fetchRateFrom(fallbackProvider)
          .then(({ rate, label }) => {
            applyRate(rate, label, 'frankfurter');
            if (notify) {
              showMainToast(`Źródło ${provider.label} niedostępne. Użyto ${label}.`, 'warn');
            }
          })
          .catch(error => {
            console.error('Błąd pobierania kursu:', error);
            const fallbackRate = DEFAULT_RATES[currency] || 4.3;
            exchangeRateInp.value = fallbackRate.toFixed(4);
            currentExchangeRate = fallbackRate;
            exchangeInfo.innerText = `Błąd pobierania kursu. Użyto domyślnego kursu PLN/${currency}: ${fallbackRate.toFixed(4)}`;
            if (notify) {
              showMainToast(`Błąd pobierania kursu. Użyto domyślnego.`, 'warn');
            }
            updateBaseMultiplier();
            calculatePrice();
            isPresetApplied = false;
          });
        return;
      }
      const fallbackRate = DEFAULT_RATES[currency] || 4.3;
      exchangeRateInp.value = fallbackRate.toFixed(4);
      currentExchangeRate = fallbackRate;
      exchangeInfo.innerText = `Błąd pobierania kursu. Użyto domyślnego kursu PLN/${currency}: ${fallbackRate.toFixed(4)}`;
      if (notify) {
        showMainToast(`Błąd pobierania kursu. Użyto domyślnego.`, 'warn');
      }
      updateBaseMultiplier();
      calculatePrice();
      isPresetApplied = false;
    });
}

function updateRateStatusBadge(key, status) {
  const container = document.getElementById('rateStatusRow');
  if (!container) return;
  const el = container.querySelector(`[data-provider="${key}"]`);
  if (!el) return;
  el.classList.remove('is-ok', 'is-fail', 'is-loading');
  if (status) {
    el.classList.add(`is-${status}`);
  }
}

function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function checkRateProvidersStatus(currency) {
  const now = Date.now();
  Object.keys(RATE_PROVIDERS).forEach((key) => {
    const cached = rateStatusCache[key];
    if (cached && now - cached.ts < 60000) {
      updateRateStatusBadge(key, cached.status);
      return;
    }
    updateRateStatusBadge(key, 'loading');
    const provider = RATE_PROVIDERS[key];
    fetchWithTimeout(provider.buildUrl(currency), 5000)
      .then((resp) => {
        if (!resp.ok) throw new Error('status');
        return resp.json();
      })
      .then((data) => {
        const rate = provider.readRate(data, currency);
        const status = rate ? 'ok' : 'fail';
        rateStatusCache[key] = { ts: Date.now(), status };
        updateRateStatusBadge(key, status);
      })
      .catch(() => {
        rateStatusCache[key] = { ts: Date.now(), status: 'fail' };
        updateRateStatusBadge(key, 'fail');
      });
  });
}

// STOCK URL button handler
document.getElementById('stockUrlBtn').addEventListener('click', () => {
  const productId = document.getElementById('productId').value;
  if (/^\d{1,6}$/.test(productId)) {
    const url = `https://stock/product/product/details/${productId}`;
    window.open(url, '_blank');
  } else {
    document.getElementById('result').innerHTML = '<span class="error">ID produktu musi być liczbą od 1 do 6 cyfr.</span>';
  }
});

document.getElementById('plnNetto').addEventListener('input', () => {
  lastChanged = 'netto';
  hideSelfTestDetails();
  enforceTwoDecimals(document.getElementById('plnNetto'));
  syncFields('netto');
  scheduleHistoryLog('netto');
});
document.getElementById('plnNetto').addEventListener('focus', () => {
  setFieldBaseline('netto');
});
document.getElementById('plnNetto').addEventListener('blur', () => {
  flushHistoryLog('netto');
});

document.getElementById('plnBrutto').addEventListener('input', () => {
  lastChanged = 'brutto';
  hideSelfTestDetails();
  enforceTwoDecimals(document.getElementById('plnBrutto'));
  syncFields('brutto');
  scheduleHistoryLog('brutto');
});
document.getElementById('plnBrutto').addEventListener('focus', () => {
  setFieldBaseline('brutto');
});
document.getElementById('plnBrutto').addEventListener('blur', () => {
  flushHistoryLog('brutto');
});

document.getElementById('ebayPrice').addEventListener('input', () => {
  lastChanged = 'ebayPrice';
  hideSelfTestDetails();
  enforceTwoDecimals(document.getElementById('ebayPrice'));
  syncFields('ebayPrice');
  scheduleHistoryLog('ebayPrice');
});
document.getElementById('ebayPrice').addEventListener('focus', () => {
  setFieldBaseline('ebayPrice');
});
document.getElementById('ebayPrice').addEventListener('blur', () => {
  flushHistoryLog('ebayPrice');
});

document.getElementById('vatRate').addEventListener('input', () => {
  lastChanged = 'vatRate';
  hideSelfTestDetails();
  syncFields('vatRate');
  updateBaseMultiplier();
  scheduleHistoryLog('vatRate');
});
document.getElementById('vatRate').addEventListener('focus', () => {
  setFieldBaseline('vatRate');
});
document.getElementById('vatRate').addEventListener('blur', () => {
  flushHistoryLog('vatRate');
});

['exchangeRate', 'commission'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    hideSelfTestDetails();
    if (lastChanged === 'ebayPrice' && !isNaN(parseFloat(document.getElementById('ebayPrice').value))) {
      syncFields('ebayPrice');
    } else if ((lastChanged === 'netto' || lastChanged === 'brutto') && !isNaN(parseFloat(document.getElementById('plnNetto').value))) {
      syncFields(lastChanged);
    } else if (lastChanged === 'vatRate' && !isNaN(parseInt(document.getElementById('vatRate').value))) {
      syncFields('vatRate');
    } else {
      calculatePrice();
    }
    updateBaseMultiplier();
    scheduleHistoryLog(id);
  });
  document.getElementById(id).addEventListener('focus', () => {
    setFieldBaseline(id);
  });
  document.getElementById(id).addEventListener('blur', () => {
    flushHistoryLog(id);
  });
});

document.getElementById('currency').addEventListener('change', () => {
  const selectedCurrency = document.getElementById('currency').value;
  document.getElementById('currencyLabel').innerText = selectedCurrency;
  updateEbayCurrencyLabel();
  hideSelfTestDetails();
  fetchExchangeRate(selectedCurrency, { notify: false });
  checkRateProvidersStatus(selectedCurrency);
  addHistoryEntry('currency');
});

document.getElementById('refreshRateBtn').addEventListener('click', () => {
  fetchExchangeRate(document.getElementById('currency').value, { notify: true });
  addHistoryEntry('exchangeRate');
});

const rateSourceSelect = document.getElementById('rateSource');
if (rateSourceSelect) {
  rateSourceSelect.addEventListener('change', () => {
    fetchExchangeRate(document.getElementById('currency').value, { notify: true });
    checkRateProvidersStatus(document.getElementById('currency').value);
  });
}

updateEbayCurrencyLabel();
fetchExchangeRate(document.getElementById('currency').value, { notify: false });
renderHistory();
checkRateProvidersStatus(document.getElementById('currency').value);

document.getElementById('historyList').addEventListener('click', (event) => {
  const target = event.target;
  if (!target) return;
  const removeBtn = target.closest('.history-remove');
  const copyBtn = target.closest('.history-copy');

  if (removeBtn) {
    const index = parseInt(removeBtn.getAttribute('data-index'), 10);
    if (Number.isNaN(index)) return;
    const item = removeBtn.closest('.history-item');
    if (!item) return;
    item.classList.add('is-removing');
    setTimeout(() => {
      historyEntries.splice(index, 1);
      renderHistory();
    }, 170);
    return;
  }

  if (copyBtn) {
    const index = parseInt(copyBtn.getAttribute('data-index'), 10);
    if (Number.isNaN(index)) return;
    const entry = historyEntries[index];
    if (!entry || !entry.bruttoValue) return;
    navigator.clipboard.writeText(entry.bruttoValue).catch(() => {});
    copyBtn.classList.add('is-ok');
    const originalHtml = copyBtn.innerHTML;
    copyBtn.innerHTML = '<span class="history-copy-ok">✓</span>';
    setTimeout(() => {
      copyBtn.classList.remove('is-ok');
      copyBtn.innerHTML = originalHtml;
    }, 900);
  }
});

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  if (!historyEntries.length) return;
  const confirmed = window.confirm('Wyczyścić całą historię?');
  if (!confirmed) return;
  lastClearedHistory = historyEntries.slice();
  historyEntries.length = 0;
  lastHistorySignature = '';
  renderHistory();
  const restoreBtn = document.getElementById('restoreHistoryBtn');
  restoreBtn.style.display = 'inline-flex';
  if (restoreHistoryTimer) {
    clearTimeout(restoreHistoryTimer);
  }
  restoreHistoryTimer = setTimeout(() => {
    lastClearedHistory = [];
    restoreBtn.style.display = 'none';
  }, 8000);
});

document.getElementById('restoreHistoryBtn').addEventListener('click', () => {
  if (!lastClearedHistory.length) return;
  historyEntries.unshift(...lastClearedHistory);
  historyEntries.splice(20);
  lastClearedHistory = [];
  if (restoreHistoryTimer) {
    clearTimeout(restoreHistoryTimer);
    restoreHistoryTimer = null;
  }
  document.getElementById('restoreHistoryBtn').style.display = 'none';
  renderHistory();
});

const partNumberInput = document.getElementById('partNumberInput');
if (partNumberInput) {
  let lastSearchQuery = '';
  const searchStatus = document.getElementById('searchStatus');
  const pnSuggestion = document.getElementById('pnSuggestion');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const sourceGoogle = document.getElementById('sourceGoogle');
  const sourceAllegro = document.getElementById('sourceAllegro');
  const sourceEbay = document.getElementById('sourceEbay');
  const clearSearchStatus = () => {
    if (!searchStatus) return;
    searchStatus.textContent = '';
    searchStatus.classList.remove('is-warn');
  };

  const updatePnSuggestion = () => {
    const raw = partNumberInput.value.trim();
    if (!raw) {
      partNumberInput.dataset.suggestion = '';
      if (pnSuggestion) pnSuggestion.textContent = '';
      return;
    }
    const resolved = resolvePnManufacturer(raw);
    const manufacturer = resolved.vendor || '';
    const suggestionValue = manufacturer && !raw.toLowerCase().startsWith(manufacturer.toLowerCase())
      ? `${manufacturer} ${raw}`
      : '';
    partNumberInput.dataset.suggestion = suggestionValue;
    if (pnSuggestion) {
      pnSuggestion.textContent = '';
      if (suggestionValue) {
        const label = document.createElement('span');
        label.className = 'pn-label';
        label.textContent = `Sugestia ${manufacturer}?`;

        const hint = document.createElement('span');
        hint.className = 'pn-hint';
        hint.textContent = 'Tab, aby uzupełnić';

        pnSuggestion.append(label, hint);
      }
    }
  };
  const clearSearchInput = () => {
    if (partNumberInput.value.trim()) {
      partNumberInput.value = '';
      updatePnSuggestion();
      lastSearchQuery = '';
    }
  };
  const runSearchAll = () => {
    const query = partNumberInput.value.trim();
    const sources = [];
    if (sourceGoogle?.checked) sources.push('google');
    if (sourceEbay?.checked) sources.push('ebay');
    if (sourceAllegro?.checked) sources.push('allegro');
    if (!sources.length) {
      showMainToast('Wybierz minimum jedno źródło wyszukiwania.', 'warn');
      return false;
    }
    if (!query) {
      showMainToast('Wpisz Part Number, aby wyszukać.', 'warn');
      return false;
    }
    if (query === lastSearchQuery) {
      showMainToast('To samo zapytanie — pomijam.', 'warn');
      return false;
    }
    lastSearchQuery = query;
    clearSearchStatus();
    if (sources.includes('google')) {
      openSearch('https://www.google.com/search?q=', `"${query}"`);
    }
    if (sources.includes('ebay')) {
      openSearch('https://www.ebay.com/sch/58058/i.html?_oac=1&_from=R40&_nkw=', query);
    }
    if (sources.includes('allegro')) {
      openSearch('https://allegro.pl/kategoria/komputery?string=', query);
    }
    logActivity('search', { query, sources });
    return true;
  };
  document.getElementById('searchAllBtn').addEventListener('click', () => {
    if (runSearchAll()) {
      clearSearchInput();
    }
  });
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      clearSearchInput();
      clearSearchStatus();
      partNumberInput.focus();
    });
  }
  [sourceGoogle, sourceAllegro, sourceEbay].forEach((checkbox) => {
    if (!checkbox) return;
    checkbox.addEventListener('change', () => {
      clearSearchStatus();
    });
  });
  partNumberInput.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const suggestionValue = partNumberInput.dataset.suggestion;
      if (suggestionValue) {
        event.preventDefault();
        partNumberInput.value = suggestionValue;
        updatePnSuggestion();
        if (runSearchAll()) {
          clearSearchInput();
        }
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (runSearchAll()) {
        clearSearchInput();
      }
    }
  });

  partNumberInput.addEventListener('input', () => {
    updatePnSuggestion();
    clearSearchStatus();
  });
  updatePnSuggestion();
  if (window.PN_MAPPINGS_API?.load) {
    window.PN_MAPPINGS_API.load().then(() => {
      updatePnSuggestion();
    }).catch(() => {});
  }
}


// Start

const adminKeys = new Set();
window.addEventListener('keydown', (event) => {
  adminKeys.add(event.key.toLowerCase());
  if (adminKeys.has('a') && adminKeys.has('d') && adminKeys.has('m')) {
    adminKeys.clear();
    window.open('admin.html', '_blank', 'noopener');
  }
});
window.addEventListener('keyup', (event) => {
  adminKeys.delete(event.key.toLowerCase());
});
