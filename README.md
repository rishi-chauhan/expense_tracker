# Paisa Kidhar Gaya?!

**पैसा किधर गया?!** — *"Where did the money go?!"*

A personal expense analyzer for Indian credit card statements. Upload your CSVs, get instant dashboards and charts — no cloud, no signup, everything stays on your machine.

## Highlights

- **Instant visual analytics** — upload credit card CSVs and get interactive charts in seconds
- **AI assistant** — ask questions about your spending in plain English (local Ollama, your data never leaves your device)
- **Multi-card support** — auto-detects bank and card number from 15 Indian banks
- **Two dashboards** — summary home page + advanced analytics with spending trends, top merchants, and transaction explorer
- **Light/dark theme** — plus a privacy toggle to hide credit transactions
- **Zero config** — smart deduplication, format auto-detection, drag-and-drop upload

## Quick Start

Requires [Bun](https://bun.sh/) v1.1+.

```bash
bun install
bun run dev
# open http://localhost:3000
```

## How It Works

1. **Upload** a credit card statement CSV (drag-and-drop or file picker)
2. **Auto-detect** — the parser finds the format, delimiter, bank name, and card number automatically
3. **Parse & deduplicate** — transactions are validated, deduplicated by hash, and stored in SQLite
4. **Browse dashboards** — view monthly trends, top merchants, debit/credit ratios, and search transactions
5. **Ask AI** (optional) — ask questions like *"how much did I spend on groceries last month?"*

## CSV Format

The parser auto-detects the format — no manual configuration needed. It looks for rows containing `DATE` and `AMT` columns, supports `~|~` and `~` delimiters, and handles variable metadata rows.

**Example structure:**

```
Name~|~JOHN DOE
Card~|~xxxx-xxxx-xxxx-1234
...
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Customer~|~25/12/2025~|~GROCERY STORE~|~1,234.56~|~~|~25
Domestic~|~Customer~|~26/12/2025~|~PAYMENT RECEIVED~|~5,000.00~|~Cr~|~0
```

Auto-detection works with statements from HDFC, ICICI, SBI, Axis, Kotak, and 10 other Indian banks. If the bank or card number can't be detected, the app prompts you to enter it manually.

## AI Assistant (Optional)

Requires [Ollama](https://ollama.ai/) running locally with the Qwen 2.5 1.5B model:

```bash
ollama pull qwen2.5:1.5b
ollama serve
```

The AI translates your questions into SQL queries, runs them against your data, and summarizes the results. Fully local — no data leaves your device. If Ollama isn't running, the chat feature simply hides itself.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh/) |
| Frontend | React 19 + Vite |
| Charts | Chart.js + react-chartjs-2 |
| Database | SQLite (Bun native driver) |
| AI | Ollama + Qwen 2.5 1.5B |
| Testing | Vitest + React Testing Library |

## Development

```bash
bun run dev          # start full-stack dev server (localhost:3000)
bun run build        # production build
bun run start        # start production server
bun run test         # run vitest tests (watch mode)
bun run lint         # run ESLint
```

See [TESTING.md](TESTING.md) for the full test suite details (287 tests across 18 test files).

## Contributing

1. Fork the repo and create a feature branch
2. Make your changes
3. Run `bun run test -- --run` and `bun run lint` — all checks must pass
4. Open a pull request

## License

MIT — see [LICENSE](LICENSE) for details.
