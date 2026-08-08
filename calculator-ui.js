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

  function setClientVatForSaleMode(doc, isNet) {
    const vatEl = getElement(doc, 'vatRate');
    if (!vatEl) return false;
    const nextVat = isNet ? 0 : 23;
    const currentVat = root.CalculatorCore.parseNumber(vatEl.value);
    vatEl.value = String(nextVat);
    return currentVat !== nextVat;
  }

  function formatBaseMultiplierPresetValue(value) {
    const parsed = root.CalculatorCore.parseNumber(value);
    if (!Number.isFinite(parsed)) return '';
    return parsed.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  }

  function normalizeBaseMultiplierPreset(item, index = 0) {
    const multiplier = root.CalculatorCore.parseNumber(item?.multiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
    const rawId = String(item?.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const fallbackLabel = `Base ${formatBaseMultiplierPresetValue(multiplier)}`;
    const label = String(item?.label || item?.name || fallbackLabel).trim().slice(0, 40);
    return {
      id: rawId || `base-${index + 1}`,
      label: label || fallbackLabel,
      multiplier,
      enabled: item?.enabled !== false
    };
  }

  function normalizeBaseMultiplierPresetsConfig(raw) {
    const incoming = raw && typeof raw === 'object' ? raw : {};
    const source = Array.isArray(incoming.presets) ? incoming.presets : [];
    const seen = new Set();
    const presets = source
      .map(normalizeBaseMultiplierPreset)
      .filter(Boolean)
      .map((item, index) => {
        let id = item.id;
        if (seen.has(id)) id = `${id}-${index + 1}`;
        seen.add(id);
        return { ...item, id };
      });
    return {
      version: Number(incoming.version) || 1,
      presets
    };
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

  function isActiveElement(doc, el) {
    const activeElement = doc?.activeElement || root.document?.activeElement || null;
    return !!el && activeElement === el;
  }

  function writeField(doc, el, value, options = {}) {
    if (!el || !Number.isFinite(value)) return;
    if (options.skipActive !== false && isActiveElement(doc, el)) return;
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
    if (!skip.has('netto')) writeField(doc, nettoEl, result?.netto, options);
    if (!skip.has('brutto')) writeField(doc, bruttoEl, result?.brutto, options);
    if (!skip.has('ebayPrice')) writeField(doc, ebayEl, result?.ebay, options);
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
    setClientVatForSaleMode,
    formatBaseMultiplierPresetValue,
    normalizeBaseMultiplierPreset,
    normalizeBaseMultiplierPresetsConfig,
    readPrimaryState,
    clearRecalculatedFields,
    flashRecalculatedField,
    isActiveElement,
    writePrimaryResult,
    readMarkupState,
    readBaseState
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
