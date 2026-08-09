import { useState, useEffect, useCallback } from 'react';
import { getStatements, deleteStatement } from '../utils/api.js';

export function useStatements() {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStatements();
      setStatements(data.statements || []);
    } catch (err) {
      setError(err.message || 'Failed to load statements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const remove = useCallback(async (id) => {
    await deleteStatement(id);
    await refetch();
  }, [refetch]);

  return { statements, loading, error, refetch, remove };
}
