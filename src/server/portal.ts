import { Router, type Request, type Response } from 'express';
import { escapeHtml } from './util.js';

export const portal = Router();

const USERS = [
  { id: 'USR-1001', name: 'Amara Okafor', email: 'amara.okafor@wengcheng.example', role: 'Treasury Analyst', status: 'active' },
  { id: 'USR-1002', name: 'Daniel Weiss', email: 'daniel.weiss@wengcheng.example', role: 'Platform Engineer', status: 'active' },
  { id: 'USR-1003', name: 'Priya Raman', email: 'priya.raman@wengcheng.example', role: 'Compliance Lead', status: 'active' },
  { id: 'USR-1004', name: 'Sofia Marchetti', email: 'sofia.marchetti@wengcheng.example', role: 'Finance Admin', status: 'invited' },
];

const BILLING = [
  { invoice: 'INV-2026-1104', plan: 'Enterprise Treasury', amount: 48200, currency: 'USD', status: 'paid', due: '2026-11-01' },
  { invoice: 'INV-2026-1201', plan: 'Audit Archive Add-on', amount: 3800, currency: 'USD', status: 'open', due: '2026-12-01' },
];

const EASE = 'cubic-bezier(0.16,1,0.3,1)';

function brandName(): string {
  return 'Wèngchéng'
    .split('')
    .map((letter, index) => `<span style="animation-delay:${index * 45}ms">${escapeHtml(letter)}</span>`)
    .join('');
}

function shell(title: string, inner: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Wèngchéng Inner Ward</title>
<meta name="description" content="The protected ward behind the Wèngchéng front gate.">
<style>
:root{
  --paper:oklch(0.9588 0.0127 86.8);
  --card:oklch(0.9795 0.0098 87.5);
  --raised:oklch(0.9354 0.0173 84.6);
  --line:oklch(0.8661 0.018 81.3);
  --line-soft:oklch(0.9114 0.0162 82.8);
  --ink:oklch(0.2773 0.0157 224.2);
  --muted:oklch(0.5008 0.0151 208.7);
  --faint:oklch(0.5248 0.0096 156.9);
  --teal:oklch(0.5021 0.0651 200.9);
  --ease:${EASE};
  --display:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
}
*,*::before,*::after{box-sizing:border-box}
html{overflow-x:hidden}
body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:clamp(0.875rem,0.86rem + 0.1vw,0.9375rem);line-height:1.55;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:100;background:var(--teal);transform-origin:left center;pointer-events:none;animation:ward-wipe 560ms var(--ease) both}
h1,h2,h3{font-family:var(--display);letter-spacing:-0.03em;font-weight:600}
header{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px;padding:16px 24px;border-bottom:1px solid var(--line-soft);background:var(--paper);animation:ward-fade 300ms var(--ease) backwards}
.brand{display:inline-flex;align-items:center;gap:16px}
.seal{display:inline-flex;width:40px;height:40px;align-items:center;justify-content:center;border:1px solid color-mix(in oklch,var(--teal) 40%,transparent);border-radius:12px;background:color-mix(in oklch,var(--teal) 8%,transparent);color:var(--teal);font-family:var(--display);font-size:20px;font-weight:700;line-height:1;animation:seal-in 520ms var(--ease) backwards;transition:transform 260ms var(--ease),background-color 260ms var(--ease)}
.seal:hover{transform:translate3d(0,-4px,0) rotate(-6deg);background:color-mix(in oklch,var(--teal) 14%,transparent)}
.brand-name{display:inline-flex;font-family:var(--display);font-size:16px;font-weight:600;letter-spacing:-0.02em}
.brand-name>span{display:inline-block;animation:letter-in 420ms var(--ease) backwards}
.brand-note{color:var(--faint);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase}
nav{display:flex;flex-wrap:wrap;gap:8px}
nav a{display:inline-flex;min-height:44px;align-items:center;padding:0 16px;border-radius:8px;color:var(--muted);font-size:13px;text-decoration:none;transition:background-color 180ms var(--ease),color 180ms var(--ease),transform 180ms var(--ease)}
nav a:hover{background:var(--raised);color:var(--teal);transform:translate3d(0,-2px,0)}
nav a:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
main{width:clamp(320px,92vw,1120px);margin:0 auto;padding:64px 24px 96px}
.head{display:flex;flex-direction:column;gap:24px;max-width:65ch}
h1{margin:0;font-size:clamp(1.75rem,3.4vw,2.5rem);line-height:1.15}
p.sub{max-width:65ch;margin:0;color:var(--muted);font-size:clamp(0.875rem,1vw,1rem)}
.badge{display:inline-flex;min-height:32px;align-items:center;padding:8px 16px;border:1px solid color-mix(in oklch,var(--teal) 40%,transparent);border-radius:999px;background:color-mix(in oklch,var(--teal) 8%,transparent);color:var(--teal);font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;animation:ward-rise 360ms var(--ease) backwards}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;margin-top:48px}
.grid .card{animation:ward-rise 400ms var(--ease) backwards}
.grid .card:nth-child(1){animation-delay:80ms}.grid .card:nth-child(2){animation-delay:130ms}.grid .card:nth-child(3){animation-delay:180ms}.grid .card:nth-child(4){animation-delay:230ms}
.card{padding:32px;border:1px solid var(--line);border-radius:16px;background:var(--card);transition:transform 220ms var(--ease),border-color 220ms var(--ease),box-shadow 220ms var(--ease)}
.card:hover{transform:translate3d(0,-2px,0);border-color:color-mix(in oklch,var(--teal) 45%,var(--line));box-shadow:0 12px 28px -20px oklch(0.25 0.018 210 / 0.35)}
.card .k{color:var(--faint);font-size:11px;text-transform:uppercase;letter-spacing:0.12em}
.card .v{margin-top:16px;font-family:var(--display);font-size:clamp(1.75rem,2.6vw,2.25rem);font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;color:var(--ink)}
table{width:100%;margin-top:48px;border:1px solid var(--line);border-radius:16px;border-collapse:separate;border-spacing:0;overflow:hidden;background:var(--card);animation:ward-rise 440ms var(--ease) backwards;animation-delay:240ms}
th,td{padding:16px 24px;border-bottom:1px solid var(--line-soft);text-align:left;font-size:13px}
th{color:var(--faint);font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase}
tr:last-child td{border-bottom:none}
tbody tr{animation:ward-rise 360ms var(--ease) backwards}
tbody tr:nth-child(1){animation-delay:280ms}tbody tr:nth-child(2){animation-delay:320ms}tbody tr:nth-child(3){animation-delay:360ms}tbody tr:nth-child(4){animation-delay:400ms}
footer{width:clamp(320px,92vw,1120px);margin:0 auto;padding:32px 24px 48px;border-top:1px solid var(--line-soft);color:var(--faint);font-size:12px;animation:ward-fade 400ms var(--ease) backwards;animation-delay:320ms}
@keyframes ward-wipe{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@keyframes ward-fade{from{opacity:0}to{opacity:1}}
@keyframes ward-rise{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@keyframes seal-in{from{opacity:0;transform:translate3d(0,-16px,0) scale(0.6) rotate(-12deg)}to{opacity:1;transform:translate3d(0,0,0) scale(1) rotate(0)}}
@keyframes letter-in{from{opacity:0;transform:translate3d(0,8px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
</style></head><body>
<header>
  <div class="brand">
    <span class="seal" aria-hidden="true">瓮</span>
    <span class="brand-name" aria-label="Wèngchéng">${brandName()}</span>
    <span class="brand-note">Inner Citadel · Protected Ward</span>
  </div>
  <nav aria-label="Ward sections">
    <a href="/portal/api/overview">Ward</a>
    <a href="/portal/api/users">Residents</a>
    <a href="/portal/api/billing">Ledger</a>
    <a href="/portal/admin">Gate House</a>
  </nav>
</header>
<main>${inner}</main>
<footer>Wèngchéng · Inner Citadel. Anomalous requests are routed to the outer deception grid.</footer>
</body></html>`;
}

portal.get('/', (_req: Request, res: Response) => {
  res.type('html').send(shell('Ward Desk', `
    <div class="head">
      <span class="badge">Protected ward</span>
      <h1>Good morning, keeper.</h1>
      <p class="sub">Wèngchéng Inner Citadel. The quiet front office behind the front gate.</p>
    </div>
    <div class="grid">
      <div class="card"><div class="k">Ledger entries today</div><div class="v">12,481</div></div>
      <div class="card"><div class="k">Settled volume</div><div class="v">$8.42M</div></div>
      <div class="card"><div class="k">Active households</div><div class="v">248</div></div>
    </div>`));
});

portal.get('/api/overview', (_req: Request, res: Response) => {
  res.json({
    service: 'wengcheng-inner-citadel',
    environment: 'inner-citadel',
    status: 'operational',
    metrics: { transactions_today: 12481, settled_volume_usd: 8420000, active_tenants: 248, uptime_pct: 99.99 },
    region: 'ap-southeast-1',
    generated_at: new Date().toISOString(),
  });
});

portal.get('/api/users', (_req: Request, res: Response) => {
  res.json({ total: USERS.length, data: USERS });
});

portal.get('/api/billing', (_req: Request, res: Response) => {
  res.json({ account: 'WENG-WARD-0042', currency: 'USD', invoices: BILLING });
});

portal.get('/admin', (_req: Request, res: Response) => {
  res.type('html').send(shell('Gate House', `
    <div class="head">
      <span class="badge">Gate keeper access</span>
      <h1>Gate House</h1>
      <p class="sub">Wèngchéng Inner Citadel. Hostile traffic stops here while residents pass through.</p>
    </div>
    <div class="grid">
      <div class="card"><div class="k">Ward cluster</div><div class="v">inner-citadel-03</div></div>
      <div class="card"><div class="k">Policy</div><div class="v">LOCKED</div></div>
    </div>
    <table><thead><tr><th>Module</th><th>State</th></tr></thead><tbody>
      <tr><td>Ledger replication</td><td>healthy</td></tr>
      <tr><td>Audit archive</td><td>healthy</td></tr>
      <tr><td>Outer grid uplink</td><td>connected</td></tr>
    </tbody></table>`));
});

portal.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, zone: 'inner-citadel', ts: Date.now() });
});
