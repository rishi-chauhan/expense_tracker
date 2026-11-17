import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { __resetCategoriesCache } from '../hooks/useCategories.js';

expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
  __resetCategoriesCache();
});

// Mock window.alert and window.confirm
global.alert = () => {};
global.confirm = () => true;
