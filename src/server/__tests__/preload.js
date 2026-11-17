// Loaded by bun test (see bunfig.toml). Points every server test at a
// throwaway database so tests never touch data/expenses.db.
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

if (!process.env.DB_PATH) {
  const dir = mkdtempSync(path.join(tmpdir(), 'paisa-test-'));
  process.env.DB_PATH = path.join(dir, 'test.db');
}
