import { CalculationResult } from '../types';
import { historyService } from '../services/historyService';
import { exportService } from '../services/exportService';
import { historyChart } from './historyChart';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { formatCurrency, formatPercentage } from '../utils/formatters';

class HistoryPanel {
  private isVisible = false;
  private panel: HTMLElement | null = null;

  init(): void {
    this.createPanel();
    this.bindEvents();
  }

  private createPanel(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'historyPanel';
    this.panel.className = 'history-panel';
    this.panel.innerHTML = `
      <div class="history-header">
        <h3>Historia Obliczeń</h3>
        <div class="history-actions">
          <button id="exportHistoryCSV" class="btn-secondary">Eksport CSV</button>
          <button id="clearHistory" class="btn-danger">Wyczyść</button>
          <button id="closeHistory" class="btn-close">&times;</button>
        </div>
      </div>
      <div class="history-tabs">
        <button class="tab-btn active" data-tab="list">Lista</button>
        <button class="tab-btn" data-tab="chart">Wykres</button>
        <button class="tab-btn" data-tab="stats">Statystyki</button>
      </div>
      <div class="history-content">
        <div id="historyList" class="tab-content active"></div>
        <div id="historyChart" class="tab-content"></div>
        <div id="historyStats" class="tab-content"></div>
      </div>
    `;
    
    document.body.appendChild(this.panel);
  }

  private bindEvents(): void {
    if (!this.panel) return;

    // Close button
    this.panel.querySelector('#closeHistory')?.addEventListener('click', () => {
      this.hide();
    });

    // Export CSV
    this.panel.querySelector('#exportHistoryCSV')?.addEventListener('click', () => {
      const history = historyService.getHistory();
      exportService.exportHistoryToCSV(history.calculations);
    });

    // Clear history
    this.panel.querySelector('#clearHistory')?.addEventListener('click', () => {
      if (confirm('Czy na pewno chcesz wyczyścić całą historię?')) {
        historyService.clearHistory();
        this.updateContent();
      }
    });

    // Tab switching
    this.panel.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab;
        if (tabName) this.switchTab(tabName);
      });
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
    this.updateContent();
  }

  hide(): void {
    if (!this.panel) return;
    
    this.isVisible = false;
    this.panel.classList.remove('visible');
    document.body.classList.remove('modal-open');
    historyChart.destroy();
  }

  private switchTab(tabName: string): void {
    if (!this.panel) return;

    // Update tab buttons
    this.panel.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    this.panel.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `history${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    });

    // Load content based on tab
    if (tabName === 'chart') {
      this.updateChart();
    } else if (tabName === 'stats') {
      this.updateStats();
    }
  }

  private updateContent(): void {
    this.updateList();
    this.updateChart();
    this.updateStats();
  }

  private updateList(): void {
    const listContainer = this.panel?.querySelector('#historyList');
    if (!listContainer) return;

    const history = historyService.getHistory();
    
    if (history.calculations.length === 0) {
      listContainer.innerHTML = '<p class="empty-state">Brak zapisanych obliczeń</p>';
      return;
    }

    const listHTML = history.calculations.map(calc => `
      <div class="history-item" data-id="${calc.id}">
        <div class="history-item-header">
          <span class="history-date">${format(calc.timestamp, 'dd.MM.yyyy HH:mm', { locale: pl })}</span>
          <div class="history-actions">
            <button class="btn-load" data-id="${calc.id}">Wczytaj</button>
            <button class="btn-export-pdf" data-id="${calc.id}">PDF</button>
            <button class="btn-delete" data-id="${calc.id}">&times;</button>
          </div>
        </div>
        <div class="history-details">
          <div class="detail-row">
            <span>PLN Netto:</span>
            <span>${formatCurrency(calc.plnNetto, 'PLN')}</span>
          </div>
          <div class="detail-row">
            <span>Cena eBay:</span>
            <span>${formatCurrency(calc.ebayPrice, calc.currency)}</span>
          </div>
          <div class="detail-row">
            <span>Mnożnik:</span>
            <span>${calc.multiplier.toFixed(6)}</span>
          </div>
          ${calc.productId ? `
            <div class="detail-row">
              <span>ID Produktu:</span>
              <span>${calc.productId}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    listContainer.innerHTML = listHTML;

    // Bind action buttons
    listContainer.querySelectorAll('.btn-load').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id;
        if (id) this.loadCalculation(id);
      });
    });

    listContainer.querySelectorAll('.btn-export-pdf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id;
        if (id) this.exportCalculationToPDF(id);
      });
    });

    listContainer.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id;
        if (id) this.deleteCalculation(id);
      });
    });
  }

  private updateChart(): void {
    const history = historyService.getHistory();
    historyChart.init('historyChart');
    historyChart.updateChart(history.calculations);
  }

  private updateStats(): void {
    const statsContainer = this.panel?.querySelector('#historyStats');
    if (!statsContainer) return;

    const history = historyService.getHistory();
    const calculations = history.calculations;

    if (calculations.length === 0) {
      statsContainer.innerHTML = '<p class="empty-state">Brak danych do analizy</p>';
      return;
    }

    // Calculate statistics
    const avgEbayPrice = calculations.reduce((sum, calc) => sum + calc.ebayPrice, 0) / calculations.length;
    const avgMultiplier = calculations.reduce((sum, calc) => sum + calc.multiplier, 0) / calculations.length;
    const maxEbayPrice = Math.max(...calculations.map(calc => calc.ebayPrice));
    const minEbayPrice = Math.min(...calculations.map(calc => calc.ebayPrice));
    
    const currencyStats = calculations.reduce((acc, calc) => {
      acc[calc.currency] = (acc[calc.currency] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsedCurrency = Object.entries(currencyStats)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'EUR';

    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <h4>Łączne obliczenia</h4>
          <span class="stat-value">${calculations.length}</span>
        </div>
        <div class="stat-card">
          <h4>Średnia cena eBay</h4>
          <span class="stat-value">${avgEbayPrice.toFixed(2)}</span>
        </div>
        <div class="stat-card">
          <h4>Średni mnożnik</h4>
          <span class="stat-value">${avgMultiplier.toFixed(4)}</span>
        </div>
        <div class="stat-card">
          <h4>Najwyższa cena</h4>
          <span class="stat-value">${maxEbayPrice.toFixed(2)}</span>
        </div>
        <div class="stat-card">
          <h4>Najniższa cena</h4>
          <span class="stat-value">${minEbayPrice.toFixed(2)}</span>
        </div>
        <div class="stat-card">
          <h4>Najczęstsza waluta</h4>
          <span class="stat-value">${mostUsedCurrency}</span>
        </div>
      </div>
      <div class="currency-breakdown">
        <h4>Rozkład walut:</h4>
        ${Object.entries(currencyStats).map(([currency, count]) => `
          <div class="currency-stat">
            <span>${currency}:</span>
            <span>${count} (${((count / calculations.length) * 100).toFixed(1)}%)</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  private loadCalculation(id: string): void {
    const history = historyService.getHistory();
    const calculation = history.calculations.find(calc => calc.id === id);
    
    if (!calculation) return;

    // Load values into form
    (document.getElementById('plnNetto') as HTMLInputElement).value = calculation.plnNetto.toFixed(2);
    (document.getElementById('plnBrutto') as HTMLInputElement).value = calculation.plnBrutto.toFixed(2);
    (document.getElementById('ebayPrice') as HTMLInputElement).value = calculation.ebayPrice.toFixed(2);
    (document.getElementById('currency') as HTMLSelectElement).value = calculation.currency;
    (document.getElementById('exchangeRate') as HTMLInputElement).value = calculation.exchangeRate.toFixed(4);
    (document.getElementById('commission') as HTMLInputElement).value = (calculation.commission * 100).toFixed(1);
    (document.getElementById('vatRate') as HTMLInputElement).value = (calculation.vatRate * 100).toFixed(0);
    
    if (calculation.productId) {
      (document.getElementById('productId') as HTMLInputElement).value = calculation.productId;
    }

    // Update labels
    document.getElementById('currencyLabel')!.innerText = calculation.currency;
    const ebayCurrencyLabel = document.getElementById('ebayCurrencyLabel')!;
    ebayCurrencyLabel.innerText = `${calculation.currency} (z VAT ${(calculation.vatRate * 100).toFixed(0)}%)`;

    this.hide();
    
    // Trigger calculation update
    const event = new Event('input', { bubbles: true });
    document.getElementById('plnNetto')?.dispatchEvent(event);
  }

  private async exportCalculationToPDF(id: string): Promise<void> {
    const history = historyService.getHistory();
    const calculation = history.calculations.find(calc => calc.id === id);
    
    if (calculation) {
      await exportService.exportToPDF(calculation);
    }
  }

  private deleteCalculation(id: string): void {
    if (confirm('Czy na pewno chcesz usunąć to obliczenie?')) {
      historyService.deleteCalculation(id);
      this.updateContent();
    }
  }
}

export const historyPanel = new HistoryPanel();