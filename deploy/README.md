# Raspberry Pi deployment

Run **Paisa Kidhar Gaya?!** as an always-on LAN service:

```
LAN clients ──► Caddy (:443, basic auth) ──► Bun (127.0.0.1:3000) ──► SQLite
                                                      ▲
                                              backup.sh (cron)
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
| 3 | App user `expenses`, files under `/opt/expense_tracker` |
| 4 | `bun install`, production build if `dist/` missing |
| 5 | systemd unit `expense-tracker` (starts on boot) |
| 6 | Caddy site with **basic auth** + internal TLS |
| 7 | ufw: LAN → SSH, 80, 443 only (port **3000** stays closed) |
| 8 | Nightly backup cron for the `expenses` user |
| 9 | Health check on `http://127.0.0.1:3000/api/health` |

### After setup

1. Point **`expenses.home.lan`** at the Pi (router DNS or client `/etc/hosts`)
2. Open **https://expenses.home.lan**
3. Log in with username **`admin`** (or your `EXPENSES_ADMIN_USER`) and the password you set
4. Trust Caddy’s local certificate once per device (browser security prompt)

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPENSES_HOST` | `expenses.home.lan` | Hostname in Caddy |
| `EXPENSES_ADMIN_USER` | `admin` | Basic-auth username |
| `EXPENSES_ADMIN_PASSWORD` | (interactive prompt) | Required if no TTY |
| `APP_ROOT` | `/opt/expense_tracker` | Install path |
| `LAN_SUBNET` | auto-detect | ufw source subnet |
| `SETUP_FIREWALL` | `1` | Apply ufw rules |
| `SKIP_APT` | `0` | Skip apt install |
| `SKIP_CADDY` | `0` | Skip Caddy config |
| `SKIP_FIREWALL` | `0` | Skip ufw |
| `SKIP_CRON` | `0` | Skip backup cron |
| `DRY_RUN` | `0` | Print actions only |

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
  ./ pi@raspberrypi:/opt/expense_tracker/
```

Then on the Pi:

```bash
cd /opt/expense_tracker   # or your clone path
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
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

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
sudo systemctl reload caddy
```

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

---

## Backups

[`backup.sh`](backup.sh) uses SQLite’s online `.backup` (WAL-safe), keeps 14 days by default.

```bash
# one-shot
sudo -u expenses /opt/expense_tracker/deploy/backup.sh
```

`setup.sh` adds a daily cron at 03:15. Manual cron line:

```cron
15 3 * * * /opt/expense_tracker/deploy/backup.sh >> /opt/expense_tracker/backups/backup.log 2>&1
```

### Restore

```bash
sudo systemctl stop expense-tracker
cp /opt/expense_tracker/backups/expenses-YYYYMMDDThhmmssZ.db /opt/expense_tracker/data/expenses.db
sudo chown expenses:expenses /opt/expense_tracker/data/expenses.db
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

Unit file: [`expense-tracker.service`](expense-tracker.service)

---

## Troubleshooting

| Problem | Check |
|---------|--------|
| Health fails | `sudo journalctl -u expense-tracker -n 50` |
| Caddy 502 | App running? `curl http://127.0.0.1:3000/api/health` |
| Build OOM | Pre-build on laptop, rsync `dist/` |
| Can’t reach from phone | DNS/hosts for `EXPENSES_HOST`; ufw allows your LAN subnet |
| TLS warning | Expected with `tls internal` — trust local CA once |

---

## Success checklist

- [ ] `HOST=127.0.0.1` — Bun listens on localhost only
- [ ] `GET /api/health` returns OK
- [ ] Only Caddy reachable on LAN (80/443)
- [ ] Basic auth required before data is visible
- [ ] Service survives reboot
- [ ] Nightly backup cron present; restore tested once
- [ ] Ollama (if used) on `127.0.0.1` only

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
