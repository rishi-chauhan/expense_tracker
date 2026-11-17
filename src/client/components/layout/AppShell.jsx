import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import Icon from '../ui/Icon';
import { navItemFor } from './navItems';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import './AppShell.css';

function hasFiles(e) {
  return Array.from(e.dataTransfer?.types || []).includes('Files');
}

/**
 * Layout frame: sidebar/rail (≥768px) or top bar + bottom tabs (phone).
 * Also accepts a CSV dropped anywhere on the window.
 */
export default function AppShell({ cards, onUpload, onFileDrop, onAskAI, aiOpen, children }) {
  const desktop = useIsDesktop();
  const location = useLocation();
  const item = navItemFor(location.pathname);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    if (!onFileDrop) return undefined;
    const enter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    };
    const over = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const leave = (e) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileDrop(file);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [onFileDrop]);

  return (
    <div className={`app-shell${desktop ? ' is-desktop' : ' is-mobile'}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      {desktop && <Sidebar onUpload={onUpload} />}
      <div className="app-column">
        <TopBar
          title={item.label}
          showFilters={item.filters}
          cards={cards}
          desktop={desktop}
          onUpload={onUpload}
          onAskAI={onAskAI}
          aiOpen={aiOpen}
        />
        <main id="main" className="app-main" tabIndex={-1}>
          {children}
        </main>
      </div>
      {!desktop && <BottomNav />}

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-card">
            <Icon name="upload" size={28} />
            <p>Drop to upload</p>
          </div>
        </div>
      )}
    </div>
  );
}
