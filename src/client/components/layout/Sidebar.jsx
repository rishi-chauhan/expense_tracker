import React from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../ui/Icon';
import SettingsControls from './SettingsControls';
import { NAV_ITEMS } from './navItems';
import { useFilters } from '../../contexts/FilterContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import './Sidebar.css';

/** ≥1024px: full sidebar. 768–1023px: 72px icon rail (labels via aria-label/title). */
export default function Sidebar({ onUpload }) {
  const { filterSearch } = useFilters();
  const wide = useMediaQuery('(min-width: 1024px)', true);
  return (
    <aside className="sidebar">
      <NavLink to={`/${filterSearch}`} className="sidebar-brand" aria-label="Paisa Kidhar Gaya?! overview">
        <span className="brand-mark" aria-hidden="true">₹</span>
        <span className="sidebar-brand-name">Paisa Kidhar Gaya?!</span>
      </NavLink>

      <button type="button" className="sidebar-upload" onClick={onUpload} aria-label="Upload statement" title="Upload statement">
        <Icon name="upload" size={18} />
        <span className="sidebar-label">Upload statement</span>
      </button>

      <nav className="sidebar-nav" aria-label="Primary">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.filters ? `${item.to}${filterSearch}` : item.to}
            end={item.end}
            className="sidebar-link"
            title={item.label}
          >
            <Icon name={item.icon} size={20} />
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <SettingsControls compact={!wide} />
      </div>
    </aside>
  );
}
