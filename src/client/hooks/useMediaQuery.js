import { useSyncExternalStore } from 'react';

/** Live boolean for a CSS media query. `fallback` is used where matchMedia is missing. */
export function useMediaQuery(query, fallback = true) {
  const subscribe = (onChange) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  };
  const getSnapshot = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return fallback;
    return window.matchMedia(query).matches;
  };
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}

export const DESKTOP_QUERY = '(min-width: 768px)';

export function useIsDesktop() {
  return useMediaQuery(DESKTOP_QUERY, true);
}
