(function (root) {
  'use strict';

  const highlightedFields = new Set();

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

  function clearRecalculatedFields() {
    highlightedFields.forEach((el) => {
      if (el?.__recalculatedTimer) {
        clearTimeout(el.__recalculatedTimer);
        el.__recalculatedTimer = null;
      }
      el?.classList?.remove('is-recalculated');
    });
    highlightedFields.clear();
  }

  function flashRecalculatedField(el) {
    if (!el?.classList) return;
    el.classList.remove('is-recalculated');
    void el.offsetWidth;
    el.classList.add('is-recalculated');
    highlightedFields.add(el);
    if (el.__recalculatedTimer) {
      clearTimeout(el.__recalculatedTimer);
    }
    el.__recalculatedTimer = setTimeout(() => {
      el.classList.remove('is-recalculated');
      el.__recalculatedTimer = null;
      highlightedFields.delete(el);
    }, 60000);
  }

  function writeField(el, value) {
    if (!el || !Number.isFinite(value)) return;
    const nextValue = value.toFixed(2);
    if (el.value === nextValue) return;
    el.value = nextValue;
    flashRecalculatedField(el);
  }

  function writePrimaryResult(doc, result, options = {}) {
    const skip = new Set(options.skip || []);
    const nettoEl = getElement(doc, 'plnNetto');
    const bruttoEl = getElement(doc, 'plnBrutto');
    const ebayEl = getElement(doc, 'ebayPrice');
    if (!skip.has('netto')) writeField(nettoEl, result?.netto);
    if (!skip.has('brutto')) writeField(bruttoEl, result?.brutto);
    if (!skip.has('ebayPrice')) writeField(ebayEl, result?.ebay);
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
    clearRecalculatedFields,
    flashRecalculatedField,
    writePrimaryResult,
    readMarkupState,
    readBaseState
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
