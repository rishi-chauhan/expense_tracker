import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'expense-tracker-settings';

const defaultSettings = { showCredits: false, hideAmounts: false };

const SettingsContext = createContext({
  ...defaultSettings,
  toggleShowCredits: () => {},
  toggleHideAmounts: () => {},
});

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Older versions stored only { showCredits }.
      return {
        showCredits: Boolean(parsed.showCredits),
        hideAmounts: Boolean(parsed.hideAmounts),
      };
    }
  } catch {
    // ignore corrupt / blocked localStorage
  }
  return defaultSettings;
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // storage blocked: settings just won't persist
    }
  }, [settings]);

  const toggleShowCredits = useCallback(
    () => setSettings(s => ({ ...s, showCredits: !s.showCredits })), []
  );
  const toggleHideAmounts = useCallback(
    () => setSettings(s => ({ ...s, hideAmounts: !s.hideAmounts })), []
  );

  // Shift+H toggles privacy mode (hide all amounts) anywhere except text fields.
  useEffect(() => {
    const onKey = (e) => {
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey
        && (e.key === 'H' || e.key === 'h') && !isTypingTarget(e.target)) {
        e.preventDefault();
        toggleHideAmounts();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleHideAmounts]);

  const value = useMemo(
    () => ({ ...settings, toggleShowCredits, toggleHideAmounts }),
    [settings, toggleShowCredits, toggleHideAmounts]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  return useContext(SettingsContext);
}
