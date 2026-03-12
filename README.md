<div align="center">
  <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena" height="80" />

  <h1>FairArena</h1>

  <p><strong>A production-grade, multi-tool developer platform —<br>
  sandboxed terminals, full API testing, and real-time webhook inspection.</strong></p>

  <p>
    <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick%20Start-4min-6366f1?style=flat-square&logo=docker" alt="Quick Start" /></a>
    <a href="#%EF%B8%8F-deploy-to-vercel--vps"><img src="https://img.shields.io/badge/Deploy-Vercel%20%2B%20VPS-000000?style=flat-square&logo=vercel" alt="Deploy" /></a>
    <img src="https://img.shields.io/badge/License-MIT-22c55e?style=flat-square" alt="MIT" />
    <img src="https://img.shields.io/badge/Node-22-339933?style=flat-square&logo=nodedotjs" alt="Node 22" />
    <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React 19" />
  </p>
</div>

---

## ✨ Features

### 🖥️ Online Terminal
> **Important:** The online terminal feature is disabled on the public/demo deployment due to server resource constraints. To use the terminal feature, self-host the backend on your VPS or locally (see **Quick Start**) and ensure the server has sufficient CPU/RAM available.

- Isolated **Docker sandbox** per session — no host access, no shared state
- Supports **Ubuntu, Debian, Alpine, Fedora, Arch Linux**
- Session limits enforced per-IP via **Upstash Redis** (1 active session, 1 hr/day)
- **Two-tier resource gating**: new sessions blocked at ≥50% CPU/RAM; all sessions killed at ≥60%
- Auto-expiry with countdown timer, 2-minute warning, graceful cleanup
- Search, copy-selection, pop-out to new window
- Full xterm.js with JetBrains Mono, 5000-line scrollback

### 🔌 API Tester (Postman-like)
- **All HTTP methods** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Request builder**: query params, custom headers w/ autocomplete, auth (Bearer, Basic, API Key), body (JSON / form / text / XML)
- **cURL import** — paste any curl command; it's parsed into structured fields
- **cURL export** — one-click copy of the equivalent curl command
- **Postman Collection v2.1 import / export** — load and save entire collections
- Smart **URL suggestions** from history, header name autocomplete, Content-Type suggestions
- **Request history** — localStorage-backed, searchable, per-item rename & delete
- Full **response inspector**: JSON syntax highlight, headers, timing, size, redirect chain
- SSRF-protected proxy — blocks requests to private IPs / localhost

### 🔗 Webhook Inspector
- Instant unique **webhook URLs** — no sign-up required
- Real-time event stream via **Server-Sent Events**
- Inspect **headers, query params, body** (JSON highlighted), raw
- **Multi-channel** — up to 10 simultaneous channels
- **Persists across tab switches and page refreshes** — channels survive until their 1-hour TTL
- QR code generation, channel export as JSON, per-channel rename, method filter
- Auto-reconnect with exponential backoff, heartbeat keep-alive (25s)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Vercel (or any static CDN)                             │
│  React 19 · Vite 7 · Tailwind · TypeScript             │
│  VITE_API_URL=https://api.yourserver.com                │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────▼──────────────────────────────────┐
│  VPS — Docker Compose                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Node 22 · Express 5 · TypeScript               │    │
│  │  ├─ /api/request/run  → SSRF-safe HTTP proxy    │    │
│  │  ├─ /api/curl/parse   → cURL → JSON             │    │
│  │  ├─ /api/webhook/*    → SSE + event store       │    │
│  │  ├─ /terminal         → WebSocket → node-pty    │    │
│  │  └─ /api/server-stats → resource monitor        │    │
│  └───────────┬─────────────────────────────────────┘    │
│              │ docker.sock (bind-mount, read-only)       │
│  ┌───────────▼─────────────────────────────────────┐    │
│  │  Docker Engine                                  │    │
│  │  └─ fairarena-sandbox containers (ephemeral)    │    │
│  │     --memory=256m --cpus=0.5 --pids-limit=64    │    │
│  │     --cap-drop=ALL --read-only --no-new-privs   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Upstash Redis (optional)                               │
│  └─ Per-IP session claim/release + daily quota         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2
- Node.js ≥ 22 (for local dev only)

### 1. Clone & configure

```bash
git clone https://github.com/fairarena/fairarena-tools.git
cd fairarena-tools
cp .env.example .env
```

Edit `.env` — the minimum required for production:

```env
NODE_ENV=production
PORT=4000
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### 2. Start backend

```bash
docker compose up -d
docker compose logs -f server
```

The API is now live at `http://localhost:4000`. Verify:

```bash
curl http://localhost:4000/api/health
```

### 3. Start frontend (local dev)

```bash
cd client
npm install
npm run dev          # → http://localhost:5173
```

The Vite dev server proxies `/api/*` and `/terminal` to `localhost:4000` automatically via `vite.config.ts`.

---

## ☁️ Deploy to Vercel + VPS

### Backend (VPS)

1. **SSH into your VPS**, clone the repo, copy `.env.example` → `.env`
2. Set `ALLOWED_ORIGINS` to your Vercel preview + production URLs:
   ```env
   ALLOWED_ORIGINS=https://fairarena.app,
   ```
3. Give Docker socket access to the non-root user in the container:
   ```bash
   sudo setfacl -m user:1001:rw /var/run/docker.sock
   ```
4. Launch:
   ```bash
   docker compose up -d --build
   ```
5. **Reverse proxy** (recommended — nginx or Caddy):
   ```nginx
   # /etc/nginx/sites-available/fairarena
   server {
     listen 443 ssl;
     server_name api.yourserver.com;

     location / {
       proxy_pass http://localhost:4000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";  # required for WebSocket
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;

       # SSE — disable buffering for Webhook Dumper
       proxy_buffering off;
       proxy_cache off;
       proxy_read_timeout 3600s;
     }
   }
   ```

### Frontend (Vercel)

1. Import the `client/` directory as a new Vercel project (set **Root Directory** to `client`)
2. Add one environment variable in the Vercel dashboard:
   ```
   VITE_API_URL = https://api.yourserver.com
   ```
3. Deploy — that's it. The React app builds once and the compiled JS reads `VITE_API_URL` at runtime to reach your VPS.

> **WebSocket URL** is derived automatically: `https://` → `wss://`, `http://` → `ws://`.

---

## ⚙️ Environment Variables

### Server (`/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP / WS port |
| `NODE_ENV` | `development` | `production` enables strict CORS |
| `ALLOWED_ORIGINS` | `https://fairarena.app` | Comma-separated CORS allow-list |
| `MAX_SESSIONS` | `3` | Max global concurrent Docker sessions |
| `MAX_SESSIONS_PER_IP` | `1` | Max sessions per IP (Redis-enforced) |
| `SESSION_TTL_MS` | `1800000` | Max session lifetime (30 min) |
| `DAILY_LIMIT_MS` | `3600000` | Max terminal time per IP per day (1 hr) |
| `OVERLOAD_THRESHOLD` | `50` | % CPU/RAM → block new sessions |
| `KILL_THRESHOLD` | `60` | % CPU/RAM → kill all active sessions |
| `OVERLOAD_CHECK_MS` | `5000` | Resource poll interval |
| `UPSTASH_REDIS_URL` | *(optional)* | Upstash REST URL — in-memory fallback if absent |
| `UPSTASH_REDIS_TOKEN` | *(optional)* | Upstash REST token |
| `ALLOW_PRIVATE_PROXY` | `false` | Allow API tester to reach private IPs (**never enable publicly**) |
| `WS_MSG_RATE_LIMIT` | `60` | Max WebSocket messages/min per connection |
| `WS_CONN_IDLE_MS` | `600000` | Close idle WS connections after 10 min |

### Frontend (`/client/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | *(empty)* | Backend URL for Vercel+VPS split deploy. Leave empty for local dev. |

---

## 🔒 Security Model

| Threat | Mitigation |
|---|---|
| Container escape | `--cap-drop=ALL`, `--read-only`, `--no-new-privileges`, `--pids-limit=64`, `--memory=256m`, `--cpus=0.5` |
| SSRF via API proxy | DNS resolution + private-IP regex blocklist; private hosts require explicit opt-in flag |
| Resource exhaustion | Two-tier CPU/RAM threshold: 50% blocks new sessions, 60% terminates all |
| Per-user abuse | Redis per-IP claim (1 session), 1 hr/day quota, 30 min max session TTL |
| Brute-force / scraping | Global 120 req/min rate limit + 30 req/min on proxy + 10/min on webhook create |
| Sensitive env leakage | Server strips `x-env*`, `x-secret*`, `x-internal*`, `x-debug*` headers; never returns raw MB values |
| XSS | React escapes all dynamic content; raw HTML only in pre-sanitized JSON highlighter |
| Injection | All Docker commands use `node-pty` with argv arrays, never `shell: true`; no `exec()` |
| CORS | Strict allow-list; wildcard (`*`) only in development |
| Helmet | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Webhook spam | 10 new channels/min/IP; max 200 events/channel; 1 hr TTL; cleanup every 5 min |

---

## 🛠️ Local Development

```bash
# Terminal 1 — backend with hot reload
cd server && npm run dev

# Terminal 2 — frontend with HMR
cd client && npm run dev
```

Both share the same Vite proxy config — no env vars needed locally.

### Running TypeScript checks

```bash
# Server
cd server && npx tsc --noEmit

# Client
cd client && npx tsc --noEmit
```

---

## 📁 Project Structure

```
fairarena/
├── server/
│   ├── src/
│   │   ├── index.ts          # Express app, WS server, all routes
│   │   ├── redis.ts          # Upstash Redis + in-memory fallback
│   │   ├── resources.ts      # CPU/RAM monitor, overload gates
│   │   └── docker/
│   │       ├── manager.ts    # Container lifecycle (create/destroy/resize)
│   │       └── images.ts     # OS image catalog
│   ├── Dockerfile
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.tsx           # 3-tab layout + popup terminal mode
│   │   ├── components/
│   │   │   ├── TerminalPane.tsx    # xterm.js + resource stats
│   │   │   ├── ApiTester.tsx       # Postman-like request builder
│   │   │   ├── WebhookDumper.tsx   # SSE webhook inspector
│   │   │   ├── Navbar.tsx
│   │   │   └── OSSelector.tsx
│   │   ├── hooks/
│   │   │   └── useTerminalSession.ts  # WebSocket session hook
│   │   └── types/index.ts
│   ├── .env.example
│   └── package.json
│
├── docker-compose.yml        # Backend only (frontend → Vercel)
├── .env.example              # Server environment template
└── README.md
```

---

## 🤝 Contributing

1. Fork → create a feature branch (`git checkout -b feat/my-feature`)
2. Commit with clear messages
3. Open a PR — describe **what** and **why**

Please run `npx tsc --noEmit` in both `server/` and `client/` before submitting.

---

<div align="center">
  <p>Built with ❤️ — FairArena Team</p>
</div>
