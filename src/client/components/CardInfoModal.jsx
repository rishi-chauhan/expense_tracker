import React, { useState } from 'react';
import './CardInfoModal.css';

function CardInfoModal({ detected, transactionCount, onConfirm, onCancel }) {
  const [bankName, setBankName] = useState(detected?.bankName || '');
  const [cardLast4, setCardLast4] = useState(detected?.cardLast4 || '');
  const [cardLabel, setCardLabel] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!bankName.trim() || !cardLast4.trim() || cardLast4.length !== 4) return;
    onConfirm({
      bankName: bankName.trim(),
      cardLast4: cardLast4.trim(),
      cardLabel: cardLabel.trim() || null,
    });
  };

  const handleLast4Change = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardLast4(value);
  };

  const isValid = bankName.trim() && cardLast4.length === 4;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Card Information Needed</h3>
          <p className="modal-subtitle">
            We couldn't fully detect your card details from the CSV.
            {transactionCount > 0 && ` (${transactionCount} transactions found)`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-field">
            <label htmlFor="bank-name">Bank Name *</label>
            <input
              id="bank-name"
              type="text"
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              placeholder="e.g. HDFC, ICICI, SBI"
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label htmlFor="card-last4">Last 4 Digits *</label>
            <input
              id="card-last4"
              type="text"
              inputMode="numeric"
              value={cardLast4}
              onChange={handleLast4Change}
              placeholder="e.g. 1234"
              maxLength={4}
            />
          </div>

          <div className="modal-field">
            <label htmlFor="card-label">Nickname (optional)</label>
            <input
              id="card-label"
              type="text"
              value={cardLabel}
              onChange={e => setCardLabel(e.target.value)}
              placeholder="e.g. Personal Card, Travel Card"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="modal-btn cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="modal-btn confirm" disabled={!isValid}>
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CardInfoModal;
