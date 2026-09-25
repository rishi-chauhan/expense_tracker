# Sourced by setup.sh and install.sh.
# Copies Bun to /usr/local/bin/bun as a real 0755 file so the app user can
# run it. Official installer + a symlink into /root/.bun is executable as
# root only (home directory mode 0700) — that is "Permission denied" for expenses.

SYSTEM_BUN="${SYSTEM_BUN:-/usr/local/bin/bun}"

_find_bun_binary() {
  local candidate real
  for candidate in "${SYSTEM_BUN}" /usr/bin/bun \
    "${BUN_INSTALL:-/root/.bun}/bin/bun" \
    "${HOME}/.bun/bin/bun" \
    "${APP_ROOT:-}/.bun/bin/bun"; do
    [[ -n "${candidate}" && -e "${candidate}" ]] || continue
    real="$(readlink -f "${candidate}" 2>/dev/null || true)"
    if [[ -n "${real}" && -f "${real}" ]]; then
      echo "${real}"
      return 0
    fi
  done
  if command -v bun >/dev/null 2>&1; then
    real="$(readlink -f "$(command -v bun)" 2>/dev/null || true)"
    if [[ -n "${real}" && -f "${real}" ]]; then
      echo "${real}"
      return 0
    fi
  fi
  return 1
}

_bun_is_public_file() {
  local path="$1"
  [[ -f "${path}" && ! -L "${path}" && -x "${path}" ]] || return 1
  local mode
  mode="$(stat -c '%a' "${path}" 2>/dev/null || stat -f '%OLp' "${path}")"
  case "${mode: -1}" in
    1|3|5|7) return 0 ;;
    *) return 1 ;;
  esac
}

promote_bun_to_system() {
  local src dest_dir
  dest_dir="$(dirname "${SYSTEM_BUN}")"

  src="$(_find_bun_binary || true)"
  if [[ -z "${src}" ]]; then
    return 1
  fi

  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[dry-run] install -m 0755 ${src} ${SYSTEM_BUN}"
    return 0
  fi

  mkdir -p "${dest_dir}"
  chmod a+rx "${dest_dir}" 2>/dev/null || true

  if _bun_is_public_file "${SYSTEM_BUN}" && [[ "$(readlink -f "${SYSTEM_BUN}")" == "${src}" ]]; then
    chmod a+rx "${SYSTEM_BUN}" || true
    return 0
  fi

  echo "==> Installing world-executable bun at ${SYSTEM_BUN}"
  echo "    source: ${src}"
  local tmp
  tmp="$(mktemp)"
  cp -a "${src}" "${tmp}"
  install -m 0755 "${tmp}" "${SYSTEM_BUN}"
  rm -f "${tmp}"

  if [[ -e "$(dirname "${src}")/bunx" && ! -e "${dest_dir}/bunx" ]]; then
    ln -sf bun "${dest_dir}/bunx"
  fi
}

assert_bun_runnable_by_app_user() {
  local bun_bin="${1:-${SYSTEM_BUN}}"
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    return 0
  fi
  if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    return 0
  fi
  # Do not execute bun here: cwd is often the git clone (has .env) and stdin may
  # be a TTY after password input — that combination is "Error: EOF".
  if sudo -u "${APP_USER}" -- test -x "${bun_bin}"; then
    return 0
  fi
  echo "ensure-bun: ${APP_USER} cannot execute ${bun_bin}" >&2
  echo "  ls -l: $(ls -l "${bun_bin}" 2>/dev/null || true)" >&2
  echo "  resolves to: $(readlink -f "${bun_bin}" 2>/dev/null || true)" >&2
  return 1
}
