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

  root.__calculatorUiTestResult = 'ok';
})(typeof globalThis !== 'undefined' ? globalThis : window);
