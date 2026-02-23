import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'expense-tracker-settings';

const defaultSettings = { showCredits: false };

const SettingsContext = createContext({ showCredits: false, toggleShowCredits: () => {} });

export function SettingsProvider({ children }) {
  const [showCredits, setShowCredits] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Boolean(parsed.showCredits);
      }
    } catch {
      // ignore corrupt localStorage
    }
    return defaultSettings.showCredits;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showCredits }));
  }, [showCredits]);

  const toggleShowCredits = () => setShowCredits(prev => !prev);

  return (
    <SettingsContext.Provider value={{ showCredits, toggleShowCredits }}>
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  return useContext(SettingsContext);
}
