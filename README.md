# Expense Tracker

React application to track and analyze expenses from CSV files containing monthly credit card statements.

## Features

- 📊 Visual analytics with interactive charts
- 📈 Spending by category (pie chart)
- 📉 Monthly spending trends (bar chart)
- 📁 CSV file upload and parsing
- ⚡ Fast and responsive UI

## Tech Stack

- **Runtime & Package Manager**: [Bun](https://bun.sh/) v1.1+
- **Framework**: React 19
- **Build Tool**: Vite 6
- **Charts**: Chart.js with react-chartjs-2
- **Data Parsing**: PapaParse (CSV parser)
- **Linting**: ESLint 9 with React plugins

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

Start development server:
```bash
bun run dev
```

The app will be available at `http://localhost:5173`

## Production

Build for production:
```bash
bun run build
```

Preview production build:
```bash
bun run preview
```

## Code Quality

Run linter:
```bash
bun run lint
```

## Usage

1. Start the development server with `bun run dev`
2. Open your browser to `http://localhost:5173`
3. Click "Choose File" and upload a CSV file containing expense data
4. View the analytics dashboard with charts and statistics

## CSV Format

Your CSV file should include these columns:
- **Date**: Transaction date (any standard date format)
- **Amount**: Transaction amount (numeric, e.g., 45.99)
- **Category**: Expense category (e.g., Groceries, Gas, Dining)

Example CSV:
```csv
Date,Amount,Category
2025-01-15,45.99,Groceries
2025-01-16,30.00,Gas
2025-01-17,125.50,Dining
```

## Project Structure

```
expense_tracker/
├── src/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # Main app component
│   ├── index.css             # Global styles
│   └── components/
│       ├── FileUpload.jsx    # CSV file upload component
│       ├── FileUpload.css
│       ├── Dashboard.jsx     # Analytics dashboard
│       └── Dashboard.css
├── public/                   # Static assets
├── index.html                # HTML template
├── package.json              # Dependencies
├── bun.lock                 # Bun lock file
├── vite.config.js            # Vite configuration
└── eslint.config.js          # ESLint rules
```

## Why Bun?

- ⚡ **Faster installs**: 2-10x faster than npm
- 🚀 **Better performance**: Optimized JavaScript runtime
- 🛠️ **Built-in tools**: TypeScript, bundler, test runner included
- 🔄 **npm compatible**: Works with existing package.json

## License

Private project
