let lastChanged = null;
let originalEbayPrice = null;
let originalCurrency = 'EUR';
let originalExchangeRate = 4.3;
let lastCurrency = 'EUR';
let currentExchangeRate = 4.3;
const VAT23 = 0.23;
const DEFAULT_RATES = { EUR: 4.3, USD: 3.9, GBP: 5.0 };
let isPresetApplied = false;

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
  calculatePrice();
});

// Update eBay currency label with VAT rate
function updateEbayCurrencyLabel() {
  const currency = document.getElementById('currency').value;
  const vatRateInput = document.getElementById('vatRate');
  const vatRate = parseInt(vatRateInput.value) || 0; // Default to 0 if invalid
  ebayCurrencyLabel.innerText = `${currency} (z VAT ${vatRate}%)`;
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
  fetchExchangeRate('EUR');
});

function syncFields(source) {
  const nettoInput = document.getElementById('plnNetto');
  const bruttoInput = document.getElementById('plnBrutto');
  const ebayPriceInput = document.getElementById('ebayPrice');
  const vatRateInput = document.getElementById('vatRate');
  const exchangeRate = parseFloat(document.getElementById('exchangeRate').value);
  const commission = advancedOptionsToggle.checked ? parseFloat(document.getElementById('commission').value) / 100 : 0.15;
  const vatRate = parseInt(vatRateInput.value) / 100;
  const resultDiv = document.getElementById('result');

  // Validate negative inputs
  if (source === 'netto' && !isNaN(parseFloat(nettoInput.value)) && parseFloat(nettoInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Kwota netto nie może być ujemna.</span>';
    return;
  }
  if (source === 'brutto' && !isNaN(parseFloat(bruttoInput.value)) && parseFloat(bruttoInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Kwota brutto nie może być ujemna.</span>';
    return;
  }
  if (source === 'ebayPrice' && !isNaN(parseFloat(ebayPriceInput.value)) && parseFloat(ebayPriceInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Cena na eBay nie może być ujemna.</span>';
    return;
  }
  if (source === 'vatRate' && !isNaN(parseFloat(vatRateInput.value)) && parseFloat(vatRateInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Stawka VAT nie może być ujemna.</span>';
    return;
  }

  if (source === 'netto' && !isNaN(parseFloat(nettoInput.value))) {
    const netto = parseFloat(nettoInput.value);
    bruttoInput.value = (netto * (1 + VAT23)).toFixed(2);
    if (!isNaN(exchangeRate) && !isNaN(commission) && !isNaN(vatRate)) {
      const bruttoClient = netto * (1 + vatRate);
      const priceInCurrency = bruttoClient * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'brutto' && !isNaN(parseFloat(bruttoInput.value))) {
    const brutto = parseFloat(bruttoInput.value);
    const netto = brutto / (1 + VAT23);
    nettoInput.value = netto.toFixed(2);
    if (!isNaN(exchangeRate) && !isNaN(commission) && !isNaN(vatRate)) {
      const bruttoClient = netto * (1 + vatRate);
      const priceInCurrency = bruttoClient * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'ebayPrice' && !isNaN(parseFloat(ebayPriceInput.value))) {
    const ebayPrice = parseFloat(ebayPriceInput.value);
    if (!isNaN(exchangeRate) && !isNaN(commission) && !isNaN(vatRate) && exchangeRate > 0) {
      const priceInCurrency = ebayPrice / (1 + commission);
      const bruttoClient = priceInCurrency / exchangeRate;
      const netto = bruttoClient / (1 + vatRate);
      nettoInput.value = netto.toFixed(2);
      bruttoInput.value = (netto * (1 + VAT23)).toFixed(2);
      originalEbayPrice = ebayPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'vatRate' && !isNaN(parseInt(vatRateInput.value))) {
    const vatRate = Math.max(0, Math.min(100, parseInt(vatRateInput.value))) / 100;
    vatRateInput.value = parseInt(vatRate * 100);
    updateEbayCurrencyLabel(); // Ensure label updates with new VAT rate (including 0)
    let netto = parseFloat(nettoInput.value);
    if (isNaN(netto)) {
      const brutto = parseFloat(bruttoInput.value);
      if (!isNaN(brutto)) {
        netto = brutto / (1 + VAT23);
        nettoInput.value = netto.toFixed(2);
      }
    }
    if (!isNaN(netto) && netto > 0 && !isNaN(exchangeRate) && !isNaN(commission)) {
      const bruttoClient = netto * (1 + vatRate);
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
  const netto = parseFloat(document.getElementById('plnNetto').value);
  const brutto = parseFloat(document.getElementById('plnBrutto').value);
  const ebayPrice = parseFloat(document.getElementById('ebayPrice').value);
  const exchangeRate = parseFloat(document.getElementById('exchangeRate').value);
  const commission = advancedOptionsToggle.checked ? parseFloat(document.getElementById('commission').value) / 100 : 0.15;
  const vatRate = parseInt(document.getElementById('vatRate').value) / 100;
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

  let resultHTML = `
 Mnożnik dla <a href="https://panel-e.baselinker.com/inventory_settings#price_groups" target="_blank">Base</a> → ${currency}: <strong>${multiplierBrutto.toFixed(6)}</strong><br><br>
    <span class="tooltip">Pomnóż kwotę netto lub brutto w PLN przez mnożnik, aby uzyskać cenę na eBay w ${currency}.</span>
  `;

  if (!isNaN(ebayPrice) && ebayPrice > 0 && lastChanged === 'ebayPrice' && !isPresetApplied) {
    resultHTML = `
      <strong>Cena końcowa w ${currency} (dla klienta):</strong> ${ebayPrice.toFixed(2)} ${currency}<br><br>
      ${resultHTML}
    `;
  } else if (!isNaN(netto) && netto > 0) {
    const bruttoClient = netto * (1 + vatRate);
    const priceInCurrency = bruttoClient * exchangeRate;
    const finalPrice = priceInCurrency * (1 + commission);
    resultHTML = `
      <strong>Cena końcowa w ${currency} (dla klienta):</strong> ${finalPrice.toFixed(2)} ${currency}<br><br>
      ${resultHTML}
    `;
  } else if (isNaN(netto) && isNaN(brutto) && isNaN(ebayPrice)) {
    resultDiv.innerHTML = `<span class="error">Wprowadź kwotę netto, brutto lub cenę na eBay, aby zobaczyć cenę końcową.</span><br><br>${resultHTML}`;
    return;
  }

  resultDiv.innerHTML = resultHTML;
}

function applyPreset(currency, vat) {
  isPresetApplied = true;
  document.getElementById('currency').value = currency;
  document.getElementById('vatRate').value = parseInt(vat);
  document.getElementById('currencyLabel').innerText = currency;
  ebayCurrencyLabel.innerText = `${currency} (z VAT ${vat}%)`;
  lastChanged = 'vatRate';
  fetchExchangeRate(currency);
}

function convertEbayPrice(newRate) {
  if (originalEbayPrice === null || isNaN(originalEbayPrice) || originalExchangeRate === null) return null;
  return (originalEbayPrice * originalExchangeRate) / newRate;
}

function updateEbayPriceFromNettoOrBrutto() {
  const nettoInput = document.getElementById('plnNetto');
  const bruttoInput = document.getElementById('plnBrutto');
  const ebayPriceInput = document.getElementById('ebayPrice');
  const exchangeRate = parseFloat(document.getElementById('exchangeRate').value);
  const commission = advancedOptionsToggle.checked ? parseFloat(document.getElementById('commission').value) / 100 : 0.15;
  const vatRate = parseInt(document.getElementById('vatRate').value) / 100;

  if (lastChanged === 'netto' && !isNaN(parseFloat(nettoInput.value))) {
    const netto = parseFloat(nettoInput.value);
    if (!isNaN(exchangeRate) && !isNaN(commission) && !isNaN(vatRate)) {
      const bruttoClient = netto * (1 + vatRate);
      const priceInCurrency = bruttoClient * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
    }
  } else if (lastChanged === 'brutto' && !isNaN(parseFloat(bruttoInput.value))) {
    const brutto = parseFloat(bruttoInput.value);
    if (!isNaN(exchangeRate) && !isNaN(commission) && !isNaN(vatRate)) {
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

  const convertEbayPriceNeeded = !isNaN(parseFloat(ebayPriceInput.value)) && lastChanged === 'ebayPrice' && lastCurrency !== currency && !isPresetApplied;
  const updateFromNettoOrBrutto = !isNaN(parseFloat(document.getElementById('plnNetto').value)) && (lastChanged === 'netto' || lastChanged === 'brutto');
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

      if (convertEbayPriceNeeded) {
        const newEbayPrice = convertEbayPrice(rate);
        if (newEbayPrice !== null) {
          ebayPriceInput.value = newEbayPrice.toFixed(2);
          if (originalCurrency === currency) {
            ebayPriceInput.value = originalEbayPrice.toFixed(2);
          }
          syncFields('ebayPrice');
        }
      } else if (updateFromNettoOrBrutto) {
        updateEbayPriceFromNettoOrBrutto();
        syncFields(lastChanged);
      } else if (isPresetApplied || lastChanged === 'vatRate') {
        syncFields('vatRate');
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

      if (convertEbayPriceNeeded) {
        const newEbayPrice = convertEbayPrice(fallbackRate);
        if (newEbayPrice !== null) {
          ebayPriceInput.value = newEbayPrice.toFixed(2);
          if (originalCurrency === currency) {
            ebayPriceInput.value = originalEbayPrice.toFixed(2);
          }
          syncFields('ebayPrice');
        }
      } else if (updateFromNettoOrBrutto) {
        updateEbayPriceFromNettoOrBrutto();
        syncFields(lastChanged);
      } else if (isPresetApplied || lastChanged === 'vatRate') {
        syncFields('vatRate');
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
  syncFields('netto');
});

document.getElementById('plnBrutto').addEventListener('input', () => {
  lastChanged = 'brutto';
  syncFields('brutto');
});

document.getElementById('ebayPrice').addEventListener('input', () => {
  lastChanged = 'ebayPrice';
  syncFields('ebayPrice');
});

document.getElementById('vatRate').addEventListener('input', () => {
  lastChanged = 'vatRate';
  syncFields('vatRate');
});

['exchangeRate', 'commission'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    if (lastChanged === 'ebayPrice' && !isNaN(parseFloat(document.getElementById('ebayPrice').value))) {
      syncFields('ebayPrice');
    } else if ((lastChanged === 'netto' || lastChanged === 'brutto') && !isNaN(parseFloat(document.getElementById('plnNetto').value))) {
      syncFields(lastChanged);
    } else if (lastChanged === 'vatRate' && !isNaN(parseInt(document.getElementById('vatRate').value))) {
      syncFields('vatRate');
    } else {
      calculatePrice();
    }
  });
});

document.getElementById('currency').addEventListener('change', () => {
  const selectedCurrency = document.getElementById('currency').value;
  document.getElementById('currencyLabel').innerText = selectedCurrency;
  updateEbayCurrencyLabel();
  fetchExchangeRate(selectedCurrency);
});

document.getElementById('refreshRateBtn').addEventListener('click', () => {
  fetchExchangeRate(document.getElementById('currency').value);
});

// Start
fetchExchangeRate('EUR');