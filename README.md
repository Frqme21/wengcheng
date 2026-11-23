# 瓮城 / Wèngchéng: Adaptive Cyber-Deception Grid

A single-process, full-stack cyber-deception platform. Legitimate traffic reaches a realistic mock SaaS portal. Hostile traffic is silently diverted into a synthetic "urn courtyard" of canary decoys, adaptive tarpits, and, only when genuinely novel, an on-demand LLM-generated fake service.

**Zero tokens for normal traffic. Zero Docker required to run locally.**

---

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. The app works offline with procedural decoys even if no API keys are set. Edit `.env` only when you want real AI generated decoys and reports.

Production, where one process serves both the API and the built React app:

```bash
npm run build
npm start
```

Optional model keys, where either one enables AI decoy synthesis and neither means procedural fallback:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NVIDIA_API_KEY` | not set | Primary OpenAI-compatible NVIDIA NIM endpoint |
| `NVIDIA_MODEL` | `meta/llama-3.1-8b-instruct` | NIM model id |
| `OPENROUTER_API_KEY` | not set | Secondary OpenAI-compatible endpoint, used when NVIDIA key is unset |
| `OPENROUTER_MODEL` | `meta-llama/llama-3.1-8b-instruct:free` | OpenRouter model id |
| `PORT` | `3000` | Listen port |
| `DEMO_ADMIN_TOKEN` | not set | When set, protects all simulator actions, reset, the 403 gate, and AI reports |

---

## First demo path

1. Open the dashboard.
2. Click **Take 1-min Tour** beside **Play the whole story**. The tour makes real requests and opens the report.
3. Run `npm run attacker` in a second terminal, or use the simulator buttons in the dashboard.
4. Click a hostile session on the topology map and try **Write a short report** or **Use AI for a deeper report**.
5. Engage the portcullis to show the 403 gate.

If `DEMO_ADMIN_TOKEN` is set, the top bar shows a lock icon. Enter the token there before any simulator action, reset, the 403 gate, AI reports, the tour, or the full story. Telemetry reads and report downloads stay open to everyone.

For the short written pitch, proof points, and demo script, see [PITCH.md](./PITCH.md).

---

## Architecture

```
src/
├─ server/
│  ├─ index.ts        Express bootstrap + Vite middleware / static delivery, WS attach
│  ├─ sentinel.ts     Zero-token deterministic threat classifier (<2ms, no async)
│  ├─ deception.ts    Deception cache, procedural decoys, adaptive tarpit/slow-drip
│  ├─ analyst.ts      Threat narratives, MITRE tags, Markdown/JSON incident reports
│  ├─ llm.ts          OpenAI-compatible NIM / OpenRouter client + JSON repair
│  ├─ state.ts        In-memory telemetry store, sliding windows, lockdown state
│  ├─ portal.ts       Protected "AegisCloud Enterprise Portal" (Inner Citadel)
│  ├─ realtime.ts     WebSocket control plane + one-click judge simulator
│  └─ util.ts         Hashing, path normalisation, seeded RNG, helpers
├─ shared/types.ts    Wire protocol shared by server and client
└─ client/            Vite + React + Tailwind SOC dashboard (SVG topology, drawer, attacker view)
scripts/attacker.py    Standalone external-attacker CLI (stdlib only)
manim/…                Short Manim Community explainer
```

### Token-conservation rules

1. Every request is classified by `sentinel.ts` using pre-compiled regex signatures, path rules, user-agent signatures, and fixed-memory sliding windows. No LLM is involved.
2. Clean traffic calls `next()` immediately. The portal handles it with zero added latency.
3. Suspicious traffic is classified into a `(category + normalized path)` cache key. Known probes such as `/.env`, `/admin`, `/api/users`, and classic SQLi are served from deterministic or cached decoys with 0 tokens.
4. The LLM is woken only for a novel or unknown endpoint, a custom payload with a cache miss, or when an analyst clicks **Use AI for a deeper report**. Calls are capped per session.
5. The generated decoy is cached, so replays cost nothing. The dashboard shows live **Tokens Saved**, **AI Wakeups**, **Tokens Spent**, and average sentinel decision time.

### Endpoints

| Path | Behaviour |
| --- | --- |
| `/portal`, `/portal/api/overview`, `/portal/api/users`, `/portal/api/billing`, `/portal/admin` | Real protected portal, only reached on a PASS verdict |
| `/.env`, `/admin`, `/wp-admin`, `/api/dump` | Synthetic canary responses |
| `/portal/api/v2/ledger/reconcile?...` | Novel probe, wakes the LLM once and caches the result |
| `/api/snapshot` | JSON telemetry snapshot, polling fallback |
| `/api/commands` | POST control-plane commands: simulate, analyze, portcullis, reset |
| `/api/reports/:sessionId.md` and `/api/reports/:sessionId.json` | Downloadable executive incident report |
| `/health` | Health check |
| `/ws` | WebSocket telemetry and simulator response stream |

### Portcullis

Engage manually from the dashboard or through `POST /api/commands` with `{"type":"portcullis","engaged":true}`. Auto-engagement happens after 14 hostile events in 30s or on a severity-5 signature such as command injection. Blocked sessions receive a stylized 403.

---

## Demo script

```bash
# Terminal 1
npm run dev

# Terminal 2, runs recon, novel AI-wakeup probe, and slow-drip tarpit
npm run attacker
```

Click a hostile session pip on the topology map to open the session drawer, then use **Write a short report** or **Use AI for a deeper report**.

---

## Video

```bash
python3 manim/wengcheng_explainer.py
```

This renders every scene and joins them into `manim/output/wengcheng.mp4`. The final video is 1920x1080, 60fps, and about 78 seconds long.

---

## Deployment

The included `Dockerfile` builds the React bundle and compiles the TypeScript server into `dist/server`, then runs a single Node process with `npm start`. Docker is optional for local development.

- **Build command:** `npm run build`
- **Start command:** `npm start`
- **Port:** `$PORT`, default `3000`
- **Health check path:** `/health`

Set `NVIDIA_API_KEY` and/or `OPENROUTER_API_KEY` as environment secrets for AI decoys. Leaving them unset is fully supported.

For a public demo, set `DEMO_ADMIN_TOKEN`. Every control-plane action then requires the token from the `x-demo-token` header, a `?token=` URL, or the lock icon in the top bar. WebSocket command actions use the same guard. Snapshot reads, report downloads, and clean traffic stay public.

---

## Scope and limitations

- This is a demo and research prototype, not a production intrusion prevention system.
- Telemetry is in memory and resets when the process restarts.
- Attacker traffic is generated by the simulator or `scripts/attacker.py`, not by a real network tap.
- AI output is decision support and can be wrong. The short procedural report always works without a model.
- The mock portal contains no real customer data.
