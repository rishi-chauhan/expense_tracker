import { useState, useEffect, useCallback } from 'react';
import { getTransactions, getCards } from '../utils/api.js';
import { isoMondayString } from '../utils/dataProcessing.js';

const CC_PAYMENT_RE = /CC PAYMENT|BPPY/i;

/**
 * API rows → component shape. Derived fields are computed once here so the
 * hot filtering/grouping paths never parse dates or lower-case strings again.
 */
export function transformTransactions(transactions) {
  return transactions.map(tx => {
    const dateStr = String(tx.date).slice(0, 10);
    const [y, m, d] = dateStr.split('-').map(Number);
    const local = new Date(y, m - 1, d); // local midnight (not UTC)
    const description = tx.description || '';
    return {
    Id: tx.id,
    Date: local,
    DateStr: dateStr,
    Ts: local.getTime(),
    MonthKey: dateStr.slice(0, 7),
    WeekKey: isoMondayString(local),
    DescLower: description.toLowerCase(),
    IsCCPayment: CC_PAYMENT_RE.test(description),
    Amount: tx.amount,
    Description: description,
    IsCredit: Boolean(tx.is_credit),
    Type: tx.type,
    CardId: tx.card_id,
    CardLabel: tx.card_label,
    BankName: tx.bank_name,
    CategoryId: tx.category_id,
    CategoryName: tx.category_name,
    CategoryColor: tx.category_color,
    CategoryManual: Boolean(tx.category_manual),
    };
  });
}

/**
 * Fetch transactions + cards on mount; expose data, loading, error, refetch.
 */
export function useTransactions() {
  const [csvData, setCsvData] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

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
      setVersion(v => v + 1);
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

  return { csvData, cards, loading, error, refetch, setError, version };
}
