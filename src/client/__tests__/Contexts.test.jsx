/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';

function ensureLocalStorage() {
  const store = new Map();
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: ls,
  });
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: ls,
  });
}

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggleTheme}>toggle-theme</button>
    </div>
  );
}

function SettingsProbe() {
  const { showCredits, toggleShowCredits } = useSettings();
  return (
    <div>
      <span data-testid="credits">{String(showCredits)}</span>
      <button type="button" onClick={toggleShowCredits}>toggle-credits</button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    ensureLocalStorage();
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  });

  it('defaults to light when system prefers light', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('toggles theme and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await user.click(screen.getByText('toggle-theme'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(localStorage.getItem('expense-tracker-theme')).toBe('dark');
  });
});

describe('SettingsContext', () => {
  beforeEach(() => {
    ensureLocalStorage();
    localStorage.clear();
  });

  it('defaults showCredits to false', () => {
    render(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>
    );
    expect(screen.getByTestId('credits')).toHaveTextContent('false');
  });

  it('toggles showCredits and persists', async () => {
    const user = userEvent.setup();
    render(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>
    );

    await user.click(screen.getByText('toggle-credits'));
    expect(screen.getByTestId('credits')).toHaveTextContent('true');
    expect(JSON.parse(localStorage.getItem('expense-tracker-settings')).showCredits).toBe(true);
  });
});
