import './FileUpload.css'
import { ERROR_MESSAGES } from '../../utils/constants';

function FileUpload({ onFileSelect }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type === 'application/pdf') {
      onFileSelect(file)
    } else {
      throw new Error(ERROR_MESSAGES.INVALID_PDF_FILE)
    }
  }

  return (
    <div className="pdf-upload">
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
      />
    </div>
  )
}

export default FileUpload 