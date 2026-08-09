import { useState, useCallback } from 'react';
import { uploadCSV } from '../utils/api.js';

/**
 * Handle CSV upload, duplicates, needsCardInfo / CardInfoModal, and notifications.
 */
export function useUpload({ onSuccess } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [pendingUpload, setPendingUpload] = useState(null);

  const handleFileUpload = useCallback(async (file, cardOverrides) => {
    setLoading(true);
    setError(null);
    setNotification(null);

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
          const existing = err.data.existingStatement;
          const uploadDate = new Date(existing.uploaded_at).toLocaleDateString();
          setNotification({
            type: 'info',
            title: 'Duplicate Statement',
            message: `This statement was already uploaded on ${uploadDate}.`,
            details: [
              `File: ${existing.file_name}`,
              `Period: ${existing.period_start} to ${existing.period_end}`,
            ],
          });
          return;
        }

        if (err.needsCardInfo && err.data) {
          setPendingUpload({
            file,
            detected: err.data.detected,
            transactionCount: err.data.transactionCount,
          });
          return;
        }

        throw err;
      }

      if (onSuccess) await onSuccess(result);

      const cardLabel = result.cardInfo
        ? `${result.cardInfo.bankName} ...${result.cardInfo.cardLast4}`
        : '';
      setNotification({
        type: 'success',
        title: 'Upload Complete!',
        message: `Successfully processed ${result.statementInfo.fileName}`,
        details: [
          `Added: ${result.newCount} new transaction${result.newCount !== 1 ? 's' : ''}`,
          `Skipped: ${result.duplicateCount} duplicate${result.duplicateCount !== 1 ? 's' : ''}`,
          `Period: ${result.statementInfo.periodStart} to ${result.statementInfo.periodEnd}`,
          ...(cardLabel ? [`Card: ${cardLabel}`] : []),
        ],
      });
    } catch (err) {
      setError(err.message ? `Upload failed: ${err.message}` : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  const handleConfirmUpload = useCallback((cardDetails) => {
    if (!pendingUpload) return;
    const { file } = pendingUpload;
    setPendingUpload(null);
    handleFileUpload(file, cardDetails);
  }, [pendingUpload, handleFileUpload]);

  const handleCancelUpload = useCallback(() => {
    setPendingUpload(null);
  }, []);

  return {
    loading,
    error,
    setError,
    notification,
    setNotification,
    pendingUpload,
    handleFileUpload,
    handleConfirmUpload,
    handleCancelUpload,
  };
}
