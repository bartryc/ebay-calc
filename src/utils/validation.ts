export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validatePositiveNumber(value: number, fieldName: string): void {
  if (isNaN(value) || value < 0) {
    throw new ValidationError(`${fieldName} nie może być ujemna.`);
  }
}

export function validateExchangeRate(rate: number): void {
  if (isNaN(rate) || rate <= 0) {
    throw new ValidationError('Kurs waluty musi być dodatni.');
  }
}

export function validateCommission(commission: number): void {
  if (isNaN(commission) || commission < 0 || commission > 100) {
    throw new ValidationError('Prowizja musi być w przedziale 0-100%.');
  }
}

export function validateVatRate(vatRate: number): void {
  if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
    throw new ValidationError('Stawka VAT musi być w przedziale 0-100%.');
  }
}

export function validateProductId(productId: string): boolean {
  return /^\d{1,6}$/.test(productId);
}