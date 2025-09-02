import { exchangeRateService } from '../services/exchangeRateService';
import { calculationService } from '../services/calculationService';
import { formatCurrency } from '../utils/formatters';

class ComparisonTool {
  private panel: HTMLElement | null = null;
  private isVisible = false;

  init(): void {
    this.createPanel();
    this.bindEvents();
  }

  private createPanel(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'comparisonPanel';
    this.panel.className = 'comparison-panel';
    this.panel.innerHTML = `
      <div class="comparison-header">
        <h3>Porównanie Walut</h3>
        <button id="closeComparison" class="btn-close">&times;</button>
      </div>
      <div class="comparison-content">
        <div class="comparison-input">
          <label for="comparisonNetto">PLN Netto:</label>
          <input type="number" id="comparisonNetto" step="0.01" min="0" placeholder="Wprowadź kwotę">
          <button id="calculateComparison" class="btn-primary">Porównaj</button>
        </div>
        <div id="comparisonResults" class="comparison-results"></div>
      </div>
    `;
    
    document.body.appendChild(this.panel);
  }

  private bindEvents(): void {
    if (!this.panel) return;

    this.panel.querySelector('#closeComparison')?.addEventListener('click', () => {
      this.hide();
    });

    this.panel.querySelector('#calculateComparison')?.addEventListener('click', () => {
      this.calculateComparison();
    });

    this.panel.querySelector('#comparisonNetto')?.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        this.calculateComparison();
      }
    });

    // Close on outside click
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) {
        this.hide();
      }
    });
  }

  show(): void {
    if (!this.panel) return;
    
    this.isVisible = true;
    this.panel.classList.add('visible');
    document.body.classList.add('modal-open');
  }

  hide(): void {
    if (!this.panel) return;
    
    this.isVisible = false;
    this.panel.classList.remove('visible');
    document.body.classList.remove('modal-open');
  }

  private async calculateComparison(): void {
    const nettoInput = this.panel?.querySelector('#comparisonNetto') as HTMLInputElement;
    const resultsContainer = this.panel?.querySelector('#comparisonResults');
    
    if (!nettoInput || !resultsContainer) return;

    const netto = parseFloat(nettoInput.value);
    if (isNaN(netto) || netto <= 0) {
      resultsContainer.innerHTML = '<p class="error">Wprowadź prawidłową kwotę netto</p>';
      return;
    }

    resultsContainer.innerHTML = '<p>Obliczanie...</p>';

    try {
      const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'NOK', 'SEK', 'DKK'];
      const rates = await exchangeRateService.fetchMultipleRates(currencies);
      
      const commission = parseFloat((document.getElementById('commission') as HTMLInputElement).value) / 100 || 0.15;
      const vatRate = parseFloat((document.getElementById('vatRate') as HTMLInputElement).value) / 100 || 0.23;

      const results = currencies.map(currency => {
        const rate = rates[currency];
        if (!rate) return null;

        const calculation = calculationService.calculateFromNetto(
          netto, rate, commission, vatRate, currency
        );

        return {
          currency,
          rate,
          ebayPrice: calculation.ebayPrice,
          multiplier: calculation.multiplier
        };
      }).filter(Boolean);

      // Sort by eBay price
      results.sort((a, b) => (a?.ebayPrice || 0) - (b?.ebayPrice || 0));

      const resultsHTML = `
        <div class="comparison-table">
          <div class="comparison-row comparison-header-row">
            <span>Waluta</span>
            <span>Kurs</span>
            <span>Cena eBay</span>
            <span>Mnożnik</span>
          </div>
          ${results.map(result => `
            <div class="comparison-row">
              <span class="currency-code">${result?.currency}</span>
              <span>${result?.rate.toFixed(4)}</span>
              <span class="price">${formatCurrency(result?.ebayPrice || 0, result?.currency || 'EUR')}</span>
              <span class="multiplier">${result?.multiplier.toFixed(6)}</span>
            </div>
          `).join('')}
        </div>
        <div class="comparison-insights">
          <p><strong>Najlepsza opcja:</strong> ${results[0]?.currency} - ${formatCurrency(results[0]?.ebayPrice || 0, results[0]?.currency || 'EUR')}</p>
          <p><strong>Różnica:</strong> ${((results[results.length - 1]?.ebayPrice || 0) - (results[0]?.ebayPrice || 0)).toFixed(2)} między najdroższą a najtańszą</p>
        </div>
      `;

      resultsContainer.innerHTML = resultsHTML;
    } catch (error) {
      resultsContainer.innerHTML = '<p class="error">Błąd podczas pobierania kursów walut</p>';
    }
  }
}

export const comparisonTool = new ComparisonTool();