import { ExchangeRateData } from '../types';

class ExchangeRateService {
  private cache = new Map<string, { data: ExchangeRateData; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_RATES = { EUR: 4.3, USD: 3.9, GBP: 5.0, CHF: 4.2, NOK: 0.37, SEK: 0.36, DKK: 0.58 };

  async fetchExchangeRate(currency: string): Promise<number> {
    const cacheKey = `PLN-${currency}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data.rates[currency];
    }

    try {
      const response = await fetch(`https://api.frankfurter.app/latest?from=PLN&to=${currency}`);
      if (!response.ok) throw new Error('Network error');
      
      const data: ExchangeRateData = await response.json();
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      
      return data.rates[currency];
    } catch (error) {
      console.warn('Failed to fetch exchange rate, using fallback:', error);
      return this.DEFAULT_RATES[currency as keyof typeof this.DEFAULT_RATES] || 4.3;
    }
  }

  async fetchMultipleRates(currencies: string[]): Promise<Record<string, number>> {
    const rates: Record<string, number> = {};
    
    try {
      const currencyList = currencies.join(',');
      const response = await fetch(`https://api.frankfurter.app/latest?from=PLN&to=${currencyList}`);
      
      if (response.ok) {
        const data: ExchangeRateData = await response.json();
        return data.rates;
      }
    } catch (error) {
      console.warn('Failed to fetch multiple rates, using fallbacks:', error);
    }

    // Fallback to individual requests
    for (const currency of currencies) {
      rates[currency] = await this.fetchExchangeRate(currency);
    }
    
    return rates;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const exchangeRateService = new ExchangeRateService();