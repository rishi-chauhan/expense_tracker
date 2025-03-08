import { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import './App.css'

function App() {
  const [pdfContent, setPdfContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Initialize PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString()
  }, [])

  const extractTextFromPDF = async (file) => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('Starting PDF extraction for file:', file.name)
      
      // Read the file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()
      console.log('File successfully converted to ArrayBuffer')
      
      // Load the PDF document
      console.log('Loading PDF document...')
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      console.log('PDF loaded successfully. Number of pages:', pdf.numPages)
      
      let fullText = ''
      
      // Iterate through each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`Processing page ${pageNum}/${pdf.numPages}`)
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .trim()
        
        if (pageText) {
          fullText += `Page ${pageNum}:\n${pageText}\n\n`
        } else {
          console.log(`Warning: No text content found on page ${pageNum}`)
        }
      }
      
      if (!fullText.trim()) {
        throw new Error('No text content found in the PDF')
      }
      
      console.log('PDF text extraction completed successfully')
      setPdfContent(fullText)
      
    } catch (error) {
      console.error('Detailed error in PDF processing:', error)
      setError(error.message || 'Error reading PDF file')
      setPdfContent('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app-container">
      <h1>PDF Content Viewer</h1>
      <div className="pdf-upload">
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => {
            const file = e.target.files[0]
            if (file && file.type === 'application/pdf') {
              extractTextFromPDF(file)
            } else {
              setError('Please select a valid PDF file')
            }
          }}
        />
      </div>
      
      {isLoading && <div className="loading">Loading PDF content...</div>}
      
      {error && !isLoading && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {pdfContent && !isLoading && !error && (
        <div className="pdf-content">
          <h2>PDF Content:</h2>
          <pre>{pdfContent}</pre>
        </div>
      )}
    </div>
  )
}

export default App
