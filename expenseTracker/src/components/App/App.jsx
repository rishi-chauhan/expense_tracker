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
    try {
      initializePdfWorker()
      console.log('PDF worker initialized')
    } catch (error) {
      console.error('Error initializing PDF worker:', error)
      setError('Failed to initialize PDF processor: ' + error.message)
    }
  }, [])

  const handleFileSelect = async (file) => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('Processing file:', file.name)
      
      const data = await extractTableData(file)
      
      if (data.rows.length > 0) {
        console.log(`Successfully extracted ${data.rows.length} rows of table data`)
        setTableData(data)
      } else {
        throw new Error('No rows were found in the table')
      }
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
      
      {!isLoading && !error && tableData.rows.length > 0 && (
        <>
          <div className="results-summary">
            Found {tableData.rows.length} transactions
          </div>
          <TableDisplay 
            headers={tableData.headers} 
            rows={tableData.rows} 
          />
        </>
      )}
    </div>
  )
}

export default App
