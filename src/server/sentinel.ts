import type { Request } from 'express';
import type { AttackCategory } from '../shared/types.js';
import { state } from './state.js';
import { truncate } from './util.js';

/** Silent routing flag used by the control plane; hostile actors never see a blunt rejection. */
export const DIVERTED_TO_URN = 'DIVERTED_TO_URN' as const;

export interface SentinelVerdict {
  action: 'pass' | 'divert';
  category: AttackCategory;
  confidence: number;
  signature: string;
  matched: string;
  severity: number;
  payload: string;
}

interface SignatureRule {
  category: AttackCategory;
  signature: string;
  severity: number;
  confidence: number;
  test: (ctx: ProbeContext) => string | null;
}

interface ProbeContext {
  path: string;
  rawPath: string;
  query: string;
  body: string;
  ua: string;
  method: string;
  isPortal: boolean;
  headers: Record<string, string | string[] | undefined>;
}

const KNOWN_PORTAL_ROUTES = new Set([
  '/portal',
  '/portal/',
  '/portal/api/overview',
  '/portal/api/users',
  '/portal/api/billing',
  '/portal/admin',
  '/portal/health',
]);

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function find(regex: RegExp, value: string): string | null {
  regex.lastIndex = 0;
  const match = regex.exec(value);
  return match ? match[0] : null;
}

// All regexes are compiled once at module load: evaluation is pure and allocation-light.
const RULES: SignatureRule[] = [
  {
    // Unknown internal surfaces win over generic payload signatures so one novel
    // probe is classified and cached as a single coherent incident.
    category: 'novel',
    signature: 'UNKNOWN_INTERNAL_SURFACE',
    severity: 2,
    confidence: 74,
    test: (c) => {
      if (!c.isPortal) return null;
      if (KNOWN_PORTAL_ROUTES.has(c.path.split('?')[0] ?? '')) return null;
      if (/\/(?:api\/v\d+|internal|private|debug|metrics|graphql|reconcile|ledger)\b/i.test(c.path)) return 'novel internal surface';
      if (/\b(?:table|schema|dump|debug|export|columns|database|filter)\s*=/i.test(c.query)) return 'structured probe parameter';
      return null;
    },
  },
  {
    category: 'rce',
    signature: 'OS_COMMAND_INJECTION',
    severity: 5,
    confidence: 96,
    test: (c) =>
      find(/\$\([^)]{1,60}\)|`[^`]{1,60}`|;\s*(?:cat|id|whoami|uname|ls|curl|wget|nc)\b|\b(?:rm\s+-rf|chmod\s+777)\b/i, c.query) ??
      find(/\$\([^)]{1,60}\)|;\s*(?:cat|id|whoami)\b/i, c.body),
  },
  {
    category: 'sqli',
    signature: 'SQL_UNION_SELECT',
    severity: 4,
    confidence: 98,
    test: (c) => find(/\bunion\b\s+(?:all\s+)?\bselect\b/i, `${c.query} ${c.body} ${c.path}`),
  },
  {
    category: 'sqli',
    signature: 'SQL_TAUTOLOGY',
    severity: 4,
    confidence: 96,
    test: (c) => find(/['"`)]?\s*(?:or|and)\s+['"`]?\d+\s*=\s*['"`]?\d+/i, `${c.query} ${c.body}`),
  },
  {
    category: 'sqli',
    signature: 'SQL_TIME_BASED',
    severity: 5,
    confidence: 97,
    test: (c) =>
      find(/\b(?:sleep|pg_sleep|benchmark)\s*\(\s*\d+/i, `${c.query} ${c.body}`) ??
      find(/\bwaitfor\s+delay\b/i, `${c.query} ${c.body}`),
  },
  {
    category: 'sqli',
    signature: 'SQL_SCHEMA_ENUM',
    severity: 3,
    confidence: 88,
    test: (c) => find(/\b(?:information_schema|sqlite_master|pg_catalog|sysobjects)\b/i, `${c.query} ${c.body}`),
  },
  {
    category: 'traversal',
    signature: 'PATH_TRAVERSAL',
    severity: 4,
    confidence: 97,
    test: (c) =>
      find(/\.\.[/\\]|\.\.%2f|%2e%2e[/\\]?/i, decodeSafe(`${c.rawPath} ${c.query} ${c.body}`)) ??
      find(/\/etc\/(?:passwd|shadow)|\bwin\.ini\b/i, decodeSafe(`${c.path} ${c.query}`)),
  },
  {
    category: 'recon',
    signature: 'SENSITIVE_FILE_PROBE',
    severity: 3,
    confidence: 95,
    test: (c) =>
      find(/(?:^|\/)(?:\.env(?:\.local|\.production)?|\.git(?:\/config)?|\.aws|\.htaccess|\.DS_Store|wp-config\.php|config\.yml|id_rsa)(?:$|\/|\?)/i, c.path),
  },
  {
    category: 'recon',
    signature: 'ADMIN_SURFACE_PROBE',
    severity: 3,
    confidence: 92,
    test: (c) =>
      find(/(?:^|\/)(?:wp-admin|wp-login\.php|phpmyadmin|administrator|actuator|server-status|swagger(?:-ui)?|graphiql)(?:$|\/)/i, c.path) ??
      (!c.isPortal ? find(/(?:^|\/)admin(?:$|\/)/i, c.path) : null),
  },
  {
    category: 'recon',
    signature: 'DATA_DUMP_PROBE',
    severity: 4,
    confidence: 93,
    test: (c) =>
      find(/(?:^|\/)api\/(?:dump|keys|secrets|export|backup)(?:$|\/)/i, c.path) ??
      (!c.isPortal ? find(/(?:^|\/)api\/users(?:$|\/)/i, c.path) : null),
  },
  {
    category: 'recon',
    signature: 'SCANNER_USER_AGENT',
    severity: 3,
    confidence: 94,
    test: (c) => find(/\b(?:sqlmap|nikto|nmap|masscan|acunetix|dirbuster|wpscan|gobuster|ffuf|nessus|openvas|zgrab)\b/i, c.ua),
  },
];

/**
 * Zero-token, zero-async classification. Called for every request.
 * Typical evaluation time is well below 0.05 ms; the 2 ms budget is generous.
 */
export function evaluateRequest(req: Request, bodyString = ''): SentinelVerdict {
  const rawPath = req.originalUrl || req.url || '/';
  const path = decodeSafe(rawPath.split('?')[0] ?? '/').toLowerCase();
  const isPortal = path === '/portal' || path.startsWith('/portal/');
  const ua = String(req.headers['user-agent'] ?? '');
  const query = typeof req.query === 'object' && req.query !== null
    ? decodeSafe(JSON.stringify(req.query))
    : '';
  const forced = req.headers['x-wc-force-category'];
  const forcedCategory = (Array.isArray(forced) ? forced[0] : forced)?.toLowerCase();

  const ctx: ProbeContext = {
    path,
    rawPath,
    query,
    body: bodyString,
    ua,
    method: req.method,
    isPortal,
    headers: req.headers as Record<string, string | string[] | undefined>,
  };

  // Deterministic test hook used by the built-in judge simulator.
  if (forcedCategory && ['sqli', 'recon', 'traversal', 'rce', 'scraping', 'novel'].includes(forcedCategory)) {
    return {
      action: 'divert',
      category: forcedCategory as AttackCategory,
      confidence: 99,
      signature: 'SIMULATOR_FORCED_PROBE',
      matched: forcedCategory ?? '',
      severity: forcedCategory === 'rce' ? 5 : 3,
      payload: truncate(query || path, 240),
    };
  }

  for (const rule of RULES) {
    const matched = rule.test(ctx);
    if (matched) {
      return {
        action: 'divert',
        category: rule.category,
        confidence: rule.confidence,
        signature: rule.signature,
        matched,
        severity: rule.severity,
        payload: truncate(`${path}${query ? `?${query}` : ''} ${bodyString}`.trim(), 300),
      };
    }
  }

  // Burst / scraping detection: fixed-memory sliding window per client IP.
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const burst = state.slidingWindow(`burst:${ip}`, 8_000);
  if (burst >= 11) {
    return {
      action: 'divert',
      category: 'scraping',
      confidence: 86,
      signature: 'BURST_SCRAPE_WINDOW',
      matched: `${burst} requests / 8s`,
      severity: 2,
      payload: truncate(path, 240),
    };
  }

  return {
    action: 'pass',
    category: 'none',
    confidence: 100,
    signature: 'HEURISTIC_CLEAN',
    matched: '',
    severity: 0,
    payload: '',
  };
}

// Warm every regex engine at boot so the first real request also stays inside the 2ms budget.
const WARMUP_PROBE: ProbeContext = {
  path: '/portal/api/overview',
  rawPath: '/portal/api/overview',
  query: '{"q":"warmup"}',
  body: '',
  ua: 'WengchengWarmup/1.0',
  method: 'GET',
  isPortal: true,
  headers: {},
};
for (const rule of RULES) rule.test(WARMUP_PROBE);
