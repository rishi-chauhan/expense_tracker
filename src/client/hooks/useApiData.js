import { useEffect, useState } from 'react';

/**
 * Load data from an API helper; reloads when `key` changes (e.g. after an
 * upload). The server answers unchanged data with 304, so reloads are cheap.
 */
export function useApiData(loader, key) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, loading: true, error: null }));
    loader()
      .then(data => { if (alive) setState({ data, loading: false, error: null }); })
      .catch(err => { if (alive) setState({ data: null, loading: false, error: err.message || 'Failed to load' }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
