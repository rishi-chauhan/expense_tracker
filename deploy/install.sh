#!/usr/bin/env bash
# Idempotent Pi setup helper for Paisa Kidhar Gaya?!
#
# App layer only: user, dirs, sync, .env, bun install/build, systemd.
# Prefer sudo ./deploy/setup.sh for full Pi setup (Caddy, firewall, cron).
# Called automatically by setup.sh with SKIP_NEXT_STEPS=1.
#
# Usage (from a clone or rsynced tree):
#   sudo ./deploy/install.sh
#   sudo APP_ROOT=/opt/expense_tracker ./deploy/install.sh
#   sudo DRY_RUN=1 ./deploy/install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_ROOT="${APP_ROOT:-/opt/expense_tracker}"
APP_USER="${APP_USER:-expenses}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
SERVICE_NAME="${SERVICE_NAME:-expense-tracker}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_NEXT_STEPS="${SKIP_NEXT_STEPS:-0}"

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

need_root() {
  if [[ "${EUID}" -ne 0 && "${DRY_RUN}" != "1" ]]; then
    echo "install.sh: run as root (sudo) or set DRY_RUN=1" >&2
    exit 1
  fi
}

echo "==> Paisa Kidhar Gaya?! install"
echo "    source:  ${SOURCE_ROOT}"
echo "    target:  ${APP_ROOT}"
echo "    user:    ${APP_USER}"
echo "    dry-run: ${DRY_RUN}"

need_root

# --- Bun ---
BUN_BIN=""
for candidate in /usr/local/bin/bun /usr/bin/bun "${HOME}/.bun/bin/bun"; do
  if [[ -x "${candidate}" ]]; then
    BUN_BIN="${candidate}"
    break
  fi
done

if [[ -z "${BUN_BIN}" ]]; then
  if command -v bun >/dev/null 2>&1; then
    BUN_BIN="$(command -v bun)"
  fi
fi

if [[ -z "${BUN_BIN}" ]]; then
  echo "install.sh: Bun not found. Install from https://bun.sh then re-run." >&2
  echo "  curl -fsSL https://bun.sh/install | bash" >&2
  echo "  sudo ln -sf \"\$HOME/.bun/bin/bun\" /usr/local/bin/bun" >&2
  exit 1
fi
echo "==> Found bun at ${BUN_BIN}"

# --- sqlite3 (for backups) ---
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "==> sqlite3 missing — install with: sudo apt install -y sqlite3"
  echo "    (continuing; required for deploy/backup.sh)"
fi

# --- user ---
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  echo "==> Creating user ${APP_USER}"
  run useradd --system --home-dir "${APP_ROOT}" --shell /usr/sbin/nologin "${APP_USER}"
else
  echo "==> User ${APP_USER} already exists"
fi

# --- directories ---
echo "==> Ensuring directories under ${APP_ROOT}"
run mkdir -p "${APP_ROOT}" "${APP_ROOT}/data" "${APP_ROOT}/backups"

# --- sync tree (if installing from another path) ---
if [[ "$(cd "${SOURCE_ROOT}" && pwd)" != "$(cd "${APP_ROOT}" 2>/dev/null && pwd || true)" ]]; then
  echo "==> Syncing project files to ${APP_ROOT}"
  if command -v rsync >/dev/null 2>&1; then
    run rsync -a --delete \
      --exclude '.git/' \
      --exclude 'node_modules/' \
      --exclude 'data/*.db' \
      --exclude 'data/*.db-*' \
      --exclude 'backups/' \
      --exclude '.env' \
      --exclude '.env.local' \
      "${SOURCE_ROOT}/" "${APP_ROOT}/"
  else
    echo "install.sh: rsync not found; copy manually or apt install rsync" >&2
    exit 1
  fi
else
  echo "==> SOURCE_ROOT is APP_ROOT — skipping rsync"
fi

# --- .env ---
if [[ ! -f "${APP_ROOT}/.env" ]]; then
  if [[ -f "${APP_ROOT}/.env.example" ]]; then
    echo "==> Creating .env from .env.example (edit before going live)"
    run cp "${APP_ROOT}/.env.example" "${APP_ROOT}/.env"
  fi
else
  echo "==> .env already present — leaving untouched"
fi

# --- ownership ---
echo "==> Fixing ownership"
run chown -R "${APP_USER}:${APP_GROUP}" "${APP_ROOT}"

# --- bun path for systemd ---
if [[ ! -e /usr/local/bin/bun ]]; then
  echo "==> Linking bun to /usr/local/bin/bun for systemd"
  run ln -sf "${BUN_BIN}" /usr/local/bin/bun
fi

# --- deps + production build (if dist missing) ---
# Use absolute bun path — expenses login shell may not include /usr/local/bin
echo "==> Installing dependencies as ${APP_USER}"
if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[dry-run] sudo -u ${APP_USER} env HOME=${APP_ROOT} ${BUN_BIN} install (in ${APP_ROOT})"
else
  sudo -u "${APP_USER}" -H env HOME="${APP_ROOT}" bash -c "cd '${APP_ROOT}' && '${BUN_BIN}' install"
fi

if [[ ! -d "${APP_ROOT}/dist" ]]; then
  echo "==> dist/ missing — running production build"
  echo "    Tip: on weak Pis, build on a laptop and rsync dist/ instead."
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] sudo -u ${APP_USER} env HOME=${APP_ROOT} ${BUN_BIN} run build"
  else
    sudo -u "${APP_USER}" -H env HOME="${APP_ROOT}" bash -c "cd '${APP_ROOT}' && '${BUN_BIN}' run build" \
      || echo "WARNING: build failed — rsync a prebuilt dist/ from your laptop" >&2
  fi
else
  echo "==> dist/ present — skipping build"
fi

# --- systemd unit (rewrite paths if APP_ROOT is not the default) ---
UNIT_SRC="${SOURCE_ROOT}/deploy/expense-tracker.service"
if [[ ! -f "${UNIT_SRC}" ]]; then
  UNIT_SRC="${APP_ROOT}/deploy/expense-tracker.service"
fi
UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"
if [[ -f "${UNIT_SRC}" ]]; then
  echo "==> Installing systemd unit -> ${UNIT_DST}"
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] render ${UNIT_SRC} -> ${UNIT_DST} (APP_ROOT=${APP_ROOT}, User=${APP_USER})"
  else
    # Escape & \ for sed replacement safety
    local_app_root_esc="${APP_ROOT//\\/\\\\}"
    local_app_root_esc="${local_app_root_esc//&/\\&}"
    sed \
      -e "s|/opt/expense_tracker|${local_app_root_esc}|g" \
      -e "s|^User=expenses$|User=${APP_USER}|" \
      -e "s|^Group=expenses$|Group=${APP_GROUP}|" \
      -e "s|/usr/local/bin/bun|${BUN_BIN}|g" \
      "${UNIT_SRC}" > "${UNIT_DST}"
  fi
  run systemctl daemon-reload
  run systemctl enable "${SERVICE_NAME}.service"
  echo "==> Starting ${SERVICE_NAME}"
  run systemctl restart "${SERVICE_NAME}.service" || true
else
  echo "install.sh: missing deploy/expense-tracker.service" >&2
  exit 1
fi

echo
echo "==> Done (app layer)."
if [[ "${SKIP_NEXT_STEPS}" != "1" ]]; then
  echo
  echo "Next steps (manual — or run sudo ./deploy/setup.sh for full setup):"
  echo "  1. Edit ${APP_ROOT}/.env  (HOST=127.0.0.1, DB_PATH on SSD if available)"
  echo "  2. curl -s http://127.0.0.1:3000/api/health"
  echo "  3. Install Caddy; copy deploy/Caddyfile; run: caddy hash-password"
  echo "  4. Firewall: allow LAN -> 80/443 only; do NOT expose :3000"
  echo "  5. Schedule backups: crontab -u ${APP_USER} -e"
  echo "       15 3 * * * ${APP_ROOT}/deploy/backup.sh >> ${APP_ROOT}/backups/backup.log 2>&1"
  echo "  6. If using Ollama, bind it to 127.0.0.1"
  echo
fi
