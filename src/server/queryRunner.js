/**
 * Main-thread side of the AI query engine. Keeps one persistent worker; on
 * timeout the worker is terminated (killing the running SQLite statement) and
 * a fresh one is spawned on the next call.
 */
import { DB_PATH } from './config.js';
import { prepareReadOnlySql } from './sqlGuard.js';

export class QueryTimeoutError extends Error {
  constructor() {
    super('Query took too long');
    this.name = 'QueryTimeoutError';
  }
}

export class QueryEngineUnavailableError extends Error {
  constructor(message = 'AI query engine unavailable') {
    super(message);
    this.name = 'QueryEngineUnavailableError';
  }
}

let worker = null;
let nextId = 1;
const pending = new Map();

function failAll(error) {
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(error);
  }
  pending.clear();
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./queryWorker.js', import.meta.url).href);
  worker.onmessage = (event) => {
    const { id, rows, error, unavailable } = event.data || {};
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    if (unavailable) entry.reject(new QueryEngineUnavailableError());
    else if (error) entry.reject(new Error(error));
    else entry.resolve(rows);
  };
  worker.onerror = (event) => {
    console.error('Query worker error:', event?.message || event);
    worker = null;
    failAll(new QueryEngineUnavailableError());
  };
  // Don't keep the process alive just for an idle worker.
  worker.unref?.();
  return worker;
}

function killWorker() {
  if (!worker) return;
  try { worker.terminate(); } catch { /* ignore */ }
  worker = null;
}

/**
 * Validate and run a read-only query in the worker.
 * Rejects with: Error (validation / SQL error), QueryTimeoutError,
 * QueryEngineUnavailableError.
 */
export function runReadOnlyQuery(sql, { timeoutMs = 3000, dbPath = DB_PATH } = {}) {
  try {
    prepareReadOnlySql(sql); // fail fast on the main thread
  } catch (error) {
    return Promise.reject(error);
  }

  let w;
  try {
    w = getWorker();
  } catch (error) {
    console.error('Could not start query worker:', error);
    return Promise.reject(new QueryEngineUnavailableError());
  }

  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      killWorker();
      // Anything else queued on the dead worker fails too.
      failAll(new QueryTimeoutError());
      reject(new QueryTimeoutError());
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    // The worker re-validates and wraps; send the original SQL.
    w.postMessage({ id, dbPath, sql });
  });
}

export function shutdownQueryWorker() {
  killWorker();
  failAll(new QueryEngineUnavailableError());
}
