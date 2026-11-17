#!/usr/bin/env bash
# Nightly SQLite backup for Paisa Kidhar Gaya?!
# Uses the online .backup command so WAL databases stay consistent.
#
# Usage:
#   ./deploy/backup.sh
#   DB_PATH=/path/to/expenses.db BACKUP_DIR=/path/to/backups RETENTION_DAYS=14 ./deploy/backup.sh
#
# Optional off-device copy (both opt-in, set in .env or the environment):
#   BACKUP_REMOTE=/mnt/usb/expenses-backups     # or user@nas:/volume1/backups (rsync target)
#   BACKUP_AGE_RECIPIENT=age1...                # encrypt the remote copy with `age`
# With BACKUP_AGE_RECIPIENT set (and `age` installed) only the encrypted
# expenses-*.db.age file is sent; the local plaintext backup is kept as usual.
#
# Cron example (as the app login user):
#   15 3 * * * /opt/expense_tracker/deploy/backup.sh >> /opt/expense_tracker/backups/backup.log 2>&1

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env if present (does not override already-exported vars)
if [[ -f "${APP_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${APP_ROOT}/.env"
  set +a
fi

DB_PATH="${DB_PATH:-${APP_ROOT}/data/expenses.db}"
# Resolve relative DB_PATH against app root
if [[ "${DB_PATH}" != /* ]]; then
  DB_PATH="${APP_ROOT}/${DB_PATH}"
fi

BACKUP_DIR="${BACKUP_DIR:-${APP_ROOT}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_DIR}/expenses-${STAMP}.db"

mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${DB_PATH}" ]]; then
  echo "backup.sh: database not found: ${DB_PATH}" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "backup.sh: sqlite3 is required (apt install sqlite3)" >&2
  exit 1
fi

echo "backup.sh: backing up ${DB_PATH} -> ${DEST}"
sqlite3 "${DB_PATH}" ".backup '${DEST}'"

if [[ ! -s "${DEST}" ]]; then
  echo "backup.sh: backup file missing or empty: ${DEST}" >&2
  exit 1
fi

INTEGRITY="$(sqlite3 "${DEST}" 'PRAGMA integrity_check;' 2>&1 || true)"
if [[ "${INTEGRITY}" != "ok" ]]; then
  echo "backup.sh: integrity check FAILED for ${DEST}:" >&2
  printf '%s\n' "${INTEGRITY}" >&2
  mv "${DEST}" "${DEST}.corrupt" || true
  exit 1
fi
chmod 600 "${DEST}"

# Optional off-device copy
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  if ! command -v rsync >/dev/null 2>&1; then
    echo "backup.sh: BACKUP_REMOTE set but rsync is not installed" >&2
    exit 1
  fi
  SEND="${DEST}"
  CLEANUP=""
  if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
    if ! command -v age >/dev/null 2>&1; then
      echo "backup.sh: BACKUP_AGE_RECIPIENT set but age is not installed (apt install age)" >&2
      exit 1
    fi
    SEND="${DEST}.age"
    age -r "${BACKUP_AGE_RECIPIENT}" -o "${SEND}" "${DEST}"
    CLEANUP="${SEND}"
  fi
  echo "backup.sh: copying $(basename "${SEND}") -> ${BACKUP_REMOTE}"
  rsync -a --chmod=F600 "${SEND}" "${BACKUP_REMOTE%/}/"
  if [[ -n "${CLEANUP}" ]]; then
    rm -f "${CLEANUP}"
  fi
fi

# Drop backups older than retention window
find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'expenses-*.db' -mtime "+${RETENTION_DAYS}" -print -delete \
  || true

echo "backup.sh: ok ($(du -h "${DEST}" | awk '{print $1}'), keep ${RETENTION_DAYS}d)"
