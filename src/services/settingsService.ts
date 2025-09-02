import { AppSettings } from '../types';

class SettingsService {
  private readonly STORAGE_KEY = 'ebay-calculator-settings';
  private readonly DEFAULT_SETTINGS: AppSettings = {
    theme: 'light',
    defaultCurrency: 'EUR',
    defaultCommission: 15,
    defaultVatRate: 23,
    autoSave: true,
    notifications: true
  };

  getSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...this.DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
    return this.DEFAULT_SETTINGS;
  }

  updateSettings(updates: Partial<AppSettings>): void {
    const current = this.getSettings();
    const updated = { ...current, ...updates };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  resetSettings(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const settingsService = new SettingsService();