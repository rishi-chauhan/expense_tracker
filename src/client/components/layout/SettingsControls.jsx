import React from 'react';
import Icon from '../ui/Icon';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import './SettingsControls.css';

/**
 * Theme, privacy and credits switches (+ logout when the optional login is on).
 * `compact` renders icon-only rows for the tablet rail.
 */
export default function SettingsControls({ compact = false, onAction }) {
  const { theme, toggleTheme } = useTheme();
  const { showCredits, toggleShowCredits, hideAmounts, toggleHideAmounts } = useSettings();
  const { authRequired, logout } = useAuth();

  const run = (fn) => () => { fn(); onAction?.(); };

  const rows = [
    {
      key: 'theme',
      icon: theme === 'dark' ? 'sun' : 'moon',
      label: theme === 'dark' ? 'Light theme' : 'Dark theme',
      onClick: run(toggleTheme),
    },
    {
      key: 'privacy',
      icon: hideAmounts ? 'eye' : 'eyeOff',
      label: hideAmounts ? 'Show amounts' : 'Hide amounts',
      hint: 'Shift+H',
      pressed: hideAmounts,
      onClick: run(toggleHideAmounts),
    },
    {
      key: 'credits',
      icon: 'credits',
      label: 'Show credits',
      switch: true,
      pressed: showCredits,
      onClick: run(toggleShowCredits),
    },
  ];
  if (authRequired) {
    rows.push({ key: 'logout', icon: 'logout', label: 'Log out', onClick: run(logout) });
  }

  return (
    <div className={`settings-controls${compact ? ' is-compact' : ''}`}>
      {rows.map(row => (
        <button
          key={row.key}
          type="button"
          className="settings-row"
          onClick={row.onClick}
          aria-pressed={row.pressed}
          aria-label={compact ? row.label : undefined}
          title={compact ? row.label : row.hint ? `${row.label} (${row.hint})` : undefined}
          role={row.switch ? 'switch' : undefined}
          aria-checked={row.switch ? row.pressed : undefined}
        >
          <Icon name={row.icon} size={18} />
          {!compact && <span className="settings-label">{row.label}</span>}
          {!compact && row.switch && <span className={`switch${row.pressed ? ' is-on' : ''}`} aria-hidden="true" />}
          {!compact && row.hint && <kbd className="settings-kbd">{row.hint}</kbd>}
        </button>
      ))}
    </div>
  );
}
