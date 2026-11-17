import React from 'react';
import Dialog from './ui/Dialog';
import FileUpload from './FileUpload';
import './ui/Button.css';
import './UploadDialog.css';

/** "Upload statement" dialog (native <dialog>). */
export default function UploadDialog({ open, onClose, onFile, onError, loading }) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      title="Upload statement"
      description="Export a statement as CSV from your bank's website. It is parsed on your Pi and never leaves your network."
      variant="sheet"
    >
      {loading ? (
        <div className="upload-progress" role="status">
          <span className="btn-spinner" aria-hidden="true" />
          Reading statement…
        </div>
      ) : (
        <FileUpload onFileUpload={onFile} onError={onError} />
      )}
    </Dialog>
  );
}
