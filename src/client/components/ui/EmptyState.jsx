import React from 'react';
import Icon from './Icon';
import './EmptyState.css';

export default function EmptyState({ icon = 'info', title, children, action, className = '' }) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <span className="empty-state-icon"><Icon name={icon} size={20} /></span>
      <p className="empty-state-title">{title}</p>
      {children && <p className="empty-state-text">{children}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
