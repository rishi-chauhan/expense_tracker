import { Database } from 'bun:sqlite';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'expenses.db');
const db = new Database(dbPath);

console.log('\n📊 Credit Transactions by Month and Year:\n');

// Query credits grouped by month
const query = db.query(`
  SELECT
    strftime('%Y-%m', date) as month,
    COUNT(*) as credit_count,
    SUM(amount) as total_amount
  FROM transactions
  WHERE is_credit = 1
  GROUP BY strftime('%Y-%m', date)
  ORDER BY month
`);

const results = query.all();

if (results.length === 0) {
  console.log('No credit transactions found in database.');
} else {
  console.log('Month     | Count | Total Amount');
  console.log('----------|-------|-------------');
  results.forEach(row => {
    console.log(`${row.month} |  ${row.credit_count.toString().padStart(4)} | ₹${row.total_amount.toFixed(2).padStart(10)}`);
  });

  console.log('\n📈 Summary by Year:\n');

  const yearQuery = db.query(`
    SELECT
      strftime('%Y', date) as year,
      COUNT(*) as credit_count,
      SUM(amount) as total_amount
    FROM transactions
    WHERE is_credit = 1
    GROUP BY strftime('%Y', date)
    ORDER BY year
  `);

  const yearResults = yearQuery.all();
  console.log('Year | Count | Total Amount');
  console.log('-----|-------|-------------');
  yearResults.forEach(row => {
    console.log(`${row.year} |  ${row.credit_count.toString().padStart(4)} | ₹${row.total_amount.toFixed(2).padStart(10)}`);
  });
}

db.close();
