import type { Request, Response } from 'express';
import type { DeceptionCacheEntry } from '../shared/types.js';
import { llm } from './llm.js';
import type { SentinelVerdict } from './sentinel.js';
import { state, DECOYS } from './state.js';
import { hash32, normalizePath, seededRandom, shortId, sleep, truncate } from './util.js';

export const MAX_AI_CALLS_PER_SESSION = 3;

const TARPIT_LATENCY_MS = [400, 900, 1600, 2500, 3500, 3500];

interface DecoyTemplate {
  decoyId: string;
  contentType: string;
  status?: number;
  body: (ctx: DecoyContext) => string;
  drip?: boolean;
}

interface DecoyContext {
  verdict: SentinelVerdict;
  sessionId: string;
  path: string;
  query: string;
  payload: string;
  label?: string;
  ai?: Record<string, unknown>;
}

export interface DeceptionResult {
  status: number;
  contentType: string;
  body: string;
  decoyId: string;
  source: DeceptionCacheEntry['source'];
  cacheKey: string;
  aiWakeup: boolean;
  tokensSaved: number;
  drip: boolean;
  latencyMs: number;
  note?: string;
}

interface BuiltDecoy {
  decoyId: string;
  contentType: string;
  status: number;
  body: string;
  source: DeceptionCacheEntry['source'];
  drip: boolean;
  note?: string;
  aiWakeup?: boolean;
}

function fakeUsers(seed: number, count = 12) {
  const rnd = seededRandom(seed);
  const first = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Drew', 'Harper', 'Quinn'];
  const last = ['Chen', 'Okafor', 'Patel', 'Rossi', 'Nakamura', 'Silva', 'Novak', 'Haddad'];
  return Array.from({ length: count }, (_, i) => ({
    id: `USR-${String(4820 + i + Math.floor(rnd() * 40))}`,
    name: `${first[Math.floor(rnd() * first.length)]} ${last[Math.floor(rnd() * last.length)]}`,
    email: `user${i + 1}@aegiscloud-test.invalid`,
    role: rnd() > 0.75 ? 'finance_admin' : 'member',
    department: ['Treasury', 'Platform', 'Payments', 'Internal Audit'][Math.floor(rnd() * 4)],
    last_login: new Date(Date.now() - Math.floor(rnd() * 60) * 86_400_000).toISOString(),
  }));
}

const ENV_BODY = `# AegisCloud Enterprise Portal. SYNTHETIC SECRET CANARY
NODE_ENV=production
APP_ENV=inner-citadel
DATABASE_URL=postgres://aegis_readonly:F4KE-CANARY-ONLY@db.internal.invalid:5432/aegis_shadow
REDIS_URL=redis://cache.internal.invalid:6379/0
JWT_SECRET=SYNTHETIC_CANARY_TOKEN_NOT_A_REAL_SECRET_9f3a1c
AWS_ACCESS_KEY_ID=AKIAFAKE4DECOY7CANARY
AWS_SECRET_ACCESS_KEY=wengcheng-synthetic-canary-do-not-use
STRIPE_SECRET_KEY=sk_test_FAKE_WENGCHENG_CANARY_ONLY
SLACK_WEBHOOK_URL=https://hooks.slack.test/services/FAKE/DECOY/CANARY
# Any credential above is monitored. Access has been recorded.
`;

const PASSWD_BODY = `root:x:0:0:root:/root:/bin/bash
aegis:x:1000:1000:Aegis Service Account:/srv/aegis:/bin/false
payroll:x:1001:1001:Payroll Sync (synthetic):/srv/payroll:/bin/false
oracle:x:1002:1002:Shadow Ledger Decoy:/srv/oracle:/sbin/nologin
# WENGCHENG CANARY FILE. All reads are logged
`;

const TABLE_DECOYS = [
  { table: 'aegis_shadow_ledger', columns: ['ledger_id', 'entity', 'amount_usd', 'settlement_state'] },
  { table: 'corp_payroll_vault', columns: ['employee_ref', 'band', 'net_amount', 'cycle'] },
  { table: 'inner_citadel_sessions', columns: ['session_ref', 'scope', 'expires_at', 'origin'] },
  { table: 'treasury_reconciliation_v2', columns: ['batch_id', 'currency', 'delta', 'review_flag'] },
];

const TEMPLATES: Record<string, DecoyTemplate> = {
  'recon:.env': {
    decoyId: 'decoy-env-vault',
    contentType: 'text/plain; charset=utf-8',
    body: () => ENV_BODY,
  },
  'recon:.git': {
    decoyId: 'decoy-env-vault',
    contentType: 'application/json',
    body: () => JSON.stringify({
      canary: true,
      repository: 'aegiscloud/inner-citadel (synthetic mirror)',
      refs: ['refs/heads/main', 'refs/heads/release/2026.11'],
      leaked_files: ['.env.production', 'config/deploy.key', 'docs/runbook.md'],
      notice: 'This repository is a monitored deception artifact.',
    }, null, 2),
  },
  'recon:admin': {
    decoyId: 'decoy-auth-db',
    contentType: 'text/html; charset=utf-8',
    body: () => `<!doctype html><html><head><title>AegisCloud :: Inner Citadel Admin</title></head>
<body style="font-family:monospace;background:#080c12;color:#9fb6c6;padding:32px">
<h1 style="color:#00e5ff">AEGISCLOUD / CONTROL PLANE</h1>
<p>Administrative console mirror. <b>SYNTHETIC SESSION</b></p>
<table border="1" cellpadding="8" cellspacing="0" style="border-color:#162231">
<tr><td>bootstrap_token</td><td>eyJmYWtlX2NhbmFyeSI6dHJ1ZSwic2NvcGUiOiJkZWNveSJ9</td></tr>
<tr><td>node</td><td>inner-citadel-03.aegis.invalid</td></tr>
<tr><td>audit</td><td>ALL ACCESS RECORDED BY WENGCHENG</td></tr>
</table></body></html>`,
  },
  'recon:api-users': {
    decoyId: 'decoy-auth-db',
    contentType: 'application/json',
    drip: true,
    body: (ctx) => JSON.stringify({
      _canary: 'WENGCHENG_SYNTHETIC_DIRECTORY',
      total: 2481,
      page: 1,
      data: fakeUsers(hash32(ctx.sessionId + ctx.path)),
    }, null, 2),
  },
  'recon:api-dump': {
    decoyId: 'decoy-auth-db',
    contentType: 'application/json',
    drip: true,
    body: (ctx) => JSON.stringify({
      _canary: 'WENGCHENG_SYNTHETIC_EXPORT',
      export_id: `EXP-${hash32(ctx.sessionId).toString(16).toUpperCase()}`,
      tables: ['aegis_shadow_ledger', 'corp_payroll_vault', 'inner_citadel_sessions'],
      rows: fakeUsers(hash32(ctx.path), 20),
    }, null, 2),
  },
  'sqli:classic': {
    decoyId: 'decoy-auth-db',
    contentType: 'application/json',
    body: (ctx) => JSON.stringify({
      query: 'SELECT * FROM aegis_shadow_ledger WHERE 1=1',
      _deception: 'SYNTHETIC SCHEMA DUMP. CANARY',
      table: 'aegis_shadow_ledger',
      columns: ['ledger_id', 'entity', 'amount_usd', 'settlement_state'],
      rows: [
        { ledger_id: 'LGR-90014', entity: 'Orchid Holdings Ltd', amount_usd: 48210.55, settlement_state: 'cleared' },
        { ledger_id: 'LGR-90015', entity: 'Northwind Trust', amount_usd: 119004.20, settlement_state: 'pending' },
        { ledger_id: 'LGR-90016', entity: 'Kestrel Dynamics', amount_usd: 7310.00, settlement_state: 'cleared' },
      ],
      warning: truncate(ctx.payload, 140),
    }, null, 2),
  },
  'traversal:etc': {
    decoyId: 'decoy-env-vault',
    contentType: 'text/plain; charset=utf-8',
    body: () => PASSWD_BODY,
  },
  'scraping:csv': {
    decoyId: 'tarpit-sink',
    contentType: 'text/csv; charset=utf-8',
    drip: true,
    body: (ctx) => {
      const rnd = seededRandom(hash32(ctx.sessionId));
      const lines = ['ledger_id,entity,amount_usd,cycle,region,canary'];
      for (let i = 0; i < 110; i += 1) {
        lines.push(`LGR-${90000 + i},Synthetic Entity ${i},${(rnd() * 90000).toFixed(2)},2026-Q${1 + Math.floor(rnd() * 4)},APAC,WENGCHENG-DECOY`);
      }
      return `${lines.join('\n')}\n`;
    },
  },
  'novel:generic': {
    decoyId: 'decoy-payroll',
    contentType: 'application/json',
    body: (ctx) => JSON.stringify({
      service: 'AegisCloud Payroll Reconciliation (synthetic)',
      endpoint: ctx.path,
      status: 'degraded',
      canary: true,
      hint: 'Retry with ?page=2&format=csv for the full export.',
      data: fakeUsers(hash32(ctx.path + ctx.sessionId), 6),
    }, null, 2),
  },
};

function pickTemplateKey(verdict: SentinelVerdict, normalized: string): string {
  switch (verdict.category) {
    case 'recon': {
      if (/\.env/.test(normalized)) return 'recon:.env';
      if (/\.git/.test(normalized)) return 'recon:.git';
      if (/api\/(dump|export|backup|secrets|keys)/.test(normalized)) return 'recon:api-dump';
      if (/api\/users|directory|employees/.test(normalized)) return 'recon:api-users';
      return 'recon:admin';
    }
    case 'sqli':
      return 'sqli:classic';
    case 'traversal':
      return 'traversal:etc';
    case 'scraping':
      return 'scraping:csv';
    case 'novel':
    case 'rce':
    default:
      return 'novel:generic';
  }
}

function isNovelPayload(verdict: SentinelVerdict, path: string): boolean {
  if (verdict.category === 'novel') return true;
  const pathname = path.split('?')[0] ?? '';
  return /\/v\d+\/|\/(?:internal|private|debug|graphql|reconcile|ledger)\b/i.test(pathname);
}

function buildProceduralDecoy(ctx: DecoyContext, templateKey: string, novel = false): BuiltDecoy {
  const template = TEMPLATES[templateKey] ?? TEMPLATES['novel:generic']!;
  const seed = hash32(`${ctx.path}|${ctx.payload}|${ctx.sessionId}`);
  const rnd = seededRandom(seed);
  const pick = TABLE_DECOYS[Math.floor(rnd() * TABLE_DECOYS.length)]!;
  let body: string;
  let contentType = template.contentType;
  let decoyId = template.decoyId;

  if (ctx.ai && Object.keys(ctx.ai).length > 0) {
    const ai = ctx.ai;
    const label = typeof ai.decoyLabel === 'string' ? ai.decoyLabel : 'Synthetic Ledger Mirror';
    const table = typeof ai.table === 'string' ? ai.table : pick.table;
    const columns = Array.isArray(ai.columns)
      ? ai.columns.filter((x): x is string => typeof x === 'string').slice(0, 6)
      : pick.columns;
    const rows = Array.isArray(ai.rows)
      ? ai.rows.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null).slice(0, 8)
      : [];
    body = JSON.stringify({
      _canary: 'WENGCHENG_AI_SYNTHESIZED_DECOY',
      service: label,
      table,
      columns: columns.length ? columns : pick.columns,
      rows,
      notice: typeof ai.note === 'string' ? ai.note : 'Synthetic dataset. Access logged for deception analytics.',
      generated_by: llm.providerLabel,
      requested_path: ctx.path,
    }, null, 2);
    contentType = 'application/json';
    decoyId = 'decoy-payroll';
  } else if (novel) {
    // Offline / budget-exhausted novel probes still get a context-aware invented schema.
    const requestedTable =
      ctx.query.match(/"table"\s*:\s*"([^"]+)"/)?.[1] ??
      ctx.query.match(/table=([^&\s"']+)/)?.[1] ??
      ctx.path.split('/').filter(Boolean).slice(-1)[0] ??
      pick.table;
    const table = String(requestedTable).slice(0, 48);
    body = JSON.stringify({
      _canary: 'WENGCHENG_PROCEDURAL_NOVEL_DECOY',
      service: 'Synthetic Ledger Mirror (offline synthesis)',
      table,
      columns: pick.columns,
      rows: fakeUsers(seed, 7),
      notice: `Novel probe synthesised without a model call. ${ctx.path} is a monitored decoy.`,
      generated_by: 'procedural-engine-v2',
      requested_path: ctx.path,
    }, null, 2);
    contentType = 'application/json';
    decoyId = 'decoy-payroll';
  } else {
    body = template.body(ctx);
  }

  return {
    decoyId,
    contentType,
    status: 200,
    body,
    source: ctx.ai ? 'ai' : 'procedural',
    drip: Boolean(template.drip),
    note: ctx.ai ? 'Novel probe served by on-demand AI synthesis.' : 'Context-aware procedural decoy (0 tokens).',
    aiWakeup: Boolean(ctx.ai),
  };
}

/** Write a large decoy export in small chunks to occupy a scanner for as long as possible. */
async function slowDrip(
  res: Response,
  body: string,
  contentType: string,
  level: number,
  decoyId: string,
  source: DeceptionCacheEntry['source'],
  aiWakeup: boolean,
): Promise<void> {
  res.status(200);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Wengcheng-Tarpit', `level-${level}`);
  res.setHeader('X-Wengcheng-Decoy', decoyId);
  res.setHeader('X-Wengcheng-Source', source);
  res.setHeader('X-Wengcheng-Tokens', aiWakeup ? 'ai-called' : '0');
  const size = 170;
  const capped = body.slice(0, size * 42);
  const chunks = capped.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g')) ?? [capped];
  let aborted = false;
  res.on('close', () => { aborted = true; });
  for (const chunk of chunks) {
    if (aborted || res.writableEnded) return;
    res.write(chunk);
    await sleep(Math.max(55, 150 - level * 18));
  }
  if (!aborted && !res.writableEnded) res.end();
}

class DeceptionEngine {
  private sessionAiCalls = new Map<string, number>();
  private inflight = new Map<string, Promise<BuiltDecoy>>();

  reset(): void {
    this.sessionAiCalls.clear();
    this.inflight.clear();
  }

  async respond(req: Request, verdict: SentinelVerdict, sessionId: string): Promise<DeceptionResult> {
    const path = normalizePath(req.path || req.originalUrl || '/');
    const basePath = path.startsWith('/portal') ? path.slice('/portal'.length) || '/' : path;
    const normalized = verdict.category === 'novel' ? normalizePath(req.path).replace(/^\/portal/, '') || '/' : basePath;
    const query = typeof req.query === 'object' && req.query !== null ? JSON.stringify(req.query) : '';
    const cacheKey = `${verdict.category}:${normalized}`;
    const queryPayload = truncate(query, 300);
    const templateKey = pickTemplateKey(verdict, normalized);

    const cached = state.findCache(cacheKey);
    let built: BuiltDecoy;
    let fromCache = false;
    let tokensSaved = 0;

    if (cached) {
      fromCache = true;
      tokensSaved = state.countCacheHit(sessionId, cacheKey);
      built = this.buildFromCache(cached, verdict, sessionId, basePath, queryPayload, templateKey);
    } else {
      const existing = this.inflight.get(cacheKey);
      if (existing) {
        // Identical concurrent probes share the first build and are charged as cache replays.
        fromCache = true;
        let shared: BuiltDecoy | undefined;
        try {
          shared = await existing;
        } catch {
          shared = undefined;
        }
        const fresh = state.findCache(cacheKey);
        tokensSaved = state.countCacheHit(sessionId, cacheKey);
        built = fresh
          ? this.buildFromCache(fresh, verdict, sessionId, basePath, queryPayload, templateKey)
          : (shared ?? this.fallbackProcedural(req, verdict, sessionId, templateKey, queryPayload));
      } else {
        const build = this.buildDecoy(req, verdict, sessionId, cacheKey, normalized, templateKey, query, queryPayload)
          .finally(() => { this.inflight.delete(cacheKey); });
        this.inflight.set(cacheKey, build);
        try {
          built = await build;
        } catch {
          built = this.fallbackProcedural(req, verdict, sessionId, templateKey, queryPayload);
        }
        tokensSaved = built.source === 'ai' ? 0 : state.countHeuristicHit(sessionId);
      }
    }

    // Progressive portcullis-adjacent tarpit: 400ms -> 3500ms.
    const tarpitLevel = state.bumpTarpit(sessionId);
    let latencyMs = TARPIT_LATENCY_MS[Math.min(tarpitLevel, TARPIT_LATENCY_MS.length - 1)] ?? 400;
    if (fromCache) latencyMs = Math.round(latencyMs * 0.72);
    const drip = built.drip && (verdict.category === 'scraping' || tarpitLevel >= 2 || /export|dump|users|csv/.test(basePath));

    return {
      status: built.status,
      contentType: built.contentType,
      body: built.body,
      decoyId: built.decoyId,
      source: built.source,
      cacheKey,
      aiWakeup: built.aiWakeup === true,
      tokensSaved,
      drip,
      latencyMs,
      note: fromCache ? built.note : (built.note ?? 'Deterministic decoy (0 tokens).'),
    };
  }

  private async buildDecoy(
    req: Request,
    verdict: SentinelVerdict,
    sessionId: string,
    cacheKey: string,
    normalized: string,
    templateKey: string,
    query: string,
    queryPayload: string,
  ): Promise<BuiltDecoy> {
    const novel = isNovelPayload(verdict, req.originalUrl || req.path);
    const budgetUsed = this.sessionAiCalls.get(sessionId) ?? 0;
    let ai: Record<string, unknown> | undefined;

    if (novel && budgetUsed < MAX_AI_CALLS_PER_SESSION && llm.configured) {
      this.sessionAiCalls.set(sessionId, budgetUsed + 1);
      ai = (await llm.synthesizeDecoy({
        sessionId,
        category: verdict.category,
        method: req.method,
        path: req.originalUrl || req.path,
        query,
        payload: queryPayload,
        userAgent: String(req.headers['user-agent'] ?? ''),
      })) ?? undefined;
      if (ai) state.countAiWakeup(sessionId);
    }

    const built = buildProceduralDecoy({
      verdict,
      sessionId,
      path: req.originalUrl || req.path,
      query,
      payload: queryPayload,
      ai,
    }, templateKey, novel);

    const entry: DeceptionCacheEntry = {
      key: cacheKey,
      category: verdict.category,
      pathPattern: normalized,
      source: built.source,
      decoyId: built.decoyId,
      hits: 0,
      createdAt: Date.now(),
      preview: truncate(built.body.replace(/\s+/g, ' ').slice(0, 110), 110),
    };
    state.putCache(entry);
    return built;
  }

  private fallbackProcedural(
    req: Request,
    verdict: SentinelVerdict,
    sessionId: string,
    templateKey: string,
    queryPayload: string,
  ): BuiltDecoy {
    return buildProceduralDecoy({
      verdict,
      sessionId,
      path: req.originalUrl || req.path,
      query: '',
      payload: queryPayload,
    }, templateKey, verdict.category === 'novel');
  }

  private buildFromCache(
    entry: DeceptionCacheEntry,
    verdict: SentinelVerdict,
    sessionId: string,
    path: string,
    payload: string,
    templateKey: string,
  ): BuiltDecoy {
    const template = TEMPLATES[templateKey] ?? TEMPLATES['novel:generic']!;
    return {
      decoyId: entry.decoyId,
      contentType: entry.source === 'ai' || verdict.category === 'novel' ? 'application/json' : template.contentType,
      status: 200,
      body: this.cachedBody(entry, verdict, sessionId, path, payload),
      source: entry.source,
      drip: Boolean(template.drip),
      note: `Cache hit · ${entry.hits + 1} replayed probes · 0 tokens`,
      aiWakeup: false,
    };
  }

  /** Rebuild a cached decoy body; cached entries keep a compact preview only. */
  private cachedBody(
    entry: DeceptionCacheEntry,
    verdict: SentinelVerdict,
    sessionId: string,
    path: string,
    payload: string,
  ): string {
    const templateKey = pickTemplateKey(verdict, entry.pathPattern);
    const template = TEMPLATES[templateKey] ?? TEMPLATES['novel:generic']!;
    if (entry.source === 'ai') {
      return JSON.stringify({
        _canary: 'WENGCHENG_AI_DECOY_REPLAY',
        cache_key: entry.key,
        service: 'AI-synthesised synthetic ledger mirror (cached)',
        table: TABLE_DECOYS[hash32(entry.key) % TABLE_DECOYS.length]!.table,
        rows: fakeUsers(hash32(entry.key), 8),
        notice: 'Cached AI decoy replayed with zero additional model calls.',
        generated_by: llm.providerLabel,
        requested_path: path,
      }, null, 2);
    }
    if (verdict.category === 'novel') {
      return buildProceduralDecoy({
        verdict,
        sessionId,
        path,
        query: '',
        payload,
      }, 'novel:generic', true).body;
    }
    return template.body({ verdict, sessionId, path, query: '', payload });
  }

  async send(res: Response, result: DeceptionResult): Promise<void> {
    if (res.writableEnded) return;
    if (result.drip) {
      await sleep(Math.min(220, Math.round(result.latencyMs * 0.3)));
      await slowDrip(
        res,
        result.body,
        result.contentType,
        Math.min(5, Math.round(result.latencyMs / 700)),
        result.decoyId,
        result.source,
        result.aiWakeup,
      );
      return;
    }
    await sleep(result.latencyMs);
    res.status(result.status);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Wengcheng-Decoy', result.decoyId);
    res.setHeader('X-Wengcheng-Source', result.source);
    res.setHeader('X-Wengcheng-Tokens', result.aiWakeup ? 'ai-called' : '0');
    res.send(result.body);
  }

  get decoyIds(): string[] {
    return DECOYS.map((d) => d.id);
  }
}

export const deception = new DeceptionEngine();
export { TEMPLATES, shortId };
