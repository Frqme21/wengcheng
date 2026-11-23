<div align="center">
  <img src="public/og.png" alt="Wèngchéng dashboard" width="920" />
  <h1>Wèngchéng / 瓮城</h1>
  <p><strong>A fake city behind a real front door.</strong></p>
  <p>Normal users reach the real app. Attackers get convincing decoys. AI wakes up only when the request is novel.</p>

  <p>
    <a href="https://c8b7bb6b.wengcheng.pages.dev"><img src="https://img.shields.io/badge/live-static_preview-f97316?style=for-the-badge" alt="Live preview" /></a>
    <img src="https://img.shields.io/badge/NVIDIA-NIM-76b900?style=for-the-badge&logo=nvidia&logoColor=white" alt="NVIDIA NIM" />
    <img src="https://img.shields.io/badge/node-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 20+" />
  </p>
</div>

## What Wèngchéng does

Wèngchéng sits in front of a protected portal called Aegis Cloud. Every request gets a fast deterministic verdict before any model call happens.

| Verdict | What the attacker sees | AI cost |
|---|---|---:|
| PASS | The real portal | 0 |
| DIVERT | A cached or procedural decoy | 0 on cache hit |
| WAKE | A newly synthesized decoy for a novel probe | 1 wakeup on cache miss |
| BLOCKED | A 403 when the portcullis gate is on | 0 |

The useful part is the split: clean traffic stays cheap, and the expensive model call only happens when the sentinel sees something new.

## Try it locally

```bash
npm install
cp .env.example .env
npm run dev
```

- Dashboard: http://localhost:3000
- Portal: http://localhost:3000/portal
- Health: http://localhost:3000/health

It works without API keys. With no keys, Wèngchéng uses offline procedural decoys and reports.

## NVIDIA NIM

Set these in `.env` on the backend:

```bash
NVIDIA_API_KEY=your_key_here
NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b
LLM_TIMEOUT_MS=90000
# optional
NVIDIA_ENABLE_THINKING=true
```

If `NVIDIA_API_KEY` is set, the backend uses NVIDIA NIM. If `OPENROUTER_API_KEY` is set instead, it uses OpenRouter. If neither is set, it stays in offline procedural mode.

Do not commit keys. Use `.env` locally and secrets in your deployment platform.

## Live frontend preview

The static Pages frontend is deployed at https://c8b7bb6b.wengcheng.pages.dev. It shows the interface and explains how to connect a live backend. To make it fully live, deploy the backend and rebuild the frontend with:

```bash
cd redesign
VITE_API_BASE=https://your-backend.example.com npm run build
npx wrangler pages deploy dist --project-name wengcheng --branch main
```

## Repo layout

```text
src/server/      Express backend, sentinel, deception, LLM, realtime, portal
src/client/      Main dashboard frontend
src/shared/      Shared wire types
redesign/        Clean standalone frontend wired to the real backend
scripts/         Attacker simulation and submission verification
```

## Backend deployment

The backend is a Node process with Express and WebSockets. Cloudflare Pages can host the static frontend, but the backend needs a Node runtime.

```bash
npm run build
npm start
```

Docker:

```bash
docker build -t wengcheng .
docker run -p 3000:3000 --env-file .env wengcheng
```

## For judges

Run `npm run dev`, open the dashboard, and click **Take the guided tour**. Then turn the 403 gate off, send a **Novel probe**, and watch the AI wakeup counter change when NIM is configured. The cache hit after that shows the cost-saving path.
