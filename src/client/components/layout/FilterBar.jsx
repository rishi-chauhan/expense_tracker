import React, { useState } from 'react';
import SegmentedControl from '../ui/SegmentedControl';
import Select from '../ui/Select';
import Chip from '../ui/Chip';
import Sheet from '../ui/Sheet';
import Icon from '../ui/Icon';
import { useFilters, PERIODS } from '../../contexts/FilterContext';
import './FilterBar.css';

const DESKTOP_PERIODS = ['latest', '3m', '6m', '12m', 'all', 'custom'];

function CustomRange({ range, onChange }) {
  return (
    <div className="custom-range">
      <label className="custom-range-field">
        <span>From</span>
        <input
          type="date"
          className="input"
          value={range.from || ''}
          max={range.to || undefined}
          onChange={(e) => onChange(e.target.value || null, range.to)}
        />
      </label>
      <label className="custom-range-field">
        <span>To</span>
        <input
          type="date"
          className="input"
          value={range.to || ''}
          min={range.from || undefined}
          onChange={(e) => onChange(range.from, e.target.value || null)}
        />
      </label>
    </div>
  );
}

function CardSelect({ cards, cardId, setCard, compact }) {
  if (cards.length < 2) return null;
  return (
    <Select
      label="Card"
      hideLabel
      className={`filter-card${compact ? ' is-compact' : ''}`}
      value={cardId || 'all'}
      onChange={(e) => setCard(e.target.value)}
    >
      <option value="all">All cards</option>
      {cards.map(c => (
        <option key={c.id} value={String(c.id)}>
          {c.card_label || `${c.bank_name} ...${c.card_last4}`}
        </option>
      ))}
    </Select>
  );
}

/** Global card + period filters. Desktop: inline controls. Phone: chips + sheet. */
export default function FilterBar({ cards = [], desktop = true }) {
  const { cardId, period, range, setCard, setPeriod, setCustomRange } = useFilters();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (desktop) {
    return (
      <div className="filter-bar">
        <CardSelect cards={cards} cardId={cardId} setCard={setCard} />
        <SegmentedControl
          label="Period"
          size="md"
          value={DESKTOP_PERIODS.includes(period) ? period : 'custom'}
          onChange={setPeriod}
          options={PERIODS.filter(p => DESKTOP_PERIODS.includes(p.value))}
        />
        {period === 'custom' && <CustomRange range={range} onChange={setCustomRange} />}
      </div>
    );
  }

  const current = PERIODS.find(p => p.value === period);
  return (
    <div className="filter-chips" role="group" aria-label="Filters">
      <Chip onClick={() => setSheetOpen(true)} selected aria-haspopup="dialog">
        <Icon name="calendar" size={14} />
        {current?.short}
        <Icon name="chevronDown" size={14} />
      </Chip>
      <CardSelect cards={cards} cardId={cardId} setCard={setCard} compact />

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Period">
        <div className="period-options" role="radiogroup" aria-label="Period">
          {PERIODS.map(p => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={period === p.value}
              className="period-option"
              onClick={() => {
                setPeriod(p.value);
                if (p.value !== 'custom') setSheetOpen(false);
              }}
            >
              {p.short}
              {period === p.value && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
        {period === 'custom' && <CustomRange range={range} onChange={setCustomRange} />}
      </Sheet>
    </div>
  );
}
