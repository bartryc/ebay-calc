(function (root) {
  'use strict';

  const service = root.RateService;
  if (!service) throw new Error('RateService is not loaded');

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

  equal(service.normalizeProviderKey('erapi'), 'erapi', 'provider erapi');
  equal(service.normalizeProviderKey('nbp'), 'nbp', 'provider nbp');
  equal(service.normalizeProviderKey('exchangerate'), 'nbp', 'provider legacy exchangerate');
  equal(service.normalizeProviderKey('frankfurter'), service.DEFAULT_PROVIDER, 'provider frankfurter fallback');
  equal(service.normalizeProviderKey('unknown'), service.DEFAULT_PROVIDER, 'provider unknown fallback');
  equal(service.getFallbackProviderKey('erapi'), 'nbp', 'fallback from erapi');
  equal(service.getFallbackProviderKey('nbp'), 'erapi', 'fallback from nbp');
  approx(service.readProviderRate('erapi', { rates: { EUR: 0.2357 } }, 'EUR'), 0.2357, 'erapi rate');
  approx(service.readProviderRate('nbp', { rates: [{ mid: 4.2427 }] }, 'EUR'), 1 / 4.2427, 'nbp inverse rate');
  equal(service.readProviderRate('nbp', { rates: [{ mid: 0 }] }, 'EUR'), null, 'nbp invalid rate');
  approx(service.getDefaultRate('GBP'), 5, 'default known rate');
  approx(service.getDefaultRate('CHF'), 4.3, 'default unknown rate');
  equal(service.getProviderKeys().includes('erapi'), true, 'provider keys erapi');

  root.__rateServiceTestResult = 'ok';
})(typeof globalThis !== 'undefined' ? globalThis : window);
