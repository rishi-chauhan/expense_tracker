import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import IconButton from '../ui/IconButton';
import Button from '../ui/Button';
import Sheet from '../ui/Sheet';
import FilterBar from './FilterBar';
import SettingsControls from './SettingsControls';
import { useFilters } from '../../contexts/FilterContext';
import './TopBar.css';

/**
 * Sticky, opaque header (no blur).
 * Desktop: page title + global filters + Upload / Ask AI.
 * Phone: logo, title, Upload, Ask AI, overflow menu; filter chips below.
 */
export default function TopBar({ title, showFilters, cards, desktop, onUpload, onAskAI, aiOpen }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { filterSearch } = useFilters();

  if (desktop) {
    return (
      <header className="topbar">
        <div className="topbar-row">
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-actions">
            {showFilters && <FilterBar cards={cards} desktop />}
            <Button variant="secondary" icon="ask" onClick={onAskAI} aria-pressed={aiOpen}>Ask AI</Button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="topbar is-mobile">
      <div className="topbar-row">
        <Link to={`/${filterSearch}`} className="topbar-logo" aria-label="Paisa Kidhar Gaya?! overview">
          <span className="brand-mark" aria-hidden="true">₹</span>
        </Link>
        <h1 className="topbar-title">{title}</h1>
        <div className="topbar-actions">
          <IconButton icon="upload" label="Upload statement" onClick={onUpload} />
          <IconButton icon="ask" label="Ask AI" onClick={onAskAI} active={aiOpen} />
          <IconButton icon="more" label="Settings" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" />
        </div>
      </div>
      {showFilters && <FilterBar cards={cards} desktop={false} />}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Settings">
        <SettingsControls onAction={() => {}} />
      </Sheet>
    </header>
  );
}
