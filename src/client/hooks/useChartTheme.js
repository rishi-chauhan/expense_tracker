import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

function readCssVar(name, fallback) {
  if (typeof window === 'undefined' || !document.documentElement) return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function buildChartColors(theme) {
  const isLight = theme === 'light';
  return {
    tooltipBg: readCssVar('--color-bg-surface', isLight ? '#ffffff' : '#1a1f35'),
    tooltipBorder: readCssVar('--color-accent', isLight ? '#b8751a' : '#d4952e'),
    tooltipTitleColor: readCssVar('--color-text-primary', isLight ? '#1a1d2e' : '#eaecf0'),
    tooltipBodyColor: readCssVar('--color-text-secondary', isLight ? '#5c6070' : '#8b8fa6'),
    gridColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)',
    borderColor: isLight ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.06)',
    tickColorPrimary: readCssVar('--color-text-secondary', isLight ? '#5c6070' : '#8b8fa6'),
    tickColorSecondary: readCssVar('--color-text-muted', isLight ? '#8a8e9e' : '#5a5e76'),
    debit: isLight ? 'rgba(212, 66, 90, 0.75)' : 'rgba(232, 84, 110, 0.75)',
    debitSolid: readCssVar('--color-debit', isLight ? '#d4425a' : '#e8546e'),
    debitFill: isLight ? 'rgba(212, 66, 90, 0.10)' : 'rgba(232, 84, 110, 0.08)',
    credit: isLight ? 'rgba(30, 165, 110, 0.75)' : 'rgba(54, 201, 145, 0.75)',
    creditSolid: readCssVar('--color-credit', isLight ? '#1ea56e' : '#36c991'),
    creditFill: isLight ? 'rgba(30, 165, 110, 0.10)' : 'rgba(54, 201, 145, 0.08)',
    pointBorderColor: readCssVar('--color-bg-card', isLight ? '#ffffff' : '#111722'),
    doughnutBorder: readCssVar('--color-bg-card', isLight ? '#ffffff' : '#111722'),
    accent: readCssVar('--color-accent', isLight ? '#b8751a' : '#d4952e'),
    fontHeading: "'Plus Jakarta Sans', sans-serif",
    fontBody: "'DM Sans', sans-serif",
    fontMono: "'JetBrains Mono', monospace",
  };
}

export function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => buildChartColors(theme), [theme]);
}
