import { Chart, registerables } from 'chart.js';
import { CalculationResult } from '../types';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

Chart.register(...registerables);

class HistoryChart {
  private chart: Chart | null = null;
  private canvas: HTMLCanvasElement | null = null;

  init(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'historyChart';
    container.appendChild(this.canvas);
  }

  updateChart(calculations: CalculationResult[]): void {
    if (!this.canvas) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    // Prepare data - last 20 calculations
    const recentCalculations = calculations.slice(0, 20).reverse();
    
    const labels = recentCalculations.map(calc => 
      format(calc.timestamp, 'dd.MM HH:mm', { locale: pl })
    );

    const ebayPrices = recentCalculations.map(calc => calc.ebayPrice);
    const multipliers = recentCalculations.map(calc => calc.multiplier);

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Cena eBay',
            data: ebayPrices,
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            tension: 0.4,
            yAxisID: 'y'
          },
          {
            label: 'Mnożnik',
            data: multipliers,
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Czas'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Cena eBay'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Mnożnik'
            },
            grid: {
              drawOnChartArea: false,
            },
          }
        },
        plugins: {
          legend: {
            display: true
          },
          tooltip: {
            callbacks: {
              afterLabel: (context) => {
                const calc = recentCalculations[context.dataIndex];
                return [
                  `PLN Netto: ${calc.plnNetto.toFixed(2)}`,
                  `Waluta: ${calc.currency}`,
                  `Kurs: ${calc.exchangeRate.toFixed(4)}`
                ];
              }
            }
          }
        }
      }
    });
  }

  destroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}

export const historyChart = new HistoryChart();