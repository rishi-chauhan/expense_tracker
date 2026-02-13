/**
 * Centralized Chart.js configuration and registration.
 */
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Title,
} from 'chart.js';

ChartJS.register(
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Title,
);

/** Shared tooltip styling matching the dark theme */
export const sharedTooltipConfig = {
  backgroundColor: '#1c1e2e',
  borderColor: '#e2a23b',
  borderWidth: 1,
  padding: 16,
  cornerRadius: 8,
  titleFont: {
    family: "'Sora', sans-serif",
    size: 13,
    weight: '600',
  },
  bodyFont: {
    family: "'DM Sans', sans-serif",
    size: 13,
  },
  titleColor: '#e8e9ed',
  bodyColor: '#8b8da0',
};

/** Shared INR tooltip callback */
export const inrTooltipCallback = {
  label: function(context) {
    return context.dataset.label + ': ₹' + context.parsed.y.toLocaleString('en-IN');
  }
};

/** Shared scale config for X axis */
export const sharedXScale = {
  grid: { display: false },
  border: { color: 'rgba(255, 255, 255, 0.06)' },
  ticks: {
    font: {
      family: "'DM Sans', sans-serif",
      size: 12,
    },
    color: '#8b8da0',
  }
};

/** Shared scale config for Y axis */
export const sharedYScale = {
  beginAtZero: true,
  grid: { color: 'rgba(255, 255, 255, 0.04)' },
  border: { color: 'rgba(255, 255, 255, 0.06)' },
  ticks: {
    font: {
      family: "'JetBrains Mono', monospace",
      size: 11,
    },
    color: '#5c5e72',
    callback: function(value) {
      return '₹' + value.toLocaleString('en-IN');
    }
  }
};

/** Shared animation config */
export const sharedAnimation = {
  duration: 750,
  easing: 'easeOutCubic',
};

/** Theme colors */
export const COLORS = {
  debit: 'rgba(240, 99, 122, 0.75)',
  debitSolid: '#f0637a',
  credit: 'rgba(61, 217, 160, 0.75)',
  creditSolid: '#3dd9a0',
  accent: '#e2a23b',
  accentDim: 'rgba(226, 162, 59, 0.15)',
  info: '#5b9cf5',
  infoDim: 'rgba(91, 156, 245, 0.15)',
  chartArea: 'rgba(226, 162, 59, 0.08)',
};
