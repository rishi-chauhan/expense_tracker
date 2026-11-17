import { useCallback, useEffect, useState } from 'react';
import { getCategories } from '../utils/api.js';

/**
 * Tiny shared cache for GET /api/categories so every component that needs
 * categories doesn't refetch on mount. Call invalidateCategories() after any
 * category / rule mutation.
 */
let cache = null;        // { categories, rules }
let inflight = null;     // Promise
const subscribers = new Set();

function notify() {
  for (const fn of subscribers) fn(cache);
}

export function loadCategories({ force = false } = {}) {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight && !force) return inflight;
  const request = getCategories()
    .then((data) => {
      cache = { categories: data.categories || [], rules: data.rules || [] };
      notify();
      return cache;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });
  inflight = request;
  return request;
}

/** Drop the cache and refetch for any mounted subscriber. */
export function invalidateCategories() {
  cache = null;
  if (subscribers.size > 0) return loadCategories({ force: true });
  return Promise.resolve(null);
}

/** Test helper */
export function __resetCategoriesCache() {
  cache = null;
  inflight = null;
}

export function useCategories() {
  const [state, setState] = useState(() => cache);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const onChange = (value) => { if (alive) setState(value); };
    subscribers.add(onChange);
    loadCategories()
      .then((value) => { if (alive) { setState(value); setError(null); } })
      .catch((err) => { if (alive) setError(err.message || 'Failed to load categories'); });
    return () => {
      alive = false;
      subscribers.delete(onChange);
    };
  }, []);

  const refresh = useCallback(() => invalidateCategories(), []);

  return {
    categories: state?.categories || [],
    rules: state?.rules || [],
    loading: !state && !error,
    error,
    refresh,
  };
}
