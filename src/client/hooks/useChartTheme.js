import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { CHART_FONT } from '../utils/chartConfig';

function readCssVar(name, fallback) {
  if (typeof window === 'undefined' || !document.documentElement) return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** '#rrggbb' + alpha → rgba() (falls back to the input for non-hex values). */
export function withAlpha(hex, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Fallbacks mirror the token table in index.css.
const FALLBACK = {
  light: { surface: '#ffffff', border: '#e3e5ea', text: '#0f1115', text2: '#5a5f6b', text3: '#8a8f9a', accent: '#4f46e5', debit: '#e11d48', credit: '#059669' },
  dark: { surface: '#131418', border: '#25272e', text: '#ededf0', text2: '#a2a6b0', text3: '#6c707a', accent: '#8b8cf8', debit: '#fb7185', credit: '#34d399' },
};

function buildChartColors(theme, hideAmounts) {
  const f = FALLBACK[theme === 'light' ? 'light' : 'dark'];
  const surface = readCssVar('--surface', f.surface);
  const border = readCssVar('--border', f.border);
  const text = readCssVar('--text', f.text);
  const text2 = readCssVar('--text-2', f.text2);
  const text3 = readCssVar('--text-3', f.text3);
  const accent = readCssVar('--accent', f.accent);
  const debit = readCssVar('--debit', f.debit);
  const credit = readCssVar('--credit', f.credit);
  return {
    tooltipBg: surface,
    tooltipBorder: border,
    tooltipTitleColor: text,
    tooltipBodyColor: text2,
    gridColor: withAlpha(border, 0.7),
    borderColor: border,
    tickColorPrimary: text2,
    tickColorSecondary: text3,
    accent,
    accentFill: withAlpha(accent, 0.12),
    debit: withAlpha(debit, 0.8),
    debitSolid: debit,
    debitFill: withAlpha(debit, 0.1),
    credit: withAlpha(credit, 0.8),
    creditSolid: credit,
    creditFill: withAlpha(credit, 0.1),
    pointBorderColor: surface,
    doughnutBorder: surface,
    font: CHART_FONT,
    hideAmounts: Boolean(hideAmounts),
  };
}

export function useChartTheme() {
  const { theme } = useTheme();
  const { hideAmounts } = useSettings();
  return useMemo(() => buildChartColors(theme, hideAmounts), [theme, hideAmounts]);
}
