# Paisa Kidhar Gaya?!

Full-stack application to track and analyze expenses from credit card statement CSV files with persistent storage and intelligent deduplication.

## Features

- 💾 **Persistent Storage**: SQLite database with automatic data persistence
- 🔄 **Smart Deduplication**: Prevents duplicate statements and transactions
- 📊 **Visual Analytics**: Interactive charts with monthly spending trends
- 📈 **Debits vs Credits**: Separate tracking of expenses and payments
- 📁 **CSV Upload**: Drag-and-drop or browse to upload statements
- ⚡ **Fast Performance**: Bun runtime with optimized processing
- 🧪 **Comprehensive Testing**: 230+ tests across frontend and backend
- 🔐 **Data Integrity**: Foreign key constraints and cascade deletes

## Tech Stack

### Backend
- **Runtime**: [Bun](https://bun.sh/) v1.1+ (server & package manager)
- **Database**: SQLite with Bun's native driver
- **Server**: Bun's built-in HTTP server
- **CSV Parsing**: PapaParse with custom delimiter support
- **Hashing**: SHA-256 for duplicate detection

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 6
- **Charts**: Chart.js with react-chartjs-2
- **Styling**: Custom CSS with modern design

### Development
- **Testing**: Vitest with React Testing Library
- **Linting**: ESLint 9 with React plugins
- **Type Checking**: JavaScript with JSDoc

## Prerequisites

- [Bun](https://bun.sh/) v1.1 or higher

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

## Installation

Install dependencies:
```bash
bun install
```

## Development

Start the full-stack development server:
```bash
bun run dev
```

The app will be available at `http://localhost:3000`

For frontend-only development with Vite:
```bash
bun run dev:vite
```

This will start Vite at `http://localhost:5173`

## Production

Build frontend for production:
```bash
bun run build
```

Start production server:
```bash
bun run start
```

The full-stack app will be available at `http://localhost:3000`

## Testing

Run all vitest tests (client + shared server):
```bash
bun run test
```

Run tests once (no watch):
```bash
bun run test -- --run
```

Run with coverage:
```bash
bun run test:coverage
```

Run backend vitest tests only:
```bash
bun run test:backend
```

Run frontend tests only:
```bash
bun run test:frontend
```

Run server tests that use bun:sqlite (must use `bun test`, not vitest):
```bash
bun test src/server/__tests__/db.test.js src/server/__tests__/integration.test.js src/server/__tests__/routes.test.js
```

Interactive test UI:
```bash
bun run test:ui
```

See [TESTING.md](TESTING.md) for detailed testing documentation.

## Code Quality

Run linter:
```bash
bun run lint
```

## Usage

1. Start the server with `bun run dev`
2. Open your browser to `http://localhost:3000`
3. Upload a credit card statement CSV file:
   - Drag and drop onto the upload area, or
   - Click to browse and select a file
4. View your **Home** dashboard with:
   - Total debits (expenses) and credits (payments)
   - Net spending calculation
   - Monthly spending trends chart with range selector (1M, 3M, 6M, 12M, All)
5. Navigate to the **Analytics** page for advanced insights:
   - Spending trends with weekly/monthly granularity toggle
   - Debit/credit ratio breakdown
   - Top 10 merchants by spending
   - Full transaction explorer with search, date filters, sorting, and pagination
6. Upload additional statements - duplicates are automatically detected and skipped

### Features in Action

- **Duplicate Detection**: The same statement file uploaded twice will be recognized and rejected
- **Transaction Deduplication**: Overlapping statements won't create duplicate transactions
- **Data Persistence**: All data is stored in SQLite (`data/expenses.db`)
- **Statement History**: View all uploaded statements and their metadata
- **Delete Statements**: Remove statements with automatic cascade delete of transactions

## CSV Format

This app is designed for credit card statement CSV files. The parser **auto-detects** the format:

### Format Auto-Detection
- **Delimiter**: Supports both `~|~` and `~` delimiters (auto-detected from header row)
- **Header location**: Searches for the row containing `DATE` and `AMT` columns (not hardcoded to a specific row number)
- **Column variations**: Handles both `Debit /Credit` and `Debit / Credit` (with/without space)
- **Metadata**: Variable number of metadata rows before the header (automatically skipped)

### Required Columns
- `DATE`: Transaction date in DD/MM/YYYY format (e.g., 25/12/2025)
- `AMT`: Transaction amount with optional commas (e.g., 1,234.56)
- `Description`: Transaction description
- `Debit /Credit` (or `Debit / Credit`): "Cr" for credits, empty for debits

### Example CSV Structure
```csv
Name~|~JOHN DOE
Card~|~xxxx-xxxx-xxxx-1234
...
(metadata rows - variable count)
...
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Customer~|~25/12/2025~|~GROCERY STORE~|~1,234.56~|~~|~25
Domestic~|~Customer~|~26/12/2025~|~PAYMENT RECEIVED~|~5,000.00~|~Cr~|~0
```

See `assets/sample_statement.csv` for a complete example.

## Project Structure

```
expense_tracker/
├── src/
│   ├── server/                      # Backend (Bun server)
│   │   ├── index.js                 # HTTP server and Vite dev integration
│   │   ├── db.js                    # SQLite database operations
│   │   ├── parser.js                # CSV parsing with format auto-detection
│   │   ├── routes.js                # API endpoint handlers
│   │   ├── utils.js                 # Hash generation, date/amount parsing
│   │   └── __tests__/               # Backend tests (43 bun:sqlite tests)
│   │       ├── utils.test.js
│   │       ├── parser.test.js
│   │       ├── db.test.js
│   │       ├── routes.test.js
│   │       └── integration.test.js
│   │
│   └── client/                      # Frontend (React)
│       ├── main.jsx                 # React entry point, BrowserRouter wrapper
│       ├── App.jsx                  # Root component, routing, API calls, state
│       ├── App.css                  # Root component styles
│       ├── index.css                # Global styles
│       ├── pages/                   # Route-level page components
│       │   ├── HomePage.jsx         # Upload + basic dashboard page
│       │   ├── HomePage.css
│       │   ├── AnalyticsDashboard.jsx  # Advanced analytics with filters
│       │   └── AnalyticsDashboard.css
│       ├── components/              # Reusable UI components
│       │   ├── FileUpload.jsx       # CSV file upload with drag-and-drop
│       │   ├── FileUpload.css
│       │   ├── Dashboard.jsx        # Summary stats + monthly line chart
│       │   ├── Dashboard.css
│       │   ├── SpendingTrends.jsx   # Weekly/monthly spending line chart
│       │   ├── SpendingTrends.css
│       │   ├── TopMerchants.jsx     # Top 10 merchants bar chart
│       │   ├── TopMerchants.css
│       │   ├── DebitCreditRatio.jsx # Debit/credit doughnut chart
│       │   ├── DebitCreditRatio.css
│       │   ├── TransactionExplorer.jsx  # Paginated transaction table
│       │   └── TransactionExplorer.css
│       ├── utils/                   # Shared utilities
│       │   ├── chartConfig.js       # Chart.js registration and config
│       │   └── dataProcessing.js    # Data filtering, aggregation, formatting
│       └── __tests__/               # Frontend tests (190 vitest tests)
│           ├── setup.js
│           ├── App.test.jsx
│           ├── Dashboard.test.jsx
│           ├── FileUpload.test.jsx
│           ├── HomePage.test.jsx
│           ├── AnalyticsDashboard.test.jsx
│           ├── SpendingTrends.test.jsx
│           ├── TopMerchants.test.jsx
│           ├── DebitCreditRatio.test.jsx
│           ├── TransactionExplorer.test.jsx
│           └── dataProcessing.test.js
│
├── tests/
│   └── fixtures/                    # Test CSV files
│       ├── sample_valid.csv
│       ├── sample_invalid.csv
│       ├── sample_malformed.csv
│       └── sample_empty.csv
│
├── data/                            # SQLite database (created at runtime)
│   └── expenses.db
│
├── public/                          # Static assets
├── assets/                          # Sample files
│   └── sample_statement.csv
├── index.html                       # HTML template
├── package.json                     # Dependencies and scripts
├── bun.lock                         # Bun lock file
├── vite.config.js                   # Vite configuration
├── vitest.config.js                 # Vitest test configuration
├── eslint.config.js                 # ESLint rules
├── TESTING.md                       # Testing documentation
└── README.md                        # This file
```

## Architecture

### Data Flow

1. **Upload**: User uploads CSV file via drag-and-drop or file picker
2. **File Hash**: SHA-256 hash generated for duplicate detection
3. **Parse**: CSV parsed with custom delimiter, metadata skipped
4. **Validate**: Transactions validated (date, amount, description)
5. **Store**: Data persisted to SQLite with deduplication
6. **Display**: Frontend fetches and visualizes data with Chart.js

### Database Schema

**statements** table:
- `id`: Primary key
- `file_name`: Original filename
- `file_hash`: SHA-256 hash (unique constraint)
- `period_start`, `period_end`: Statement date range
- `row_count`: Number of transactions
- `uploaded_at`: Timestamp

**transactions** table:
- `id`: Primary key
- `tx_hash`: Composite hash (date + amount + description, unique)
- `date`, `amount`, `description`, `is_credit`, `type`
- `statement_id`: Foreign key to statements (CASCADE delete)
- `uploaded_at`: Timestamp

### API Endpoints

- `GET /api/transactions` - Fetch all transactions with statistics
- `POST /api/upload` - Upload and process CSV file
- `GET /api/statements` - Fetch all uploaded statements
- `DELETE /api/statements/:id` - Delete statement and its transactions

## Why Bun?

- ⚡ **Faster installs**: 2-10x faster than npm
- 🚀 **Better performance**: Optimized JavaScript runtime
- 🛠️ **Built-in tools**: Native SQLite, HTTP server, test runner
- 🔄 **npm compatible**: Works with existing package.json
- 💾 **SQLite native**: Built-in database support without dependencies

## Contributing

1. Make changes to the code
2. Run vitest tests: `bun run test -- --run`
3. Run server tests: `bun test src/server/__tests__/db.test.js src/server/__tests__/integration.test.js src/server/__tests__/routes.test.js`
4. Run linter: `bun run lint`
5. Ensure all tests pass before committing

## License

Private project
