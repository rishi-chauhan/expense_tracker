# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React 19 single-page application for analyzing credit card expenses from CSV files. Users upload CSV statements, and the app visualizes spending patterns using Chart.js.

**Runtime:** Bun (v1.1+) - NOT npm. All commands use `bun` instead of `npm`.

## Development Commands

```bash
# Install dependencies
bun install

# Start both backend and frontend dev servers
# Backend: http://localhost:3000 (API)
# Frontend: http://localhost:5173 (React app)
bun run dev

# Start backend only (if needed separately)
bun run dev:backend

# Start frontend only (if needed separately)
bun run dev:vite

# Build for production
bun run build

# Start production server
bun run start

# Preview production build
bun run preview

# Run client + shared server tests (vitest — do NOT use bare `bun test`)
bun run test

# Run tests once (no watch)
bun run test -- --run

# Run server tests that use bun:sqlite (must use bun test, not vitest)
bun test src/server/__tests__/db.test.js src/server/__tests__/integration.test.js src/server/__tests__/routes.test.js

# Run linter
bun run lint
```

## Architecture

### Data Flow

1. **FileUpload** → User selects CSV file
2. **App** → Parses CSV with PapaParse, validates data, manages state
3. **Dashboard** → Processes parsed data and renders Chart.js visualizations

### State Management

All state is managed in `App.jsx` using React hooks:
- `csvData`: Parsed and cleaned CSV data (array of objects)
- `loading`: Boolean for parsing state
- `error`: String for parsing errors

Data flows **one-way** from App → FileUpload (onFileUpload callback) and App → Dashboard (csvData prop).

### CSV Parsing (App.jsx)

PapaParse configuration:
- `header: true` - First row becomes object keys
- `dynamicTyping: true` - Auto-converts numeric strings to numbers
- `skipEmptyLines: true` - Ignores blank rows

**Critical:** After parsing, data is cleaned to filter out rows where ALL values are null/undefined/empty strings. This prevents Chart.js errors from malformed data.

### Data Visualization (Dashboard.jsx)

Two charts are generated from the same CSV data:

1. **Pie Chart - Spending by Category**
   - Aggregates `Amount` by `Category` field
   - Uses `reduce()` to sum amounts per category
   - Validates: Category exists, Amount is a valid number

2. **Bar Chart - Monthly Spending**
   - Aggregates `Amount` by month-year from `Date` field
   - Parses dates, formats as "MMM-YYYY" (e.g., "Jan-2025")
   - **Sorts chronologically** before rendering (important for readability)
   - Validates: Date is parseable, Amount is a valid number

**Chart.js Registration:** All Chart.js components (ArcElement, BarElement, etc.) must be registered globally in Dashboard.jsx before use.

### Expected CSV Format

The app expects these columns (case-sensitive):
- `Date` - Any standard date format (parsed by `new Date()`)
- `Amount` - Numeric value (e.g., 45.99)
- `Category` - String (e.g., "Groceries", "Gas", "Dining")

Additional columns are ignored. Missing/invalid values are filtered during processing.

## Code Patterns

### Component Structure
- Each component has a matching CSS file (e.g., `FileUpload.jsx` + `FileUpload.css`)
- Use functional components with hooks (no class components)
- Props are validated implicitly through usage, no PropTypes defined

### File Validation
- Only `.csv` MIME type accepted (`file.type === 'text/csv'`)
- Invalid files trigger browser alert (in FileUpload.jsx)
- Parser errors are caught and displayed as red error messages (in App.jsx)

### ESLint Configuration
- Uses **ESLint 9 flat config** (eslint.config.js, not .eslintrc)
- Allows unused vars if they match regex `^[A-Z_]` (constants pattern)
- React Hooks rules enforced via eslint-plugin-react-hooks
- React Refresh rules warn if non-component exports exist

## Important Notes

- This project was migrated from npm to Bun - never use npm commands
- `pdfjs-dist` was previously a dependency but removed (project evolved from PDF to CSV processing)
- Vite uses default port 5173 for dev server
- Production builds go to `dist/` directory (gitignored)
- `bun.lock` is committed to git for reproducible builds

## File Organization

```
src/
├── main.jsx              # React entry point, renders <App />
├── App.jsx               # Root component, CSV parsing logic, state management
├── index.css             # Global styles
└── components/
    ├── FileUpload.jsx    # File input, validates CSV MIME type
    ├── FileUpload.css
    ├── Dashboard.jsx     # Chart.js visualizations, data aggregation
    └── Dashboard.css
```

When adding new components, follow the pattern of component + CSS file in the `components/` directory.
