/**
 * Centralized Chart.js configuration and registration.
 */
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
} from 'chart.js';

ChartJS.register(
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
);

/** Same Inter stack as the UI (canvas text doesn't inherit CSS). */
export const CHART_FONT = "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
if (ChartJS.defaults?.font) ChartJS.defaults.font.family = CHART_FONT;

// Canvas text doesn't trigger font loading: redraw charts once Inter is ready.
if (typeof document !== 'undefined' && document.fonts?.ready) {
  document.fonts.ready.then(() => {
    Object.values(ChartJS.instances || {}).forEach(c => c.update('none'));
  }).catch(() => {});
}

/** Tooltip config factory — accepts a chart colors object */
export function getTooltipConfig(colors) {
  return {
    backgroundColor: colors.tooltipBg,
    borderColor: colors.tooltipBorder,
    borderWidth: 1,
    padding: 16,
    cornerRadius: 8,
    titleFont: {
      family: colors.font,
      size: 13,
      weight: '600',
    },
    bodyFont: {
      family: colors.font,
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
        family: colors.font,
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
        family: colors.font,
        size: 11,
      },
      color: colors.tickColorSecondary,
      callback: function(value) {
        return '₹' + value.toLocaleString('en-IN');
      }
    }
  };
}

const prefersReducedMotion = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Shared animation config — off entirely under prefers-reduced-motion */
export const sharedAnimation = prefersReducedMotion
  ? false
  : { duration: 300, easing: 'easeOutCubic' };

/** Cap canvas resolution at 2x: 3x phone screens cost 2.25x the pixels for no visible gain. */
export const chartDevicePixelRatio = typeof window !== 'undefined'
  ? Math.min(window.devicePixelRatio || 1, 2)
  : 1;
