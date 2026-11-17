import React from 'react';
import './Chip.css';

/** Small label. With onClick it renders as a toggle button (aria-pressed via `selected`). */
export default function Chip({ color, selected, onClick, className = '', children, ...rest }) {
  const dot = color ? <span className="chip-dot" style={{ background: color }} aria-hidden="true" /> : null;
  if (onClick) {
    return (
      <button
        type="button"
        className={`chip chip-button${selected ? ' is-selected' : ''} ${className}`.trim()}
        aria-pressed={selected}
        onClick={onClick}
        {...rest}
      >
        {dot}
        {children}
      </button>
    );
  }
  return (
    <span className={`chip ${className}`.trim()} {...rest}>
      {dot}
      {children}
    </span>
  );
}

export const Badge = Chip;
