/**
 * Worker that runs AI-chat SQL on a read-only SQLite connection, off the main
 * thread, so a slow query can be killed with worker.terminate().
 *
 * Messages in:  { id, dbPath, sql }   (sql is already validated + wrapped)
 * Messages out: { id, rows } | { id, error }
 */
import { Database } from 'bun:sqlite';
import { prepareReadOnlySql } from './sqlGuard.js';

let conn = null;
let connPath = null;

function getConnection(dbPath) {
  if (!conn || connPath !== dbPath) {
    if (conn) conn.close();
    conn = new Database(dbPath, { readonly: true });
    conn.run('PRAGMA query_only = ON');
    connPath = dbPath;
  }
  return conn;
}

self.onmessage = (event) => {
  const { id, dbPath, sql } = event.data || {};
  let db;
  try {
    db = getConnection(dbPath);
  } catch (error) {
    // Fail closed: never fall back to a writable connection.
    postMessage({ id, unavailable: true, error: error?.message || String(error) });
    return;
  }
  try {
    // Defence in depth: validate again inside the worker.
    const wrapped = prepareReadOnlySql(sql);
    const rows = db.query(wrapped).all();
    postMessage({ id, rows });
  } catch (error) {
    postMessage({ id, error: error?.message || String(error) });
  }
};
