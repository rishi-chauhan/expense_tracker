import { useState, useCallback } from 'react';
import { uploadCSV } from '../utils/api.js';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function formatUploadedAt(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'earlier' : DATE_FMT.format(d);
}

/**
 * CSV upload with duplicate detection and the "card info needed" retry.
 * Outcomes are reported through `notify({ type, title, message, details })`
 * (toasts). handleFileUpload resolves to 'success' | 'duplicate' |
 * 'needs-card-info' | 'error'.
 */
export function useUpload({ onSuccess, notify = () => {} } = {}) {
  const [loading, setLoading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState(null);

  const handleFileUpload = useCallback(async (file, cardOverrides) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (cardOverrides) {
        if (cardOverrides.bankName) formData.append('bankName', cardOverrides.bankName);
        if (cardOverrides.cardLast4) formData.append('cardLast4', cardOverrides.cardLast4);
        if (cardOverrides.cardLabel) formData.append('cardLabel', cardOverrides.cardLabel);
      }

      let result;
      try {
        result = await uploadCSV(formData);
      } catch (err) {
        if (err.isDuplicate && err.data) {
          const existing = err.data.existingStatement || {};
          notify({
            type: 'info',
            title: 'Already uploaded',
            message: `${existing.file_name || 'This statement'} was uploaded on ${formatUploadedAt(existing.uploaded_at)}. Nothing changed.`,
            details: existing.period_start ? [`Period: ${existing.period_start} to ${existing.period_end}`] : [],
          });
          return 'duplicate';
        }
        if (err.needsCardInfo && err.data) {
          setPendingUpload({
            file,
            detected: err.data.detected,
            transactionCount: err.data.transactionCount,
          });
          return 'needs-card-info';
        }
        throw err;
      }

      if (onSuccess) await onSuccess(result);

      const card = result.cardInfo ? `${result.cardInfo.bankName} ...${result.cardInfo.cardLast4}` : null;
      const added = result.newCount;
      const skipped = result.duplicateCount;
      notify({
        type: 'success',
        title: 'Statement uploaded',
        message: `${added} new transaction${added === 1 ? '' : 's'} added from ${result.statementInfo.fileName}.`,
        details: [
          ...(skipped ? [`${skipped} already-known transaction${skipped === 1 ? '' : 's'} skipped`] : []),
          `Period: ${result.statementInfo.periodStart} to ${result.statementInfo.periodEnd}`,
          ...(card ? [`Card: ${card}`] : []),
        ],
      });
      return 'success';
    } catch (err) {
      notify({
        type: 'error',
        title: 'Upload failed',
        message: err.message || 'The statement could not be uploaded.',
      });
      return 'error';
    } finally {
      setLoading(false);
    }
  }, [onSuccess, notify]);

  const handleConfirmUpload = useCallback((cardDetails) => {
    if (!pendingUpload) return Promise.resolve(null);
    const { file } = pendingUpload;
    setPendingUpload(null);
    return handleFileUpload(file, cardDetails);
  }, [pendingUpload, handleFileUpload]);

  const handleCancelUpload = useCallback(() => {
    setPendingUpload(null);
  }, []);

  return {
    loading,
    pendingUpload,
    handleFileUpload,
    handleConfirmUpload,
    handleCancelUpload,
  };
}
