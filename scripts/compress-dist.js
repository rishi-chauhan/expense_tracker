#!/usr/bin/env bun
/**
 * Precompress dist/ (run after `vite build`, on the laptop — not the Pi).
 * Writes file.gz (gzip -9) and file.br (brotli q11) next to every text asset
 * ≥ 1 KB. The server picks the best variant per Accept-Encoding, so the Pi
 * never compresses static files at runtime.
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import zlib from 'node:zlib';

const DIST = path.resolve(process.argv[2] || 'dist');
const EXTENSIONS = new Set(['.js', '.css', '.html', '.svg', '.json', '.webmanifest', '.txt']);
const MIN_SIZE = 1024;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let count = 0;
let rawTotal = 0;
let brTotal = 0;

for (const file of walk(DIST)) {
  if (!EXTENSIONS.has(path.extname(file))) continue;
  const { size } = statSync(file);
  if (size < MIN_SIZE) continue;

  const buf = readFileSync(file);
  const gz = Bun.gzipSync(buf, { level: 9 });
  const br = zlib.brotliCompressSync(buf, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  });
  writeFileSync(`${file}.gz`, gz);
  writeFileSync(`${file}.br`, br);
  count++;
  rawTotal += size;
  brTotal += br.length;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`compress-dist: ${count} files, ${kb(rawTotal)} → ${kb(brTotal)} (brotli)`);
