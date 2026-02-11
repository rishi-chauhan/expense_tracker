# Expense Tracker

Full-stack application to track and analyze expenses from credit card statement CSV files with persistent storage and intelligent deduplication.

## Features

- 💾 **Persistent Storage**: SQLite database with automatic data persistence
- 🔄 **Smart Deduplication**: Prevents duplicate statements and transactions
- 📊 **Visual Analytics**: Interactive charts with monthly spending trends
- 📈 **Debits vs Credits**: Separate tracking of expenses and payments
- 📁 **CSV Upload**: Drag-and-drop or browse to upload statements
- ⚡ **Fast Performance**: Bun runtime with optimized processing
- 🧪 **Comprehensive Testing**: 110+ tests with 98% backend coverage
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

Run all tests:
```bash
bun test
```

Run tests with coverage:
```bash
bun test:coverage
```

Run backend tests only:
```bash
bun test:backend
```

Run frontend tests only:
```bash
bun test:frontend
```

Interactive test UI:
```bash
bun test:ui
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
4. View your analytics dashboard with:
   - Total debits (expenses) and credits (payments)
   - Net spending calculation
   - Monthly spending trends chart
5. Upload additional statements - duplicates are automatically detected and skipped

### Features in Action

- **Duplicate Detection**: The same statement file uploaded twice will be recognized and rejected
- **Transaction Deduplication**: Overlapping statements won't create duplicate transactions
- **Data Persistence**: All data is stored in SQLite (`data/expenses.db`)
- **Statement History**: View all uploaded statements and their metadata
- **Delete Statements**: Remove statements with automatic cascade delete of transactions

## CSV Format

This app is designed for credit card statement CSV files with the following format:

### Expected Format
- **Delimiter**: `~|~` (custom delimiter)
- **Metadata**: First 25 rows contain account metadata (automatically skipped)
- **Header Row**: Row 26 contains column headers
- **Required Columns**:
  - `DATE`: Transaction date in DD/MM/YYYY format (e.g., 25/12/2025)
  - `AMT`: Transaction amount with optional commas (e.g., 1,234.56)
  - `Description`: Transaction description
  - `Debit /Credit`: "Cr" for credits, empty for debits

### Example CSV Structure
```csv
Name~|~JOHN DOE
Card~|~xxxx-xxxx-xxxx-1234
...
(23 more metadata rows)
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
│   │   ├── index.js                 # HTTP server and routing
│   │   ├── db.js                    # SQLite database operations
│   │   ├── parser.js                # CSV parsing logic
│   │   ├── routes.js                # API endpoint handlers
│   │   ├── utils.js                 # Hash generation, date/amount parsing
│   │   └── __tests__/               # Backend tests (83/84 passing)
│   │       ├── utils.test.js
│   │       ├── parser.test.js
│   │       ├── db.test.js
│   │       ├── routes.test.js
│   │       └── integration.test.js
│   │
│   └── client/                      # Frontend (React)
│       ├── main.jsx                 # React entry point
│       ├── App.jsx                  # Main app component
│       ├── index.css                # Global styles
│       ├── components/
│       │   ├── FileUpload.jsx       # CSV file upload
│       │   ├── FileUpload.css
│       │   ├── Dashboard.jsx        # Analytics dashboard
│       │   └── Dashboard.css
│       └── __tests__/               # Frontend tests
│           ├── setup.js
│           ├── App.test.jsx
│           ├── Dashboard.test.jsx
│           └── FileUpload.test.jsx
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
2. Run tests: `bun test`
3. Run linter: `bun run lint`
4. Ensure all tests pass before committing

## License

Private project
