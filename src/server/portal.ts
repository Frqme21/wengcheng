import { Router, type Request, type Response } from 'express';
import { escapeHtml } from './util.js';

export const portal = Router();

const USERS = [
  { id: 'USR-1001', name: 'Amara Okafor', email: 'amara.okafor@aegiscloud.example', role: 'Treasury Analyst', status: 'active' },
  { id: 'USR-1002', name: 'Daniel Weiss', email: 'daniel.weiss@aegiscloud.example', role: 'Platform Engineer', status: 'active' },
  { id: 'USR-1003', name: 'Priya Raman', email: 'priya.raman@aegiscloud.example', role: 'Compliance Lead', status: 'active' },
  { id: 'USR-1004', name: 'Sofia Marchetti', email: 'sofia.marchetti@aegiscloud.example', role: 'Finance Admin', status: 'invited' },
];

const BILLING = [
  { invoice: 'INV-2026-1104', plan: 'Enterprise Treasury', amount: 48200, currency: 'USD', status: 'paid', due: '2026-11-01' },
  { invoice: 'INV-2026-1201', plan: 'Audit Archive Add-on', amount: 3800, currency: 'USD', status: 'open', due: '2026-12-01' },
];

function shell(title: string, inner: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · AegisCloud Enterprise Portal</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#070b11;color:#d9e6ee;font-family:Inter,system-ui,sans-serif}
header{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;border-bottom:1px solid #162231;background:#0a1018}
.brand{font-weight:800;letter-spacing:.08em;color:#00e5ff}.brand span{color:#7b93a5;font-weight:500;font-size:12px;letter-spacing:.02em}
nav a{color:#8fa6b5;margin-left:22px;text-decoration:none;font-size:13px}nav a:hover{color:#00e5ff}
main{max-width:1080px;margin:48px auto;padding:0 28px}h1{font-size:30px;margin:0 0 8px}p.sub{color:#7b93a5;margin:0 0 32px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.card{background:#0b121b;border:1px solid #162231;border-radius:10px;padding:22px}
.card .k{color:#7b93a5;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.card .v{font-size:30px;font-weight:700;margin-top:10px;color:#00e5ff}
table{width:100%;border-collapse:collapse;margin-top:20px}td,th{text-align:left;padding:12px;border-bottom:1px solid #162231;font-size:13px}th{color:#7b93a5;font-weight:500}
.badge{display:inline-block;padding:3px 9px;border:1px solid #1b6f78;border-radius:100px;color:#00e5ff;font-size:11px}
footer{max-width:1080px;margin:60px auto;padding:18px 28px;border-top:1px solid #162231;color:#516779;font-size:11px}
</style></head><body>
<header><div class="brand">AEGISCLOUD <span>ENTERPRISE PORTAL · INNER CITADEL</span></div>
<nav><a href="/portal/api/overview">Overview</a><a href="/portal/api/users">Directory</a><a href="/portal/api/billing">Billing</a><a href="/portal/admin">Admin</a></nav></header>
<main>${inner}</main>
<footer>Protected production surface. Any anomalous request is routed to the outer deception grid.</footer>
</body></html>`;
}

portal.get('/', (_req: Request, res: Response) => {
  res.type('html').send(shell('Overview', `
    <span class="badge">PRODUCTION · PROTECTED</span>
    <h1 style="margin-top:18px">Good morning, operator.</h1>
    <p class="sub">AegisCloud Enterprise Portal. Inner Citadel. This is the real protected application.</p>
    <div class="grid">
      <div class="card"><div class="k">Transactions today</div><div class="v">12,481</div></div>
      <div class="card"><div class="k">Settled volume</div><div class="v">$8.42M</div></div>
      <div class="card"><div class="k">Active tenants</div><div class="v">248</div></div>
    </div>`));
});

portal.get('/api/overview', (_req: Request, res: Response) => {
  res.json({
    service: 'aegiscloud-enterprise-portal',
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
  res.json({ account: 'AEGIS-ENT-0042', currency: 'USD', invoices: BILLING });
});

portal.get('/admin', (_req: Request, res: Response) => {
  res.type('html').send(shell('Control Plane', `
    <span class="badge">AUTHORIZED SESSION</span>
    <h1 style="margin-top:18px">Administrative Control Plane</h1>
    <p class="sub">Real production administration surface. Sentinel heuristics allow this exact path through.</p>
    <div class="grid">
      <div class="card"><div class="k">Cluster</div><div class="v">inner-citadel-03</div></div>
      <div class="card"><div class="k">Policy</div><div class="v">LOCKED</div></div>
    </div>
    <table><tr><th>Module</th><th>State</th></tr>
      <tr><td>Ledger replication</td><td>healthy</td></tr>
      <tr><td>Audit archive</td><td>healthy</td></tr>
      <tr><td>Deception grid uplink</td><td>connected</td></tr>
    </table>`));
});

portal.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, zone: 'inner-citadel', ts: Date.now() });
});
