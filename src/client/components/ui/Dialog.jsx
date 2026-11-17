import React, { useEffect, useId, useRef } from 'react';
import IconButton from './IconButton';
import './Dialog.css';

/**
 * Native <dialog> opened with showModal(): focus trap, inert background and
 * Esc handling come from the browser. Closes on Esc and on backdrop click.
 *
 * variant: 'center' (default) | 'sheet' (bottom sheet on phones) | 'panel' (right side)
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'center',
  size = 'md',
  hideTitle = false,
  className = '',
  initialFocusRef,
  closeLabel = 'Close',
}) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return undefined;
    if (typeof el.showModal === 'function' && !el.open) {
      try { el.showModal(); } catch { el.setAttribute('open', ''); }
    } else if (!el.open) {
      el.setAttribute('open', '');
    }
    if (initialFocusRef?.current) initialFocusRef.current.focus();
    return () => {
      if (el.open && typeof el.close === 'function') el.close();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  const onCancel = (e) => {
    // Esc: keep React in control of the open state.
    e.preventDefault();
    onClose?.();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      // Handle Esc ourselves (consistent across browsers); suppresses native cancel.
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    }
  };

  const onClick = (e) => {
    // A click whose target is the <dialog> itself landed on the backdrop.
    if (e.target === ref.current) onClose?.();
  };

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${variant} dialog-${size} ${className}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={onCancel}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div className="dialog-inner">
        <header className={`dialog-header${hideTitle ? ' is-hidden' : ''}`}>
          <div className="dialog-heading">
            <h2 id={titleId} className={hideTitle ? 'sr-only' : 'dialog-title'}>{title}</h2>
            {description && <p id={descId} className="dialog-desc">{description}</p>}
          </div>
          {onClose && <IconButton icon="close" label={closeLabel} onClick={onClose} className="dialog-close" />}
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
