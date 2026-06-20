(function (root) {
  'use strict';

  const DEFAULT_RATES = { EUR: 4.3, USD: 3.9, GBP: 5.0 };
  const DEFAULT_PROVIDER = 'erapi';
  const DEFAULT_RATE_PROVIDERS = [
    {
      id: 'erapi',
      label: 'open.er-api.com',
      enabled: true,
      url: 'https://open.er-api.com/v6/latest/PLN',
      responsePath: 'rates.{CURRENCY}',
      transform: 'direct'
    },
    {
      id: 'nbp',
      label: 'NBP API',
      enabled: true,
      url: 'https://api.nbp.pl/api/exchangerates/rates/A/{CURRENCY}/?format=json',
      responsePath: 'rates.0.mid',
      transform: 'inverse'
    }
  ];
  const PROVIDERS = {};

  function readPath(data, path, currency) {
    const normalizedPath = String(path || '').replace(/\{CURRENCY\}/g, String(currency || ''));
    if (!normalizedPath) return null;
    return normalizedPath
      .split('.')
      .filter(Boolean)
      .reduce((acc, key) => (acc == null ? undefined : acc[key]), data);
  }

  function normalizeCustomProvider(item) {
    const idRaw = String(item?.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!idRaw) return null;
    const url = String(item?.url || '').trim();
    const responsePath = String(item?.responsePath || '').trim();
    if (!url || !responsePath) return null;
    const label = String(item?.label || item?.name || '').trim() || idRaw;
    const transform = String(item?.transform || 'direct').trim().toLowerCase() === 'inverse' ? 'inverse' : 'direct';
    return {
      id: idRaw,
      label,
      url,
      responsePath,
      transform,
      enabled: item?.enabled !== false
    };
  }

  function buildCustomProvider(item) {
    return {
      label: item.label,
      custom: true,
      buildUrl: (currency) => item.url.replace(/\{CURRENCY\}/g, encodeURIComponent(String(currency || ''))),
      readRate: (data, currency) => {
        const raw = parseFloat(String(readPath(data, item.responsePath, currency) ?? '').replace(',', '.'));
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return item.transform === 'inverse' ? 1 / raw : raw;
      }
    };
  }

  function registerCustomProviders(items) {
    Object.keys(PROVIDERS).forEach((key) => {
      delete PROVIDERS[key];
    });
    const normalized = Array.isArray(items)
      ? items.map(normalizeCustomProvider).filter((item) => item && item.enabled)
      : [];
    normalized.forEach((item) => {
      PROVIDERS[item.id] = buildCustomProvider(item);
    });
    return normalized;
  }

  function normalizeProviderKey(value) {
    const keyRaw = String(value || '').trim().toLowerCase();
    const key = keyRaw === 'exchangerate' ? 'nbp' : keyRaw;
    if (key === 'frankfurter') return DEFAULT_PROVIDER;
    if (PROVIDERS[key]) return key;
    if (PROVIDERS[DEFAULT_PROVIDER]) return DEFAULT_PROVIDER;
    return Object.keys(PROVIDERS)[0] || DEFAULT_PROVIDER;
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

  function registerCustomCurrencies(items) {
    if (!Array.isArray(items)) return [];
    const normalized = items
      .map((item) => {
        const code = String(item?.code || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
        const fallbackRate = parseFloat(String(item?.fallbackRate ?? '').replace(',', '.'));
        if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(fallbackRate) || fallbackRate <= 0) return null;
        return { code, fallbackRate };
      })
      .filter(Boolean);
    normalized.forEach((item) => {
      DEFAULT_RATES[item.code] = item.fallbackRate;
    });
    return normalized;
  }

  function getProviderKeys() {
    return Object.keys(PROVIDERS);
  }

  function getProviderOptions() {
    return getProviderKeys().map((key) => ({ id: key, label: PROVIDERS[key].label }));
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
    DEFAULT_RATE_PROVIDERS,
    PROVIDERS,
    normalizeProviderKey,
    getProvider,
    getFallbackProviderKey,
    readProviderRate,
    getDefaultRate,
    getProviderKeys,
    getProviderOptions,
    registerCustomProviders,
    registerCustomCurrencies,
    createFetchRate
  };

  registerCustomProviders(DEFAULT_RATE_PROVIDERS);

  root.RateService = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
