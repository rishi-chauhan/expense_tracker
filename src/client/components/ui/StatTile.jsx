import React from 'react';
import './StatTile.css';

/** Compact secondary figure: label on top, value below, optional note. */
export default function StatTile({ label, value, note, noteTone, className = '' }) {
  return (
    <div className={`stat-tile ${className}`.trim()}>
      <p className="stat-label">{label}</p>
      <p className="stat-value num">{value}</p>
      {note && <p className={`stat-note${noteTone ? ` is-${noteTone}` : ''}`}>{note}</p>}
    </div>
  );
}
