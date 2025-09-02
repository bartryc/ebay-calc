export interface CalculationResult {
  id: string;
  timestamp: Date;
  plnNetto: number;
  plnBrutto: number;
  ebayPrice: number;
  currency: string;
  exchangeRate: number;
  commission: number;
  vatRate: number;
  multiplier: number;
  productId?: string;
}

export interface ExchangeRateData {
  rates: Record<string, number>;
  date: string;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
}

export interface CalculationHistory {
  calculations: CalculationResult[];
  lastUpdated: Date;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  defaultCurrency: string;
  defaultCommission: number;
  defaultVatRate: number;
  autoSave: boolean;
  notifications: boolean;
}

export type CalculationSource = 'netto' | 'brutto' | 'ebayPrice' | 'vatRate';