import React, { forwardRef, useId } from 'react';
import Icon from './Icon';
import './Input.css';

/** Text input with optional visible label, leading icon and hint. */
const Input = forwardRef(function Input({ label, hint, icon, id, className = '', hideLabel = false, ...rest }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={`field ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'field-label'}>{label}</label>
      )}
      <div className={`input-wrap${icon ? ' has-icon' : ''}`}>
        {icon && <Icon name={icon} size={18} className="input-icon" />}
        <input ref={ref} id={inputId} className="input" {...rest} />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
});

export default Input;
