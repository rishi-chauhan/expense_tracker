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

# shellcheck source=tty.sh
source "${SCRIPT_DIR}/tty.sh"

APP_ROOT="${APP_ROOT:-/opt/expense_tracker}"
APP_USER="${APP_USER:-}"
SERVICE_NAME="${SERVICE_NAME:-expense-tracker}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_NEXT_STEPS="${SKIP_NEXT_STEPS:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"

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

# Bun treats a TTY stdin (especially after `read -s`) as a data stream → Error: EOF.
run_bun() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] ${BUN_BIN} $* (in ${APP_ROOT})"
    return 0
  fi
  restore_tty
  (
    cd "${APP_ROOT}"
    export CI=true
    "${BUN_BIN}" "$@"
  ) </dev/null
}

need_root
attach_controlling_tty
resolve_app_user

echo "==> Paisa Kidhar Gaya?! install"
echo "    source:  ${SOURCE_ROOT}"
echo "    target:  ${APP_ROOT}"
echo "    user:    ${APP_USER}"
echo "    dry-run: ${DRY_RUN}"

# shellcheck source=ensure-bun.sh
source "${SCRIPT_DIR}/ensure-bun.sh"

# --- Bun (must be a real 0755 file, not a symlink into /root/.bun) ---
if ! promote_bun_to_system; then
  echo "install.sh: Bun not found. Install from https://bun.sh then re-run." >&2
  echo "  curl -fsSL https://bun.sh/install | bash" >&2
  echo "  sudo ./deploy/setup.sh" >&2
  exit 1
fi
BUN_BIN="${SYSTEM_BUN}"
echo "==> Found bun at ${BUN_BIN}"

# --- sqlite3 (for backups) ---
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "==> sqlite3 missing — install with: sudo apt install -y sqlite3"
  echo "    (continuing; required for deploy/backup.sh)"
fi

# --- user (login account; do not create a dedicated service user unless asked) ---
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  echo "User '${APP_USER}' does not exist."
  if confirm_tty "Create it as a system user? [y/N] "; then
    echo "==> Creating user ${APP_USER}"
    run useradd --system --home-dir "${APP_ROOT}" --shell /usr/sbin/nologin "${APP_USER}"
  else
    echo "install.sh: re-run as: sudo APP_USER=\$SUDO_USER $0" >&2
    exit 1
  fi
else
  echo "==> Using existing user ${APP_USER}"
fi

# --- directories ---
echo "==> Ensuring directories under ${APP_ROOT}"
run mkdir -p "${APP_ROOT}" "${APP_ROOT}/data" "${APP_ROOT}/backups"

if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
  echo "==> Stopping ${SERVICE_NAME} before sync/build"
  run systemctl stop "${SERVICE_NAME}.service" || true
fi

# --- sync tree (if installing from another path) ---
if [[ "$(cd "${SOURCE_ROOT}" && pwd)" != "$(cd "${APP_ROOT}" 2>/dev/null && pwd || true)" ]]; then
  echo "==> Syncing project files to ${APP_ROOT}"
  if command -v rsync >/dev/null 2>&1; then
    run rsync -a --delete \
      --exclude '.git/' \
      --exclude '.bun/' \
      --exclude 'node_modules/' \
      --exclude 'dist/' \
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

assert_bun_runnable_by_app_user "${BUN_BIN}"

# Run bun as root (this script is already sudo). sudo -u + closed stdin is
# what produced "Error: EOF" from Vite/Bun on the Pi.
echo "==> Installing dependencies"
run_bun install

if [[ "${SKIP_BUILD}" == "1" ]]; then
  echo "==> Skipping production build (SKIP_BUILD=1)"
elif [[ -d "${APP_ROOT}/dist" ]]; then
  echo "==> dist/ present — skipping build"
elif [[ "${DRY_RUN}" == "1" ]]; then
  echo "[dry-run] vite build in ${APP_ROOT}"
else
  echo "==> dist/ is missing."
  echo "    Vite on a Raspberry Pi often fails with 'Error: EOF' (RAM)."
  echo "    Safer: build on a laptop and copy dist/ into ${APP_ROOT}/dist/"
  if confirm_tty "Build on this device now? [y/N] "; then
    echo "==> Running production build (this can take a while)"
    run_bun ./node_modules/vite/bin/vite.js build \
      || echo "WARNING: build failed — copy a prebuilt dist/ from your laptop" >&2
  else
    echo "==> Skipping build — copy dist/ later, then: sudo systemctl restart ${SERVICE_NAME}"
  fi
fi

echo "==> Fixing ownership"
run chown -R "${APP_USER}:${APP_GROUP}" "${APP_ROOT}"

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
