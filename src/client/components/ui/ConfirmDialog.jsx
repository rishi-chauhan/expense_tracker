import React, { useRef } from 'react';
import Dialog from './Dialog';
import Button from './Button';
import './ConfirmDialog.css';

/** Replaces window.confirm. Cancel gets initial focus so Enter never destroys data by accident. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      size="sm"
      variant="sheet"
      className="confirm-dialog"
      initialFocusRef={cancelRef}
      footer={(
        <>
          <Button ref={cancelRef} onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <p className="confirm-message">{message}</p>
    </Dialog>
  );
}
