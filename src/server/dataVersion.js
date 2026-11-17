/**
 * Process-wide counters used for ETags and memoisation.
 * dataVersion is bumped after every successful mutating /api request.
 */
export const startedAt = Date.now();

let dataVersion = 0;

export function bumpDataVersion() {
  dataVersion += 1;
  return dataVersion;
}

export function getDataVersion() {
  return dataVersion;
}
