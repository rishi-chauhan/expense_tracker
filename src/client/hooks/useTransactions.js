import { useState, useEffect, useCallback } from 'react';
import { getTransactions, getCards } from '../utils/api.js';

export function transformTransactions(transactions) {
  return transactions.map(tx => ({
    Id: tx.id,
    Date: new Date(tx.date),
    Amount: tx.amount,
    Description: tx.description,
    IsCredit: Boolean(tx.is_credit),
    Type: tx.type,
    CardId: tx.card_id,
    CardLabel: tx.card_label,
    BankName: tx.bank_name,
    CategoryId: tx.category_id,
    CategoryName: tx.category_name,
    CategoryColor: tx.category_color,
    CategoryManual: Boolean(tx.category_manual),
  }));
}

/**
 * Fetch transactions + cards on mount; expose data, loading, error, refetch.
 */
export function useTransactions() {
  const [csvData, setCsvData] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txData, cardsData] = await Promise.all([
        getTransactions(),
        getCards(),
      ]);

      if (txData.transactions?.length > 0) {
        setCsvData(transformTransactions(txData.transactions));
      } else {
        setCsvData(null);
      }
      setCards(cardsData.cards || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err.message || 'Failed to load data from the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { csvData, cards, loading, error, refetch, setError };
}
