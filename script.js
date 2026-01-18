let lastChanged = null;
let originalEbayPrice = null;
let originalCurrency = 'EUR';
let originalExchangeRate = 4.3;
let lastCurrency = 'EUR';
let currentExchangeRate = 4.3;
const VAT23 = 0.23;
const DEFAULT_RATES = { EUR: 4.3, USD: 3.9, GBP: 5.0 };
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

function hideSelfTestDetails() {
  const modal = document.getElementById('selfTestModal');
  modal.style.display = 'none';
  if (selfTestHideTimer) {
    clearTimeout(selfTestHideTimer);
    selfTestHideTimer = null;
  }
}

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
    return;
  }

  const bruttoClient = 1 * (1 + vatRate);
  const priceInCurrency = bruttoClient * exchangeRate;
  const finalPriceMultiplier = priceInCurrency * (1 + commission);
  const multiplierBrutto = finalPriceMultiplier / (1 + VAT23);
  multiplierEl.textContent = multiplierBrutto.toFixed(6);
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

function runSelfTest() {
  const detailsDiv = document.getElementById('selfTestDetails');
  const modal = document.getElementById('selfTestModal');
  const alertBanner = document.getElementById('selfTestAlert');
  const fields = [
    'plnNetto',
    'plnBrutto',
    'ebayPrice',
    'vatRate',
    'commission',
    'currency',
    'exchangeRate',
    'productId'
  ];
  const snapshot = {};
  fields.forEach(id => {
    snapshot[id] = document.getElementById(id).value;
  });
  const snapshotState = {
    lastChanged,
    isPresetApplied,
    originalEbayPrice,
    originalExchangeRate,
    originalCurrency,
    lastCurrency,
    currentExchangeRate,
    exchangeInfo: document.getElementById('exchangeInfo').innerText,
    currencyLabel: document.getElementById('currencyLabel').innerText,
    ebayCurrencyLabel: ebayCurrencyLabel.innerText,
    advancedChecked: advancedOptionsToggle.checked,
    advancedDisplay: advancedOptions.style.display,
    exchangeDisabled: exchangeRateInput.disabled
  };

  advancedOptionsToggle.checked = true;
  advancedOptionsToggle.dispatchEvent(new Event('change'));

  document.getElementById('currency').value = 'EUR';
  document.getElementById('currencyLabel').innerText = 'EUR';
  document.getElementById('exchangeRate').value = '0.2500';
  document.getElementById('commission').value = '15';
  document.getElementById('vatRate').value = '23';
  updateEbayCurrencyLabel();

  const failures = [];
  const checks = [];
  const expectedFinal = (100 * (1 + 0.23) * 0.25 * (1 + 0.15)).toFixed(2);

  lastChanged = 'netto';
  document.getElementById('plnNetto').value = '100';
  syncFields('netto');
  const ebayValue = document.getElementById('ebayPrice').value;
  if (ebayValue !== expectedFinal) {
    failures.push(`Test 1: ebayPrice ${ebayValue} zamiast ${expectedFinal}`);
  } else {
    checks.push(`Test 1 OK: 100 PLN netto -> ${expectedFinal} (EUR) przy VAT 23%, kurs 0.25 (1 PLN = 0.25 EUR) i prowizji 15%`);
  }

  lastChanged = 'ebayPrice';
  document.getElementById('ebayPrice').value = expectedFinal;
  syncFields('ebayPrice');
  const nettoValue = parseNumber(document.getElementById('plnNetto').value);
  if (!Number.isFinite(nettoValue) || Math.abs(nettoValue - 100) > 0.02) {
    failures.push(`Test 2: plnNetto ${document.getElementById('plnNetto').value} zamiast 100.00`);
  } else {
    checks.push('Test 2 OK: cena eBay -> ERP netto wraca do 100.00 (odwrotne przeliczenie)');
  }

  originalEbayPrice = 100;
  originalExchangeRate = 0.25;
  const converted = convertEbayPrice(0.4);
  if (!Number.isFinite(converted) || Math.abs(converted - 160) > 0.0001) {
    failures.push(`Test 3: konwersja ${converted} zamiast 160`);
  } else {
    checks.push('Test 3 OK: konwersja waluty (100 przy kursie 0.25 -> 160 przy kursie 0.4)');
  }

  fields.forEach(id => {
    document.getElementById(id).value = snapshot[id];
  });
  lastChanged = snapshotState.lastChanged;
  isPresetApplied = snapshotState.isPresetApplied;
  originalEbayPrice = snapshotState.originalEbayPrice;
  originalExchangeRate = snapshotState.originalExchangeRate;
  originalCurrency = snapshotState.originalCurrency;
  lastCurrency = snapshotState.lastCurrency;
  currentExchangeRate = snapshotState.currentExchangeRate;
  document.getElementById('exchangeInfo').innerText = snapshotState.exchangeInfo;
  document.getElementById('currencyLabel').innerText = snapshotState.currencyLabel;
  ebayCurrencyLabel.innerText = snapshotState.ebayCurrencyLabel;
  advancedOptionsToggle.checked = snapshotState.advancedChecked;
  advancedOptions.style.display = snapshotState.advancedDisplay;
  exchangeRateInput.disabled = snapshotState.exchangeDisabled;
  updateEbayCurrencyLabel();
  calculatePrice();

  modal.style.display = 'flex';
  const resultsList = checks.length
    ? checks.map(item => `<li>${item}</li>`).join('')
    : '<li>Brak testów OK.</li>';
  const failuresList = failures.length
    ? failures.map(item => `<li>${item}</li>`).join('')
    : '';

  detailsDiv.innerHTML = [
    '<div class="self-test-header"><strong id="selfTestTitle">Self-test</strong> <button type="button" id="selfTestClose">Zamknij</button></div>',
    '<div class="self-test-section">',
    '<div class="self-test-title">Zakres</div>',
    '<ol class="self-test-list">',
    '<li>Przeliczenie ERP → eBay z ustalonymi danymi wejściowymi.</li>',
    '<li>Przeliczenie eBay → ERP (odwrotne działanie).</li>',
    '<li>Konwersja ceny eBay między kursami.</li>',
    '</ol>',
    '</div>',
    '<div class="self-test-section">',
    '<div class="self-test-title">Wyniki</div>',
    `<ul class="self-test-results ${failures.length ? 'is-fail' : 'is-ok'}">${resultsList}</ul>`,
    failuresList ? `<div class="self-test-title">Błędy</div><ul class="self-test-results is-fail">${failuresList}</ul>` : '',
    '</div>'
  ].join('');

  if (failures.length) {
    alertBanner.style.display = 'flex';
  } else {
    alertBanner.style.display = 'none';
  }

  if (selfTestHideTimer) {
    clearTimeout(selfTestHideTimer);
  }
  selfTestHideTimer = setTimeout(() => {
    hideSelfTestDetails();
  }, 8000);
}

document.getElementById('selfTestBtn').addEventListener('click', () => {
  runSelfTest();
});

document.getElementById('selfTestModal').addEventListener('click', (event) => {
  if (event.target && event.target.id === 'selfTestClose') {
    event.preventDefault();
    hideSelfTestDetails();
    return;
  }
  if (event.target && event.target.id === 'selfTestModal') {
    hideSelfTestDetails();
  }
});

document.getElementById('selfTestAlertClose').addEventListener('click', () => {
  document.getElementById('selfTestAlert').style.display = 'none';
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

function fetchExchangeRate(currency) {
  const exchangeInfo = document.getElementById('exchangeInfo');
  const exchangeRateInp = document.getElementById('exchangeRate');
  const ebayPriceInput = document.getElementById('ebayPrice');
  exchangeInfo.innerText = 'Pobieranie kursu...';

  const ebayPriceValue = parseNumber(ebayPriceInput.value);
  const convertEbayPriceNeeded = Number.isFinite(ebayPriceValue) && lastChanged === 'ebayPrice' && lastCurrency !== currency && !isPresetApplied;
  const nettoValue = parseNumber(document.getElementById('plnNetto').value);
  const bruttoValue = parseNumber(document.getElementById('plnBrutto').value);
  const updateFromNettoOrBrutto = (Number.isFinite(nettoValue) || Number.isFinite(bruttoValue)) && (lastChanged === 'netto' || lastChanged === 'brutto');
  const oldCurrency = lastCurrency;
  lastCurrency = currency;

  fetch(`https://api.frankfurter.app/latest?from=PLN&to=${currency}`)
    .then(response => {
      if (!response.ok) throw new Error('Błąd sieci');
      return response.json();
    })
    .then(data => {
      const rate = data.rates[currency];
      if (!rate) throw new Error('Brak kursu dla wybranej waluty');
      exchangeRateInp.value = rate.toFixed(4);
      currentExchangeRate = rate;
      const now = new Date();
      exchangeInfo.innerText = `Kurs PLN/${currency}: ${rate.toFixed(4)} (${now.toLocaleString('pl-PL')})`;
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
    })
    .catch(error => {
      console.error('Błąd pobierania kursu:', error);
      const fallbackRate = DEFAULT_RATES[currency] || 4.3;
      exchangeRateInp.value = fallbackRate.toFixed(4);
      currentExchangeRate = fallbackRate;
      exchangeInfo.innerText = `Błąd pobierania kursu. Użyto domyślnego kursu PLN/${currency}: ${fallbackRate.toFixed(4)}`;
      updateBaseMultiplier();

      if (convertEbayPriceNeeded) {
        const newEbayPrice = convertEbayPrice(fallbackRate);
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
  fetchExchangeRate(selectedCurrency);
  addHistoryEntry('currency');
});

document.getElementById('refreshRateBtn').addEventListener('click', () => {
  fetchExchangeRate(document.getElementById('currency').value);
  addHistoryEntry('exchangeRate');
});

updateEbayCurrencyLabel();
fetchExchangeRate(document.getElementById('currency').value);
renderHistory();

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


// Start
fetchExchangeRate('EUR');
