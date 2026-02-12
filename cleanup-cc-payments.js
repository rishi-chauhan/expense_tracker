import { Database } from 'bun:sqlite';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'expenses.db');
const db = new Database(dbPath);

console.log('🧹 Cleaning up CC payment transactions...\n');

// First, show what will be deleted
const checkQuery = db.query(`
  SELECT id, date, amount, description
  FROM transactions
  WHERE is_credit = 1
  AND (
    UPPER(description) LIKE '%CC PAYMENT%'
    OR UPPER(description) LIKE '%BPPY%'
  )
`);

const toDelete = checkQuery.all();

if (toDelete.length === 0) {
  console.log('No CC payment transactions found.');
  db.close();
  process.exit(0);
}

console.log(`Found ${toDelete.length} CC payment transactions:\n`);
toDelete.forEach(tx => {
  console.log(`${tx.date} | ₹${tx.amount.toFixed(2)} | ${tx.description}`);
});

// Delete them
const deleteQuery = db.query(`
  DELETE FROM transactions
  WHERE is_credit = 1
  AND (
    UPPER(description) LIKE '%CC PAYMENT%'
    OR UPPER(description) LIKE '%BPPY%'
  )
`);

deleteQuery.run();

console.log(`\n✅ Deleted ${toDelete.length} CC payment transactions`);

db.close();
