import React, { useState } from 'react';
import './FileUpload.css';

function FileUpload({ onFileUpload }) {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      onFileUpload(file);
    } else {
      setSelectedFile(null);
      alert('Please upload a valid CSV file.');
    }
  };

  return (
    <div className="file-upload-container">
      <h2>Upload Credit Card Statement (CSV)</h2>
      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="file-input"
        id="csv-file-upload"
      />
      <label htmlFor="csv-file-upload" className="file-upload-button">
        {selectedFile ? selectedFile.name : 'Choose CSV File'}
      </label>
      {selectedFile && (
        <p className="selected-file-name">Selected file: {selectedFile.name}</p>
      )}
    </div>
  );
}

export default FileUpload;