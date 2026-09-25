#!/usr/bin/env bash
# One-shot Pi / Debian setup for Paisa Kidhar Gaya?!
#
# Installs system packages, Bun (if needed), app (systemd), Caddy + basic auth,
# firewall rules, and backup cron — then verifies /api/health.
#
# Usage:
#   sudo ./deploy/setup.sh
#   sudo EXPENSES_ADMIN_PASSWORD='secret' ./deploy/setup.sh
#   sudo DRY_RUN=1 ./deploy/setup.sh
#
# Environment (optional):
#   APP_ROOT              default /opt/expense_tracker
#   EXPENSES_HOST         default expenses.home.lan
#   EXPENSES_ADMIN_USER   default admin
#   EXPENSES_ADMIN_PASSWORD  required if non-interactive (no TTY)
#   LAN_SUBNET            default 192.168.0.0/16
#   SETUP_FIREWALL=1      apply ufw rules (default 1)
#   SKIP_APT=1 SKIP_CADDY=1 SKIP_FIREWALL=1 SKIP_CRON=1  partial re-runs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP_ROOT="${APP_ROOT:-/opt/expense_tracker}"
APP_USER="${APP_USER:-expenses}"
EXPENSES_HOST="${EXPENSES_HOST:-expenses.home.lan}"
EXPENSES_ADMIN_USER="${EXPENSES_ADMIN_USER:-admin}"
LAN_SUBNET="${LAN_SUBNET:-192.168.0.0/16}"
SETUP_FIREWALL="${SETUP_FIREWALL:-1}"
SKIP_APT="${SKIP_APT:-0}"
SKIP_CADDY="${SKIP_CADDY:-0}"
SKIP_FIREWALL="${SKIP_FIREWALL:-0}"
SKIP_CRON="${SKIP_CRON:-0}"
DRY_RUN="${DRY_RUN:-0}"

CADDY_SITE_PATH="/etc/caddy/sites/expense-tracker"
CADDY_MAIN="/etc/caddy/Caddyfile"
CRON_MARKER="deploy/backup.sh"

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

need_root() {
  if [[ "${EUID}" -ne 0 && "${DRY_RUN}" != "1" ]]; then
    echo "setup.sh: run as root (sudo ./deploy/setup.sh)" >&2
    exit 1
  fi
}

detect_lan_subnet() {
  local ip="" second=""
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}' || true)"
  if [[ -z "${ip}" ]]; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  case "${ip}" in
    10.*)
      echo "10.0.0.0/8"
      ;;
    192.168.*)
      echo "192.168.0.0/16"
      ;;
    172.*)
      second="${ip#172.}"
      second="${second%%.*}"
      if [[ "${second}" =~ ^[0-9]+$ ]] && (( second >= 16 && second <= 31 )); then
        echo "172.16.0.0/12"
      else
        echo "${LAN_SUBNET}"
      fi
      ;;
    *)
      echo "${LAN_SUBNET}"
      ;;
  esac
}

prompt_password() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    EXPENSES_ADMIN_PASSWORD="${EXPENSES_ADMIN_PASSWORD:-dry-run}"
    return 0
  fi
  if [[ -n "${EXPENSES_ADMIN_PASSWORD:-}" ]]; then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    echo "setup.sh: set EXPENSES_ADMIN_PASSWORD for non-interactive install" >&2
    exit 1
  fi
  read -rsp "Password for Caddy basic auth (${EXPENSES_ADMIN_USER}): " EXPENSES_ADMIN_PASSWORD
  echo
  if [[ -z "${EXPENSES_ADMIN_PASSWORD}" ]]; then
    echo "setup.sh: password cannot be empty" >&2
    exit 1
  fi
}

# shellcheck source=ensure-bun.sh
source "${SCRIPT_DIR}/ensure-bun.sh"

install_bun() {
  export BUN_INSTALL="${BUN_INSTALL:-/root/.bun}"
  if _find_bun_binary >/dev/null; then
    echo "==> Bun found — promoting to a world-executable ${SYSTEM_BUN}"
  else
    echo "==> Installing Bun"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "[dry-run] curl -fsSL https://bun.sh/install | bash"
      echo "[dry-run] copy bun -> ${SYSTEM_BUN} (mode 0755, not a symlink into /root)"
      return 0
    fi
    curl -fsSL https://bun.sh/install | bash
  fi
  if ! promote_bun_to_system; then
    echo "setup.sh: Bun install failed" >&2
    exit 1
  fi
  if [[ "${DRY_RUN}" != "1" && ! -x "${SYSTEM_BUN}" ]]; then
    echo "setup.sh: ${SYSTEM_BUN} is not executable" >&2
    exit 1
  fi
}

install_apt_packages() {
  echo "==> Installing system packages (sqlite3, caddy, ufw, rsync, curl)"
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] apt-get update && apt-get install -y sqlite3 caddy ufw rsync curl ca-certificates"
    return 0
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y sqlite3 caddy ufw rsync curl ca-certificates
}

configure_caddy() {
  prompt_password

  local template="${SCRIPT_DIR}/Caddyfile.template"
  if [[ ! -f "${template}" ]]; then
    echo "setup.sh: missing ${template}" >&2
    exit 1
  fi

  local hash=""
  if [[ "${DRY_RUN}" == "1" ]]; then
    hash='$2a$14$DRY_RUN_PLACEHOLDER'
    echo "[dry-run] caddy hash-password"
  else
    # Prefer stdin so the plaintext password is not visible in `ps`
    hash="$(printf '%s' "${EXPENSES_ADMIN_PASSWORD}" | caddy hash-password)"
    unset EXPENSES_ADMIN_PASSWORD
  fi

  echo "==> Writing Caddy site ${CADDY_SITE_PATH}"
  run mkdir -p /etc/caddy/sites
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] render Caddyfile.template -> ${CADDY_SITE_PATH}"
  else
    # Use ENVIRON so bcrypt hashes (contain $, /) are not mangled by awk -v / shell
    EXPENSES_HOST="${EXPENSES_HOST}" \
    EXPENSES_ADMIN_USER="${EXPENSES_ADMIN_USER}" \
    EXPENSES_HASH="${hash}" \
    awk '
      {
        gsub(/\{\{HOST\}\}/, ENVIRON["EXPENSES_HOST"]);
        gsub(/\{\{USER\}\}/, ENVIRON["EXPENSES_ADMIN_USER"]);
        gsub(/\{\{HASH\}\}/, ENVIRON["EXPENSES_HASH"]);
        print
      }
    ' "${template}" > "${CADDY_SITE_PATH}"
    unset EXPENSES_HASH
  fi

  if [[ -f "${CADDY_MAIN}" ]]; then
    if ! grep -qF 'import sites/*' "${CADDY_MAIN}" 2>/dev/null; then
      echo "==> Adding import sites/* to ${CADDY_MAIN}"
      if [[ "${DRY_RUN}" == "1" ]]; then
        echo "[dry-run] append import sites/* to Caddyfile"
      else
        printf '\nimport sites/*\n' >> "${CADDY_MAIN}"
      fi
    fi
  else
    echo "==> Creating minimal ${CADDY_MAIN}"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "[dry-run] write minimal Caddyfile with import sites/*"
    else
      printf 'import sites/*\n' > "${CADDY_MAIN}"
    fi
  fi

  run systemctl enable caddy
  run systemctl reload caddy || run systemctl restart caddy
}

configure_firewall() {
  if [[ "${SKIP_FIREWALL}" == "1" || "${SETUP_FIREWALL}" != "1" ]]; then
    echo "==> Skipping firewall"
    return 0
  fi

  local subnet="${LAN_SUBNET}"
  if [[ "${LAN_SUBNET}" == "192.168.0.0/16" ]]; then
    subnet="$(detect_lan_subnet)"
  fi
  echo "==> Configuring ufw (LAN ${subnet} -> SSH, 80, 443 only)"

  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] ufw allow from ${subnet} to any port 22,80,443"
    return 0
  fi

  if ! ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw default deny incoming
    ufw default allow outgoing
  fi
  ufw allow from "${subnet}" to any port 22 proto tcp comment 'SSH from LAN' 2>/dev/null || \
    ufw allow from "${subnet}" to any port 22 proto tcp
  ufw allow from "${subnet}" to any port 80 proto tcp comment 'HTTP from LAN' 2>/dev/null || \
    ufw allow from "${subnet}" to any port 80 proto tcp
  ufw allow from "${subnet}" to any port 443 proto tcp comment 'HTTPS from LAN' 2>/dev/null || \
    ufw allow from "${subnet}" to any port 443 proto tcp
  ufw --force enable
  ufw status verbose || true
}

configure_cron() {
  if [[ "${SKIP_CRON}" == "1" ]]; then
    echo "==> Skipping backup cron"
    return 0
  fi

  local cron_line="15 3 * * * ${APP_ROOT}/deploy/backup.sh >> ${APP_ROOT}/backups/backup.log 2>&1"
  echo "==> Scheduling nightly backup cron for ${APP_USER}"

  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] crontab -u ${APP_USER} add backup line"
    return 0
  fi

  local existing
  existing="$(crontab -u "${APP_USER}" -l 2>/dev/null || true)"
  if echo "${existing}" | grep -qF "${CRON_MARKER}"; then
    echo "==> Backup cron already present"
    return 0
  fi
  # Avoid a blank first line when crontab was empty
  if [[ -n "${existing}" ]]; then
    printf '%s\n%s\n' "${existing}" "${cron_line}" | crontab -u "${APP_USER}" -
  else
    printf '%s\n' "${cron_line}" | crontab -u "${APP_USER}" -
  fi
}

verify_setup() {
  echo "==> Verifying app health"
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] curl http://127.0.0.1:3000/api/health"
    return 0
  fi
  sleep 2
  if curl -sf "http://127.0.0.1:3000/api/health" | grep -q '"status":"ok"'; then
    echo "==> Health check OK"
  else
    echo "WARNING: health check failed — check: systemctl status expense-tracker" >&2
  fi
}

print_summary() {
  echo
  echo "=========================================="
  echo "  Paisa Kidhar Gaya?! setup complete"
  echo "=========================================="
  echo
  echo "  App:     ${APP_ROOT}"
  echo "  Service: systemctl status expense-tracker"
  echo "  Health:  curl -s http://127.0.0.1:3000/api/health"
  echo
  if [[ "${SKIP_CADDY}" != "1" ]]; then
    echo "  URL:     https://${EXPENSES_HOST}"
    echo "  Auth:    ${EXPENSES_ADMIN_USER} (basic auth via Caddy)"
    echo "  DNS:     point ${EXPENSES_HOST} at this host (router or /etc/hosts)"
    echo "  TLS:     internal CA — trust Caddy local cert on client devices once"
  fi
  echo
  if [[ "${SKIP_CRON}" != "1" ]]; then
    echo "  Backups: ${APP_ROOT}/backups/ (nightly cron)"
  else
    echo "  Backups: ${APP_ROOT}/deploy/backup.sh (cron skipped)"
  fi
  echo "  Docs:    ${APP_ROOT}/deploy/README.md"
  echo
}

echo "=========================================="
echo "  Paisa Kidhar Gaya?! — full setup"
echo "=========================================="
echo "  APP_ROOT:      ${APP_ROOT}"
echo "  EXPENSES_HOST: ${EXPENSES_HOST}"
echo "  DRY_RUN:       ${DRY_RUN}"
echo

need_root

if [[ "${SKIP_APT}" != "1" ]]; then
  install_apt_packages
fi

install_bun

echo "==> Installing application (systemd, build, deps)"
export APP_ROOT APP_USER DRY_RUN SKIP_NEXT_STEPS=1
"${SCRIPT_DIR}/install.sh"

if [[ "${SKIP_CADDY}" != "1" ]]; then
  configure_caddy
fi

configure_firewall
configure_cron
verify_setup
print_summary
