import React, { memo } from 'react';
import Amount from './ui/Amount';
import { formatDay as formatTxDate } from '../utils/dataProcessing.js';
import './TransactionRow.css';

const UNCATEGORISED = '#8b90a0';

/**
 * Compact list row: description + category on the left, amount + date on
 * the right. Renders as a button when `onSelect` is given (opens details).
 */
function TransactionRow({ tx, onSelect, showCard = false }) {
  const content = (
    <>
      <span className="tx-row-main">
        <span className="tx-row-desc">{tx.Description}</span>
        <span className="tx-row-meta">
          <span className="tx-row-cat">
            <span className="tx-row-dot" style={{ background: tx.CategoryColor || UNCATEGORISED }} aria-hidden="true" />
            {tx.CategoryName || 'Uncategorised'}
          </span>
          {showCard && tx.CardLabel && <span className="tx-row-card">{tx.CardLabel}</span>}
        </span>
      </span>
      <span className="tx-row-side">
        <Amount value={tx.Amount} credit={tx.IsCredit} tone={tx.IsCredit ? 'credit' : 'plain'} sign={tx.IsCredit} className="tx-row-amount" />
        <span className="tx-row-date">{formatTxDate(tx.Date)}</span>
      </span>
    </>
  );

  if (onSelect) {
    return (
      <li className="tx-row">
        <button type="button" className="tx-row-inner" onClick={() => onSelect(tx)}>
          {content}
        </button>
      </li>
    );
  }
  return (
    <li className="tx-row">
      <div className="tx-row-inner">{content}</div>
    </li>
  );
}

export default memo(TransactionRow);
