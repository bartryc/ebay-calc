(function (root) {
  'use strict';

  const ui = root.CalculatorUI;
  if (!ui) throw new Error('CalculatorUI is not loaded');

  function equal(actual, expected, label) {
    if (actual !== expected) {
      throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
  }

  function approx(actual, expected, label, tolerance = 0.000001) {
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
      throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
  }

  function createDoc(values) {
    const elements = {};
    Object.keys(values).forEach((id) => {
      const value = values[id];
      elements[id] = typeof value === 'object'
        ? { ...value }
        : { value };
    });
    return {
      getElementById(id) {
        return elements[id] || null;
      },
      elements
    };
  }

  const doc = createDoc({
    plnNetto: '100,50',
    plnBrutto: '123,62',
    ebayPrice: '35.55',
    exchangeRate: '0,2357',
    vatRate: '23',
    currency: 'EUR',
    purchaseAmount: '1000',
    minMarkup: '30',
    targetSaleAmount: '1300',
    purchaseAmountNetToggle: { checked: true },
    markupSaleNetToggle: { checked: false },
    currentBaseMultiplier: '0,2875'
  });

  const primary = ui.readPrimaryState(doc, () => 15);
  approx(primary.netto, 100.5, 'primary netto');
  approx(primary.brutto, 123.62, 'primary brutto');
  approx(primary.ebayPrice, 35.55, 'primary ebay');
  approx(primary.exchangeRate, 0.2357, 'primary exchange');
  approx(primary.vatRate, 0.23, 'primary VAT');
  approx(primary.commission, 0.15, 'primary commission');
  equal(primary.currency, 'EUR', 'primary currency');

  equal(ui.setClientVatForSaleMode(doc, true), true, 'net sale mode changes VAT');
  equal(doc.elements.vatRate.value, '0', 'net sale mode sets VAT to 0%');
  equal(ui.setClientVatForSaleMode(doc, true), false, 'unchanged net sale mode leaves VAT at 0%');
  equal(ui.setClientVatForSaleMode(doc, false), true, 'gross sale mode changes VAT');
  equal(doc.elements.vatRate.value, '23', 'gross sale mode sets VAT to 23%');

  ui.writePrimaryResult(doc, { netto: 200, brutto: 246, ebay: 66.6 }, { skip: ['netto'] });
  equal(doc.elements.plnNetto.value, '100,50', 'write skips netto');
  equal(doc.elements.plnBrutto.value, '246.00', 'write brutto');
  equal(doc.elements.ebayPrice.value, '66.60', 'write ebay');

  doc.activeElement = doc.elements.plnBrutto;
  doc.elements.plnBrutto.value = '246.';
  ui.writePrimaryResult(doc, { netto: 200, brutto: 246, ebay: 66.6 });
  equal(doc.elements.plnBrutto.value, '246.', 'write skips active field');
  doc.activeElement = null;

  const markup = ui.readMarkupState(doc, () => 12.5);
  approx(markup.purchaseAmount, 1000, 'markup purchase');
  approx(markup.markupPercent, 30, 'markup percent');
  approx(markup.targetSaleAmount, 1300, 'markup sale');
  equal(markup.purchaseIsNet, true, 'markup purchase mode');
  equal(markup.saleIsNet, false, 'markup sale mode');
  approx(markup.commission, 0.125, 'markup commission');

  const base = ui.readBaseState(doc, () => 15);
  approx(base.currentBaseMultiplier, 0.2875, 'base multiplier');
  approx(base.exchangeRate, 0.2357, 'base exchange');
  approx(base.vatRate, 0.23, 'base VAT');
  approx(base.commission, 0.15, 'base commission');

  equal(ui.formatBaseMultiplierPresetValue('0,265400'), '0.2654', 'format Base multiplier preset');
  const basePreset = ui.normalizeBaseMultiplierPreset({ id: 'EBAY-DE!', label: 'eBay DE', multiplier: '0,2654' });
  equal(basePreset.id, 'ebay-de', 'normalize Base preset id');
  equal(basePreset.label, 'eBay DE', 'normalize Base preset label');
  approx(basePreset.multiplier, 0.2654, 'normalize Base preset multiplier');
  equal(ui.normalizeBaseMultiplierPreset({ multiplier: 0 }), null, 'reject zero Base multiplier');
  const basePresets = ui.normalizeBaseMultiplierPresetsConfig({
    presets: [
      { id: 'de', label: 'DE', multiplier: 0.2654 },
      { id: 'de', label: 'DE zapas', multiplier: 0.2711, enabled: false },
      { id: 'bad', label: 'Błędny', multiplier: -1 }
    ]
  });
  equal(basePresets.presets.length, 2, 'filter invalid Base presets');
  equal(basePresets.presets[1].id, 'de-2', 'deduplicate Base preset ids');
  equal(basePresets.presets[1].enabled, false, 'keep disabled Base preset');

  root.__calculatorUiTestResult = 'ok';
})(typeof globalThis !== 'undefined' ? globalThis : window);
