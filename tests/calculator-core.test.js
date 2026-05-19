(function (root) {
  'use strict';

  const core = root.CalculatorCore;
  if (!core) throw new Error('CalculatorCore is not loaded');

  function approx(actual, expected, label, tolerance = 0.000001) {
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
      throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
  }

  function isNaNValue(actual, label) {
    if (!Number.isNaN(actual)) {
      throw new Error(`${label}: expected NaN, got ${actual}`);
    }
  }

  function equal(actual, expected, label) {
    if (actual !== expected) {
      throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
  }

  equal(core.parseNumber('12,34'), 12.34, 'parse comma decimal');
  equal(core.parseNumber('12.34'), 12.34, 'parse dot decimal');
  isNaNValue(core.parseNumber(''), 'parse empty');
  approx(core.toFraction(23), 0.23, 'percent to fraction');
  approx(core.toBruttoFromNetto(100), 123, 'netto -> brutto');
  approx(core.toNettoFromBrutto(123), 100, 'brutto -> netto');
  approx(core.toBruttoFromNetto(100, 0), 100, 'netto -> brutto VAT 0');
  approx(core.toNettoFromBrutto(100, 0), 100, 'brutto -> netto VAT 0');
  isNaNValue(core.toNettoFromBrutto(100, -1), 'brutto -> netto invalid VAT');

  const fromNetto = core.calculatePrimaryFromNetto(100, 0.25, 0.23, 0.15);
  approx(fromNetto.brutto, 123, 'primary netto brutto');
  approx(fromNetto.ebay, 35.3625, 'primary netto ebay');

  const fromBrutto = core.calculatePrimaryFromBrutto(123, 0.25, 0.23, 0.15);
  approx(fromBrutto.netto, 100, 'primary brutto netto');
  approx(fromBrutto.ebay, 35.3625, 'primary brutto ebay');

  const fromEbay = core.calculatePrimaryFromEbay(35.3625, 0.25, 0.23, 0.15);
  approx(fromEbay.netto, 100, 'primary ebay netto');
  approx(fromEbay.brutto, 123, 'primary ebay brutto');

  const fromNettoVat0 = core.calculatePrimaryFromNetto(100, 0.25, 0, 0.15);
  approx(fromNettoVat0.ebay, 28.75, 'primary netto VAT 0 ebay');
  const fromNettoNoCommission = core.calculatePrimaryFromNetto(100, 0.25, 0.23, 0);
  approx(fromNettoNoCommission.ebay, 30.75, 'primary netto no commission ebay');
  isNaNValue(core.calculateEbayFromNetto(100, 0, 0.23, 0.15), 'invalid rate ebay from netto');
  isNaNValue(core.calculateEbayFromNetto(100, 0.25, -0.01, 0.15), 'invalid VAT ebay from netto');
  isNaNValue(core.calculateEbayFromNetto(100, 0.25, 0.23, -0.01), 'invalid commission ebay from netto');

  const invalidFromEbay = core.calculatePrimaryFromEbay(100, 0, 0.23, 0.15);
  isNaNValue(invalidFromEbay.netto, 'invalid ebay reverse netto');
  isNaNValue(invalidFromEbay.brutto, 'invalid ebay reverse brutto');
  equal(invalidFromEbay.ebay, 100, 'invalid ebay reverse keeps ebay');

  equal(core.resolvePricingSource({ netto: 100, brutto: 123, ebayPrice: 35, lastPrimarySource: 'ebayPrice' }), 'ebayPrice', 'source keeps last primary source');
  equal(core.resolvePricingSource({ netto: 100, brutto: 123, ebayPrice: NaN, activeSource: 'netto' }), 'netto', 'source keeps active input');
  equal(core.resolvePricingSource({ netto: 100, brutto: 123, ebayPrice: NaN }), 'brutto', 'source fallback prefers brutto');
  equal(core.resolvePricingSource({ netto: '', brutto: '', ebayPrice: '' }), null, 'source empty');

  const fromSource = core.calculatePrimaryFromSource('brutto', { brutto: 123 }, 0.25, 0.23, 0.15);
  approx(fromSource.pricing.netto, 100, 'primary from source netto');
  approx(fromSource.pricing.ebay, 35.3625, 'primary from source ebay');
  equal(fromSource.skip[0], 'brutto', 'primary from source skip');

  approx(core.amountToBrutto(100, false, 0.23), 100, 'brutto mode amount');
  approx(core.amountToBrutto(100, true, 0.23), 123, 'netto mode amount');
  approx(core.bruttoToInputAmount(123, false, 0.23), 123, 'brutto input amount');
  approx(core.bruttoToInputAmount(123, true, 0.23), 100, 'netto input amount');
  isNaNValue(core.amountToBrutto(100, true, -0.1), 'invalid net amount VAT');
  isNaNValue(core.bruttoToInputAmount(100, true, -1), 'invalid brutto input VAT');

  approx(core.saleBruttoFromMarkup(1000, 30), 1300, 'sale from markup');
  approx(core.saleBruttoFromMarkup(1000, -20), 800, 'sale from negative markup');
  approx(core.saleBruttoFromMarkup(1000, -100), 0, 'sale from -100 markup');
  approx(core.markupPercent(1000, 1300), 30, 'markup percent');
  approx(core.markupPercent(1000, 800), -20, 'negative markup percent');
  approx(core.profit(1000, 1300), 300, 'profit');
  approx(core.profit(1000, 800), -200, 'negative profit');
  const markupFromSale = core.calculateMarkupFromSale(1000, 1300, false, false, 0.23);
  approx(markupFromSale.markupPercent, 30, 'markup summary from sale');
  approx(markupFromSale.profit, 300, 'profit summary from sale');
  const markupFromNetSale = core.calculateMarkupFromSale(1000, 1000, false, true, 0.23);
  approx(markupFromNetSale.saleBrutto, 1230, 'sale net mode to brutto');
  approx(core.ebayFromSaleBrutto(1300, 0.25, 0.15), 373.75, 'ebay from sale brutto');
  approx(core.saleBruttoFromEbay(373.75, 0.25, 0.15), 1300, 'sale brutto from ebay');
  const markupFromEbay = core.calculateMarkupFromEbay(1000, 373.75, false, 0.25, 0.15, 0.23);
  approx(markupFromEbay.saleBrutto, 1300, 'markup summary sale from ebay with commission');
  approx(markupFromEbay.markupPercent, 30, 'markup summary percent from ebay with commission');
  approx(core.priceLevelPlnFromEbay(373.75, 0.25), 1495, 'price level pln from ebay');
  const markupState = {
    purchaseAmount: 1000,
    markupPercent: 30,
    targetSaleAmount: 1400,
    ebayPrice: 373.75,
    exchangeRate: 0.25,
    commission: 0.15,
    vatRate: 0.23,
    purchaseIsNet: false,
    saleIsNet: false
  };
  equal(core.resolveMarkupSource({ ...markupState, lastSource: 'targetSaleAmount' }), 'targetSaleAmount', 'markup source keeps target sale');
  equal(core.resolveMarkupSource({ ...markupState, preferredSource: 'ebayPrice' }), 'ebayPrice', 'markup source preferred ebay');
  equal(core.resolveMarkupSource({ purchaseAmount: 1000, markupPercent: 30 }), 'minMarkup', 'markup source fallback min markup');
  equal(core.resolveMarkupSource({ purchaseAmount: '', markupPercent: '', targetSaleAmount: '', ebayPrice: '' }), null, 'markup source empty');
  approx(core.calculateSaleBruttoFromMarkupSource('minMarkup', markupState), 1300, 'sale brutto from markup source');
  approx(core.calculateSaleBruttoFromMarkupSource('targetSaleAmount', markupState), 1400, 'sale brutto from target source');
  approx(core.calculateSaleBruttoFromMarkupSource('ebayPrice', markupState), 1300, 'sale brutto from ebay source');
  isNaNValue(core.saleBruttoFromMarkup(0, 30), 'sale from zero purchase');
  isNaNValue(core.markupPercent(0, 1300), 'markup from zero purchase');
  isNaNValue(core.ebayFromSaleBrutto(1300, 0, 0.15), 'ebay from sale invalid rate');
  isNaNValue(core.saleBruttoFromEbay(373.75, 0, 0.15), 'sale from ebay invalid rate');
  isNaNValue(core.priceLevelPlnFromEbay(373.75, 0), 'price level invalid rate');

  approx(core.baseMultiplier(0.25, 0.23, 0.15), 0.2875, 'base multiplier');
  approx(core.commissionFromBaseMultiplier(0.2875, 0.25, 0.23), 0.15, 'commission from base multiplier');
  approx(core.baseMultiplier(0.25, 0, 0), 0.2032520325203252, 'base multiplier VAT 0 commission 0');
  isNaNValue(core.baseMultiplier(0, 0.23, 0.15), 'base multiplier invalid rate');
  isNaNValue(core.baseMultiplier(0.25, 0.23, -0.01), 'base multiplier invalid commission');
  isNaNValue(core.commissionFromBaseMultiplier(0, 0.25, 0.23), 'commission from invalid base');
  isNaNValue(core.commissionFromBaseMultiplier(0.2875, 0, 0.23), 'commission from invalid rate');

  root.__calculatorCoreTestResult = 'ok';
})(typeof globalThis !== 'undefined' ? globalThis : window);
