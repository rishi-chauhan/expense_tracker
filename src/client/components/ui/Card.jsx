import React from 'react';
import './Card.css';

export function Card({ as = 'section', className = '', children, ...rest }) {
  return React.createElement(as, { className: `card ${className}`.trim(), ...rest }, children);
}

/** Card title row. `id` lets the parent use aria-labelledby. */
export function CardHeader({ title, subtitle, actions, id, level = 2 }) {
  return (
    <header className="card-header">
      <div className="card-heading">
        {React.createElement(`h${level}`, { className: 'card-title', id }, title)}
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </header>
  );
}

export default Card;
