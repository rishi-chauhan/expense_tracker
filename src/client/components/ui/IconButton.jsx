import React from 'react';
import Icon from './Icon';
import './IconButton.css';

/** Icon-only button. `label` is required: it becomes aria-label and title. */
export default function IconButton({ icon, label, size = 20, active = false, className = '', type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={`icon-btn${active ? ' is-active' : ''} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
