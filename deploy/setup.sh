#!/usr/bin/env bash
# One-shot Pi / Debian setup for Paisa Kidhar Gaya?!
#
# Installs system packages, Bun (if needed), app (systemd), Caddy + basic auth,
# firewall rules, Tailscale (tailnet HTTPS + SSH), and backup cron — then
# verifies /api/health.
#
# Usage:
#   sudo ./deploy/setup.sh
#   sudo EXPENSES_ADMIN_PASSWORD='secret' ./deploy/setup.sh
#   sudo DRY_RUN=1 ./deploy/setup.sh
#
# Tailscale login (pick one; do not commit a key):
#   Interactive: the script prints a URL / QR. Approve the Pi in a browser.
#   Auth key:    sudo TAILSCALE_AUTH_KEY='tskey-auth-...' ./deploy/setup.sh
#
# Environment (optional):
#   APP_ROOT              default /opt/expense_tracker
#   EXPENSES_HOST         default expenses.home.lan
#   EXPENSES_ADMIN_USER   default admin
#   EXPENSES_ADMIN_PASSWORD  required if non-interactive (no TTY)
#   LAN_SUBNET            default 192.168.0.0/16
#   CADDY_BIND            addresses Caddy listens on (default: detected LAN IP + 127.0.0.1).
#                         Never all interfaces: tailscale serve needs <tailscale-ip>:443.
#   SETUP_FIREWALL=1      apply ufw rules (default 1)
#   TAILSCALE_HOSTNAME    default expenses
#   TAILSCALE_AUTH_KEY    optional; reusable, non-ephemeral. Or set TS_AUTHKEY.
#   TAILSCALE_SSH=1       enable Tailscale SSH (default 1)
#   APP_AUTH=0            1 = also turn on the optional in-app password (reuses the
#                         Caddy password; writes AUTH_PASSWORD_HASH to .env).
#                         Default 0 leaves .env auth settings untouched.
#   SKIP_APT=1 SKIP_INSTALL=1 SKIP_CADDY=1 SKIP_FIREWALL=1 SKIP_CRON=1 SKIP_TAILSCALE=1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=tty.sh
source "${SCRIPT_DIR}/tty.sh"

APP_ROOT="${APP_ROOT:-/opt/expense_tracker}"
APP_USER="${APP_USER:-}"
EXPENSES_HOST="${EXPENSES_HOST:-expenses.home.lan}"
EXPENSES_ADMIN_USER="${EXPENSES_ADMIN_USER:-admin}"
LAN_SUBNET="${LAN_SUBNET:-192.168.0.0/16}"
CADDY_BIND="${CADDY_BIND:-}"
SETUP_FIREWALL="${SETUP_FIREWALL:-1}"
SKIP_APT="${SKIP_APT:-0}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
SKIP_CADDY="${SKIP_CADDY:-0}"
SKIP_FIREWALL="${SKIP_FIREWALL:-0}"
SKIP_CRON="${SKIP_CRON:-0}"
SKIP_TAILSCALE="${SKIP_TAILSCALE:-0}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-expenses}"
TAILSCALE_SSH="${TAILSCALE_SSH:-1}"
DRY_RUN="${DRY_RUN:-0}"
APP_AUTH="${APP_AUTH:-0}"
TAILSCALE_URL=""
TAILSCALE_IP=""

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

# Primary LAN IPv4 address. Skips loopback and Tailscale's CGNAT range (100.64.0.0/10),
# which the default route can point at when an exit node is in use.
detect_lan_ip() {
  local ip=""
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}' || true)"
  if [[ -z "${ip}" || "${ip}" == 127.* || "${ip}" =~ ^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\. ]]; then
    ip="$(hostname -I 2>/dev/null | tr ' ' '\n' \
      | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' \
      | grep -vE '^(127\.|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.)' \
      | head -n1 || true)"
  fi
  echo "${ip}"
}

detect_lan_subnet() {
  local ip="" second=""
  ip="$(detect_lan_ip)"
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
  echo "Caddy basic-auth password for user '${EXPENSES_ADMIN_USER}' (typing is hidden)." >/dev/tty
  echo "Waiting for input — type a password and press Enter." >/dev/tty
  while true; do
    EXPENSES_ADMIN_PASSWORD="$(read_tty -s "Password: ")" || exit 1
    if [[ -n "${EXPENSES_ADMIN_PASSWORD}" ]]; then
      break
    fi
    echo "Password cannot be empty — try again." >/dev/tty
  done
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
    echo "    Running vendor installer: https://bun.sh/install"
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

# Set KEY=VALUE in ${APP_ROOT}/.env idempotently (replaces an existing line).
# VALUE is written verbatim — callers quote it as needed.
set_env_var() {
  local key="$1" value="$2" env_file="${APP_ROOT}/.env" tmp
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] set ${key}=… in ${env_file}"
    return 0
  fi
  touch "${env_file}"
  tmp="$(mktemp)"
  grep -v -E "^[[:space:]]*${key}=" "${env_file}" > "${tmp}" || true
  printf '%s=%s\n' "${key}" "${value}" >> "${tmp}"
  cat "${tmp}" > "${env_file}"
  rm -f "${tmp}"
  chmod 600 "${env_file}"
  if [[ -n "${APP_USER}" ]]; then
    chown "${APP_USER}:${APP_GROUP:-${APP_USER}}" "${env_file}" || true
  fi
}

# Optional in-app password (S1). Only with APP_AUTH=1; must run before
# configure_caddy unsets EXPENSES_ADMIN_PASSWORD.
configure_app_auth() {
  if [[ "${APP_AUTH}" != "1" ]]; then
    echo "==> In-app password: off (set APP_AUTH=1 to enable)"
    return 0
  fi
  prompt_password
  echo "==> Enabling in-app password (AUTH_PASSWORD_HASH in .env)"
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] hash password via scripts/hash-password.js"
    return 0
  fi
  local bun_bin="${SYSTEM_BUN:-/usr/local/bin/bun}" app_hash
  # Password goes through stdin, never argv.
  app_hash="$(printf '%s' "${EXPENSES_ADMIN_PASSWORD}" | "${bun_bin}" "${APP_ROOT}/scripts/hash-password.js")"
  if [[ "${app_hash}" != \$argon2id\$* ]]; then
    echo "setup.sh: could not generate the app password hash" >&2
    exit 1
  fi
  # Single quotes: the hash contains '$' and backup.sh sources .env with bash.
  set_env_var AUTH_PASSWORD_HASH "'${app_hash}'"
  unset app_hash
}

# Host allow-list (DNS-rebinding defence): localhost + LAN name + tailnet name.
configure_allowed_hosts() {
  local hosts="localhost,127.0.0.1" ts_host=""
  if [[ "${SKIP_CADDY}" != "1" ]]; then
    hosts="${hosts},${EXPENSES_HOST}"
  fi
  if [[ -n "${TAILSCALE_URL}" && "${TAILSCALE_URL}" != *"<tailnet>"* ]]; then
    ts_host="${TAILSCALE_URL#https://}"
    ts_host="${ts_host%%/*}"
    ts_host="${ts_host%%:*}"
    hosts="${hosts},${ts_host}"
  fi
  echo "==> ALLOWED_HOSTS=${hosts}"
  set_env_var ALLOWED_HOSTS "${hosts}"
  run systemctl restart expense-tracker.service || true
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
    hash="$(printf '%s\n' "${EXPENSES_ADMIN_PASSWORD}" | caddy hash-password)"
    unset EXPENSES_ADMIN_PASSWORD
  fi

  # Bind Caddy to the LAN address + loopback only. Listening on every interface
  # also grabs <tailscale-ip>:443, so `tailscale serve` cannot bind and the
  # tailnet URL fails the TLS handshake against Caddy instead.
  local bind="${CADDY_BIND}"
  if [[ -z "${bind}" ]]; then
    local lan_ip=""
    lan_ip="$(detect_lan_ip)"
    if [[ -z "${lan_ip}" ]]; then
      echo "setup.sh: could not detect the Pi's LAN IPv4 address." >&2
      echo "  Re-run with CADDY_BIND='<lan-ip> 127.0.0.1'." >&2
      exit 1
    fi
    bind="${lan_ip} 127.0.0.1"
  fi
  echo "==> Caddy will listen on: ${bind}"
  echo "    (reserve this LAN IP for the Pi in your router's DHCP settings)"

  echo "==> Writing Caddy site ${CADDY_SITE_PATH}"
  run mkdir -p /etc/caddy/sites
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] render Caddyfile.template -> ${CADDY_SITE_PATH}"
  else
    # Use ENVIRON so bcrypt hashes (contain $, /) are not mangled by awk -v / shell
    EXPENSES_HOST="${EXPENSES_HOST}" \
    EXPENSES_ADMIN_USER="${EXPENSES_ADMIN_USER}" \
    EXPENSES_HASH="${hash}" \
    CADDY_BIND_ADDRS="${bind}" \
    awk '
      {
        gsub(/\{\{HOST\}\}/, ENVIRON["EXPENSES_HOST"]);
        gsub(/\{\{BIND\}\}/, ENVIRON["CADDY_BIND_ADDRS"]);
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

  echo "==> Validating Caddy configuration"
  run caddy validate --config "${CADDY_MAIN}" --adapter caddyfile
  run systemctl enable caddy
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] systemctl reload caddy (or start when inactive)"
  elif systemctl is-active --quiet caddy; then
    # restart, not reload: a reload that changes listen addresses can keep the
    # old *:443 socket (and fails outright if the old config conflicts).
    systemctl restart caddy
  else
    systemctl start caddy
  fi
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
    if [[ "${SKIP_TAILSCALE}" != "1" ]]; then
      echo "[dry-run] ufw allow in on tailscale0; ufw allow 41641/udp"
    fi
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
  if [[ "${SKIP_TAILSCALE}" != "1" ]]; then
    # tailscale0 is the private tunnel only. UDP 41641 is WireGuard, not the app.
    # Neither rule publishes Bun or Caddy on the home WAN address.
    echo "==> Allowing Tailscale (interface tailscale0, UDP 41641)"
    ufw allow in on tailscale0 comment 'Tailscale tailnet' 2>/dev/null || \
      ufw allow in on tailscale0
    ufw allow 41641/udp comment 'Tailscale WireGuard' 2>/dev/null || \
      ufw allow 41641/udp
  fi
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

app_listen_port() {
  local env_file="${APP_ROOT}/.env" line
  if [[ -f "${env_file}" ]]; then
    line="$(grep -E '^[[:space:]]*PORT=' "${env_file}" | tail -n 1 || true)"
    line="${line#*=}"
    line="${line//\"/}"
    line="${line//\'/}"
    line="${line//$'\r'/}"
    line="${line// /}"
    if [[ "${line}" =~ ^[0-9]+$ ]]; then
      echo "${line}"
      return
    fi
  fi
  echo "3000"
}

install_tailscale() {
  if command -v tailscale >/dev/null 2>&1; then
    echo "==> Tailscale already installed"
  else
    echo "==> Installing Tailscale"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "[dry-run] curl -fsSL https://tailscale.com/install.sh | sh"
      return 0
    fi
    echo "    Running vendor installer: https://tailscale.com/install.sh"
    curl -fsSL https://tailscale.com/install.sh | sh
  fi
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] systemctl enable --now tailscaled"
    return 0
  fi
  systemctl enable tailscaled
  systemctl start tailscaled
}

tailscale_is_running() {
  tailscale status --json 2>/dev/null | grep -Eq '"BackendState":[[:space:]]*"Running"'
}

configure_tailscale() {
  if [[ "${SKIP_TAILSCALE}" == "1" ]]; then
    echo "==> Skipping Tailscale"
    return 0
  fi

  install_tailscale
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] tailscale up --hostname=${TAILSCALE_HOSTNAME} --ssh=${TAILSCALE_SSH} --operator=${APP_USER}"
    echo "[dry-run] tailscale serve --bg --yes $(app_listen_port)"
    TAILSCALE_URL="https://${TAILSCALE_HOSTNAME}.<tailnet>.ts.net"
    return 0
  fi

  local up_help serve_help port
  up_help="$(tailscale up --help 2>&1 || true)"
  local -a up_args=(up --hostname="${TAILSCALE_HOSTNAME}" --accept-dns=true)
  if [[ "${TAILSCALE_SSH}" == "1" && "${up_help}" == *"--ssh"* ]]; then
    up_args+=(--ssh)
  fi
  if [[ "${up_help}" == *"--operator"* && -n "${APP_USER}" ]]; then
    up_args+=(--operator="${APP_USER}")
  fi

  if [[ -n "${TAILSCALE_AUTH_KEY:-}" && -z "${TS_AUTHKEY:-}" ]]; then
    export TS_AUTHKEY="${TAILSCALE_AUTH_KEY}"
  fi

  if tailscale_is_running; then
    echo "==> Tailscale already logged in — applying hostname ${TAILSCALE_HOSTNAME}"
    # Already online: don't block setup if the daemon is slow to report.
    if [[ "${up_help}" == *"--timeout"* ]]; then
      up_args+=(--timeout=90s)
    fi
  else
    echo
    echo "==> Log this Pi into Tailscale"
    echo "    Approve the URL (or scan the QR) with the Tailscale account you use on your phone."
    echo "    This waits until you approve. No public IP and no router port-forward."
    if [[ -z "${TS_AUTHKEY:-}" && ! -r /dev/tty ]]; then
      echo "setup.sh: no TTY and no TAILSCALE_AUTH_KEY, so Tailscale cannot log in." >&2
      echo "Re-run from an SSH session, or:" >&2
      echo "  sudo TAILSCALE_AUTH_KEY='tskey-auth-...' ./deploy/setup.sh" >&2
      echo "Create a reusable, non-ephemeral key at https://login.tailscale.com/admin/settings/keys" >&2
      exit 1
    fi
    if [[ -z "${TS_AUTHKEY:-}" && "${up_help}" == *"--qr"* && -r /dev/tty ]]; then
      up_args+=(--qr)
    fi
  fi

  # TS_AUTHKEY is read by the CLI. Do not put the key on the command line.
  tailscale "${up_args[@]}"
  unset TS_AUTHKEY TAILSCALE_AUTH_KEY || true

  if ! tailscale_is_running; then
    echo "setup.sh: Tailscale did not reach Running. Approve the login URL, then re-run setup.sh." >&2
    exit 1
  fi

  port="$(app_listen_port)"
  echo "==> Publishing http://127.0.0.1:${port} on the tailnet (not the public internet)"
  serve_help="$(tailscale serve --help 2>&1 || true)"
  local -a serve_args=(serve --bg)
  if [[ "${serve_help}" == *"--yes"* ]]; then
    serve_args+=(--yes)
  fi
  if [[ "${serve_help}" == *"--https"* ]]; then
    serve_args+=(--https=443)
  fi
  # Port form proxies to 127.0.0.1 only. Never use `tailscale funnel` (that is public).
  serve_args+=("${port}")
  if ! tailscale "${serve_args[@]}"; then
    echo "setup.sh: tailscale serve failed." >&2
    echo "One-time: enable MagicDNS and HTTPS Certificates at" >&2
    echo "  https://login.tailscale.com/admin/dns" >&2
    echo "Then re-run: sudo SKIP_APT=1 SKIP_INSTALL=1 SKIP_CADDY=1 ./deploy/setup.sh" >&2
    exit 1
  fi

  local status_out
  status_out="$(tailscale serve status 2>&1 || true)"
  printf '%s\n' "${status_out}"
  TAILSCALE_URL="$(printf '%s\n' "${status_out}" | grep -oE 'https://[A-Za-z0-9.-]+\.ts\.net' | head -n 1 || true)"
  TAILSCALE_IP="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
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
  if [[ "${SKIP_TAILSCALE}" != "1" ]]; then
    echo
    echo "  From anywhere (phone/laptop with Tailscale, same account):"
    echo "  App URL: ${TAILSCALE_URL:-run: tailscale serve status}"
    if [[ -n "${TAILSCALE_IP}" ]]; then
      echo "  SSH:     ssh ${APP_USER}@${TAILSCALE_IP}"
      echo "           (or ssh ${APP_USER}@${TAILSCALE_HOSTNAME} once MagicDNS is on)"
    else
      echo "  SSH:     ssh ${APP_USER}@${TAILSCALE_HOSTNAME}"
    fi
    echo "  Open the App URL in the browser, not the 100.x IP (the certificate is for the name)."
    echo "  Home LAN URL above is unchanged and still asks for the Caddy password."
  fi
  if [[ "${APP_AUTH}" == "1" ]]; then
    echo "  App password: on (same password as Caddy). LAN users see two prompts."
  else
    echo "  App password: off — keep the tailnet single-user (see deploy/README.md)."
  fi
  echo "  Docs:    ${APP_ROOT}/deploy/README.md"
  echo
}

echo "=========================================="
echo "  Paisa Kidhar Gaya?! — full setup"
echo "=========================================="
echo "  APP_ROOT:      ${APP_ROOT}"
echo "  EXPENSES_HOST: ${EXPENSES_HOST}"
echo "  TAILSCALE:     ${TAILSCALE_HOSTNAME} (skip=${SKIP_TAILSCALE})"
echo "  DRY_RUN:       ${DRY_RUN}"
echo

need_root
attach_controlling_tty
resolve_app_user

echo "  APP_USER:      ${APP_USER}"

# Ask before apt/build so prompts are not buried in Vite output.
if [[ "${SKIP_CADDY}" != "1" || "${APP_AUTH}" == "1" ]]; then
  prompt_password
fi

if [[ "${SKIP_APT}" != "1" ]]; then
  install_apt_packages
fi

install_bun

if [[ "${SKIP_INSTALL}" != "1" ]]; then
  echo "==> Installing application (systemd, build, deps)"
  export APP_ROOT APP_USER APP_GROUP DRY_RUN SKIP_NEXT_STEPS=1 SKIP_BUILD
  "${SCRIPT_DIR}/install.sh"
else
  echo "==> Skipping app install (SKIP_INSTALL=1)"
fi

configure_app_auth

if [[ "${SKIP_CADDY}" != "1" ]]; then
  configure_caddy
fi
unset EXPENSES_ADMIN_PASSWORD || true

configure_firewall
configure_cron
verify_setup
configure_tailscale
configure_allowed_hosts
print_summary
