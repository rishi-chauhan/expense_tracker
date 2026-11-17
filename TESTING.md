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
├── server/__tests__/
│   ├── preload.js                 # bun test: throwaway DB_PATH for every run
│   ├── utils.test.js              # (vitest) hashes, date/amount parsing
│   ├── parser.test.js             # (vitest) CSV parsing
│   ├── db.test.js                 # (bun) schema + CRUD
│   ├── routes.test.js             # (bun) API handlers
│   ├── integration.test.js        # (bun) full upload workflow
│   ├── executeReadOnlyQuery.test.js # (bun) AI SQL validator (sqlGuard.js)
│   ├── security.test.js           # (bun) CSRF, size, host allow-list, validation, CSV injection, query worker timeout
│   ├── auth.test.js               # (bun) optional login, sessions, rate limit
│   ├── perf.test.js               # (bun) static compression/caching, API ETag/gzip, lean payload
│   └── ollama.test.js             # (bun) Ollama client
└── client/__tests__/
    ├── setup.js                   # jest-dom, in-memory localStorage, cache resets
    ├── testUtils.jsx              # renderWithProviders, makeTx, makeFetchMock, setSettings
    ├── App.test.jsx               # shell, nav, filters in URL, upload toasts, card-info retry, privacy, login
    ├── OverviewPage.test.jsx      # hero + money strip, KPIs, budgets, recurring, empty states
    ├── TransactionsPage.test.jsx  # sorting, pagination, URL category filter, search, export, phone list/sheet
    ├── AnalyticsDashboard.test.jsx # Insights on global filters
    ├── FilterContext.test.jsx     # period maths + provider/URL behaviour
    ├── ui.test.jsx                # Amount privacy, ToastProvider, ConfirmDialog, SegmentedControl
    ├── Contexts.test.jsx          # Theme + Settings (incl. back-compat)
    ├── FileUpload.test.jsx, CardInfoModal.test.jsx, StatementsPage.test.jsx, AskAI.test.jsx
    ├── SpendingTrends.test.jsx, TopMerchants.test.jsx, DebitCreditRatio.test.jsx
    └── dataProcessing.test.js
```

## Running Tests

```bash
bun run test -- --run   # vitest: client + pure server tests (never bare `bun test` at the root)
bun run test:bun        # bun:sqlite server tests (uses a throwaway DB via preload)
bun run test:all        # both
bun run test:coverage
```

New server tests that import `bun:sqlite` must be added to `test:bun` in `package.json` **and** to the `exclude` list in `vitest.config.js`.

Client tests query by role/label (`getByRole`, `getByLabelText`) rather than class names wherever possible, and page tests render with the real providers via `renderWithProviders`.

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
- [x] CSRF / CSP / host allow-list / body size limits
- [x] AI SQL validation and worker timeout
- [x] Static precompression, ETag/304, API gzip
- [x] API endpoints and error handling

### Critical Frontend Features
- [x] Component rendering
- [x] React Router navigation
- [x] File upload validation
- [x] Overview, Transactions and Insights pages
- [x] Chart components (SpendingTrends, DebitCreditRatio, TopMerchants, CategoryBreakdown via Insights)
- [x] Global URL filters, privacy mode, toasts, dialogs, optional login
- [x] Data processing utilities
- [x] API integration
- [x] Error and loading states

## Test Quality Metrics

- **Total Tests**: run `bun run test:all` for current counts (vitest + bun:test)
- **CI**: GitHub Actions runs lint + vitest + bun server tests on every PR
- **Edge Cases Covered**: Empty files, invalid dates, malformed data, duplicates, CC payment filtering, upload size/CSV validation
- **Integration Coverage**: Full upload workflows tested

## Known Issues

None noted at last update.

## Best Practices

- Server tests use isolated in-memory or throwaway SQLite databases (never `data/expenses.db`)
- Tests are independent and can run in parallel
- Fixtures are reusable across test files
- Mocks are properly cleaned up after each test
- Test names clearly describe what is being tested

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure all tests pass: `bun run test:all`
3. Check coverage: `bun run test:coverage`
5. Aim for 85%+ coverage for new code
6. Include edge case tests

## Success Criteria

- [x] Test infrastructure set up (Vitest, testing-library, happy-dom)
- [x] Backend utils: 100% coverage
- [x] Backend parser: 95%+ coverage
- [x] Backend database: 90%+ coverage
- [x] Backend routes: 85%+ coverage
- [x] Backend integration tests working
- [x] Test fixtures created
- [x] All critical features have tests
- [x] Tests run fast (<5 seconds for vitest suite)
- [x] Tests are maintainable and readable

**Overall Status**: run `bun run test:all` for current counts.
