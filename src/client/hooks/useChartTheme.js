import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const DARK_CHART_COLORS = {
  // Tooltip
  tooltipBg: '#1a1f35',
  tooltipBorder: '#d4952e',
  tooltipTitleColor: '#eaecf0',
  tooltipBodyColor: '#8b8fa6',

  // Grid & axes
  gridColor: 'rgba(255, 255, 255, 0.04)',
  borderColor: 'rgba(255, 255, 255, 0.06)',
  tickColorPrimary: '#8b8fa6',
  tickColorSecondary: '#5a5e76',

  // Data colors
  debit: 'rgba(232, 84, 110, 0.75)',
  debitSolid: '#e8546e',
  debitFill: 'rgba(232, 84, 110, 0.08)',
  credit: 'rgba(54, 201, 145, 0.75)',
  creditSolid: '#36c991',
  creditFill: 'rgba(54, 201, 145, 0.08)',

  // Misc
  pointBorderColor: '#141828',
  doughnutBorder: '#141828',
  accent: '#d4952e',

  // Fonts
  fontHeading: "'Plus Jakarta Sans', sans-serif",
  fontBody: "'DM Sans', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
};

const LIGHT_CHART_COLORS = {
  // Tooltip
  tooltipBg: '#ffffff',
  tooltipBorder: '#b8751a',
  tooltipTitleColor: '#1a1d2e',
  tooltipBodyColor: '#5c6070',

  // Grid & axes
  gridColor: 'rgba(0, 0, 0, 0.06)',
  borderColor: 'rgba(0, 0, 0, 0.10)',
  tickColorPrimary: '#5c6070',
  tickColorSecondary: '#8a8e9e',

  // Data colors
  debit: 'rgba(212, 66, 90, 0.75)',
  debitSolid: '#d4425a',
  debitFill: 'rgba(212, 66, 90, 0.10)',
  credit: 'rgba(30, 165, 110, 0.75)',
  creditSolid: '#1ea56e',
  creditFill: 'rgba(30, 165, 110, 0.10)',

  // Misc
  pointBorderColor: '#ffffff',
  doughnutBorder: '#ffffff',
  accent: '#b8751a',

  // Fonts
  fontHeading: "'Plus Jakarta Sans', sans-serif",
  fontBody: "'DM Sans', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
};

export function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(
    () => (theme === 'light' ? LIGHT_CHART_COLORS : DARK_CHART_COLORS),
    [theme]
  );
}
