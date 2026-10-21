# Make Paisa Kidhar Gaya?! reachable from anywhere

**Plan A is implemented.** `sudo ./deploy/setup.sh` installs Tailscale and runs `tailscale serve` against `127.0.0.1:3000` by default. Opt out with `SKIP_TAILSCALE=1`. Human steps (account, approve the Pi, install the app on your phone) are in [deploy/README.md](deploy/README.md#reach-it-from-anywhere-tailscale). The rest of this file is the design record: why the app is LAN-only without Tailscale, why Funnel and port-forward are rejected, and what the script is not allowed to change.

Handoff for an implementing agent. This file is self-contained. Do not hunt the repo for deployment context before acting; the current behavior, the files that enforce it, and the exact edits are below.

The app is a personal credit-card statement analyzer. The database holds merchant names, amounts, card last-4, and bank names. Treat remote access as exposing financial data. Do not open the Pi to the public internet.

## Decision (do this)

**Plan A (Tailscale) is already the default in `deploy/setup.sh`.** Leave it that way. It matches “leave the Pi in one place and open the app from my own phone and laptop anywhere.”

- No router port-forward.
- Works if the ISP uses CGNAT (common on Indian home connections; a public port-forward often cannot work).
- No code changes in the React app or the Bun API.
- Bun stays on `127.0.0.1:3000`. The existing LAN Caddy site stays as it is.
- Only devices on the owner’s tailnet can open the app. Tailscale identity is the lock. Do not also publish ports 80/443 to the world.

**Do not implement Plan C** (router port-forward + Let’s Encrypt + HTTP basic auth on the public internet) unless the owner explicitly rejects both Plan A and Plan B in writing. Plan C puts every transaction behind a single password with no second factor.

**Plan B (Cloudflare Tunnel + Cloudflare Access)** is the alternative when the owner must open the app in a normal browser on a device that does not have Tailscale installed (a work laptop, a borrowed phone). Plan B still does not require opening inbound ports. It needs a domain on Cloudflare and an email address for the Access one-time PIN. Steps are in this file so you can switch if the owner says so. Default is Plan A.

---

## What the app is

| Item | Value |
|------|--------|
| Name | Paisa Kidhar Gaya?! (`paisa-kidhar-gaya`) |
| Runtime | Bun. Never npm. |
| Production process | `bun run start` → `NODE_ENV=production bun run src/server/index.js` |
| Production listen | `127.0.0.1:3000` (from `HOST` in `.env`) |
| What that process serves | JSON API under `/api/*` **and** the built SPA from `./dist` (SPA fallback to `index.html`) |
| Database | SQLite file, default `data/expenses.db` (WAL). On the Pi: `/opt/expense_tracker/data/expenses.db` |
| Reverse proxy today | Caddy, site hostname `expenses.home.lan`, `tls internal`, HTTP basic auth |
| Process manager | systemd unit `expense-tracker`, user `expenses`, `WorkingDirectory=/opt/expense_tracker` |
| Firewall today | ufw: SSH, 80, 443 allowed **only from the LAN subnet**. Port 3000 is not allowed from the LAN. |
| Optional AI | Ollama at `http://127.0.0.1:11434`, model `qwen2.5:1.5b`. The chat route asks Ollama for SQL and runs a read-only `SELECT` against SQLite. |
| Installer | `sudo ./deploy/setup.sh` on the Pi. Install path `/opt/expense_tracker`. |

Dev (laptop only, irrelevant on the Pi): Vite `http://localhost:5173` proxies `/api` to `http://localhost:3000`. Do not run Vite on the Pi for this task.

### Request path today (LAN)

```
Phone/laptop on home Wi-Fi
  → https://expenses.home.lan  (Caddy :443, basic auth, Caddy local CA)
    → http://127.0.0.1:3000     (Bun: API + dist/)
      → SQLite
```

`expenses.home.lan` is not a public DNS name. Clients resolve it via the router or `/etc/hosts`. The certificate is Caddy’s **internal CA** (`tls internal` in `deploy/Caddyfile.template`). Browsers off the LAN, and browsers that never trusted that CA, cannot use this URL. That is why the app feels “local network only.” It is not a bind-address bug.

### Why you must not “just bind 0.0.0.0”

`src/server/config.js` sets production `HOST` to `127.0.0.1` unless `HOST` is overridden. That is correct. Leave it. The Bun process has **no authentication of its own**. Every `/api/*` route trusts whoever can open the TCP port:

- `GET /api/transactions`, `/api/cards`, `/api/statements`, `/api/export` — full statement data and CSV dump
- `POST /api/upload` — write statements
- `DELETE /api/statements/:id` — delete a statement and its transactions
- category, budget, and rule mutations
- `POST /api/chat` — natural language → SQL → rows (read-only SELECT, still a full data read)

Auth exists only in Caddy (`basic_auth` in the generated site). If Bun is reachable on a LAN or WAN address, that auth is skipped.

---

## Files that enforce “LAN only” (do not widen these for Plan A)

| File | What it does | Change for Plan A? |
|------|----------------|--------------------|
| `/opt/expense_tracker/.env` on the Pi (template: `.env.example`) | `HOST=127.0.0.1`, `PORT=3000`, `NODE_ENV=production` | **No.** Keep `HOST=127.0.0.1`. |
| `src/server/config.js` | `HOST = process.env.HOST \|\| (isProd ? '127.0.0.1' : '0.0.0.0')` | **No.** |
| `src/server/index.js` | `Bun.serve({ hostname: HOST, port: PORT })`. Dev-only CORS allows `http://localhost:5173`. Production sends **no** CORS headers (same-origin via the proxy). Serves `dist/` with SPA fallback. | **No.** |
| `src/client/utils/api.js` | `const API_BASE = '/api'` — relative URLs. | **No.** Any hostname works as long as the UI and API share one origin. |
| `src/client/main.jsx` | `BrowserRouter` with no `basename`. The app must be served at the **root** of the hostname (`https://host/`), not under a subpath. | **No.** |
| `vite.config.js` | Dev proxy to `localhost:3000`. | **No.** |
| `deploy/Caddyfile.template` | `{{HOST}}` with `tls internal`, `basic_auth`, `reverse_proxy 127.0.0.1:3000`. Rendered to `/etc/caddy/sites/expense-tracker` by `setup.sh`. | **No** for Plan A. LAN URL keeps working. |
| `deploy/setup.sh` `configure_firewall` | ufw allow 22/80/443 **from LAN subnet only** (`detect_lan_subnet`, default `192.168.0.0/16`). | **No.** Do not add `ufw allow 80` or `443` from Anywhere. |
| `deploy/expense-tracker.service` | systemd, `EnvironmentFile=-/opt/expense_tracker/.env`, hardened (`ProtectHome`, `ProtectSystem=strict`). | **No.** |
| `src/server/ollama.js` | `OLLAMA_URL` default `http://localhost:11434` (Pi `.env` uses `http://127.0.0.1:11434`). | **No.** Do not bind Ollama to `0.0.0.0`. |

Frontend theme/settings live in `localStorage` keys `expense-tracker-theme` and `expense-tracker-settings`. They are per browser. Nothing to migrate.

There is no session cookie, no CSRF token, and no app login. That is acceptable while the only clients are on the tailnet (Plan A) or behind Cloudflare Access (Plan B). It is not acceptable as the only control on a world-reachable port (Plan C).

---

## Plan A — Tailscale (implement this)

Tailscale makes an outbound WireGuard connection from the Pi. Phones and laptops on the same tailnet reach the Pi by a stable name (`<machine>.<tailnet>.ts.net`) from any network. Inbound ports on the home router stay closed. ufw’s “allow outgoing” default already permits the tunnel; do not punch inbound holes.

### A0. Confirm the Pi install before adding Tailscale

On the Pi:

```bash
systemctl is-active expense-tracker
curl -sf http://127.0.0.1:3000/api/health
ss -tlnp | grep 3000
# expect 127.0.0.1:3000 only, not 0.0.0.0:3000
sudo ufw status verbose
# 22/80/443 should be "from <lan-subnet>", not "Anywhere"
```

Health JSON looks like `{"success":true,"status":"ok","db":true,"uptime":...}`.

If the service is missing, the LAN installer is `sudo ./deploy/setup.sh` from a checkout, documented in `deploy/README.md`. Finish that before this plan. Do not re-run `setup.sh` in a way that regenerates Caddy unless you still have `EXPENSES_ADMIN_PASSWORD` — `configure_caddy` rewrites `/etc/caddy/sites/expense-tracker`.

### A1. Install Tailscale on the Pi

Raspberry Pi OS / Debian, arm64 or armhf. Official install:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

`tailscale up` prints a URL. The **owner** must open it and approve the Pi on their Tailscale account. This step cannot be finished without that human login. Use a reusable auth key only if the owner already created one in the Tailscale admin console (Settings → Keys). Do not invent a key. Do not commit a key. Do not put a key in the git repo or in this file.

```bash
# only if the owner handed you an auth key out of band:
sudo tailscale up --auth-key=tskey-auth-... --hostname=expenses
```

Recommended hostname: `expenses` (MagicDNS name becomes `expenses.<tailnet>.ts.net`).

Enable start on boot (the install script usually does this):

```bash
sudo systemctl enable --now tailscaled
```

### A2. Publish the app on the tailnet only

`tailscale serve` terminates HTTPS with a Tailscale certificate and proxies to local Bun. Traffic never hits Caddy, so Caddy basic auth is **not** in this path. The tailnet ACL is the access control: only the owner’s logged-in devices can connect. That is stronger than HTTP basic auth for a single-user app.

Keep serving at the hostname root so `BrowserRouter` and `/api` keep working.

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:3000
sudo tailscale serve status
```

What this does:

- Listens on the Tailscale interface, port 443, not on the LAN address and not on the public WAN.
- Proxies to `http://127.0.0.1:3000`.
- Leaves `expense-tracker.service` and Caddy unchanged, so `https://expenses.home.lan` still works at home.

If `serve` complains that 443 is taken on the tailscale interface only, stop and inspect `tailscale serve status`. Do not stop Caddy to “free” LAN port 443; Caddy binds the LAN interfaces, Tailscale Serve binds the tailnet interface. They coexist.

Reset if you need to undo just the publish (does not log the node out):

```bash
sudo tailscale serve reset
```

### A3. Optional: keep Caddy basic auth in front of the tailnet URL

Skip this unless the owner wants a password even for their own tailnet devices. It is extra friction on phones.

If you do it, do **not** point Serve at `https://127.0.0.1` (Caddy’s cert is for `expenses.home.lan`, `tls internal`, and will fail verification). Point Serve at Caddy’s HTTP-not-used port only after you add a **second** Caddy site that is plain HTTP on localhost. Do not disable `tls internal` on the LAN site.

Add a localhost HTTP site that still requires basic auth, and have Serve target that. Example file `/etc/caddy/sites/expense-tracker-tailscale` (same bcrypt hash already in `/etc/caddy/sites/expense-tracker`; copy the `basic_auth` user and hash, do not regenerate unless you know the password):

```caddy
http://127.0.0.1:8443 {
	basic_auth {
		admin <existing-bcrypt-hash-from-the-lan-site>
	}
	header {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy no-referrer
		-Server
	}
	reverse_proxy 127.0.0.1:3000
}
```

`http://127.0.0.1:8443` is not reachable from the LAN if nothing else binds it on `0.0.0.0`. Confirm with `ss -tlnp | grep 8443` — the address must be `127.0.0.1:8443`.

Then:

```bash
sudo systemctl reload caddy
sudo tailscale serve --bg --https=443 http://127.0.0.1:8443
```

Default implementation is **A2 without this extra site.**

### A4. Install Tailscale on each client the owner uses

- Phone: Tailscale app from the store, log in to the same account.
- Laptop: https://tailscale.com/download , same account.

No `/etc/hosts` entry. No port-forward. No CA install for the tailnet URL (the certificate is a real public cert for `*.ts.net` issued via Tailscale).

### A5. MagicDNS

In the Tailscale admin console, MagicDNS must be on (it is on by default for new tailnets). The URL is:

```text
https://expenses.<tailnet-name>.ts.net
```

Get the exact name on the Pi:

```bash
tailscale status
tailscale cert status 2>/dev/null || true
```

The owner opens that HTTPS URL from a device that is logged into Tailscale, including on mobile data, away from home.

### A6. ACL (single user)

Default Tailscale ACL lets every device on the tailnet talk to every other device. For a one-person tailnet that is fine. If the tailnet is shared with other people, restrict TCP 443 on the Pi tag to the owner’s devices only, in the admin console ACL. Do not leave a shared tailnet able to `GET /api/transactions`.

### A7. What not to change in git for Plan A

Plan A is entirely on the Pi (packages + `tailscale serve`). No commit is required for it to work.

If you want the repo to remember the command, add a short comment to `deploy/README.md` pointing at this file. Do not change `Caddyfile.template`, `setup.sh` firewall rules, `HOST`, or the React app.

### A8. systemd persistence

`tailscaled` is enabled in A1. `tailscale serve --bg` stores the serve config on the node and restores it when `tailscaled` starts. Verify after a reboot:

```bash
sudo reboot
# after it comes back:
tailscale status
tailscale serve status
curl -sf http://127.0.0.1:3000/api/health
```

### A9. Plan A verification (required)

From the Pi:

```bash
curl -sf http://127.0.0.1:3000/api/health
ss -tlnp | grep -E '3000|tailscale'
sudo ufw status verbose | sed -n '1,40p'
```

Pass conditions:

- Health is `"status":"ok"`.
- `3000` is bound to `127.0.0.1` only.
- ufw still does **not** allow 80/443 from Anywhere.
- `tailscale serve status` shows `https://expenses.<tailnet>.ts.net` proxying to `http://127.0.0.1:3000`.

From a phone on **cellular data** (Wi-Fi off), Tailscale app connected:

1. Open `https://expenses.<tailnet>.ts.net`.
2. Home page loads (upload + dashboard). No certificate warning.
3. Open `/analytics`. Charts or the empty state render. Refresh on `/analytics` returns the app, not a 404 (SPA fallback).
4. If statements already exist, totals match what `https://expenses.home.lan` shows on the LAN.
5. Upload is optional. If you upload a CSV, confirm it appears, then confirm the LAN URL shows the same rows (one database).
6. With Tailscale **disconnected**, the tailnet URL must fail. That proves it is not accidentally public.

Also confirm the LAN URL still works on home Wi-Fi: `https://expenses.home.lan` still asks for the Caddy basic-auth password.

---

## Plan B — Cloudflare Tunnel + Access (only if the owner asks)

Use this when a browser with no Tailscale client must reach the app. Still no inbound ports. Still leave `HOST=127.0.0.1` and do not widen ufw.

### Why Access is mandatory

A tunnel to `http://127.0.0.1:3000` publishes the API to whoever has the hostname. Caddy basic auth is **not** on that path. Cloudflare Access (one-time PIN to the owner’s email, or a Google/GitHub login restricted to one email) must sit in front of the hostname before any transaction route is reachable. Do not use a quick tunnel (`trycloudflare.com`); that URL is unauthenticated and changes.

### B1. Prerequisites the owner must already have

- A Cloudflare account.
- A domain whose DNS is hosted on Cloudflare (orange-cloud proxied records are fine; the tunnel creates a CNAME).
- `cloudflared` login, which is interactive the first time.

You cannot complete B1 without the owner.

### B2. Install cloudflared on the Pi

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install -y cloudflared
```

Pi 4 is arm64 or armhf; the Cloudflare apt repo ships both. If apt has no package, download the matching `.deb` from https://github.com/cloudflare/cloudflared/releases (`linux-arm64` or `linux-arm`).

### B3. Create the tunnel

```bash
cloudflared tunnel login          # owner approves in browser; cert lands in ~/.cloudflared
cloudflared tunnel create expenses
```

Note the tunnel UUID from the create output.

DNS route (replace the hostname; do not use `expenses.home.lan`):

```bash
cloudflared tunnel route dns expenses expenses.example.com
```

Config file `/etc/cloudflared/config.yml` (root-owned, mode `0640`):

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /etc/cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: expenses.example.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Copy the credentials JSON from the user home path cloudflared printed into `/etc/cloudflared/`. Then:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

`service: http://127.0.0.1:3000` matches the production Bun server. The public URL is HTTPS because Cloudflare terminates TLS at the edge. The app stays same-origin (`https://expenses.example.com/` and `https://expenses.example.com/api/...`), so `api.js` and `BrowserRouter` need no edits.

### B4. Cloudflare Access policy

In the Cloudflare dashboard: Zero Trust → Access → Applications → self-hosted.

- Application domain: `expenses.example.com`
- Policy: Allow, Include → Emails → the owner’s email only
- Session duration: 24 hours is reasonable

Until this policy exists and a test from an incognito window shows the Access login **before** any expense UI, the tunnel is not done. An unauthenticated hit must not return transaction JSON.

### B5. Do not stack Access and also skip it via a second hostname

One public hostname. Do not add a second DNS name that points at the tunnel without Access.

### B6. Plan B verification

- Incognito browser, not on the home LAN: `https://expenses.example.com` shows Cloudflare Access, not the dashboard.
- After the PIN, the dashboard loads, `/analytics` survives a refresh, and `GET /api/health` via the browser network panel is same-origin.
- From a network that should not be trusted (or a second email), Access denies.
- On the Pi, `ss` still shows `127.0.0.1:3000`, and ufw still has no world-open 80/443.
- `cloudflared` stays up after reboot.

LAN Caddy (`https://expenses.home.lan`) remains for home use.

---

## Plan C — public port-forward (do not implement by default)

Recorded so a later agent does not “simplify” the task into opening a port. Implement only if the owner explicitly rejects Tailscale and Cloudflare.

### C1. Check CGNAT before any firewall edit

On the Pi:

```bash
curl -4 -fsS https://ifconfig.me ; echo
ip -4 route get 1.1.1.1
```

Compare the public IP from `ifconfig.me` with the WAN IP shown on the home router’s status page. If they differ, the ISP is using CGNAT. Port-forwarding will not make the Pi reachable. Stop and use Plan A or B.

### C2. If there is a real public IPv4

Needs all of the following. Missing any one of them means the app is either unreachable or exposed without a real certificate:

1. A DNS name the owner controls, A record to that WAN IP. Dynamic DNS (Cloudflare DDNS or similar) if the IP changes. Let’s Encrypt HTTP-01 will fail on a stale A record.
2. Router forward: WAN TCP 80 and 443 → Pi LAN IP, same ports. DHCP reservation for the Pi so the forward does not rot.
3. Caddy must get a **public** certificate. In `deploy/Caddyfile.template`, delete the line `tls internal`. Set `EXPENSES_HOST` to the public FQDN and re-render `/etc/caddy/sites/expense-tracker` the same way `setup.sh` does (awk substitution of `{{HOST}}`, `{{USER}}`, `{{HASH}}`). Caddy then uses automatic Let’s Encrypt. Port 80 must reach Caddy for the HTTP-01 challenge, or switch that site to a DNS-01 module (more moving parts; do not improvise a custom build on the Pi).
4. ufw change, which is the dangerous one: allow 80/443 from Anywhere, **keep 22 LAN-only**, never allow 3000. Example:

   ```bash
   sudo ufw allow 80/tcp comment 'HTTP ACME and redirect'
   sudo ufw allow 443/tcp comment 'HTTPS public'
   ```

   Do not run `ufw allow 3000`. Do not set `HOST=0.0.0.0`.
5. Add response headers on that Caddy site: `Strict-Transport-Security "max-age=31536000; includeSubDomains"`. Add them in Caddy, not in `SECURITY_HEADERS` in `src/server/config.js`, because the Bun process also serves plain HTTP on localhost and HSTS there does not help.
6. Basic auth alone is a single password cached by the browser, with no lockout and no second factor, in front of `GET /api/export` and `POST /api/chat`. Minimum extra control if Plan C is forced: Cloudflare or Caddy rate limits, and a long random password. Prefer not to do Plan C.
7. Confirm from a phone on cellular: valid padlock, basic-auth prompt, dashboard loads, `/analytics` refresh works. Confirm `http://<public-ip>:3000` does **not** connect.

Pi 4 note: Let’s Encrypt rate limits are per registered domain. Do not loop `systemctl reload caddy` while debugging cert failures.

---

## Application code: nothing required for reachability

No change to React, routes, database, or listen address is required for Plan A or Plan B. Reasons, so the next agent does not refactor “while here”:

- **Same origin.** Production Bun serves `dist/index.html` and `/api` on one port. The proxy (Tailscale Serve, cloudflared, or Caddy) presents one public hostname. `API_BASE = '/api'` keeps working. Do not introduce `VITE_API_URL` or an absolute API host.
- **SPA fallback already exists.** `src/server/index.js` `resolveDistPath` serves a real file when it exists and otherwise `./dist/index.html`. Direct loads of `/analytics` work behind the proxy. Do not add a second static server.
- **Dev CORS stays dev-only.** The `isDev` branch allows `http://localhost:5173`. Production must keep the empty CORS header set. Do not reflect arbitrary `Origin`.
- **Chat SQL stays local.** `executeReadOnlyQuery` in `src/server/db.js` allows a single `SELECT`, blocks `INSERT`/`UPDATE`/`DELETE`/`DROP`/`ATTACH`/`PRAGMA`, blocks `sqlite_master`, and appends `LIMIT 100` when missing. It still returns real transaction rows. Do not expose it without Plan A’s tailnet or Plan B’s Access. Do not point `OLLAMA_URL` at a host other than `127.0.0.1`.
- **Uploads.** `MAX_UPLOAD_SIZE` defaults to 5 MiB (`5242880`). Leave it.
- **Security headers already set** by both Bun (`src/server/config.js` `SECURITY_HEADERS`: `nosniff`, `DENY` framing, `no-referrer`) and Caddy. Tailscale Serve / Cloudflare do not strip the ones Bun sets on the origin response.

### Hardening that is explicitly out of scope unless the owner asks

- App-level user accounts, sessions, CSRF tokens.
- Changing `basic_auth` on the LAN Caddy site.
- Moving SQLite to another machine.
- Binding the app to IPv6 on the WAN.

---

## Set-and-forget on the Pi (do these with Plan A)

Remote access is useless if the Pi dies quietly. These are part of finishing the task.

1. **Router DHCP reservation** for the Pi’s MAC, so the LAN URL and any future SSH still find it. Tailscale does not need this for the tailnet URL, but the owner still SSHes on the LAN.
2. **SSH stays LAN-only** in ufw. The owner can also SSH over Tailscale (`ssh expenses@expenses`) after Tailscale is up; that does not require opening port 22 on the router. Do not `ufw allow 22` from Anywhere.
3. **Power.** A Pi 4 on a flaky USB supply corrupts SQLite. Confirm a proper 5V/3A supply. Prefer the DB on USB SSD if `DB_PATH` was moved (see `.env.example`). If `DB_PATH` is outside `/opt/expense_tracker/data` and `/opt/expense_tracker/backups`, add that path to `ReadWritePaths` in `deploy/expense-tracker.service` or systemd will block writes (`ProtectSystem=strict`).
4. **Backups already exist.** `deploy/backup.sh` via cron at 03:15, 14-day retention, user `expenses`. Confirm:

   ```bash
   sudo crontab -u expenses -l
   sudo -u expenses /opt/expense_tracker/deploy/backup.sh
   ls -l /opt/expense_tracker/backups
   ```

   A nightly file on the same SD card is not a backup if the card dies. Copy backups off the Pi (owner’s laptop, or `rclone` to storage the owner already has). Do not upload the raw `expenses.db` to a world-readable bucket. The file is the full financial history.
5. **Unattended security updates** for Debian/Raspberry Pi OS, so `tailscaled` and the kernel get patches without a login. Enable the distro’s unattended-upgrades package if it is not already on. Do not auto-reboot in a way you have not tested; a monthly reboot check is enough.
6. **Watch the service.** After reboot, `expense-tracker` and `tailscaled` must both be active. `expense-tracker.service` already has `Restart=on-failure`.

Restore drill (already documented, repeat once so the owner knows it works):

```bash
sudo systemctl stop expense-tracker
cp /opt/expense_tracker/backups/expenses-YYYYMMDDThhmmssZ.db /opt/expense_tracker/data/expenses.db
sudo chown expenses:expenses /opt/expense_tracker/data/expenses.db
sudo systemctl start expense-tracker
curl -sf http://127.0.0.1:3000/api/health
```

Use a copy of a backup in a scratch directory if you must not overwrite live data during a test. Do not leave the service stopped.

---

## Secrets and git

- Do not commit Tailscale auth keys, Cloudflare tunnel JSON, `/etc/caddy/sites/expense-tracker` (it contains the bcrypt hash), or `/opt/expense_tracker/.env` if it ever gains secrets.
- `.env` on the Pi is created from `.env.example` and is local. Current keys: `NODE_ENV`, `PORT`, `HOST`, `DB_PATH`, `MAX_UPLOAD_SIZE`, `OLLAMA_URL`, `OLLAMA_MODEL`. None of them should change for Plan A.
- The Caddy password is not in the repo. It was set at `setup.sh` time as `EXPENSES_ADMIN_USER` (default `admin`) plus `EXPENSES_ADMIN_PASSWORD`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| Tailnet URL loads on Wi-Fi but not on cellular | Client Tailscale app not connected, or MagicDNS off | Open the Tailscale app, confirm the same account, `tailscale status` on both ends shows the peer |
| Certificate warning on `expenses.home.lan` | Expected. That name uses `tls internal` | Trust Caddy’s local CA once per device, or use the tailnet URL instead |
| Certificate warning on `*.ts.net` | Serve not configured, or client not using Tailscale DNS | `tailscale serve status`; client must be on the tailnet |
| `https://expenses.<tailnet>.ts.net` shows the API 404 text about Vite | `NODE_ENV` is not production, so Bun is not serving `dist/` | `/opt/expense_tracker/.env` must contain `NODE_ENV=production`. `bun run start` also sets it. Restart `expense-tracker`. |
| Dashboard HTML loads, API calls fail | Proxy stripping `/api` or serving only static files | Serve/tunnel target must be `http://127.0.0.1:3000`, the Bun process, not the `dist/` directory |
| Refresh on `/analytics` is 404 | Something else is serving files without the SPA fallback | Same fix: proxy to Bun, which already falls back to `index.html` |
| LAN URL broke after this work | Caddy site was overwritten or Caddy was stopped | Restore `/etc/caddy/sites/expense-tracker`, `systemctl reload caddy`. Do not point the LAN site at a tailnet-only hostname |
| App reachable with Tailscale disconnected | A port-forward or a tunnel without Access exists | Remove the forward / tunnel. Re-check ufw |
| `curl 127.0.0.1:3000/api/health` fails | Bun down | `journalctl -u expense-tracker -n 80`. Often a bad `DB_PATH` or `ProtectSystem` blocking the db directory |
| Chat box missing | Ollama not running locally | Optional. `OLLAMA_HOST=127.0.0.1:11434`. Do not expose 11434 |
| Pi 4 very slow on first TLS hit | CPU | Normal on a Pi 4. Tailscale and Caddy are fine; do not add a second heavy proxy |

---

## Implementation checklist

Plan A, in order:

1. Confirm `expense-tracker` is healthy on `127.0.0.1:3000` and ufw is LAN-scoped.
2. Install `tailscaled`, `tailscale up` (owner approves the login URL).
3. `sudo tailscale serve --bg --https=443 http://127.0.0.1:3000`.
4. Owner installs Tailscale on phone and laptop, same account.
5. Verify the cellular-data test in A9, including failure when Tailscale is off.
6. Verify `https://expenses.home.lan` still works on the LAN.
7. Confirm backup cron, and tell the owner the exact URL `https://<name>.<tailnet>.ts.net`.
8. Do not commit secrets. A repo edit is optional; the running Pi config is the deliverable.

Done means: the owner can leave the house, turn off Wi-Fi, and open the dashboard over HTTPS on their own phone, while a stranger on the internet cannot open `/api/transactions`.
