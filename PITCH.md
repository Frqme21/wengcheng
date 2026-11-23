# Wèngchéng: Adaptive Cyber-Deception Grid

## One-line pitch

Wèngchéng puts a zero-token threat gate in front of your services, sends attackers into realistic fake systems, and wakes an LLM only when something genuinely new appears.

## 30-second pitch

Most AI security tools send too much traffic to a model. That is slow, expensive, and easy for attackers to waste. Wèngchéng uses a fast deterministic sentinel to handle ordinary probes from cache, then diverts hostile visitors into a synthetic courtyard of canary files, fake admin pages, slow tarpits, and adaptive decoys. Only novel probes wake an LLM to generate a new fake service. The dashboard shows what the attacker tried, how much time they lost, how many tokens were saved, and a downloadable incident report.

## Problem

Attackers constantly probe websites with repeated, low-value requests.

Sending all of that traffic to an LLM creates three problems:

1. Cost grows with every scan, even when the probe is identical to one seen before.
2. Latency increases for suspicious traffic.
3. Attackers can deliberately burn model budget with noisy, repetitive requests.

At the same time, defenders need useful threat intelligence. Blocking everything gives them very little information about attacker intent.

## Insight

Most hostile traffic is not novel.

Common probes such as `/.env`, `/admin`, SQL injection strings, and scraper paths repeat across attackers. They do not need a model each time. They need a fast classifier, a realistic decoy, and a memory of what already worked.

The model should be reserved for the small set of requests that are new, strange, or worth explaining in a report.

## Solution

Wèngchéng is a single-process full-stack demo with four layers:

1. **Sentinel**: a deterministic, zero-token classifier that decides PASS, DIVERT, or BLOCK in under 2ms.
2. **Deception grid**: cached fake responses, canary endpoints, adaptive tarpits, and a simulated protected portal.
3. **On-demand AI decoys**: an LLM is called only for novel probes or a deeper report requested by an analyst. Results are cached.
4. **Analyst dashboard**: live topology, session drawer, token accounting, incident reports, and a 1-minute guided tour.

## How it works

1. A request arrives.
2. The sentinel checks path rules, signatures, user agents, and short-window behavior.
3. Clean traffic reaches the mock SaaS portal.
4. Known hostile traffic is diverted into a decoy that costs 0 tokens.
5. Novel hostile traffic wakes the configured model once, then caches the generated decoy.
6. Repeated probes hit the cache.
7. The dashboard records diverted sessions, attacker time wasted, AI wakeups, tokens saved, and tokens spent.
8. An analyst can generate a short procedural report or a deeper AI report, then download Markdown or JSON.

## Live demo flow, 3 minutes

| Time | Action | Message |
| --- | --- | --- |
| 0:00 to 0:20 | Frame the problem | LLM-first security wastes budget on repeat probes |
| 0:20 to 0:45 | Show clean traffic | Legitimate users pass to the portal with no added model call |
| 0:45 to 1:25 | Run recon or SQLi probe | Hostile traffic is diverted into canary decoys, not the real portal |
| 1:25 to 1:55 | Trigger a novel probe | One AI wakeup generates a fake service, then caches it |
| 1:55 to 2:25 | Open a hostile session | Show the incident report and download options |
| 2:25 to 2:50 | Engage the portcullis | Repeat offenders receive a stylized 403 |
| 2:50 to 3:00 | Close on metrics | Tokens saved, AI wakeups, diverted sessions, attacker time wasted |

Fastest path for a judge: if the lock icon is shown, enter the demo token, then click **Take 1-min Tour** beside **Play the whole story**. The tour performs real requests and ends on the 403 gate.

## Proof to show

Use these as sample numbers from a real local smoke run. Exact values vary by run.

| Signal | Sample result |
| --- | --- |
| Requests | 10 |
| Diverted | 8 |
| AI wakeups | 2 |
| Tokens saved | 6,760 |
| Tokens spent | 1,118 |
| Sessions | 5 |
| Hostile events | 8 |

Also show:

- The topology map changing as sessions arrive.
- The attacker terminal receiving actual HTTP replies from decoys.
- The token counters updating after an AI wakeup.
- A downloaded Markdown or JSON incident report.
- The final 1920x1080, 60fps explainer video at `manim/output/wengcheng.mp4`.

## Why now

LLMs are cheap enough to generate believable fake services on demand, but still expensive enough that careless use is a real design problem. Wèngchéng shows a practical pattern for AI use in security: deterministic first, model second, cache always.

## Who cares

- Small security teams that need attacker intelligence without a large SOC.
- Product teams that want deception and tarpits in front of mock or legacy services.
- Educators and CTF organizers who want a visual, safe way to teach attacker behavior.
- Hackathon judges looking for an AI project with restraint, clear metrics, and a real demo.

## What makes this different

- The AI is not the whole product. It is a tool used only where it adds value.
- Token savings are visible, not claimed.
- The attacker experience is part of the demo, through real HTTP responses and a standalone CLI.
- The dashboard explains itself in plain English and includes a guided tour.
- Decoys are adaptive and cached, so repeated attacks become cheaper for the defender and more frustrating for the attacker.

## Why this fits GenHacks

- **Execution:** full-stack app, WebSockets, real HTTP command plane, downloadable reports, and a rendered explainer video.
- **AI use:** the model is invoked selectively, with telemetry showing spend and savings.
- **Security relevance:** deception, canaries, tarpits, MITRE tags, and a clear defensive framing.
- **User experience:** calm visual design, short guided tour, and one clear action per area.
- **Story:** easy to understand in 30 seconds and demo in 3 minutes.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Public demo state or model spend can be changed through `/api/commands` | Set `DEMO_ADMIN_TOKEN`. Every control action needs a token from the top bar lock, a `?token=` URL, or the `x-demo-token` header |
| LLM key missing or provider unavailable | The app falls back to procedural decoys and the short report still works |
| Judges may not understand deception at first | Lead with "attackers waste time, your model budget does not" |
| Dashboard looks complex on first load | Start with the 1-minute tour instead of explaining every panel |
| AI output can be wrong | Frame reports as decision support and keep the procedural report available |
| Hosted demo fails during the pitch | Keep a local backup running with `npm run dev` and record a backup video demo |

## Known limitations

- This is a prototype, not a production intrusion prevention system.
- Traffic is generated by the simulator and `scripts/attacker.py`, not by a real network tap.
- Telemetry is in memory and resets on restart.
- The mock portal contains no real customer data.
- The model can produce imperfect text and should not be treated as ground truth.

## Closing line

Wèngchéng makes attackers work for every byte while your model budget stays with the moments that matter.
