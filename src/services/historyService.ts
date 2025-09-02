import { CalculationResult, CalculationHistory } from '../types';

class HistoryService {
  private readonly STORAGE_KEY = 'ebay-calculator-history';
  private readonly MAX_HISTORY_ITEMS = 100;

  saveCalculation(calculation: CalculationResult): void {
    const history = this.getHistory();
    history.calculations.unshift(calculation);
    
    // Keep only the most recent items
    if (history.calculations.length > this.MAX_HISTORY_ITEMS) {
      history.calculations = history.calculations.slice(0, this.MAX_HISTORY_ITEMS);
    }
    
    history.lastUpdated = new Date();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  getHistory(): CalculationHistory {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          calculations: parsed.calculations.map((calc: any) => ({
            ...calc,
            timestamp: new Date(calc.timestamp)
          })),
          lastUpdated: new Date(parsed.lastUpdated)
        };
      }
    } catch (error) {
      console.warn('Failed to load history:', error);
    }
    
    return { calculations: [], lastUpdated: new Date() };
  }

  clearHistory(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  deleteCalculation(id: string): void {
    const history = this.getHistory();
    history.calculations = history.calculations.filter(calc => calc.id !== id);
    history.lastUpdated = new Date();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  exportToCSV(): string {
    const history = this.getHistory();
    const headers = ['Data', 'PLN Netto', 'PLN Brutto', 'Cena eBay', 'Waluta', 'Kurs', 'Prowizja %', 'VAT %', 'Mnożnik', 'ID Produktu'];
    
    const rows = history.calculations.map(calc => [
      calc.timestamp.toLocaleString('pl-PL'),
      calc.plnNetto.toFixed(2),
      calc.plnBrutto.toFixed(2),
      calc.ebayPrice.toFixed(2),
      calc.currency,
      calc.exchangeRate.toFixed(4),
      (calc.commission * 100).toFixed(1),
      (calc.vatRate * 100).toFixed(0),
      calc.multiplier.toFixed(6),
      calc.productId || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const historyService = new HistoryService();