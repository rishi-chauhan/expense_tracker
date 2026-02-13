# Testing Documentation

## Overview

This project has comprehensive automated testing covering both backend and frontend functionality. The test suite ensures reliability, data integrity, and prevents regressions.

## Test Stack

- **Framework**: Vitest (compatible with Jest API, faster than Jest)
- **Frontend Testing**: @testing-library/react, @testing-library/user-event
- **DOM Environment**: happy-dom (for frontend tests)
- **Coverage**: Vitest v8 coverage provider
- **Server Tests**: Bun's native test runner (for tests using bun:sqlite)

## Test Structure

```
src/
├── server/
│   └── __tests__/
│       ├── utils.test.js              # Hash generation, date/amount parsing
│       ├── parser.test.js             # CSV parsing logic
│       ├── db.test.js                 # Database CRUD operations
│       ├── routes.test.js             # API endpoint handlers
│       └── integration.test.js        # Full upload workflow
│
└── client/
    └── __tests__/
        ├── setup.js                   # Test environment configuration
        ├── App.test.jsx               # Main app component, routing, API calls
        ├── Dashboard.test.jsx         # Dashboard summary stats + chart
        ├── FileUpload.test.jsx        # File upload validation + drag-and-drop
        ├── HomePage.test.jsx          # Home page integration
        ├── AnalyticsDashboard.test.jsx # Analytics page filters + charts
        ├── SpendingTrends.test.jsx    # Spending trends chart
        ├── TopMerchants.test.jsx      # Top merchants chart
        ├── DebitCreditRatio.test.jsx  # Debit/credit ratio chart
        ├── TransactionExplorer.test.jsx # Transaction table + pagination
        └── dataProcessing.test.js     # Data processing utility functions

tests/
└── fixtures/
    ├── sample_valid.csv               # Valid test CSV
    ├── sample_invalid.csv             # Invalid format
    ├── sample_malformed.csv           # Malformed data
    └── sample_empty.csv               # Empty file
```

## Running Tests

```bash
# Run all vitest tests (client + shared server)
bun run test

# Run tests once (no watch)
bun run test -- --run

# Run backend vitest tests only
bun run test:backend

# Run frontend tests only
bun run test:frontend

# Run with coverage
bun run test:coverage

# Run with UI
bun run test:ui

# Run server tests that use bun:sqlite (must use bun test, not vitest)
bun test src/server/__tests__/db.test.js src/server/__tests__/integration.test.js src/server/__tests__/routes.test.js
```

**Important:** Use `bun run test` (vitest) for client and shared tests. Use `bun test` (Bun's native runner) only for server tests that depend on `bun:sqlite`.

## Test Coverage Summary

### Backend Tests: **All Passing** (43 bun:sqlite tests + vitest parser/utils tests)

#### Utils Module
- File hash generation (SHA-256)
- Transaction hash generation with normalization
- Date parsing (DD/MM/YYYY to ISO format)
- Amount parsing (comma removal, validation)

#### Parser Module
- CSV parsing with `~|~` and `~` delimiters (format auto-detection)
- Dynamic header row detection
- Transaction validation and filtering
- Credit/debit identification
- Error handling for invalid formats

#### Database Module
- Schema creation and validation
- CRUD operations (statements and transactions)
- Unique constraint enforcement (deduplication)
- CASCADE delete operations
- Statistics aggregation
- Foreign key relationships

#### API Routes
- GET /api/transactions
- POST /api/upload
- GET /api/statements
- DELETE /api/statements/:id
- Error handling (400, 404, 500 responses)
- Response format validation

#### Integration Tests
- Full upload workflow (parse, validate, store)
- File-level duplicate detection
- Transaction-level deduplication
- Data persistence verification
- Referential integrity

### Frontend Tests: **All Passing** (190 vitest tests across 12 test files)

#### App Component (18 tests)
- Routing setup (Home and Analytics routes)
- API data fetching on mount
- File upload flow with backend integration
- Error and notification state management
- Duplicate statement detection

#### Dashboard (26 tests)
- Summary stat calculations (debits, credits, net)
- Monthly spending line chart rendering
- Range selector (1M, 3M, 6M, 12M, All)
- INR currency formatting
- Empty state handling

#### FileUpload (21 tests)
- CSV MIME type validation
- Drag-and-drop file handling
- File preview with size formatting
- Error callback for invalid files

#### HomePage (tests)
- Component integration (FileUpload + Dashboard)
- Loading, error, and notification states
- Notification dismiss behavior

#### AnalyticsDashboard (10 tests)
- Filter controls (search, date range, granularity)
- Data filtering and passing to child components
- Empty state and no-data handling

#### SpendingTrends (tests)
- Weekly/monthly granularity toggle
- Debit/credit dataset rendering
- Chart configuration

#### TopMerchants (tests)
- Top 10 merchant aggregation
- Horizontal bar chart rendering

#### DebitCreditRatio (tests)
- Doughnut chart with debit/credit split
- Percentage calculations

#### TransactionExplorer (10 tests)
- Paginated table rendering (25 rows/page)
- Column sorting (Date, Amount)
- Type badges (Debit/Credit)
- Date formatting

#### Data Processing Utils (tests)
- `filterAnalyticsData` — CC payment exclusion
- `calculateSummaryStats` — Debit/credit/net totals
- `groupByMonth`, `groupByWeek` — Temporal aggregation
- `groupByDescription` — Merchant aggregation
- `filterByDateRange`, `searchByDescription` — Filters
- `formatINR` — Currency formatting

## What's Tested

### Critical Backend Features
- [x] CSV parsing with custom delimiter
- [x] Format auto-detection (both `~|~` and `~` delimiters)
- [x] Dynamic header row detection
- [x] Date/amount normalization
- [x] File hash generation (SHA-256)
- [x] Transaction hash generation
- [x] Database schema and constraints
- [x] CRUD operations
- [x] Cascade deletes
- [x] Deduplication (file and transaction level)
- [x] Statistics aggregation
- [x] API endpoints and error handling

### Critical Frontend Features
- [x] Component rendering
- [x] React Router navigation
- [x] File upload validation
- [x] Dashboard calculations and charts
- [x] Analytics page with filters
- [x] All 4 chart components (SpendingTrends, DebitCreditRatio, TopMerchants, TransactionExplorer)
- [x] Data processing utilities
- [x] API integration
- [x] Error and loading states

## Test Quality Metrics

- **Total Tests**: 233 (190 vitest + 43 bun:sqlite)
- **Test Files**: 17 (12 vitest + 5 bun:sqlite)
- **All Tests Passing**: Yes
- **Edge Cases Covered**: Empty files, invalid dates, malformed data, duplicates, CC payment filtering
- **Integration Coverage**: Full upload workflows tested

## Known Issues

None. All tests are passing.

## Best Practices

- All tests use isolated in-memory SQLite databases
- Tests are independent and can run in parallel
- Fixtures are reusable across test files
- Mocks are properly cleaned up after each test
- Test names clearly describe what is being tested

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure all vitest tests pass: `bun run test -- --run`
3. Ensure server tests pass: `bun test src/server/__tests__/db.test.js src/server/__tests__/integration.test.js src/server/__tests__/routes.test.js`
4. Check coverage: `bun run test:coverage`
5. Aim for 85%+ coverage for new code
6. Include edge case tests

## Success Criteria

- [x] Test infrastructure set up (Vitest, testing-library, happy-dom)
- [x] Backend utils: 100% coverage
- [x] Backend parser: 95%+ coverage
- [x] Backend database: 90%+ coverage
- [x] Backend routes: 85%+ coverage
- [x] Backend integration tests working
- [x] Frontend tests fully operational (190 tests passing)
- [x] All components tested (6 components + 2 pages + 1 utility module)
- [x] Test fixtures created
- [x] All critical features have tests
- [x] Tests run fast (<5 seconds for vitest suite)
- [x] Tests are maintainable and readable

**Overall Status**: All 233 tests passing. Full-stack test coverage across backend (server tests + vitest) and frontend (components, pages, utilities).
