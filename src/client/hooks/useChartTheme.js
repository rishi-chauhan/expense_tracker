import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const DARK_CHART_COLORS = {
  // Tooltip
  tooltipBg: '#111827', // dark navy
  tooltipBorder: '#8b5cf6', // violet accent
  tooltipTitleColor: '#f9fafb',
  tooltipBodyColor: '#9ca3af',

  // Grid & axes
  gridColor: 'rgba(255, 255, 255, 0.05)',
  borderColor: 'rgba(255, 255, 255, 0.1)',
  tickColorPrimary: '#9ca3af',
  tickColorSecondary: '#6b7280',

  // Data colors
  debit: 'rgba(244, 63, 94, 0.75)', // Rose
  debitSolid: '#f43f5e',
  debitFill: 'rgba(244, 63, 94, 0.15)',
  
  credit: 'rgba(16, 185, 129, 0.75)', // Emerald
  creditSolid: '#10b981',
  creditFill: 'rgba(16, 185, 129, 0.15)',

  // Misc
  pointBorderColor: '#111827',
  doughnutBorder: '#111827',
  accent: '#8b5cf6',

  // Fonts
  fontHeading: "'Plus Jakarta Sans', sans-serif",
  fontBody: "'DM Sans', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
};

const LIGHT_CHART_COLORS = {
  // Tooltip
  tooltipBg: '#ffffff',
  tooltipBorder: '#7c3aed',
  tooltipTitleColor: '#111827',
  tooltipBodyColor: '#4b5563',

  // Grid & axes
  gridColor: 'rgba(0, 0, 0, 0.06)',
  borderColor: 'rgba(0, 0, 0, 0.1)',
  tickColorPrimary: '#4b5563',
  tickColorSecondary: '#9ca3af',

  // Data colors
  debit: 'rgba(244, 63, 94, 0.75)',
  debitSolid: '#f43f5e',
  debitFill: 'rgba(244, 63, 94, 0.10)',
  
  credit: 'rgba(16, 185, 129, 0.75)',
  creditSolid: '#10b981',
  creditFill: 'rgba(16, 185, 129, 0.10)',

  // Misc
  pointBorderColor: '#ffffff',
  doughnutBorder: '#ffffff',
  accent: '#7c3aed',

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
