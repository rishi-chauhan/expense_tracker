import React, { useRef, useState } from 'react';
import Icon from './ui/Icon';
import './FileUpload.css';

function FileUpload({ onFileUpload, onError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  // Format file size helper
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Handle file selection (from input or drop)
  const handleFileSelection = (file) => {
    const hasCsvExtension = file?.name.toLowerCase().endsWith('.csv');
    const hasCsvType = !file?.type || ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(file.type);
    if (file && hasCsvExtension && hasCsvType) {
      setSelectedFile(file);
      onFileUpload(file);
    } else {
      setSelectedFile(null);
      if (onError) {
        onError('Please upload a valid CSV file.');
      } else {
        alert('Please upload a valid CSV file.');
      }
    }
  };

  // Handle file input change
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    handleFileSelection(file);
  };

  // Drag event handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  // Handle file removal
  const handleRemoveFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="file-upload-card">
      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="file-input"
          id="csv-file-upload"
          aria-label="Upload credit card statement"
        />

        {!selectedFile ? (
          <label htmlFor="csv-file-upload" className="upload-prompt">
            <span className="upload-icon"><Icon name="upload" size={22} /></span>
            <span className="upload-prompt-text">
              Drop a CSV statement here or <strong>browse files</strong>
            </span>
            <span className="upload-prompt-hint">Bank credit card statements in CSV format, up to 5 MB</span>
          </label>
        ) : (
          <div className="file-preview">
            <span className="file-preview-icon"><Icon name="check" size={18} /></span>
            <label htmlFor="csv-file-upload" className="file-info">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-meta">{formatFileSize(selectedFile.size)}, CSV file</span>
            </label>
            <button
              type="button"
              className="remove-file-button"
              onClick={handleRemoveFile}
              aria-label="Remove file"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FileUpload;
