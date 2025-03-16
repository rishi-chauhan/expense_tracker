import * as pdfjsLib from 'pdfjs-dist'

// Make sure this function is properly exported
export const initializePdfWorker = () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString()
}

export const extractTableData = async (file) => {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer })
  const pdfDoc = await pdf.promise
  
  let foundTable = false
  const headers = ["Date", "Transaction Description", "Feature Reward Points", "Amount (in Rs.)"]
  let rows = []
  let currentRow = []
  let lastY = null
  
  // Process each page
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const textContent = await page.getTextContent()
    const items = textContent.items

    // First pass: look for table start
    for (let i = 0; i < items.length; i++) {
      const text = items[i].str.trim()
      // Check for variations of the table header
      if (text.toLowerCase().includes('Domestic Transaction')) {
        foundTable = true
        break
      }
    }

    if (foundTable) {
      // Second pass: process items with position information
      let currentY = null
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const text = item.str.trim()
        
        if (!text) continue
        
        // Skip page numbers and table title
        if (text.match(/Page \d+/) || 
            text.toLowerCase().includes('Domestic Transaction')) {
          continue
        }

        const y = Math.round(item.transform[5])
        
        // If Y position is different by more than 2 units, consider it a new row
        if (currentY === null || Math.abs(y - currentY) > 2) {
          if (currentRow.length > 0) {
            // Check if current row matches expected format
            if (isValidTableRow(currentRow)) {
              rows.push([...currentRow])
            }
            currentRow = []
          }
          currentY = y
        }
        
        currentRow.push(text)
      }
      
      // Don't forget the last row
      if (currentRow.length > 0 && isValidTableRow(currentRow)) {
        rows.push([...currentRow])
      }
    }
  }

  // Post-process rows to ensure data quality
  rows = rows
    .filter(row => isValidTableRow(row))
    .map(row => cleanRowData(row))

  if (rows.length === 0) {
    throw new Error('No table data found in the PDF')
  }

  return { headers, rows }
}

// Helper function to validate row data
function isValidTableRow(row) {
  if (row.length !== 4) return false
  
  // Check if first column is a date (DD/MM/YYYY)
  const datePattern = /^\d{2}\/\d{2}\/\d{4}$/
  if (!datePattern.test(row[0])) return false
  
  // Check if last column is an amount
  const amountPattern = /^[-+]?\d*\.?\d+$/
  if (!amountPattern.test(row[3].replace(/[,₹\s]/g, ''))) return false
  
  return true
}

// Helper function to clean row data
function cleanRowData(row) {
  return row.map((cell, index) => {
    // Clean up amount formatting
    if (index === 3) {
      return cell.replace(/[₹\s]/g, '').trim()
    }
    return cell.trim()
  })
}