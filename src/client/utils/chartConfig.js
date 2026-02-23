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

/** Tooltip config factory — accepts a chart colors object */
export function getTooltipConfig(colors) {
  return {
    backgroundColor: colors.tooltipBg,
    borderColor: colors.tooltipBorder,
    borderWidth: 1,
    padding: 16,
    cornerRadius: 8,
    titleFont: {
      family: colors.fontHeading,
      size: 13,
      weight: '600',
    },
    bodyFont: {
      family: colors.fontBody,
      size: 13,
    },
    titleColor: colors.tooltipTitleColor,
    bodyColor: colors.tooltipBodyColor,
  };
}

/** Shared INR tooltip callback */
export const inrTooltipCallback = {
  label: function(context) {
    return context.dataset.label + ': ₹' + context.parsed.y.toLocaleString('en-IN');
  }
};

/** X-axis scale factory */
export function getXScale(colors) {
  return {
    grid: { display: false },
    border: { color: colors.borderColor },
    ticks: {
      font: {
        family: colors.fontBody,
        size: 12,
      },
      color: colors.tickColorPrimary,
    }
  };
}

/** Y-axis scale factory */
export function getYScale(colors) {
  return {
    beginAtZero: true,
    grid: { color: colors.gridColor },
    border: { color: colors.borderColor },
    ticks: {
      font: {
        family: colors.fontMono,
        size: 11,
      },
      color: colors.tickColorSecondary,
      callback: function(value) {
        return '₹' + value.toLocaleString('en-IN');
      }
    }
  };
}

/** Shared animation config */
export const sharedAnimation = {
  duration: 750,
  easing: 'easeOutCubic',
};
