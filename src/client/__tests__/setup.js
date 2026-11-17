import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { __resetCategoriesCache } from '../hooks/useCategories.js';

expect.extend(matchers);

// happy-dom here has no usable localStorage: provide an in-memory one.
function installLocalStorage() {
  const store = new Map();
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: ls });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: ls });
  }
}
if (typeof globalThis.localStorage?.clear !== 'function') installLocalStorage();

// Cleanup after each test
afterEach(() => {
  cleanup();
  __resetCategoriesCache();
  try { globalThis.localStorage?.clear(); } catch { /* ignore */ }
});

// Mock window.alert and window.confirm
global.alert = () => {};
global.confirm = () => true;
