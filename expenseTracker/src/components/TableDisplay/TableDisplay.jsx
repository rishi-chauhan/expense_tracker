import "./TableDisplay.css";

// Display specific columns: Date, Description, Amount
const CORE_HEADERS = ["Date", "Description", "Amount"];

function TableDisplay({ headers, rows }) {
  // Ensure headers and rows are provided and rows have data
  if (!headers || headers.length === 0 || !rows || rows.length === 0) {
     console.warn("TableDisplay: No headers or rows provided.");
     return <p>No transaction data to display.</p>;
  }

  // Find the indices of the core headers in the provided headers array
  const headerIndices = CORE_HEADERS.map(coreHeader => headers.indexOf(coreHeader));

  // Filter out headers that weren't found (index === -1)
  const validHeaderIndices = headerIndices.filter(index => index !== -1);
  const displayHeaders = validHeaderIndices.map(index => headers[index]);

  // If no core headers are found, display a message or default headers
  if (displayHeaders.length === 0) {
      console.warn("TableDisplay: Core headers (Date, Description, Amount) not found in provided headers:", headers);
      // Optionally display all provided headers as fallback
      // displayHeaders = headers;
      // validHeaderIndices = headers.map((_, i) => i);
      return <p>Could not display transactions in the expected format.</p>;
  }


  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {/* Display only the core headers */}
            {displayHeaders.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {/* Display cells corresponding to the core headers */}
              {validHeaderIndices.map((headerIndex, cellIndex) => (
                <td key={cellIndex}>{row[headerIndex] !== undefined ? row[headerIndex] : 'N/A'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TableDisplay;
