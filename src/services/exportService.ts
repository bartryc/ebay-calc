import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CalculationResult } from '../types';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

class ExportService {
  async exportToPDF(calculation: CalculationResult): Promise<void> {
    const pdf = new jsPDF();
    
    // Header
    pdf.setFontSize(20);
    pdf.text('Raport Kalkulacji eBay', 20, 30);
    
    // Date
    pdf.setFontSize(12);
    pdf.text(`Data: ${format(calculation.timestamp, 'dd.MM.yyyy HH:mm', { locale: pl })}`, 20, 50);
    
    // Calculation details
    const details = [
      `PLN Netto: ${calculation.plnNetto.toFixed(2)} PLN`,
      `PLN Brutto: ${calculation.plnBrutto.toFixed(2)} PLN`,
      `Cena eBay: ${calculation.ebayPrice.toFixed(2)} ${calculation.currency}`,
      `Waluta: ${calculation.currency}`,
      `Kurs wymiany: ${calculation.exchangeRate.toFixed(4)}`,
      `Prowizja: ${(calculation.commission * 100).toFixed(1)}%`,
      `VAT: ${(calculation.vatRate * 100).toFixed(0)}%`,
      `Mnożnik: ${calculation.multiplier.toFixed(6)}`,
    ];

    if (calculation.productId) {
      details.push(`ID Produktu: ${calculation.productId}`);
    }

    let yPosition = 70;
    details.forEach(detail => {
      pdf.text(detail, 20, yPosition);
      yPosition += 10;
    });

    // Footer
    pdf.setFontSize(10);
    pdf.text('Wygenerowano przez Przelicznik eBay v2.0', 20, 280);
    
    pdf.save(`kalkulacja-ebay-${format(calculation.timestamp, 'yyyy-MM-dd-HHmm')}.pdf`);
  }

  async exportHistoryToCSV(calculations: CalculationResult[]): Promise<void> {
    const headers = ['Data', 'PLN Netto', 'PLN Brutto', 'Cena eBay', 'Waluta', 'Kurs', 'Prowizja %', 'VAT %', 'Mnożnik', 'ID Produktu'];
    
    const rows = calculations.map(calc => [
      format(calc.timestamp, 'dd.MM.yyyy HH:mm', { locale: pl }),
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

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historia-kalkulacji-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  }

  async exportCurrentViewToPNG(): Promise<void> {
    const element = document.querySelector('.container') as HTMLElement;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale: 2
      });
      
      const link = document.createElement('a');
      link.download = `kalkulator-ebay-${format(new Date(), 'yyyy-MM-dd-HHmm')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Failed to export PNG:', error);
    }
  }
}

export const exportService = new ExportService();