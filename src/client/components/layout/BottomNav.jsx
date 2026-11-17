import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import Sheet from '../ui/Sheet';
import { NAV_ITEMS } from './navItems';
import { useFilters } from '../../contexts/FilterContext';
import './BottomNav.css';

/** <768px: thumb-reachable tab bar. "More" opens a sheet with the secondary pages. */
export default function BottomNav() {
  const { filterSearch } = useFilters();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const secondary = NAV_ITEMS.filter(i => !i.primary);
  const moreActive = secondary.some(i => location.pathname.startsWith(i.to));

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        {NAV_ITEMS.filter(i => i.primary).map(item => (
          <NavLink
            key={item.to}
            to={`${item.to}${filterSearch}`}
            end={item.end}
            className="bottom-nav-item"
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-nav-item${moreActive ? ' active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
        >
          <Icon name="more" size={22} />
          <span>More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="more-list">
          {secondary.map(item => (
            <li key={item.to}>
              <button
                type="button"
                className="more-item"
                aria-current={location.pathname.startsWith(item.to) ? 'page' : undefined}
                onClick={() => { setMoreOpen(false); navigate(item.to); }}
              >
                <Icon name={item.icon} size={20} />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
