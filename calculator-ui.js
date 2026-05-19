(function (root) {
  'use strict';

  function getElement(doc, id) {
    return doc?.getElementById ? doc.getElementById(id) : null;
  }

  function readNumber(doc, id) {
    return root.CalculatorCore.parseNumber(getElement(doc, id)?.value);
  }

  function readPercentFraction(doc, id) {
    return root.CalculatorCore.toFraction(getElement(doc, id)?.value);
  }

  function readPrimaryState(doc, getCommissionRate) {
    const commissionRaw = typeof getCommissionRate === 'function' ? getCommissionRate() : NaN;
    return {
      netto: readNumber(doc, 'plnNetto'),
      brutto: readNumber(doc, 'plnBrutto'),
      ebayPrice: readNumber(doc, 'ebayPrice'),
      exchangeRate: readNumber(doc, 'exchangeRate'),
      commission: Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN,
      vatRate: readPercentFraction(doc, 'vatRate'),
      currency: getElement(doc, 'currency')?.value || 'EUR'
    };
  }

  function writePrimaryResult(doc, result, options = {}) {
    const skip = new Set(options.skip || []);
    const nettoEl = getElement(doc, 'plnNetto');
    const bruttoEl = getElement(doc, 'plnBrutto');
    const ebayEl = getElement(doc, 'ebayPrice');
    if (nettoEl && !skip.has('netto') && Number.isFinite(result?.netto)) {
      nettoEl.value = result.netto.toFixed(2);
    }
    if (bruttoEl && !skip.has('brutto') && Number.isFinite(result?.brutto)) {
      bruttoEl.value = result.brutto.toFixed(2);
    }
    if (ebayEl && !skip.has('ebayPrice') && Number.isFinite(result?.ebay)) {
      ebayEl.value = result.ebay.toFixed(2);
    }
  }

  function readMarkupState(doc, getCommissionRate) {
    const commissionRaw = typeof getCommissionRate === 'function' ? getCommissionRate() : NaN;
    return {
      purchaseAmount: readNumber(doc, 'purchaseAmount'),
      markupPercent: readNumber(doc, 'minMarkup'),
      targetSaleAmount: readNumber(doc, 'targetSaleAmount'),
      ebayPrice: readNumber(doc, 'ebayPrice'),
      exchangeRate: readNumber(doc, 'exchangeRate'),
      commission: Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN,
      vatRate: readPercentFraction(doc, 'vatRate'),
      currency: getElement(doc, 'currency')?.value || 'EUR',
      purchaseIsNet: !!getElement(doc, 'purchaseAmountNetToggle')?.checked,
      saleIsNet: !!getElement(doc, 'markupSaleNetToggle')?.checked
    };
  }

  function readBaseState(doc, getCommissionRate) {
    const commissionRaw = typeof getCommissionRate === 'function' ? getCommissionRate() : NaN;
    return {
      currentBaseMultiplier: readNumber(doc, 'currentBaseMultiplier'),
      exchangeRate: readNumber(doc, 'exchangeRate'),
      commission: Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN,
      vatRate: readPercentFraction(doc, 'vatRate')
    };
  }

  root.CalculatorUI = {
    getElement,
    readNumber,
    readPercentFraction,
    readPrimaryState,
    writePrimaryResult,
    readMarkupState,
    readBaseState
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
