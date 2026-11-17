import React, { useId } from 'react';
import './Input.css';
import './Select.css';

/** Native select (best on phones) with optional label. */
export default function Select({ label, id, className = '', hideLabel = false, children, ...rest }) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div className={`field ${className}`.trim()}>
      {label && (
        <label htmlFor={selectId} className={hideLabel ? 'sr-only' : 'field-label'}>{label}</label>
      )}
      <select id={selectId} className="select" {...rest}>
        {children}
      </select>
    </div>
  );
}
