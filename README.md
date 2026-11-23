<div align="center">

<img src="public/og.png" alt="Wèngchéng" width="720" />

# Wèngchéng / 瓮城

**A fake city behind a real front door.**

Adaptive cyber-deception that lets normal users through, diverts attackers into convincing decoys, and wakes AI only when it matters.

[![Build](https://img.shields.io/badge/build-passing-2ea043?style=for-the-badge)](#quick-start)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA-NIM-76b900?style=for-the-badge&logo=nvidia&logoColor=white)](#ai--nvidia-nim)
[![Node](https://img.shields.io/badge/node-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](#quick-start)
[![License](https://img.shields.io/badge/demo-GenHacks-f97316?style=for-the-badge)](#for-judges)

</div>

---

## What it does

Wèngchéng sits in front of a protected portal (Aegis Cloud). Every request gets a fast deterministic verdict:

| Verdict | What happens | AI cost |
|---|---:|---:|
| **PASS** | Legitimate traffic reaches the real portal | 0 tokens |
| **DIVERT** | Known attacks get cached/deterministic decoys | 0 tokens on cache hit |
| **WAKE** | Novel unknown probes can synthesize a decoy with AI | Only on novel cache miss |
| **BLOCKED** | Portcullis/403 gate hard-blocks hostile sessions | 0 tokens |

**The point:** normal traffic stays cheap and fast. Attackers get realistic fake data, tarpit latency, and incident reports.

---

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

- **Dashboard:** http://localhost:3000
- **Protected portal:** http://localhost:3000/portal
- **Health:** http://localhost:3000/health

No API keys required. Without keys, Wèngchéng runs in **offline procedural mode** with deterministic decoys and reports.

---

## AI / NVIDIA NIM

Wèngchéng uses AI only when needed (novel decoy synthesis / deeper analysis). Configure via env vars:

```bash
# .env
NVIDIA_API_KEY=nvapi-...
NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b
# Optional
LLM_TIMEOUT_MS=90000
NVIDIA_ENABLE_THINKING=true
```

Provider behavior:

- **NVIDIA_API_KEY set** → NVIDIA NIM (`https://integrate.api.nvidia.com/v1`)
- **OPENROUTER_API_KEY set** (and no NVIDIA key) → OpenRouter
- **No keys** → offline procedural fallback (still fully demoable)

> **Security:** never commit API keys. Use `.env` locally, and `wrangler secret put` / platform secrets in deployment.

---

## Demo flow (for judges)

1. Start the app: `npm run dev`
2. Open the dashboard and click **Take the guided tour** or **Run the full demo**.
3. Send a **Novel probe** with **403 gate off** to see AI decoy synthesis (when NIM is configured).
4. Turn **403 gate on** to show hard blocking.
5. Open a hostile session and generate a report.

If `DEMO_ADMIN_TOKEN` is set, use the lock icon in the UI or open `/?token=YOUR_TOKEN`.

---

## Redesign frontend

`redesign/` contains a clean standalone frontend (Vite + React + Tailwind + M3 switch) wired to the real backend.

```bash
# terminal 1: backend
npm run dev

# terminal 2: redesign frontend
cd redesign
npm install
npm run dev
```

The redesign dev server proxies `/api` and `/ws` to `http://localhost:3000` by default. For a deployed backend, set:

```bash
# redesign/.env
VITE_API_BASE=https://your-backend.example.com
```

---

## Deploy

### Backend (Node/Express/WS)

The backend is a stateful Node process. Deploy it to any Node/Docker host.

```bash
npm run build
npm start
```

Docker:

```bash
docker build -t wengcheng .
docker run -p 3000:3000 --env-file .env wengcheng
```

### Frontend (Cloudflare Pages static)

The `redesign/` frontend can be deployed as static Pages. It must point at a running backend via `VITE_API_BASE`.

```bash
cd redesign
npm install
VITE_API_BASE=https://your-backend.example.com npm run build
npx wrangler pages deploy dist --project-name wengcheng-redesign
```

Plaintext vars go in config; secrets go through Wrangler commands:

```bash
# plaintext vars (deploy-time / config)
# edit wrangler.toml [vars]

# secrets (never commit)
npx wrangler secret put NVIDIA_API_KEY
# or bulk
npx wrangler secret bulk .env.production
```

> Note: Cloudflare Pages static hosting serves the frontend only. The Wèngchéng deception backend needs a Node runtime for Express + WebSocket + in-memory state.

---

## Architecture

```text
Browser / Attacker
        │
        ▼
┌─────────────────────┐
│  Wèngchéng Sentinel │  deterministic, fast, no LLM
└─────────┬───────────┘
          │
   ┌──────┴──────┐
   ▼             ▼
PASS           SUSPICIOUS
   │             │
   ▼             ▼
Aegis Cloud    Decoy Cache / Procedural Decoy
(real portal)        │
                     ├── cache hit: 0 tokens
                     └── novel miss: NVIDIA NIM synthesis → cache
```

Key paths:

```text
src/server/        # Express, sentinel, deception, LLM, realtime, portal
src/client/        # main dashboard frontend
src/shared/        # wire types shared by server/client
redesign/          # clean standalone frontend wired to real backend
scripts/           # attacker + submission verification
```

---

## Useful commands

```bash
npm run dev              # backend + frontend dev
npm run build            # typecheck + build frontend + build server
npm run verify:submission
npm run attacker         # external attacker simulation
```

---

## For judges

**What to look for:** real requests, real gate decisions, real decoys, and real cost-aware AI usage. Normal traffic stays free; novel attacks can trigger NVIDIA NIM; cache/replay keeps repeat attacks cheap.

**Built for GenHacks.** Wèngchéng means “urn city” - an outer defensive city wall that traps intruders before they reach the inner gate.
