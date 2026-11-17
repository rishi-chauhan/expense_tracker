import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { formatINR, formatINRCompact, formatINRWhole } from '../../utils/dataProcessing.js';
import './Amount.css';

export const HIDDEN_AMOUNT = '₹ •••••';

/**
 * Every money value in the UI goes through this so privacy mode hides them all.
 * compact: ₹1.2L, whole: ₹1,23,457 (no paise)
 * tone: 'auto' (debit/credit colour from `credit`), 'debit', 'credit', 'plain'
 */
export default function Amount({ value, credit = false, tone = 'plain', compact = false, whole = false, sign = false, className = '' }) {
  const { hideAmounts } = useSettings();
  const toneClass = tone === 'auto' ? (credit ? 'is-credit' : 'is-debit') : tone !== 'plain' ? `is-${tone}` : '';

  if (hideAmounts) {
    return (
      <span className={`amount is-hidden ${toneClass} ${className}`.trim()} aria-label="hidden amount">
        {HIDDEN_AMOUNT}
      </span>
    );
  }

  const n = Number(value) || 0;
  const text = compact ? formatINRCompact(n) : whole ? formatINRWhole(n) : formatINR(n);
  const prefix = sign ? (credit ? '+' : '−') : '';
  return <span className={`amount ${toneClass} ${className}`.trim()}>{prefix}{text}</span>;
}
