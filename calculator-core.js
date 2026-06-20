(function (root) {
  'use strict';

  const ERP_VAT_RATE = 0.23;

  function parseNumber(value) {
    const parsed = parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function toFraction(percent) {
    const parsed = parseNumber(percent);
    return Number.isFinite(parsed) ? parsed / 100 : NaN;
  }

  function toBruttoFromNetto(netto, vatRate = ERP_VAT_RATE) {
    const nettoValue = parseNumber(netto);
    const vat = parseNumber(vatRate);
    if (!Number.isFinite(nettoValue) || !Number.isFinite(vat)) return NaN;
    return nettoValue * (1 + vat);
  }

  function toNettoFromBrutto(brutto, vatRate = ERP_VAT_RATE) {
    const bruttoValue = parseNumber(brutto);
    const vat = parseNumber(vatRate);
    if (!Number.isFinite(bruttoValue) || !Number.isFinite(vat) || vat <= -1) return NaN;
    return bruttoValue / (1 + vat);
  }

  function calculateEbayFromNetto(netto, exchangeRate, clientVatRate, commissionRate) {
    const nettoValue = parseNumber(netto);
    const rate = parseNumber(exchangeRate);
    const vat = parseNumber(clientVatRate);
    const commission = parseNumber(commissionRate);
    if (!Number.isFinite(nettoValue) || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(vat) || vat < 0 || !Number.isFinite(commission) || commission < 0) {
      return NaN;
    }
    return nettoValue * (1 + vat) * rate * (1 + commission);
  }

  function calculatePrimaryFromNetto(netto, exchangeRate, clientVatRate, commissionRate) {
    const nettoValue = parseNumber(netto);
    return {
      netto: nettoValue,
      brutto: toBruttoFromNetto(nettoValue),
      ebay: calculateEbayFromNetto(nettoValue, exchangeRate, clientVatRate, commissionRate)
    };
  }

  function calculatePrimaryFromBrutto(brutto, exchangeRate, clientVatRate, commissionRate) {
    const bruttoValue = parseNumber(brutto);
    const netto = toNettoFromBrutto(bruttoValue);
    return {
      netto,
      brutto: bruttoValue,
      ebay: calculateEbayFromNetto(netto, exchangeRate, clientVatRate, commissionRate)
    };
  }

  function calculatePrimaryFromEbay(ebay, exchangeRate, clientVatRate, commissionRate) {
    const ebayValue = parseNumber(ebay);
    const rate = parseNumber(exchangeRate);
    const vat = parseNumber(clientVatRate);
    const commission = parseNumber(commissionRate);
    if (!Number.isFinite(ebayValue) || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(vat) || vat < 0 || !Number.isFinite(commission) || commission < 0) {
      return { netto: NaN, brutto: NaN, ebay: ebayValue };
    }
    const netto = ebayValue / ((1 + commission) * rate * (1 + vat));
    return {
      netto,
      brutto: toBruttoFromNetto(netto),
      ebay: ebayValue
    };
  }

  function resolvePricingSource(options = {}) {
    const sourceOrder = ['ebayPrice', 'brutto', 'netto'];
    const fallbackOrder = ['brutto', 'netto', 'ebayPrice'];
    const values = {
      netto: parseNumber(options.netto),
      brutto: parseNumber(options.brutto),
      ebayPrice: parseNumber(options.ebayPrice)
    };
    const hasValue = (source) => sourceOrder.includes(source) && Number.isFinite(values[source]);
    if (hasValue(options.preferredSource)) return options.preferredSource;
    if (hasValue(options.lastPrimarySource)) return options.lastPrimarySource;
    if (hasValue(options.lastChanged)) return options.lastChanged;
    if (hasValue(options.activeSource)) return options.activeSource;
    return fallbackOrder.find(hasValue) || null;
  }

  function calculatePrimaryFromSource(source, values, exchangeRate, clientVatRate, commissionRate) {
    if (source === 'netto') {
      return {
        pricing: calculatePrimaryFromNetto(values?.netto, exchangeRate, clientVatRate, commissionRate),
        skip: ['netto']
      };
    }
    if (source === 'brutto') {
      return {
        pricing: calculatePrimaryFromBrutto(values?.brutto, exchangeRate, clientVatRate, commissionRate),
        skip: ['brutto']
      };
    }
    if (source === 'ebayPrice') {
      return {
        pricing: calculatePrimaryFromEbay(values?.ebayPrice, exchangeRate, clientVatRate, commissionRate),
        skip: ['ebayPrice']
      };
    }
    return {
      pricing: null,
      skip: []
    };
  }

  function resolvePlnPricingSource(options = {}) {
    const values = {
      netto: parseNumber(options.netto),
      brutto: parseNumber(options.brutto)
    };
    const isPlnSource = (source) => source === 'netto' || source === 'brutto';
    if (isPlnSource(options.preferredSource) && Number.isFinite(values[options.preferredSource])) return options.preferredSource;
    if (isPlnSource(options.lastPrimarySource) && Number.isFinite(values[options.lastPrimarySource])) return options.lastPrimarySource;
    if (isPlnSource(options.lastChanged) && Number.isFinite(values[options.lastChanged])) return options.lastChanged;
    if (Number.isFinite(values.brutto)) return 'brutto';
    if (Number.isFinite(values.netto)) return 'netto';
    return null;
  }

  function amountToBrutto(amount, isNetMode, clientVatRate) {
    const value = parseNumber(amount);
    const vat = parseNumber(clientVatRate);
    if (!Number.isFinite(value)) return NaN;
    if (!isNetMode) return value;
    if (!Number.isFinite(vat) || vat < 0) return NaN;
    return value * (1 + vat);
  }

  function bruttoToInputAmount(brutto, isNetMode, clientVatRate) {
    const value = parseNumber(brutto);
    const vat = parseNumber(clientVatRate);
    if (!Number.isFinite(value)) return NaN;
    if (!isNetMode) return value;
    if (!Number.isFinite(vat) || vat <= -1) return NaN;
    return value / (1 + vat);
  }

  function saleBruttoFromMarkup(purchaseBrutto, markupPercent) {
    const purchase = parseNumber(purchaseBrutto);
    const markup = parseNumber(markupPercent);
    if (!Number.isFinite(purchase) || purchase <= 0 || !Number.isFinite(markup)) return NaN;
    return purchase * (1 + (markup / 100));
  }

  function markupPercent(purchaseBrutto, saleBrutto) {
    const purchase = parseNumber(purchaseBrutto);
    const sale = parseNumber(saleBrutto);
    if (!Number.isFinite(purchase) || purchase <= 0 || !Number.isFinite(sale)) return NaN;
    return ((sale - purchase) / purchase) * 100;
  }

  function profit(purchaseBrutto, saleBrutto) {
    const purchase = parseNumber(purchaseBrutto);
    const sale = parseNumber(saleBrutto);
    if (!Number.isFinite(purchase) || !Number.isFinite(sale)) return NaN;
    return sale - purchase;
  }

  function calculateMarkupFromSale(purchaseAmount, saleAmount, purchaseIsNet, saleIsNet, clientVatRate) {
    const purchaseBrutto = amountToBrutto(purchaseAmount, purchaseIsNet, clientVatRate);
    const saleBrutto = amountToBrutto(saleAmount, saleIsNet, clientVatRate);
    return {
      purchaseBrutto,
      saleBrutto,
      markupPercent: markupPercent(purchaseBrutto, saleBrutto),
      profit: profit(purchaseBrutto, saleBrutto)
    };
  }

  function ebayFromSaleBrutto(saleBrutto, exchangeRate, commissionRate) {
    const sale = parseNumber(saleBrutto);
    const rate = parseNumber(exchangeRate);
    const commission = parseNumber(commissionRate);
    if (!Number.isFinite(sale) || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(commission) || commission < 0) return NaN;
    return sale * rate * (1 + commission);
  }

  function saleBruttoFromEbay(ebay, exchangeRate, commissionRate) {
    const ebayValue = parseNumber(ebay);
    const rate = parseNumber(exchangeRate);
    const commission = parseNumber(commissionRate);
    if (!Number.isFinite(ebayValue) || ebayValue < 0 || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(commission) || commission < 0) return NaN;
    return ebayValue / (rate * (1 + commission));
  }

  function calculateMarkupFromEbay(purchaseAmount, ebay, purchaseIsNet, exchangeRate, commissionRate, clientVatRate) {
    const purchaseBrutto = amountToBrutto(purchaseAmount, purchaseIsNet, clientVatRate);
    const saleBrutto = saleBruttoFromEbay(ebay, exchangeRate, commissionRate);
    return {
      purchaseBrutto,
      saleBrutto,
      markupPercent: markupPercent(purchaseBrutto, saleBrutto),
      profit: profit(purchaseBrutto, saleBrutto)
    };
  }

  function resolveMarkupSource(options = {}) {
    const sourceOrder = ['minMarkup', 'targetSaleAmount', 'ebayPrice'];
    const fallbackOrder = ['minMarkup', 'targetSaleAmount', 'ebayPrice'];
    const purchase = parseNumber(options.purchaseAmount);
    const markup = parseNumber(options.markupPercent);
    const targetSale = parseNumber(options.targetSaleAmount);
    const ebay = parseNumber(options.ebayPrice);
    const rate = parseNumber(options.exchangeRate);
    const commission = parseNumber(options.commission);
    const hasValue = (source) => {
      if (!sourceOrder.includes(source)) return false;
      if (source === 'minMarkup') {
        return Number.isFinite(purchase) && purchase > 0 && Number.isFinite(markup) && markup > -100;
      }
      if (source === 'targetSaleAmount') {
        return Number.isFinite(targetSale) && targetSale >= 0;
      }
      return Number.isFinite(ebay) && ebay >= 0 && Number.isFinite(rate) && rate > 0 && Number.isFinite(commission) && commission >= 0;
    };
    if (hasValue(options.preferredSource)) return options.preferredSource;
    if (hasValue(options.lastSource)) return options.lastSource;
    return fallbackOrder.find(hasValue) || null;
  }

  function calculateSaleBruttoFromMarkupSource(source, state = {}) {
    if (source === 'minMarkup') {
      const purchaseBrutto = amountToBrutto(state.purchaseAmount, state.purchaseIsNet, state.vatRate);
      return saleBruttoFromMarkup(purchaseBrutto, state.markupPercent);
    }
    if (source === 'targetSaleAmount') {
      return amountToBrutto(state.targetSaleAmount, state.saleIsNet, state.vatRate);
    }
    if (source === 'ebayPrice') {
      return saleBruttoFromEbay(state.ebayPrice, state.exchangeRate, state.commission);
    }
    return NaN;
  }

  function priceLevelPlnFromEbay(ebay, exchangeRate) {
    const ebayValue = parseNumber(ebay);
    const rate = parseNumber(exchangeRate);
    if (!Number.isFinite(ebayValue) || ebayValue < 0 || !Number.isFinite(rate) || rate <= 0) return NaN;
    return ebayValue / rate;
  }

  function baseMultiplier(exchangeRate, clientVatRate, commissionRate) {
    const rate = parseNumber(exchangeRate);
    const vat = parseNumber(clientVatRate);
    const commission = parseNumber(commissionRate);
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(vat) || vat < 0 || !Number.isFinite(commission) || commission < 0) return NaN;
    return ((1 + vat) * rate * (1 + commission)) / (1 + ERP_VAT_RATE);
  }

  function commissionFromBaseMultiplier(multiplier, exchangeRate, clientVatRate) {
    const base = parseNumber(multiplier);
    const rate = parseNumber(exchangeRate);
    const vat = parseNumber(clientVatRate);
    const denominator = (1 + vat) * rate;
    if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(vat) || vat < 0 || !Number.isFinite(denominator) || denominator <= 0) {
      return NaN;
    }
    return ((base * (1 + ERP_VAT_RATE)) / denominator) - 1;
  }

  const api = {
    ERP_VAT_RATE,
    parseNumber,
    toFraction,
    toBruttoFromNetto,
    toNettoFromBrutto,
    calculateEbayFromNetto,
    calculatePrimaryFromNetto,
    calculatePrimaryFromBrutto,
    calculatePrimaryFromEbay,
    resolvePricingSource,
    resolvePlnPricingSource,
    calculatePrimaryFromSource,
    amountToBrutto,
    bruttoToInputAmount,
    saleBruttoFromMarkup,
    markupPercent,
    profit,
    calculateMarkupFromSale,
    ebayFromSaleBrutto,
    saleBruttoFromEbay,
    calculateMarkupFromEbay,
    resolveMarkupSource,
    calculateSaleBruttoFromMarkupSource,
    priceLevelPlnFromEbay,
    baseMultiplier,
    commissionFromBaseMultiplier
  };

  root.CalculatorCore = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
