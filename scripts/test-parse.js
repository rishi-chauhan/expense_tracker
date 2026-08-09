import Papa from 'papaparse';
import fs from 'fs';

// Read the file
const content = fs.readFileSync('./assets/sample_statement.csv', 'utf-8');

console.log('=== File Info ===');
console.log('Total length:', content.length);
console.log('First 100 chars:', content.substring(0, 100));

// Split by lines
const lines = content.split(/\r?\n/);
console.log('\n=== Line Split Info ===');
console.log('Total lines:', lines.length);
console.log('Line 0 (index 0):', lines[0]);
console.log('Line 25 (index 24):', lines[24]);
console.log('Line 26 (index 25):', lines[25]);
console.log('Line 27 (index 26):', lines[26]);

// Skip first 25 and join back
const processedContent = lines.slice(25).join('\n');

console.log('\n=== Processed Content Info ===');
console.log('Processed length:', processedContent.length);
console.log('First 200 chars:', processedContent.substring(0, 200));

// Parse with PapaParse
console.log('\n=== Parsing with PapaParse ===');
Papa.parse(processedContent, {
  delimiter: '~|~',
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    console.log('Parse successful!');
    console.log('Rows parsed:', results.data.length);
    console.log('Errors:', results.errors);
    console.log('First row:', results.data[0]);
    console.log('Column names:', Object.keys(results.data[0] || {}));
  },
  error: (err) => {
    console.log('Parse error:', err);
  }
});
