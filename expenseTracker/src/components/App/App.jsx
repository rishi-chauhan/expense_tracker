import { useState, useEffect } from 'react'
import { initializePdfWorker, extractTableData } from '../../utils/pdfUtils'
import FileUpload from '../FileUpload/FileUpload'
import TableDisplay from '../TableDisplay/TableDisplay'
import './App.css'

function App() {
  const [tableData, setTableData] = useState({ headers: [], rows: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    initializePdfWorker()
  }, [])

  const handleFileSelect = async (file) => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await extractTableData(file)
      setTableData(data)
    } catch (error) {
      console.error('Error processing PDF:', error)
      setError(error.message || 'Error reading PDF file')
      setTableData({ headers: [], rows: [] })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app-container">
      <h1>PDF Table Extractor</h1>
      
      <FileUpload onFileSelect={handleFileSelect} />
      
      {isLoading && <div className="loading">Loading PDF content...</div>}
      
      {error && !isLoading && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {!isLoading && !error && (
        <TableDisplay 
          headers={tableData.headers} 
          rows={tableData.rows} 
        />
      )}
    </div>
  )
}

export default App
