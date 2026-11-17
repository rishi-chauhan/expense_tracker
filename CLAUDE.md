# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Paisa Kidhar Gaya?!** (पैसा किधर गया?! — "Where did the money go?!") is a single-user, self-hosted React 19 app for analysing credit card CSV statements. It runs 24/7 on a Raspberry Pi 4 and is mostly opened from a phone over Tailscale. The Bun backend parses uploads into SQLite; the SPA (Overview, Transactions, Insights, Statements, Categories) renders everything on the viewing device.

**Runtime:** Bun (v1.3+) — NOT npm. All commands use `bun` / `bunx`, never npm/npx/yarn.

## Development Commands

```bash
bun install --frozen-lockfile

# Backend http://127.0.0.1:3000 + Vite http://localhost:5173 (both localhost-only)
bun run dev
bun run dev:backend
bun run dev:vite                 # add `-- --host` only for intentional LAN phone testing

bun run build                    # vite build && scripts/compress-dist.js (.br/.gz next to assets)
bun run start                    # production server (needs dist/)

bun run test -- --run            # vitest: client + pure server tests (do NOT use bare `bun test`)
bun run test:bun                 # bun:sqlite server tests (db, routes, security, auth, perf, …)
bun run test:all
bun run lint

# Single test file / single test
bun run test -- --run src/client/__tests__/OverviewPage.test.jsx
bun run test -- --run -t "privacy mode"
bun test src/server/__tests__/routes.test.js          # bun:sqlite files only
bun test src/server/__tests__/security.test.js -t "CSRF"
```

`bunfig.toml` scopes `bun test` to `src/server/__tests__` and preloads `preload.js` (throwaway `DB_PATH`), so server tests never touch `data/expenses.db`.

Demo data (no real statements): `bun scripts/generate-demo-csvs.js [outDir]` writes 12 months of synthetic statements for two fake cards (HDFC, ICICI) to `demo-data/` (gitignored). Run against a separate DB (`DB_PATH=/some/tmp/demo.db bun run dev`) and upload them via the UI or `curl -H 'X-Requested-With: paisa' -F "file=@x.csv;type=text/csv" localhost:3000/api/upload`. README screenshots in `docs/screenshots/` were made from this data.

Dev password (optional): `printf '%s' 'pw' | bun scripts/hash-password.js`, then start the backend with `AUTH_PASSWORD_HASH='<hash>'`.

## Architecture

### Request pipeline (server)

`src/server/index.js` only initialises the DB and calls `Bun.serve` (`maxRequestBodySize` capped). All logic is in `src/server/app.js` → `createApp()`, so tests call it directly:

1. **Host allow-list** (`security.js` `checkHost`, `ALLOWED_HOSTS`) → 421. Dev default `localhost,127.0.0.1`.
2. `OPTIONS` → 204 with **no CORS headers** (the SPA is always same-origin; Vite proxies `/api` with `changeOrigin: false`).
3. `/api/*`: `checkBodySize` (16 KB JSON, upload limit) → **`checkCsrf`** → `auth.handle` → conditional-GET ETag check → `routes.js handleApiRequest` → data-version bump → gzip.
4. Everything else: `static.js` (precompressed `.br`/`.gz` by `Accept-Encoding`, `/assets/*` immutable, others `no-cache`, ETag/304, `.gz`/`.br` never served by URL, SPA fallback).
5. `withSecurityHeaders` adds nosniff, frame DENY, Referrer-Policy, Permissions-Policy, COOP, CORP, and the strict **CSP** (production only; Vite HMR needs inline/eval).

**CSRF (security.js)** — required for every non-GET `/api` request, independent of any cookie: `Sec-Fetch-Site` must be `same-origin`/`none` when present; `Origin` (when present) must match `Host` or `X-Forwarded-Host`; header **`X-Requested-With: paisa`** is mandatory; bodies must be `application/json` (or `multipart/form-data` for `/api/upload`) → 415. The client `api()` helper always sends the header — any new fetch must go through `utils/api.js`.

**Optional auth (auth.js)** — off unless `AUTH_PASSWORD_HASH` is set. argon2id via `Bun.password`; DB-backed `sessions` table storing only SHA-256 of the token; `pkg_session` cookie `HttpOnly; SameSite=Strict; Secure` (prod); in-memory login rate limit (5 free, then exponential, max 900 s, 429 + Retry-After). Routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (404s for login/logout when disabled). Public: `/api/health`, login, me. `createAuth()` is a factory for tests.

**Data version / caching** — `dataVersion.js` counter is bumped by every mutating DB function in `db.js` (and after successful non-GET requests). Cacheable GETs (`/api/transactions|cards|statements|categories|budgets|recurring`) get weak ETags `W/"<startedAt>-<version>-<hash(url)>"` (budgets also include the current month) and 304 before any SQL; other API responses are `Cache-Control: no-store`. `getAllCategories` and `detectRecurring` are memoised per data version.

**AI chat** — `ollama.js` generates SQL (`keep_alive: 10m`, optional `OLLAMA_NUM_THREAD`, schema includes categories). `sqlGuard.js prepareReadOnlySql` strips comments, requires `SELECT`, rejects `RECURSIVE`, write/DDL keywords, `sqlite_*`/`sessions`, `randomblob|zeroblob|load_extension|readfile|writefile|edit|fts3_tokenizer`, multiple statements, >2000 chars, and **always wraps** as `SELECT * FROM (<sql>) LIMIT 100`. `queryRunner.js` runs it in `queryWorker.js` (read-only connection + `PRAGMA query_only`, re-validates) with a 3 s timeout that terminates and respawns the worker; no writable fallback (503). One chat at a time (429). `OLLAMA_SUMMARIZE=0` skips the summary LLM call.

**Validation & errors (routes.js)** — tiny `v.*` validators (lengths, `#rrggbb` colours, positive ints, `YYYY-MM(-DD)` dates, budget period `monthly`, card last 4 digits); `ValidationError` → 400; every unexpected error → generic `500 Internal server error` (details only in logs); UNIQUE → friendly 409. CSV export prefixes formula-like text (`= + - @ \t \r`) with `'`.

### Data flow

1. Upload (`UploadDialog` / Overview empty state / drop anywhere) → `useUpload` → `POST /api/upload` (FormData). Results are **toasts**.
2. Server parses (`parser.js`), dedupes by file hash + per-tx hash, stores. Card not detected → 422 `needsCardInfo` → `CardInfoModal` → re-send with overrides.
3. `useTransactions` fetches `/api/transactions` (lean columns) + `/api/cards`; `transformTransactions` precomputes `Date` (local midnight), `DateStr`, `Ts`, `MonthKey`, `WeekKey`, `DescLower`, `IsCCPayment`.
4. `FilterProvider` computes `filtered` once (card + analytics filter + date range) for all pages.

### Client state

Providers in `main.jsx`: `BrowserRouter` → `ThemeProvider` → `SettingsProvider` → `ToastProvider` → `AuthProvider` → `App`; `App` wraps routes in `FilterProvider`.

- **ThemeContext** — `theme`, `toggleTheme`; key `expense-tracker-theme`; `public/theme-init.js` sets `data-theme` before paint (external file, CSP-safe).
- **SettingsContext** — `showCredits`, `hideAmounts` (privacy mode), toggles; key `expense-tracker-settings` (back-compatible with `{showCredits}`); `Shift+H` toggles privacy outside text fields. When `showCredits` is false, credit rows, credit KPIs, the Type filter and the debit-vs-credit chart are hidden.
- **AuthContext** — `status: loading|authed|anon`, `authRequired`, `login`, `logout`; listens for `pkg:unauthorized` (dispatched by `api()` on 401). Default value (no provider) is `authed`.
- **FilterContext** — URL params `card`, `period` (`latest` default | `this-month` | `last-month` | `3m` | `6m` | `12m` | `all` | `custom`), `from`, `to`. Exposes `filtered`, `previousFiltered`, `range`, `previousRange`, `rangeLabel`, `filterSearch` (append to nav links), setters. Pure helpers in `utils/periods.js`.
- **ToastProvider** (`components/ui/Toast.jsx`) — `useToast().show({type, title, message, details})`; success/info auto-dismiss 5 s, errors stay.
- `hooks/useCategories.js` — shared module-level cache for `/api/categories`; call `invalidateCategories()` after category/rule mutations.

### Routes / pages

| Path | Page |
|---|---|
| `/` | `OverviewPage` — hero sentence + money strip (category segments link to `/transactions?category=`), KPIs vs previous period, lazy spending bar chart, where it went, budgets, top merchants, recurring, recent; welcome upload card when empty |
| `/transactions` | `TransactionsPage` — search (deferred), category (`?category=<id>|none`), type, export; sortable sticky table (desktop) / list + detail sheet + load more (phone); 50 per page |
| `/analytics` | `AnalyticsDashboard` (Insights) — spending trends, category split, top merchants, day-of-week, debit vs credit |
| `/statements` | `StatementsPage` — table / cards, `ConfirmDialog` delete |
| `/categories` | `CategoriesPage` — categories, auto-tag rules, monthly budgets |

Login (`LoginPage`) replaces the app when auth is required and there is no session.

### Layout & design system

`components/layout/`: `AppShell` (sidebar ≥1024 px, 72 px icon rail 768–1023 px, `TopBar` + `BottomNav` <768 px, chosen with `useIsDesktop()`), `Sidebar`, `TopBar`, `BottomNav`, `FilterBar`, `SettingsControls`, `navItems.js`.

`components/ui/` primitives (each `X.jsx` + `X.css`): `Button`, `IconButton`, `Card`/`CardHeader`, `StatTile`, `SegmentedControl`, `Select`, `Input`, `Chip`, `Dialog` (native `<dialog>` + `showModal`, Esc/backdrop close; variants `center|sheet|panel`), `ConfirmDialog`, `Sheet`, `Toast`, `Skeleton`, `EmptyState`, `Amount`, `Icon` (inline SVG paths, no icon library).

Tokens live in `index.css` (`--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-2`, `--text-3`, `--accent`, `--accent-weak`, `--on-accent`, `--debit`, `--credit`, `--warning`, `--danger`, radii `--r-*`, spacing `--s-*`). Font: **Inter Variable only**, self-hosted latin + latin-ext (`fonts.css`; latin-ext carries ₹). No monospace font — money uses `.num`/`.amount` (tabular figures). **All money in the UI goes through `<Amount>`** so privacy mode works; chart ticks/tooltips use `money()` from `chartConfig.js`. No blur, glows or gradients; only floating UI gets `--shadow-pop`. Respect `prefers-reduced-motion`.

### Charts

`utils/chartConfig.js` registers only the Chart.js pieces used, sets the Inter font, exports tooltip/axis factories, `money()`, `sharedAnimation` (off under reduced motion), `chartDevicePixelRatio` (≤2). `hooks/useChartTheme.js` reads the CSS tokens and `hideAmounts`. Chart components (`SpendingTrends`, `TopMerchants`, `CategoryBreakdown`, `DebitCreditRatio`, `WeekdayChart`, `SpendingBarChart`) memoise data/options, are wrapped in `React.memo`, and render inside `ChartCard` (fixed height + sr-only summary). Chart.js loads only on routes with a canvas; the Overview chart is lazy.

### Data processing (`utils/dataProcessing.js`)

`filterAnalyticsData` (drops CC payments — credits whose description has `CC PAYMENT`/`BPPY`), `filterByDateRange` (string compare), `searchByDescription`, `filterByCard`, `calculateSummaryStats`, `groupByMonth`/`groupByWeek` (by precomputed keys, cached `Intl` labels), `groupByDescription`, `groupByCategory`, `spendByWeekday`, `formatINR` (`₹1,23,456.78`), `formatINRWhole`, `formatINRCompact` (`₹1.2L`), `formatDay`, date-key helpers. All fall back gracefully for old-shape rows used in tests.

### Database

`db.js`: `cards`, `statements`, `transactions` (+ `category_id`, `category_manual`), `categories`, `category_rules`, `budgets`, `sessions`. WAL, `synchronous=NORMAL`, `temp_store=MEMORY`, 16 MB cache, 64 MB mmap; `PRAGMA optimize` after uploads and on close. Parameterised SQL everywhere. Stored: date, amount, description, debit/credit, type, bank, **card last 4**, card label, file name/hash, categories/rules/budgets. Never store full card numbers, names, addresses or limits.

## Code Patterns

- Functional components + hooks; component + matching CSS file side by side; pages in `pages/`, components in `components/`, primitives in `components/ui/`, layout in `components/layout/`.
- Non-component helpers go in `utils/` (ESLint `react-refresh/only-export-components`).
- ESLint 9 flat config; unused vars allowed if they match `^[A-Z_]`; JSX member usage isn't tracked, so avoid `const Tag = …` patterns (use `React.createElement`).
- Tests: prefer `getByRole`/`getByLabelText`; page tests use `__tests__/testUtils.jsx` (`renderWithProviders`, `makeTx`, `makeFetchMock`, `setSettings`). Vitest setup provides an in-memory `localStorage` and resets the categories cache. Server tests that touch SQLite run under `bun test` with a throwaway `DB_PATH` (`__tests__/preload.js` via `bunfig.toml`); add new ones to `test:bun` in `package.json` and to the vitest `exclude` list.

## Important Notes

- Never use npm. `bun.lock` is committed; CI uses `--frozen-lockfile`, pinned Bun 1.3.14 and SHA-pinned actions.
- Production binds to `127.0.0.1` (and dev does too). Never add `0.0.0.0` in production, `tailscale funnel`, or port forwards.
- Don't add heavy dependencies (Pi 4). Allowed runtime deps: React, react-router-dom, Chart.js/react-chartjs-2, PapaParse (server), `@fontsource-variable/inter`. No Tailwind, component/icon/auth libraries or state managers.
- Don't build on the Pi; build on a laptop and rsync `dist/` (it includes the `.br`/`.gz` files).
- systemd runs `bun --smol src/server/index.js` directly (one process).
- Never commit real CSVs, databases, `.env`, or screenshots with real data; use `scripts/generate-demo-csvs.js` or `tests/fixtures/sample_valid.csv`.
- No service worker caching of `/api/*` (financial data must not persist on the phone).

## File Organization

```
src/client/   main.jsx, App.jsx, index.html (Vite root), index.css (tokens), fonts.css, public/ (theme-init.js, PWA manifest)
              contexts/ · hooks/ · pages/ · components/{,layout/,ui/} · utils/ · __tests__/
src/server/   index.js (bootstrap) → app.js (pipeline) · security.js · auth.js · static.js · routes.js · db.js
              parser.js · utils.js · config.js (env config; Ollama vars live in ollama.js) · dataVersion.js · ollama.js · sqlGuard.js
              queryRunner.js / queryWorker.js · __tests__/
scripts/      compress-dist.js (build step) · hash-password.js · generate-demo-csvs.js · check-credits.js
deploy/       setup.sh (one-shot Pi install) · install.sh · backup.sh · systemd unit · Caddy · README.md
docs/         screenshots/ (synthetic data only)
```
