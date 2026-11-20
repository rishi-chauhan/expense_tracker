# Raspberry Pi deployment

Run **Paisa Kidhar Gaya?!** as an always-on service. At home, Caddy serves the LAN. From anywhere, Tailscale reaches the same Bun process. Nothing is published to the public internet.

```
Home LAN  ──► Caddy (:443, basic auth) ──► Bun (127.0.0.1:3000) ──► SQLite
Your phone/laptop (Tailscale) ──► tailscale serve (HTTPS) ──┘         ▲
                                                                    backup.sh
```

## Quick start (one command)

On the Pi, from a clone or rsynced copy of the repo:

```bash
sudo ./deploy/setup.sh
```

Non-interactive (set password in env):

```bash
sudo EXPENSES_ADMIN_PASSWORD='your-secret' ./deploy/setup.sh
```

Preview without making changes:

```bash
sudo DRY_RUN=1 ./deploy/setup.sh
```

### What `setup.sh` installs

| Step | Component |
|------|-----------|
| 1 | apt packages: `sqlite3`, `caddy`, `ufw`, `rsync`, `curl` |
| 2 | Bun (if not already installed) |
| 3 | Existing login user (for example `admin`), files under `/opt/expense_tracker` |
| 4 | `bun install`, production build if `dist/` missing |
| 5 | Hardened systemd unit `expense-tracker` (starts on boot) |
| 6 | Caddy site with **basic auth** + internal TLS, bound to the LAN IP + `127.0.0.1` only |
| 7 | ufw: LAN → SSH, 80, 443 only (port **3000** stays closed). Tailscale interface + UDP 41641 |
| 8 | Nightly backup cron for the selected login user |
| 9 | Health check on `http://127.0.0.1:3000/api/health` |
| 10 | Tailscale: log in, then `tailscale serve` so the app is HTTPS on your tailnet |

When run with `sudo`, setup uses `SUDO_USER` as `APP_USER`. An OS login named `admin` is therefore supported automatically. The service does not run as `root`, and systemd prevents privilege escalation and hides home directories. `EXPENSES_ADMIN_USER` is only the browser basic-auth username and can be different from the Linux account.

### After setup

1. Reserve the Pi's LAN IP in your router's DHCP settings (Caddy binds to it), and point **`expenses.home.lan`** at it (router DNS or client `/etc/hosts`)
2. Open **https://expenses.home.lan**
3. Log in with username **`admin`** (or your `EXPENSES_ADMIN_USER`) and the password you set
4. Trust Caddy’s local certificate once per device (browser security prompt)

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_USER` | invoking sudo user | Existing Linux account that runs the service; must not be `root` |
| `APP_GROUP` | primary group of `APP_USER` | Linux group for the installed files |
| `EXPENSES_HOST` | `expenses.home.lan` | Hostname in Caddy |
| `EXPENSES_ADMIN_USER` | `admin` | Browser basic-auth username; independent of `APP_USER` |
| `EXPENSES_ADMIN_PASSWORD` | (interactive prompt) | Required if no TTY |
| `APP_ROOT` | `/opt/expense_tracker` | Install path |
| `LAN_SUBNET` | auto-detect | ufw source subnet |
| `CADDY_BIND` | detected LAN IP + `127.0.0.1` | Addresses Caddy listens on. Never all interfaces: `tailscale serve` needs `<tailscale-ip>:443` |
| `SETUP_FIREWALL` | `1` | Apply ufw rules |
| `SKIP_APT` | `0` | Skip apt install |
| `SKIP_CADDY` | `0` | Skip Caddy config |
| `SKIP_FIREWALL` | `0` | Skip ufw |
| `SKIP_CRON` | `0` | Skip backup cron |
| `SKIP_TAILSCALE` | `0` | Skip Tailscale install, login, and serve |
| `TAILSCALE_HOSTNAME` | default: keep the current name if already logged in, otherwise `pi` | Machine name on the tailnet. Set it only to rename the node (applied with `tailscale set --hostname`). The app URL is read from the node's real MagicDNS name |
| `TAILSCALE_AUTH_KEY` | (unset) | Optional login key. Prefer the interactive URL. Do not commit this |
| `TAILSCALE_SSH` | `1` | Allow SSH from your other Tailscale devices |
| `APP_AUTH` | `0` | `1` = also turn on the optional in-app password (same password as Caddy; writes `AUTH_PASSWORD_HASH` to `.env`). `0` leaves `.env` auth settings untouched |
| `DRY_RUN` | `0` | Print actions only |

`setup.sh` also merges `localhost,127.0.0.1,<EXPENSES_HOST>,<tailnet name>` into `ALLOWED_HOSTS` in `.env` after Tailscale is set up (existing entries are kept, nothing is duplicated), so requests for any other hostname are refused (DNS-rebinding protection).

The Tailscale node may host other apps on other ports (other `tailscale serve --https=<port>` rules). `setup.sh` only adds or replaces the HTTPS 443 serve rule and never runs `tailscale serve reset`.

---

## Reach it from anywhere (Tailscale)

`setup.sh` does this by default. You do not open a port on the router, and you do not need a public IP address. The app stays on `127.0.0.1:3000`. Tailscale gives your own phone and laptop an HTTPS name that only devices on your Tailscale account can open.

### What you do once

1. Create a free account at https://login.tailscale.com/start (Google, GitHub, Microsoft, or email). Use this same account on every device.
2. On the Pi, from a current copy of this repo, run `sudo ./deploy/setup.sh` in an SSH session.
3. When the script prints a login URL or QR code, open it and approve the Pi. If it also sends you to the DNS admin page, turn on **MagicDNS** and **HTTPS Certificates**, then re-run the command in the error text.
4. Install the Tailscale app on your phone and laptop and sign in with that same account.
5. Open the `https://….ts.net` URL printed at the end of setup. That is the app. It works on mobile data, away from home.
6. SSH to the Pi from those devices with the `ssh user@100.x.x.x` line printed at the end (the `100.x` address is a Tailscale address, not a public IP). Use that address for SSH. For the website, use the `https://….ts.net` name — the certificate does not match the raw IP.

The home URL `https://expenses.home.lan` still works on your Wi-Fi and still asks for the Caddy password. The tailnet URL does not use that password. The lock is your Tailscale login (plus the optional in-app password below). Do not turn on Tailscale Funnel. That would publish the app to the whole internet.

---

## Security checklist

The app protects itself against cross-site requests (CSRF), sends a strict Content-Security-Policy, loads nothing from third parties, binds to `127.0.0.1`, and refuses unknown `Host` headers. On the tailnet path, though, **your Tailscale login is the only lock** unless you turn on the in-app password. Keep it that way deliberately:

- **Keep the tailnet single-user.** Before you share the Pi node or invite anyone to your tailnet, either turn on the in-app password (below) or add a Tailscale ACL that only lets your own devices reach TCP 443 on the Pi — see [`accessible-anywhere.md` § A6. ACL (single user)](../accessible-anywhere.md#a6-acl-single-user).
- **Device hygiene:** keep Tailscale key expiry on for phones and laptops (the default), remove a lost device from the admin console immediately, and keep screen locks on.
- **Never deploy code you haven't read** — especially from a fork or a pull request.
- Use **privacy mode** (eye icon or `Shift+H`) when someone can see your screen.

### Optional in-app password

Off by default. When `AUTH_PASSWORD_HASH` is set, every API call needs a login session (argon2id password, DB-backed sessions, `HttpOnly; SameSite=Strict; Secure` cookie, login rate limiting). Static files stay public; they contain no data.

```bash
# on the Pi, in the app folder
printf '%s' 'your password' | bun scripts/hash-password.js
# paste the result into /opt/expense_tracker/.env — SINGLE-QUOTED, the hash contains $
AUTH_PASSWORD_HASH='$argon2id$v=19$m=65536,t=2,p=1$...'
SESSION_TTL_DAYS=30
sudo systemctl restart expense-tracker
```

Or let setup do it: `sudo APP_AUTH=1 ./deploy/setup.sh` reuses the Caddy password. On the home LAN you'll then see two prompts (Caddy basic auth, then the app). If you prefer only the app login, delete the `basicauth { … }` block from `/etc/caddy/sites/expense-tracker` and `sudo systemctl restart caddy`. Keep backup copies outside `/etc/caddy/sites/`: `import sites/*` loads every file there.

To turn it off again, empty `AUTH_PASSWORD_HASH=` and restart.

Already installed the app and only want to add Tailscale (skips the Caddy password prompt and the rebuild):

```bash
sudo SKIP_APT=1 SKIP_INSTALL=1 SKIP_CADDY=1 ./deploy/setup.sh
```

No browser on the Pi session (auth key, optional): create a **reusable, non-ephemeral** key at https://login.tailscale.com/admin/settings/keys and run the script on the Pi only. Do not commit the key and do not paste it into git.

```bash
sudo TAILSCALE_AUTH_KEY='tskey-auth-...' SKIP_CADDY=1 SKIP_INSTALL=1 ./deploy/setup.sh
```

After a reboot, `tailscaled` restores Serve on its own. Check with `tailscale serve status`.

---

## Pre-build on a laptop (optional)

Vite builds can OOM on small Pis. On a laptop:

```bash
bun install
bun run build
```

Sync to the Pi (includes `dist/`):

```bash
rsync -avz --delete \
  --exclude node_modules --exclude .git --exclude data --exclude backups --exclude .env \
  ./ admin@raspberrypi:~/expense_tracker/
```

Then on the Pi:

```bash
cd ~/expense_tracker
sudo ./deploy/setup.sh
```

---

## Manual / partial install

Use **`install.sh`** only if you want the app layer without Caddy, firewall, or cron:

```bash
sudo ./deploy/install.sh
```

You must then configure Caddy, firewall, and backups yourself (sections below).

---

## Configure environment

Edit `/opt/expense_tracker/.env` (created from `.env.example` on first install):

```bash
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
# Prefer an SSD path when available:
# DB_PATH=/mnt/ssd/expense_tracker/expenses.db
MAX_UPLOAD_SIZE=5242880
ALLOWED_HOSTS=localhost,127.0.0.1,expenses.home.lan,pi.<tailnet>.ts.net
AUTH_PASSWORD_HASH=          # optional, see Security checklist
SESSION_TTL_DAYS=30
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_SUMMARIZE=0           # recommended on a Pi 4
OLLAMA_NUM_THREAD=4
# BACKUP_REMOTE=/mnt/usb/expenses-backups
# BACKUP_AGE_RECIPIENT=age1...
```

| Variable | Default | What it does |
|----------|---------|--------------|
| `ALLOWED_HOSTS` | empty in production (no check) | Comma list of hostnames the app answers to; anything else gets 421 |
| `AUTH_PASSWORD_HASH` | empty (login off) | argon2id hash from `scripts/hash-password.js`, single-quoted |
| `SESSION_TTL_DAYS` | `30` | Login session lifetime |
| `OLLAMA_SUMMARIZE` | `1` | `0` skips the second LLM call and shows the result table instead (about half the latency on a Pi) |
| `OLLAMA_NUM_THREAD` | Ollama default | CPU threads for inference |
| `BACKUP_REMOTE` / `BACKUP_AGE_RECIPIENT` | unset | Off-device backup copy (see Backups) |

Restart after edits:

```bash
sudo systemctl restart expense-tracker
curl -s http://127.0.0.1:3000/api/health
```

---

## Caddy (manual)

`setup.sh` writes `/etc/caddy/sites/expense-tracker` from `Caddyfile.template`. For manual setup, see reference [`Caddyfile`](Caddyfile) and run:

```bash
caddy hash-password
sudo systemctl restart caddy
```

The site has `bind <lan-ip> 127.0.0.1`. Without it Caddy listens on every interface, including the Tailscale IP, and `tailscale serve` cannot take `<tailscale-ip>:443` (its log repeats `bind: address already in use`). Use `restart`, not `reload`, after changing `bind`.

---

## Firewall

`setup.sh` configures ufw automatically. Manual example (adjust subnet):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp
sudo ufw allow from 192.168.0.0/16 to any port 80 proto tcp
sudo ufw allow from 192.168.0.0/16 to any port 443 proto tcp
sudo ufw enable
```

Confirm Bun is **not** exposed on the LAN:

```bash
ss -tlnp | grep 3000
# expect 127.0.0.1:3000
```

---

## Ollama (optional)

Bind Ollama to localhost so it is not reachable from the LAN:

```bash
# systemd drop-in for ollama.service, for example:
Environment=OLLAMA_HOST=127.0.0.1:11434
```

Then:

```bash
ollama pull qwen2.5:1.5b
```

The app defaults `OLLAMA_URL` to `http://127.0.0.1:11434`.

On a Pi 4: keep the 1.5B model, set `OLLAMA_SUMMARIZE=0` and `OLLAMA_NUM_THREAD=4` in `.env`. The model stays loaded for 10 minutes between questions, only one question runs at a time, and the generated SQL runs read-only in a worker that is killed after 3 seconds, so a bad query can't freeze the app.

---

## Backups

[`backup.sh`](backup.sh) uses SQLite’s online `.backup` (WAL-safe), keeps 14 days by default. The examples use an OS login named `admin`; substitute your `APP_USER` if different.

```bash
# one-shot
sudo -u admin /opt/expense_tracker/deploy/backup.sh
```

`setup.sh` adds a daily cron at 03:15. Manual cron line:

```cron
15 3 * * * /opt/expense_tracker/deploy/backup.sh >> /opt/expense_tracker/backups/backup.log 2>&1
```

Each backup is checked with `PRAGMA integrity_check`; a corrupt copy is renamed to `*.corrupt` and the script fails (so cron mails / logs it).

### Off-device copy (recommended)

Backups on the same SD card die with the SD card. Both options are opt-in, set in `.env`:

```bash
BACKUP_REMOTE=/mnt/usb/expenses-backups        # a mounted USB drive, or user@nas:/volume1/backups (rsync)
BACKUP_AGE_RECIPIENT=age1qyqszqgpqyqszqgpqyqszqgp...   # optional: encrypt the remote copy (sudo apt install age)
```

With `BACKUP_AGE_RECIPIENT` set, only the encrypted `expenses-*.db.age` file leaves the Pi. Decrypt with `age -d -i key.txt expenses-….db.age > expenses.db`. Keep the age private key somewhere other than the Pi.

### Restore

```bash
sudo systemctl stop expense-tracker
cp /opt/expense_tracker/backups/expenses-YYYYMMDDThhmmssZ.db /opt/expense_tracker/data/expenses.db
sudo chown admin:admin /opt/expense_tracker/data/expenses.db
sudo chmod 600 /opt/expense_tracker/data/expenses.db
sudo systemctl start expense-tracker
curl -s http://127.0.0.1:3000/api/health
```

---

## systemd

```bash
sudo systemctl status expense-tracker
sudo journalctl -u expense-tracker -f
sudo systemctl restart expense-tracker
```

Unit file: [`expense-tracker.service`](expense-tracker.service). It runs a single Bun process — `bun --smol src/server/index.js` with `NODE_ENV=production` — instead of `bun run start` (which started a second Bun). `MemoryHigh=200M` / `MemoryMax=300M` keep it from starving the Pi.

---

## Upgrading an existing Pi

1. On the laptop: `bun install && bun run build` (the build also writes precompressed `.br`/`.gz` files; never build on the Pi).
2. Sync to the Pi (same `rsync` as in *Pre-build on a laptop*).
3. On the Pi: `sudo ./deploy/install.sh` — re-renders the systemd unit with the new single-process `ExecStart`.
4. Add `ALLOWED_HOSTS=localhost,127.0.0.1,expenses.home.lan,<your>.ts.net` to `/opt/expense_tracker/.env` (`tailscale serve status` shows the name).
5. `sudo systemctl restart expense-tracker` and check `curl -s http://127.0.0.1:3000/api/health`.

Optional, only to turn on the app password: `printf '%s' 'pw' | bun scripts/hash-password.js` → add `AUTH_PASSWORD_HASH='…'` (single-quoted) to `.env` → restart → log in once on each device.

---

## Troubleshooting

| Problem | Check |
|---------|--------|
| Health fails | `sudo journalctl -u expense-tracker -n 50` |
| Caddy 502 | App running? `curl http://127.0.0.1:3000/api/health` |
| Build OOM | Pre-build on laptop, rsync `dist/` |
| Can’t reach from phone on Wi-Fi | DNS/hosts for `EXPENSES_HOST`; ufw allows your LAN subnet |
| Can’t reach the `*.ts.net` URL | Tailscale app connected on that phone, same account. `tailscale serve status` on the Pi |
| Browser warning on the `100.x` IP | Expected. Use the `https://….ts.net` name for the app |
| TLS warning on `expenses.home.lan` | Expected with `tls internal` — trust local CA once |
| `*.ts.net` URL: TLS `internal error`; tailscaled logs `address already in use` on `:443` | Caddy is listening on all interfaces. Add `bind <lan-ip> 127.0.0.1` to the Caddy site (or re-run setup), then `sudo systemctl restart caddy`. `ss -tlnp \| grep :443` should not show `*:443` |
| `tailscale serve` asks to enable HTTPS | https://login.tailscale.com/admin/dns — MagicDNS and HTTPS Certificates, then re-run setup |
| `421 Misdirected Request` | The hostname isn't in `ALLOWED_HOSTS` in `.env`; add it and restart |
| `403` on every save/upload | A proxy is changing the `Host`/`Origin` headers, or an old cached page lacks the CSRF header — hard-refresh |

---

## Success checklist

- [ ] `HOST=127.0.0.1` — Bun listens on localhost only
- [ ] `GET /api/health` returns OK
- [ ] Only Caddy reachable on LAN (80/443)
- [ ] Basic auth required before data is visible (LAN)
- [ ] `ALLOWED_HOSTS` set; `curl -H 'Host: evil.test' http://127.0.0.1:3000/api/health` → 421
- [ ] Tailnet is single-user, or the app password / Tailscale ACL is on
- [ ] `.env` and database are not readable by other Linux users
- [ ] Service survives reboot
- [ ] Nightly backup cron present; restore tested once
- [ ] Ollama (if used) on `127.0.0.1` only
- [ ] `tailscale serve status` shows `https://….ts.net` → `127.0.0.1:3000`
- [ ] Phone on cellular data, Tailscale connected, opens that URL
- [ ] Same URL fails when Tailscale is disconnected on the phone

---

## Files in `deploy/`

| File | Purpose |
|------|---------|
| **`setup.sh`** | **One-shot installer (start here)** |
| `install.sh` | App layer only (systemd, build) |
| `Caddyfile.template` | Rendered by `setup.sh` |
| `Caddyfile` | Manual Caddy reference |
| `expense-tracker.service` | systemd unit |
| `backup.sh` | SQLite backup + retention |
| `README.md` | This guide |
