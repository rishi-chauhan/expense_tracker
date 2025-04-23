import "./FileUpload.css";
import { ERROR_MESSAGES } from "../../utils/constants";

function FileUpload({ onFileSelect, uploadPrompt }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      onFileSelect(file);
    } else if (file) {
      alert(ERROR_MESSAGES.INVALID_PDF_FILE);
      e.target.value = null;
    }
  };

  return (
    <div className="pdf-upload">
      <label htmlFor="file-upload" className="file-upload-label">
        {uploadPrompt || 'Select PDF File'}
      </label>
      <input
        id="file-upload"
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        style={{ display: 'block', margin: '10px auto' }}
      />
    </div>
  );
}

export default FileUpload;
