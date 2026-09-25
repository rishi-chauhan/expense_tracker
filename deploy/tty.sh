# Sourced by setup.sh and install.sh.
# Prompts must use /dev/tty. Do not exec-replace stdin — that makes Bun inherit a
# half-configured terminal after `read -s` and exit with "Error: EOF".

restore_tty() {
  if [[ -r /dev/tty ]]; then
    stty sane < /dev/tty 2>/dev/null || true
    stty echo icanon < /dev/tty 2>/dev/null || true
  fi
}

attach_controlling_tty() {
  restore_tty
}

read_tty() {
  # read_tty [-s] PROMPT → echoes value on stdout
  local silent=0 prompt value
  if [[ "${1:-}" == "-s" ]]; then
    silent=1
    shift
  fi
  prompt="${1:-}"
  if [[ ! -r /dev/tty ]]; then
    echo "No controlling terminal (/dev/tty). Run from an SSH/login session." >&2
    return 1
  fi
  if [[ "${silent}" == "1" ]]; then
    read -r -s -p "${prompt}" value </dev/tty
    printf '\n' >/dev/tty
  else
    read -r -p "${prompt}" value </dev/tty
  fi
  restore_tty
  printf '%s' "${value}"
}

confirm_tty() {
  # confirm_tty "Question? [y/N] " → 0 if yes
  local reply
  reply="$(read_tty "${1:-Proceed? [y/N] }")" || return 1
  case "${reply}" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

resolve_app_user() {
  if [[ -z "${APP_USER:-}" ]]; then
    if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
      APP_USER="${SUDO_USER}"
    elif [[ "${DRY_RUN:-0}" == "1" ]]; then
      APP_USER="dry-run"
    else
      APP_USER="$(read_tty "Linux user to run the app as (your login name): ")"
    fi
  fi
  if [[ -z "${APP_USER}" || "${APP_USER}" == "root" ]]; then
    echo "APP_USER must be a normal login user, not root. Example: sudo APP_USER=\$SUDO_USER $0" >&2
    return 1
  fi
  APP_GROUP="${APP_GROUP:-${APP_USER}}"
}
