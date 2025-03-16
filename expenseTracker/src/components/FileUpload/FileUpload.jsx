import './FileUpload.css'

function FileUpload({ onFileSelect }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type === 'application/pdf') {
      onFileSelect(file)
    } else {
      throw new Error('Please select a valid PDF file')
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