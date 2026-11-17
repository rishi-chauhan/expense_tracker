import React, { useRef, useState } from 'react';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import Input from './ui/Input';
import './CardInfoModal.css';

/** Asked when the bank / last 4 digits can't be read from the CSV. */
function CardInfoModal({ detected, transactionCount, onConfirm, onCancel }) {
  const [bankName, setBankName] = useState(detected?.bankName || '');
  const [cardLast4, setCardLast4] = useState(detected?.cardLast4 || '');
  const [cardLabel, setCardLabel] = useState('');
  const bankRef = useRef(null);

  const isValid = bankName.trim() && cardLast4.length === 4;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    onConfirm({
      bankName: bankName.trim(),
      cardLast4: cardLast4.trim(),
      cardLabel: cardLabel.trim() || null,
    });
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      title="Which card is this?"
      description={`The bank or card number couldn't be read from this file.${transactionCount > 0 ? ` ${transactionCount} transactions found.` : ''}`}
      variant="sheet"
      initialFocusRef={bankRef}
    >
      <form onSubmit={handleSubmit} className="card-info-form">
        <Input
          ref={bankRef}
          label="Bank name"
          value={bankName}
          onChange={e => setBankName(e.target.value)}
          placeholder="HDFC, ICICI, SBI…"
          maxLength={40}
          required
        />
        <Input
          label="Last 4 digits"
          inputMode="numeric"
          autoComplete="off"
          value={cardLast4}
          onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="1234"
          maxLength={4}
          required
        />
        <Input
          label="Nickname (optional)"
          value={cardLabel}
          onChange={e => setCardLabel(e.target.value)}
          placeholder="Travel card"
          maxLength={40}
        />
        <div className="card-info-actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!isValid}>Upload</Button>
        </div>
      </form>
    </Dialog>
  );
}

export default CardInfoModal;
