// Generate 12 months of synthetic statement CSVs for two fake cards (HDFC + ICICI).
// Usage: bun scripts/generate-demo-csvs.js [outDir=demo-data]  — then upload them in the app.
// Use this data (never real statements) for screenshots and demos.
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const out = process.argv[2] || 'demo-data';
mkdirSync(out, { recursive: true });

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const MERCHANTS = [
  ['SWIGGY BANGALORE', 150, 900, 10], ['ZOMATO GURGAON', 200, 1200, 8],
  ['AMAZON PAY INDIA', 300, 6000, 6], ['FLIPKART INTERNET', 400, 8000, 3],
  ['BIGBASKET BANGALORE', 800, 3500, 4], ['BLINKIT DELHI', 150, 1200, 6],
  ['UBER INDIA', 120, 700, 8], ['OLA CABS', 100, 600, 4],
  ['INDIAN OIL PETROL PUMP', 1500, 4000, 2], ['NETFLIX.COM', 649, 649, 1],
  ['SPOTIFY INDIA', 119, 119, 1], ['AIRTEL POSTPAID', 999, 999, 1],
  ['BESCOM ELECTRICITY', 1200, 3200, 1], ['PVR CINEMAS', 400, 1600, 1],
  ['STARBUCKS COFFEE', 300, 900, 3], ['DECATHLON SPORTS', 1000, 5000, 0.5],
  ['APOLLO PHARMACY', 200, 1800, 1], ['MAKEMYTRIP', 3000, 18000, 0.3],
  ['IRCTC RAIL', 500, 3500, 0.5], ['CULT FIT', 1500, 1500, 0.5],
];

const pad = (n) => String(n).padStart(2, '0');
const fmtAmt = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

const CARDS = [
  { bank: 'HDFC', card: '4111 11XX XXXX 4821', scale: 1 },
  { bank: 'ICICI', card: '5241 81XX XXXX 7302', scale: 0.6 },
];

const now = new Date();
for (const c of CARDS) {
  for (let m = 11; m >= 0; m--) {
    const start = new Date(now.getFullYear(), now.getMonth() - m - 1, 15);
    const end = new Date(now.getFullYear(), now.getMonth() - m, 14);
    const days = Math.round((end - start) / 864e5);
    const rows = [];
    let debits = 0;
    for (const [name, lo, hi, freq] of MERCHANTS) {
      let n = Math.floor(freq * c.scale + rand());
      while (n-- > 0) {
        const d = new Date(start.getTime() + Math.floor(rand() * days) * 864e5);
        d.setHours(9 + Math.floor(rand() * 12), Math.floor(rand() * 60));
        const amt = Math.round(lo + rand() * (hi - lo));
        debits += amt;
        rows.push([d, `${name} `, amt, '']);
      }
    }
    // occasional refund
    if (rand() < 0.5) {
      const amt = Math.round(200 + rand() * 1500);
      rows.push([new Date(start.getTime() + 5 * 864e5), 'REFUND AMAZON PAY INDIA', amt, 'Cr']);
    }
    // previous bill payment
    const pay = Math.round(debits * (0.8 + rand() * 0.3));
    rows.push([new Date(start.getTime() + 8 * 864e5), `CC PAYMENT ${Math.floor(rand() * 1e10)} (Ref# ${Math.floor(rand() * 1e12)})`, pay, 'Cr']);
    rows.sort((a, b) => a[0] - b[0]);

    const lines = [
      'Name~|~TEST USER',
      `Bank~|~${c.bank} BANK CREDIT CARD`,
      `Payment Due Date~|~${fmtDate(new Date(end.getTime() + 18 * 864e5))}`,
      `Statement Date~|~${fmtDate(end)}`,
      `Total Amount Due~|~${fmtAmt(debits)}`,
      '',
      `Card No: ${c.card}`,
      '',
      'Domestic / International Transactions',
      'Transaction type~|~Primary / Addon Customer Name~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS',
      ...rows.map(([d, desc, amt, dc]) =>
        `Domestic~|~TEST USER~|~${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00~|~${desc}~|~${fmtAmt(amt)}~|~${dc}~|~`),
    ];
    const file = path.join(out, `${c.bank}_${end.getFullYear()}-${pad(end.getMonth() + 1)}.csv`);
    writeFileSync(file, lines.join('\n') + '\n');
  }
}
console.log('generated in', out);
