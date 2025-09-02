import { exchangeRateService } from './services/exchangeRateService';
import { calculationService } from './services/calculationService';
import { historyService } from './services/historyService';
import { settingsService } from './services/settingsService';
import { exportService } from './services/exportService';
import { notificationService } from './services/notificationService';
import { historyPanel } from './components/historyPanel';
import { settingsPanel } from './components/settingsPanel';
import { comparisonTool } from './components/comparisonTool';
import { CalculationSource, CalculationResult } from './types';
import { 
  validatePositiveNumber, 
  validateExchangeRate, 
  validateCommission, 
  validateVatRate,
  validateProductId,
  ValidationError 
} from './utils/validation';

class EbayCalculatorApp {
  private lastChanged: CalculationSource | null = null;
  private originalEbayPrice: number | null = null;
  private originalCurrency = 'EUR';
  private originalExchangeRate = 4.3;
  private lastCurrency = 'EUR';
  private currentExchangeRate = 4.3;
  private isPresetApplied = false;
  private autoSaveEnabled = true;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Initialize services
    notificationService.init();
    historyPanel.init();
    settingsPanel.init();
    comparisonTool.init();

    // Load settings
    const settings = settingsService.getSettings();
    this.applySettings(settings);

    // Bind events
    this.bindFormEvents();
    this.bindButtonEvents();
    this.bindKeyboardShortcuts();

    // Initial exchange rate fetch
    await this.fetchExchangeRate(settings.defaultCurrency);

    // Show welcome notification
    if (settings.notifications) {
      notificationService.success('Kalkulator eBay v2.0 gotowy do użycia!');
    }
  }

  private bindFormEvents(): void {
    const elements = {
      plnNetto: document.getElementById('plnNetto') as HTMLInputElement,
      plnBrutto: document.getElementById('plnBrutto') as HTMLInputElement,
      ebayPrice: document.getElementById('ebayPrice') as HTMLInputElement,
      vatRate: document.getElementById('vatRate') as HTMLInputElement,
      exchangeRate: document.getElementById('exchangeRate') as HTMLInputElement,
      commission: document.getElementById('commission') as HTMLInputElement,
      currency: document.getElementById('currency') as HTMLSelectElement,
    };

    elements.plnNetto.addEventListener('input', () => {
      this.lastChanged = 'netto';
      this.syncFields('netto');
    });

    elements.plnBrutto.addEventListener('input', () => {
      this.lastChanged = 'brutto';
      this.syncFields('brutto');
    });

    elements.ebayPrice.addEventListener('input', () => {
      this.lastChanged = 'ebayPrice';
      this.syncFields('ebayPrice');
    });

    elements.vatRate.addEventListener('input', () => {
      this.lastChanged = 'vatRate';
      this.syncFields('vatRate');
    });

    [elements.exchangeRate, elements.commission].forEach(element => {
      element.addEventListener('input', () => {
        this.handleParameterChange();
      });
    });

    elements.currency.addEventListener('change', () => {
      this.handleCurrencyChange();
    });

    // Advanced options toggle
    const advancedToggle = document.getElementById('advancedOptionsToggle') as HTMLInputElement;
    const advancedOptions = document.getElementById('advancedOptions') as HTMLElement;
    
    advancedToggle.addEventListener('change', () => {
      advancedOptions.style.display = advancedToggle.checked ? 'block' : 'none';
      elements.exchangeRate.disabled = !advancedToggle.checked;
      this.calculatePrice();
    });
  }

  private bindButtonEvents(): void {
    // Theme toggle
    const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLButtonElement;
    themeToggleBtn.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Clear button
    document.getElementById('clearBtn')?.addEventListener('click', () => {
      this.clearForm();
    });

    // Refresh rate button
    document.getElementById('refreshRateBtn')?.addEventListener('click', () => {
      this.refreshExchangeRate();
    });

    // STOCK URL button
    document.getElementById('stockUrlBtn')?.addEventListener('click', () => {
      this.openStockUrl();
    });

    // History button
    document.getElementById('historyBtn')?.addEventListener('click', () => {
      historyPanel.show();
    });

    // Settings button
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
      settingsPanel.show();
    });

    // Comparison button
    document.getElementById('comparisonBtn')?.addEventListener('click', () => {
      comparisonTool.show();
    });

    // Export buttons
    document.getElementById('exportPDFBtn')?.addEventListener('click', () => {
      this.exportCurrentToPDF();
    });

    document.getElementById('exportPNGBtn')?.addEventListener('click', () => {
      exportService.exportCurrentViewToPNG();
    });

    // Preset buttons
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const [currency, vat] = target.dataset.preset!.split('-');
        this.applyPreset(currency, parseInt(vat));
      });
    });
  }

  private bindKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'h':
            e.preventDefault();
            historyPanel.show();
            break;
          case 's':
            e.preventDefault();
            settingsPanel.show();
            break;
          case 'r':
            e.preventDefault();
            this.refreshExchangeRate();
            break;
          case 'k':
            e.preventDefault();
            this.clearForm();
            break;
          case 'e':
            e.preventDefault();
            this.exportCurrentToPDF();
            break;
        }
      }
    });
  }

  private async syncFields(source: CalculationSource): Promise<void> {
    const elements = this.getFormElements();
    const resultDiv = document.getElementById('result') as HTMLElement;

    try {
      // Validate inputs based on source
      if (source === 'netto') {
        const netto = parseFloat(elements.plnNetto.value);
        validatePositiveNumber(netto, 'Kwota netto');
        await this.calculateFromNetto(netto);
      } else if (source === 'brutto') {
        const brutto = parseFloat(elements.plnBrutto.value);
        validatePositiveNumber(brutto, 'Kwota brutto');
        await this.calculateFromBrutto(brutto);
      } else if (source === 'ebayPrice') {
        const ebayPrice = parseFloat(elements.ebayPrice.value);
        validatePositiveNumber(ebayPrice, 'Cena eBay');
        await this.calculateFromEbayPrice(ebayPrice);
      } else if (source === 'vatRate') {
        const vatRate = parseFloat(elements.vatRate.value);
        validateVatRate(vatRate);
        await this.recalculateWithNewVat(vatRate);
      }

      this.calculatePrice();
    } catch (error) {
      if (error instanceof ValidationError) {
        resultDiv.innerHTML = `<span class="error">${error.message}</span>`;
        return;
      }
      throw error;
    }
  }

  private async calculateFromNetto(netto: number): Promise<void> {
    const { exchangeRate, commission, vatRate, currency, productId } = this.getCalculationParams();
    
    const calculation = calculationService.calculateFromNetto(
      netto, exchangeRate, commission, vatRate, currency, productId
    );

    this.updateFormFromCalculation(calculation);
    this.saveCalculationIfEnabled(calculation);
  }

  private async calculateFromBrutto(brutto: number): Promise<void> {
    const { exchangeRate, commission, vatRate, currency, productId } = this.getCalculationParams();
    
    const calculation = calculationService.calculateFromBrutto(
      brutto, exchangeRate, commission, vatRate, currency, productId
    );

    this.updateFormFromCalculation(calculation);
    this.saveCalculationIfEnabled(calculation);
  }

  private async calculateFromEbayPrice(ebayPrice: number): Promise<void> {
    const { exchangeRate, commission, vatRate, currency, productId } = this.getCalculationParams();
    
    const calculation = calculationService.calculateFromEbayPrice(
      ebayPrice, exchangeRate, commission, vatRate, currency, productId
    );

    this.updateFormFromCalculation(calculation);
    this.saveCalculationIfEnabled(calculation);
  }

  private async recalculateWithNewVat(vatRate: number): Promise<void> {
    this.updateEbayCurrencyLabel();
    
    const elements = this.getFormElements();
    let netto = parseFloat(elements.plnNetto.value);
    
    if (isNaN(netto)) {
      const brutto = parseFloat(elements.plnBrutto.value);
      if (!isNaN(brutto)) {
        netto = brutto / 1.23; // VAT23
        elements.plnNetto.value = netto.toFixed(2);
      }
    }

    if (!isNaN(netto) && netto > 0) {
      await this.calculateFromNetto(netto);
    }
  }

  private getFormElements() {
    return {
      plnNetto: document.getElementById('plnNetto') as HTMLInputElement,
      plnBrutto: document.getElementById('plnBrutto') as HTMLInputElement,
      ebayPrice: document.getElementById('ebayPrice') as HTMLInputElement,
      vatRate: document.getElementById('vatRate') as HTMLInputElement,
      exchangeRate: document.getElementById('exchangeRate') as HTMLInputElement,
      commission: document.getElementById('commission') as HTMLInputElement,
      currency: document.getElementById('currency') as HTMLSelectElement,
      productId: document.getElementById('productId') as HTMLInputElement,
    };
  }

  private getCalculationParams() {
    const elements = this.getFormElements();
    const advancedToggle = document.getElementById('advancedOptionsToggle') as HTMLInputElement;
    
    return {
      exchangeRate: parseFloat(elements.exchangeRate.value),
      commission: advancedToggle.checked ? parseFloat(elements.commission.value) / 100 : 0.15,
      vatRate: parseFloat(elements.vatRate.value) / 100,
      currency: elements.currency.value,
      productId: elements.productId.value || undefined
    };
  }

  private updateFormFromCalculation(calculation: CalculationResult): void {
    const elements = this.getFormElements();
    
    elements.plnNetto.value = calculation.plnNetto.toFixed(2);
    elements.plnBrutto.value = calculation.plnBrutto.toFixed(2);
    elements.ebayPrice.value = calculation.ebayPrice.toFixed(2);
    
    this.originalEbayPrice = calculation.ebayPrice;
    this.originalCurrency = calculation.currency;
    this.originalExchangeRate = calculation.exchangeRate;
  }

  private saveCalculationIfEnabled(calculation: CalculationResult): void {
    const settings = settingsService.getSettings();
    if (settings.autoSave) {
      historyService.saveCalculation(calculation);
    }
  }

  private calculatePrice(): void {
    const elements = this.getFormElements();
    const resultDiv = document.getElementById('result') as HTMLElement;

    try {
      const { exchangeRate, commission, vatRate, currency } = this.getCalculationParams();
      
      validateExchangeRate(exchangeRate);
      validateCommission(commission * 100);
      validateVatRate(vatRate * 100);

      const netto = parseFloat(elements.plnNetto.value);
      const ebayPrice = parseFloat(elements.ebayPrice.value);

      const bruttoClient = 1 * (1 + vatRate);
      const priceInCurrency = bruttoClient * exchangeRate;
      const finalPriceMultiplier = priceInCurrency * (1 + commission);
      const multiplierBrutto = finalPriceMultiplier / 1.23;

      let resultHTML = `
        <div class="result-main">
          <div class="multiplier-section">
            <span class="multiplier-label">Mnożnik dla <a href="https://panel-e.baselinker.com/inventory_settings#price_groups" target="_blank">Base</a> → ${currency}:</span>
            <span class="multiplier-value">${multiplierBrutto.toFixed(6)}</span>
          </div>
          <div class="tooltip">Pomnóż kwotę netto lub brutto w PLN przez mnożnik, aby uzyskać cenę na eBay w ${currency}.</div>
        </div>
      `;

      if (!isNaN(ebayPrice) && ebayPrice > 0 && this.lastChanged === 'ebayPrice' && !this.isPresetApplied) {
        resultHTML = `
          <div class="result-price">
            <strong>Cena końcowa w ${currency} (dla klienta):</strong> 
            <span class="final-price">${formatCurrency(ebayPrice, currency)}</span>
          </div>
          ${resultHTML}
        `;
      } else if (!isNaN(netto) && netto > 0) {
        const calculation = calculationService.calculateFromNetto(
          netto, exchangeRate, commission, vatRate, currency
        );
        resultHTML = `
          <div class="result-price">
            <strong>Cena końcowa w ${currency} (dla klienta):</strong> 
            <span class="final-price">${formatCurrency(calculation.ebayPrice, currency)}</span>
          </div>
          ${resultHTML}
        `;
      }

      resultDiv.innerHTML = resultHTML;
    } catch (error) {
      if (error instanceof ValidationError) {
        resultDiv.innerHTML = `<span class="error">${error.message}</span>`;
      } else {
        resultDiv.innerHTML = '<span class="error">Wystąpił nieoczekiwany błąd.</span>';
      }
    }
  }

  private async fetchExchangeRate(currency: string): Promise<void> {
    const exchangeInfo = document.getElementById('exchangeInfo') as HTMLElement;
    const exchangeRateInput = document.getElementById('exchangeRate') as HTMLInputElement;
    
    exchangeInfo.innerText = 'Pobieranie kursu...';

    try {
      const rate = await exchangeRateService.fetchExchangeRate(currency);
      exchangeRateInput.value = rate.toFixed(4);
      this.currentExchangeRate = rate;
      
      const now = new Date();
      exchangeInfo.innerText = `Kurs PLN/${currency}: ${rate.toFixed(4)} (${now.toLocaleString('pl-PL')})`;

      this.handleCurrencyRateUpdate(rate);
    } catch (error) {
      exchangeInfo.innerText = `Błąd pobierania kursu dla ${currency}`;
      notificationService.error('Nie udało się pobrać aktualnego kursu waluty');
    }
  }

  private handleCurrencyRateUpdate(rate: number): void {
    const ebayPriceInput = document.getElementById('ebayPrice') as HTMLInputElement;
    
    if (this.lastChanged === 'ebayPrice' && !isNaN(parseFloat(ebayPriceInput.value)) && this.lastCurrency !== document.getElementById('currency')!.value && !this.isPresetApplied) {
      const newEbayPrice = calculationService.convertEbayPrice(this.originalEbayPrice!, this.originalExchangeRate, rate);
      ebayPriceInput.value = newEbayPrice.toFixed(2);
      this.syncFields('ebayPrice');
    } else if (this.lastChanged && ['netto', 'brutto', 'vatRate'].includes(this.lastChanged)) {
      this.syncFields(this.lastChanged);
    } else {
      this.calculatePrice();
    }

    this.lastCurrency = (document.getElementById('currency') as HTMLSelectElement).value;
    this.isPresetApplied = false;
  }

  private handleParameterChange(): void {
    if (this.lastChanged === 'ebayPrice' && !isNaN(parseFloat((document.getElementById('ebayPrice') as HTMLInputElement).value))) {
      this.syncFields('ebayPrice');
    } else if (this.lastChanged && ['netto', 'brutto'].includes(this.lastChanged)) {
      this.syncFields(this.lastChanged);
    } else if (this.lastChanged === 'vatRate') {
      this.syncFields('vatRate');
    } else {
      this.calculatePrice();
    }
  }

  private async handleCurrencyChange(): Promise<void> {
    const selectedCurrency = (document.getElementById('currency') as HTMLSelectElement).value;
    document.getElementById('currencyLabel')!.innerText = selectedCurrency;
    this.updateEbayCurrencyLabel();
    await this.fetchExchangeRate(selectedCurrency);
  }

  private updateEbayCurrencyLabel(): void {
    const currency = (document.getElementById('currency') as HTMLSelectElement).value;
    const vatRate = parseInt((document.getElementById('vatRate') as HTMLInputElement).value) || 0;
    const ebayCurrencyLabel = document.getElementById('ebayCurrencyLabel') as HTMLElement;
    ebayCurrencyLabel.innerText = `${currency} (z VAT ${vatRate}%)`;
  }

  private applyPreset(currency: string, vat: number): void {
    this.isPresetApplied = true;
    (document.getElementById('currency') as HTMLSelectElement).value = currency;
    (document.getElementById('vatRate') as HTMLInputElement).value = vat.toString();
    document.getElementById('currencyLabel')!.innerText = currency;
    
    const ebayCurrencyLabel = document.getElementById('ebayCurrencyLabel') as HTMLElement;
    ebayCurrencyLabel.innerText = `${currency} (z VAT ${vat}%)`;
    
    this.lastChanged = 'vatRate';
    this.fetchExchangeRate(currency);
    
    notificationService.info(`Zastosowano preset: ${currency} VAT ${vat}%`);
  }

  private clearForm(): void {
    const elements = this.getFormElements();
    const settings = settingsService.getSettings();
    
    elements.plnNetto.value = '';
    elements.plnBrutto.value = '';
    elements.ebayPrice.value = '';
    elements.vatRate.value = settings.defaultVatRate.toString();
    elements.commission.value = settings.defaultCommission.toString();
    elements.productId.value = '';
    elements.currency.value = settings.defaultCurrency;
    
    document.getElementById('currencyLabel')!.innerText = settings.defaultCurrency;
    this.updateEbayCurrencyLabel();
    
    const advancedToggle = document.getElementById('advancedOptionsToggle') as HTMLInputElement;
    const advancedOptions = document.getElementById('advancedOptions') as HTMLElement;
    
    advancedToggle.checked = false;
    advancedOptions.style.display = 'none';
    elements.exchangeRate.disabled = true;
    
    this.lastChanged = null;
    this.originalEbayPrice = null;
    this.originalCurrency = settings.defaultCurrency;
    this.lastCurrency = settings.defaultCurrency;
    
    this.fetchExchangeRate(settings.defaultCurrency);
    notificationService.info('Formularz został wyczyszczony');
  }

  private async refreshExchangeRate(): Promise<void> {
    exchangeRateService.clearCache();
    const currency = (document.getElementById('currency') as HTMLSelectElement).value;
    await this.fetchExchangeRate(currency);
    notificationService.success('Kurs waluty został odświeżony');
  }

  private openStockUrl(): void {
    const productId = (document.getElementById('productId') as HTMLInputElement).value;
    
    if (validateProductId(productId)) {
      const url = `https://stock/product/product/details/${productId}`;
      window.open(url, '_blank');
    } else {
      notificationService.error('ID produktu musi być liczbą od 1 do 6 cyfr');
    }
  }

  private async exportCurrentToPDF(): Promise<void> {
    const elements = this.getFormElements();
    const netto = parseFloat(elements.plnNetto.value);
    
    if (isNaN(netto) || netto <= 0) {
      notificationService.error('Wprowadź prawidłowe dane do eksportu');
      return;
    }

    const { exchangeRate, commission, vatRate, currency, productId } = this.getCalculationParams();
    
    const calculation = calculationService.calculateFromNetto(
      netto, exchangeRate, commission, vatRate, currency, productId
    );

    await exportService.exportToPDF(calculation);
    notificationService.success('Raport PDF został wygenerowany');
  }

  private toggleTheme(): void {
    const body = document.body;
    const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLButtonElement;
    
    body.classList.toggle('dark-mode');
    
    const isDark = body.classList.contains('dark-mode');
    themeToggleBtn.textContent = isDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny';
    
    settingsService.updateSettings({ theme: isDark ? 'dark' : 'light' });
  }

  private applySettings(settings: any): void {
    // Apply theme
    if (settings.theme === 'dark') {
      document.body.classList.add('dark-mode');
      (document.getElementById('themeToggleBtn') as HTMLButtonElement).textContent = 'Włącz tryb jasny';
    }

    // Apply default values
    (document.getElementById('currency') as HTMLSelectElement).value = settings.defaultCurrency;
    (document.getElementById('commission') as HTMLInputElement).value = settings.defaultCommission.toString();
    (document.getElementById('vatRate') as HTMLInputElement).value = settings.defaultVatRate.toString();
    
    document.getElementById('currencyLabel')!.innerText = settings.defaultCurrency;
    this.updateEbayCurrencyLabel();
    
    this.autoSaveEnabled = settings.autoSave;
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new EbayCalculatorApp();
});