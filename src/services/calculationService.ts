import { CalculationResult, CalculationSource } from '../types';

class CalculationService {
  private readonly VAT23 = 0.23;

  calculateFromNetto(
    netto: number,
    exchangeRate: number,
    commission: number,
    vatRate: number,
    currency: string,
    productId?: string
  ): CalculationResult {
    const brutto = netto * (1 + this.VAT23);
    const bruttoClient = netto * (1 + vatRate);
    const priceInCurrency = bruttoClient * exchangeRate;
    const ebayPrice = priceInCurrency * (1 + commission);
    const multiplier = (1 + vatRate) * exchangeRate * (1 + commission) / (1 + this.VAT23);

    return {
      id: this.generateId(),
      timestamp: new Date(),
      plnNetto: netto,
      plnBrutto: brutto,
      ebayPrice,
      currency,
      exchangeRate,
      commission,
      vatRate,
      multiplier,
      productId
    };
  }

  calculateFromBrutto(
    brutto: number,
    exchangeRate: number,
    commission: number,
    vatRate: number,
    currency: string,
    productId?: string
  ): CalculationResult {
    const netto = brutto / (1 + this.VAT23);
    return this.calculateFromNetto(netto, exchangeRate, commission, vatRate, currency, productId);
  }

  calculateFromEbayPrice(
    ebayPrice: number,
    exchangeRate: number,
    commission: number,
    vatRate: number,
    currency: string,
    productId?: string
  ): CalculationResult {
    const priceInCurrency = ebayPrice / (1 + commission);
    const bruttoClient = priceInCurrency / exchangeRate;
    const netto = bruttoClient / (1 + vatRate);
    const brutto = netto * (1 + this.VAT23);
    const multiplier = (1 + vatRate) * exchangeRate * (1 + commission) / (1 + this.VAT23);

    return {
      id: this.generateId(),
      timestamp: new Date(),
      plnNetto: netto,
      plnBrutto: brutto,
      ebayPrice,
      currency,
      exchangeRate,
      commission,
      vatRate,
      multiplier,
      productId
    };
  }

  convertEbayPrice(originalPrice: number, originalRate: number, newRate: number): number {
    return (originalPrice * originalRate) / newRate;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const calculationService = new CalculationService();