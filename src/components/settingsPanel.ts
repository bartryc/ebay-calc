import { settingsService } from '../services/settingsService';
import { AppSettings } from '../types';

class SettingsPanel {
  private isVisible = false;
  private panel: HTMLElement | null = null;

  init(): void {
    this.createPanel();
    this.bindEvents();
    this.loadSettings();
  }

  private createPanel(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'settingsPanel';
    this.panel.className = 'settings-panel';
    this.panel.innerHTML = `
      <div class="settings-header">
        <h3>Ustawienia</h3>
        <button id="closeSettings" class="btn-close">&times;</button>
      </div>
      <div class="settings-content">
        <div class="setting-group">
          <label for="defaultCurrency">Domyślna waluta:</label>
          <select id="defaultCurrency">
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="CHF">CHF</option>
            <option value="NOK">NOK</option>
            <option value="SEK">SEK</option>
            <option value="DKK">DKK</option>
          </select>
        </div>
        
        <div class="setting-group">
          <label for="defaultCommission">Domyślna prowizja (%):</label>
          <input type="number" id="defaultCommission" min="0" max="100" step="0.1">
        </div>
        
        <div class="setting-group">
          <label for="defaultVatRate">Domyślna stawka VAT (%):</label>
          <input type="number" id="defaultVatRate" min="0" max="100" step="1">
        </div>
        
        <div class="setting-group">
          <label class="toggle-switch">
            <input type="checkbox" id="autoSave">
            <span class="slider"></span>
            Automatyczne zapisywanie obliczeń
          </label>
        </div>
        
        <div class="setting-group">
          <label class="toggle-switch">
            <input type="checkbox" id="notifications">
            <span class="slider"></span>
            Powiadomienia
          </label>
        </div>
        
        <div class="settings-actions">
          <button id="saveSettings" class="btn-primary">Zapisz ustawienia</button>
          <button id="resetSettings" class="btn-secondary">Przywróć domyślne</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.panel);
  }

  private bindEvents(): void {
    if (!this.panel) return;

    this.panel.querySelector('#closeSettings')?.addEventListener('click', () => {
      this.hide();
    });

    this.panel.querySelector('#saveSettings')?.addEventListener('click', () => {
      this.saveSettings();
    });

    this.panel.querySelector('#resetSettings')?.addEventListener('click', () => {
      if (confirm('Czy na pewno chcesz przywrócić domyślne ustawienia?')) {
        this.resetSettings();
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
    this.loadSettings();
  }

  hide(): void {
    if (!this.panel) return;
    
    this.isVisible = false;
    this.panel.classList.remove('visible');
    document.body.classList.remove('modal-open');
  }

  private loadSettings(): void {
    const settings = settingsService.getSettings();
    
    (this.panel?.querySelector('#defaultCurrency') as HTMLSelectElement).value = settings.defaultCurrency;
    (this.panel?.querySelector('#defaultCommission') as HTMLInputElement).value = settings.defaultCommission.toString();
    (this.panel?.querySelector('#defaultVatRate') as HTMLInputElement).value = settings.defaultVatRate.toString();
    (this.panel?.querySelector('#autoSave') as HTMLInputElement).checked = settings.autoSave;
    (this.panel?.querySelector('#notifications') as HTMLInputElement).checked = settings.notifications;
  }

  private saveSettings(): void {
    const settings: AppSettings = {
      theme: document.body.classList.contains('dark-mode') ? 'dark' : 'light',
      defaultCurrency: (this.panel?.querySelector('#defaultCurrency') as HTMLSelectElement).value,
      defaultCommission: parseFloat((this.panel?.querySelector('#defaultCommission') as HTMLInputElement).value),
      defaultVatRate: parseFloat((this.panel?.querySelector('#defaultVatRate') as HTMLInputElement).value),
      autoSave: (this.panel?.querySelector('#autoSave') as HTMLInputElement).checked,
      notifications: (this.panel?.querySelector('#notifications') as HTMLInputElement).checked
    };

    settingsService.updateSettings(settings);
    this.hide();
    
    // Apply settings to current form
    this.applySettingsToForm(settings);
  }

  private resetSettings(): void {
    settingsService.resetSettings();
    this.loadSettings();
  }

  private applySettingsToForm(settings: AppSettings): void {
    (document.getElementById('currency') as HTMLSelectElement).value = settings.defaultCurrency;
    (document.getElementById('commission') as HTMLInputElement).value = settings.defaultCommission.toString();
    (document.getElementById('vatRate') as HTMLInputElement).value = settings.defaultVatRate.toString();
    
    // Update labels
    document.getElementById('currencyLabel')!.innerText = settings.defaultCurrency;
    const ebayCurrencyLabel = document.getElementById('ebayCurrencyLabel')!;
    ebayCurrencyLabel.innerText = `${settings.defaultCurrency} (z VAT ${settings.defaultVatRate}%)`;
  }
}

export const settingsPanel = new SettingsPanel();