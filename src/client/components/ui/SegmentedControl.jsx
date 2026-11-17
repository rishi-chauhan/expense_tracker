import React from 'react';
import './SegmentedControl.css';

/**
 * Single-choice segmented control (radiogroup semantics).
 * options: [{ value, label }]
 */
export default function SegmentedControl({ label, options, value, onChange, size = 'md', className = '' }) {
  const onKeyDown = (e) => {
    const idx = options.findIndex(o => o.value === value);
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length;
    if (next == null) return;
    e.preventDefault();
    onChange(options[next].value);
    const buttons = e.currentTarget.querySelectorAll('button');
    buttons[next]?.focus();
  };

  return (
    <div
      className={`segmented segmented-${size} ${className}`.trim()}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {options.map(opt => {
        const checked = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={`segment${checked ? ' is-checked' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
