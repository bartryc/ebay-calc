(function (root) {
  'use strict';

  const DEFAULT_RATES = { EUR: 4.3, USD: 3.9, GBP: 5.0 };
  const DEFAULT_PROVIDER = 'erapi';
  const PROVIDERS = {
    erapi: {
      label: 'open.er-api.com',
      buildUrl: () => 'https://open.er-api.com/v6/latest/PLN',
      readRate: (data, currency) => data?.rates?.[currency]
    },
    nbp: {
      label: 'NBP API',
      buildUrl: (currency) => `https://api.nbp.pl/api/exchangerates/rates/A/${currency}/?format=json`,
      readRate: (data) => {
        const mid = data?.rates?.[0]?.mid;
        if (!Number.isFinite(mid) || mid <= 0) return null;
        return 1 / mid;
      }
    }
  };

  function normalizeProviderKey(value) {
    const keyRaw = String(value || '').trim().toLowerCase();
    const key = keyRaw === 'exchangerate' ? 'nbp' : keyRaw;
    if (key === 'frankfurter') return DEFAULT_PROVIDER;
    return PROVIDERS[key] ? key : DEFAULT_PROVIDER;
  }

  function getProvider(key) {
    const providerKey = normalizeProviderKey(key);
    return {
      key: providerKey,
      provider: PROVIDERS[providerKey]
    };
  }

  function getFallbackProviderKey(providerKey) {
    const normalized = normalizeProviderKey(providerKey);
    return Object.keys(PROVIDERS).find((key) => key !== normalized) || null;
  }

  function readProviderRate(providerKey, data, currency) {
    const { provider } = getProvider(providerKey);
    const rate = provider.readRate(data, currency);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  function getDefaultRate(currency) {
    return DEFAULT_RATES[currency] || 4.3;
  }

  function getProviderKeys() {
    return Object.keys(PROVIDERS);
  }

  function createFetchRate(fetchImpl) {
    return function fetchRate(providerKey, currency) {
      const { key, provider } = getProvider(providerKey);
      return fetchImpl(provider.buildUrl(currency))
        .then((response) => {
          if (!response.ok) throw new Error('Błąd sieci');
          return response.json();
        })
        .then((data) => {
          const rate = readProviderRate(key, data, currency);
          if (!rate) throw new Error('Brak kursu dla wybranej waluty');
          return { rate, label: provider.label, key };
        });
    };
  }

  const api = {
    DEFAULT_RATES,
    DEFAULT_PROVIDER,
    PROVIDERS,
    normalizeProviderKey,
    getProvider,
    getFallbackProviderKey,
    readProviderRate,
    getDefaultRate,
    getProviderKeys,
    createFetchRate
  };

  root.RateService = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
