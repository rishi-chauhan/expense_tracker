# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack React 19 application for analyzing credit card expenses from CSV files. Users upload CSV statements through a web interface, the backend parses and stores transactions in SQLite, and the frontend provides a multi-page dashboard with interactive Chart.js visualizations.

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

1. **FileUpload** → User selects CSV file, component validates MIME type
2. **App.jsx** → Sends file to backend via `POST /api/upload` (FormData)
3. **Backend** → Parses CSV (auto-detects format), validates, deduplicates, stores in SQLite
4. **App.jsx** → Fetches transactions from `GET /api/transactions`, transforms to component format
5. **Pages** → HomePage shows summary dashboard; AnalyticsDashboard shows advanced charts with filters

### State Management

Global state is managed in `App.jsx` using React hooks:
- `csvData`: Transformed transaction array (fetched from API)
- `loading`: Boolean for upload state
- `error`: String for error messages
- `notification`: Object for success/info messages (e.g., duplicate detection)

On mount, App fetches existing transactions from the API. After upload, it re-fetches to refresh.

Data flows **one-way**: App → Pages → Components via props. Each page may have local filter state (e.g., AnalyticsDashboard manages date range and search filters).

### Routing

Uses `react-router-dom` v7 with `BrowserRouter` (wrapped in `main.jsx`).

Two routes defined in `App.jsx`:
- `/` → `HomePage` — File upload, notifications, and basic monthly spending dashboard
- `/analytics` → `AnalyticsDashboard` — Advanced analytics with filters and 4 specialized chart components

Navigation is via `NavLink` components in the app header.

### CSV Parsing (Server-Side)

CSV parsing is handled entirely by the backend in `src/server/parser.js`. The parser is format-agnostic and auto-detects:
- **Delimiter**: `~|~` or `~` (searches header row)
- **Header location**: Finds row containing `DATE` and `AMT` columns (not hardcoded)
- **Column variations**: Handles `Debit /Credit` and `Debit / Credit`

See `src/server/parser.js` for details. The client sends the raw file; all parsing logic is server-side.

### Data Visualization

**Dashboard** (`components/Dashboard.jsx`) — Shown on HomePage:
- Summary stat cards: total debits, total credits, net spending
- Line chart: monthly spending trends
- Range selector buttons (1M, 3M, 6M, 12M, All)

**AnalyticsDashboard** (`pages/AnalyticsDashboard.jsx`) — `/analytics` route:
- Filter controls: text search, date range picker, granularity toggle (weekly/monthly)
- **SpendingTrends**: Line chart with toggleable debit/credit datasets, weekly or monthly granularity
- **DebitCreditRatio**: Doughnut chart showing debit vs credit percentage split
- **TopMerchants**: Horizontal bar chart of top 10 merchants by spending
- **TransactionExplorer**: Paginated, sortable transaction table (25 rows/page)

CC payments (descriptions containing "CC PAYMENT" or "BPPY") are excluded from analytics calculations.

### Shared Utilities

**`utils/chartConfig.js`** — Centralized Chart.js configuration:
- Registers all Chart.js components globally (Tooltip, Legend, scales, elements, etc.)
- Exports shared configs: tooltip styling, axis formatting, animation, color constants (COLORS object)
- INR currency formatting for tooltips and axes

**`utils/dataProcessing.js`** — Data processing functions:
- `filterAnalyticsData(csvData)` — Removes CC payments and invalid entries
- `calculateSummaryStats(data)` — Total debits, credits, net spending
- `groupByMonth(data)`, `groupByWeek(data)` — Temporal aggregations
- `groupByDescription(data)` — Top merchants aggregation
- `filterByDateRange(data, start, end)` — Date range filtering
- `searchByDescription(data, query)` — Description search
- `formatINR(amount)` — Currency formatting

## Code Patterns

### Component Structure
- Each component has a matching CSS file (e.g., `FileUpload.jsx` + `FileUpload.css`)
- Pages live in `pages/` directory, reusable components in `components/`
- Use functional components with hooks (no class components)
- Props are validated implicitly through usage, no PropTypes defined

### File Validation
- Only `.csv` MIME type accepted (`file.type === 'text/csv'`)
- Invalid files call the `onError` callback prop (falls back to `alert()` if not provided)
- Upload errors from the backend are caught and displayed in App.jsx

### ESLint Configuration
- Uses **ESLint 9 flat config** (eslint.config.js, not .eslintrc)
- Allows unused vars if they match regex `^[A-Z_]` (constants pattern)
- React Hooks rules enforced via eslint-plugin-react-hooks
- React Refresh rules warn if non-component exports exist

## Important Notes

- This project was migrated from npm to Bun - never use npm commands
- `react-router-dom` v7 is used for client-side routing
- Vite uses default port 5173 for dev server
- Production builds go to `dist/` directory (gitignored)
- `bun.lock` is committed to git for reproducible builds
- PapaParse is a dependency (used server-side by the parser) but is NOT used on the client

## File Organization

```
src/
├── client/
│   ├── main.jsx                        # React entry point, BrowserRouter wrapper
│   ├── App.jsx                         # Root component, routing, API calls, state
│   ├── App.css                         # Root component styles
│   ├── index.css                       # Global styles
│   ├── pages/
│   │   ├── HomePage.jsx                # Upload + basic dashboard page
│   │   ├── HomePage.css
│   │   ├── AnalyticsDashboard.jsx      # Advanced analytics page with filters
│   │   └── AnalyticsDashboard.css
│   ├── components/
│   │   ├── FileUpload.jsx              # CSV file upload with drag-and-drop
│   │   ├── FileUpload.css
│   │   ├── Dashboard.jsx               # Summary stats + monthly line chart
│   │   ├── Dashboard.css
│   │   ├── SpendingTrends.jsx          # Weekly/monthly spending line chart
│   │   ├── SpendingTrends.css
│   │   ├── TopMerchants.jsx            # Top 10 merchants bar chart
│   │   ├── TopMerchants.css
│   │   ├── DebitCreditRatio.jsx        # Debit/credit doughnut chart
│   │   ├── DebitCreditRatio.css
│   │   ├── TransactionExplorer.jsx     # Paginated transaction table
│   │   └── TransactionExplorer.css
│   ├── utils/
│   │   ├── chartConfig.js              # Chart.js registration and shared config
│   │   └── dataProcessing.js           # Data filtering, aggregation, formatting
│   └── __tests__/
│       ├── setup.js                    # Test environment config
│       ├── App.test.jsx
│       ├── Dashboard.test.jsx
│       ├── FileUpload.test.jsx
│       ├── HomePage.test.jsx
│       ├── AnalyticsDashboard.test.jsx
│       ├── SpendingTrends.test.jsx
│       ├── TopMerchants.test.jsx
│       ├── DebitCreditRatio.test.jsx
│       ├── TransactionExplorer.test.jsx
│       └── dataProcessing.test.js
│
└── server/
    ├── index.js                        # HTTP server and Vite dev integration
    ├── db.js                           # SQLite database operations
    ├── parser.js                       # CSV parsing with format auto-detection
    ├── routes.js                       # API endpoint handlers
    ├── utils.js                        # Hash generation, date/amount parsing
    └── __tests__/
        ├── utils.test.js
        ├── parser.test.js
        ├── db.test.js
        ├── routes.test.js
        └── integration.test.js
```

When adding new components, follow the pattern of component + CSS file in the `components/` directory. Pages go in `pages/`.
