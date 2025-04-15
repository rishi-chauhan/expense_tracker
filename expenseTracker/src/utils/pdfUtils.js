import * as pdfjsLib from 'pdfjs-dist';
import { TABLE_CONSTANTS, ERROR_MESSAGES } from './constants';

// Make sure this function is properly exported
export const initializePdfWorker = () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
};

export const extractTableData = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await pdf.promise;

  let foundTable = false;
  const headers = TABLE_CONSTANTS.TABLE_HEADERS;
  let rows = [];
  let currentRow = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items;

    console.log(`Processing page ${pageNum}...`);

    for (let i = 0; i < items.length; i++) {
      const text = items[i].str.trim();
      console.log(`Text item: ${text}`);

      if (text.toLowerCase().includes('domestic transaction') || 
          text.toLowerCase().includes('transaction description')) {
        foundTable = true;
        console.log('Table header found!');
        break;
      }
    }

    if (foundTable) {
      let currentY = null;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const text = item.str.trim();

        if (!text) continue;

        if (text.match(/Page \d+/) || 
            text.toLowerCase().includes('domestic transaction')) {
          continue;
        }

        const y = Math.round(item.transform[5]);

        if (currentY === null || Math.abs(y - currentY) > 2) {
          if (currentRow.length > 0) {
            if (isValidTableRow(currentRow)) {
              rows.push([...currentRow]);
            } else {
              console.log(ERROR_MESSAGES.ERROR_INVALID_ROW, currentRow);
            }
            currentRow = [];
          }
          currentY = y;
        }

        currentRow.push(text);
      }

      if (currentRow.length > 0 && isValidTableRow(currentRow)) {
        rows.push([...currentRow]);
      }
    }
  }

  rows = rows
    .filter(row => isValidTableRow(row))
    .map(row => cleanRowData(row));

  if (rows.length === 0) {
    console.error(ERROR_MESSAGES.ERROR_NO_TABLE_DATA);
    throw new Error(ERROR_MESSAGES.ERROR_NO_TABLE_DATA);
  }

  return { headers, rows };
};

// Helper function to validate row data
function isValidTableRow(row) {
  if (row.length !== 4) return false;
  
  // Check if first column is a date (DD/MM/YYYY)
  const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!datePattern.test(row[0])) return false;
  
  // Check if last column is an amount
  const amountPattern = /^[-+]?\d*\.?\d+$/;
  if (!amountPattern.test(row[3].replace(/[,₹\s]/g, ''))) return false;
  
  return true;
}

// Helper function to clean row data
function cleanRowData(row) {
  return row.map((cell, index) => {
    // Clean up amount formatting
    if (index === 3) {
      return cell.replace(/[₹\s]/g, '').trim();
    }
    return cell.trim();
  });
}