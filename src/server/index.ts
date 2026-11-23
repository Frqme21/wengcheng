import 'dotenv/config';
import { createServer as createHttpServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { ViteDevServer } from 'vite';
import { analyst } from './analyst.js';
import { demoAdminRequired, DemoAuthError } from './config.js';
import { deception } from './deception.js';
import { llm } from './llm.js';
import { portal } from './portal.js';
import { handleCommand, currentSnapshot, attachRealtime } from './realtime.js';
import { DIVERTED_TO_URN, evaluateRequest } from './sentinel.js';
import { state } from './state.js';
import { shortId } from './util.js';
import type { ClientCommand, Disposition, RequestEvent } from '../shared/types.js';

const isDev = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT || 3000);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'wengcheng', mode: isDev ? 'development' : 'production', llm: llm.mode });
});

app.get('/api/snapshot', (_req, res) => {
  res.json(currentSnapshot());
});

app.post('/api/commands', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const headerToken = req.get('x-demo-token');
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const bodyToken = typeof body.token === 'string' ? body.token : undefined;
    const token = bodyToken || headerToken || queryToken;
    await handleCommand({ ...body, token } as ClientCommand);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof DemoAuthError) {
      res.status(error.status).json({ error: 'demo_token_required', message: error.message });
      return;
    }
    next(error);
  }
});

app.get('/api/reports/:file', (req, res) => {
  const match = req.params.file?.match(/^(.+)\.(md|json)$/);
  if (!match) {
    res.status(400).json({ error: 'expected .md or .json report' });
    return;
  }
  // Express has already decoded the route parameter. A second decode could throw on a literal '%'.
  const sessionId = match[1] ?? '';
  const format = match[2];
  const session = state.sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  const analysis = session.analysis ?? analyst.summarizeOnIdle(session);
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (format === 'md') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wengcheng-${safeId}.md"`);
    res.send(analyst.markdown(session, analysis));
  } else {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wengcheng-${safeId}.json"`);
    res.send(analyst.json(session, analysis));
  }
});

function isLoopback(req: Request): boolean {
  const candidates = [req.socket.remoteAddress, req.ip]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/^::ffff:/, ''));
  return candidates.some((value) => value === '127.0.0.1' || value === '::1');
}

function bypassSentinel(pathname: string): boolean {
  return (
    pathname === '/health' ||
    pathname === '/ws' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/@') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    pathname.startsWith('/favicon') ||
    /\.(?:tsx?|jsx?|css|svg|png|jpe?g|ico|woff2?|map)$/i.test(pathname)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zero-token outer gate sentinel. One deterministic evaluation per request.
// ─────────────────────────────────────────────────────────────────────────────
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const started = performance.now();
  const pathname = req.path || '/';
  if (bypassSentinel(pathname)) return next();

  const verdict = evaluateRequest(req);
  const decisionMicros = (performance.now() - started) * 1000;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ua = String(req.headers['user-agent'] ?? '');
  const simId = req.headers['x-wc-sim-id'];
  const rawSessionId = Array.isArray(simId) ? simId[0] : simId;
  const forcedSession = isLoopback(req) ? rawSessionId : undefined;
  const session = state.getOrCreateSession(ip, ua, forcedSession || undefined);

  state.applyDecision(session.id, verdict.category, verdict.action === 'divert', decisionMicros);

  if (verdict.action === 'pass') {
    // Legitimate traffic never touches the deception engine or any LLM client.
    return next();
  }

  const baseEvent = {
    id: shortId('EVT'),
    at: Date.now(),
    sessionId: session.id,
    method: req.method,
    path: (req.originalUrl || req.path).slice(0, 300),
    category: verdict.category,
    signature: verdict.signature,
    route: DIVERTED_TO_URN,
    source: (forcedSession ? 'simulator' : 'network') as 'simulator' | 'network',
  };

  if (state.lockdown.engaged) {
    session.portcullis = true;
    session.status = 'contained';
    res.status(403);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Wengcheng-Portcullis', 'ENGAGED');
    res.send(JSON.stringify({
      error: 'PORTCULLIS_LOCKDOWN',
      message: 'The outer gate has engaged. Traffic from this session is denied at the gate.',
      reason: state.lockdown.reason,
      canary: 'No production service was reached.',
    }, null, 2));
    state.recordEvent({
      ...baseEvent,
      disposition: 'blocked' as Disposition,
      status: 403,
      latencyMs: Math.round((performance.now() - started)),
      aiWakeup: false,
      tokensSaved: 0,
    });
    return;
  }

  state.markDiverted();
  if (verdict.category !== 'none') {
    state.addPayload(session.id, {
      category: verdict.category,
      path: req.originalUrl || req.path,
      value: verdict.payload,
      signature: verdict.signature,
    });
  }
  if (verdict.severity >= 3) state.noteThreat(verdict.severity);

  try {
    const result = await deception.respond(req, verdict, session.id);
    await deception.send(res, result);
    state.addDecoy(session.id, result.decoyId);
    state.recordEvent({
      ...baseEvent,
      disposition: (result.drip ? 'tarpit' : 'decoy') as Disposition,
      status: result.status,
      latencyMs: Math.round(performance.now() - started),
      decoyId: result.decoyId,
      aiWakeup: result.aiWakeup,
      tokensSaved: result.tokensSaved,
    } satisfies RequestEvent);
  } catch (error) {
    console.error('[deception] failed to serve decoy', error);
    if (!res.headersSent) res.status(200).json({ canary: true, fallback: true });
  }
});

// Protected production surface (only reachable when the sentinel says PASS).
app.use('/portal', portal);

app.use((error: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  if (error.type === 'entity.parse.failed' || error.status === 400) {
    if (!res.headersSent) res.status(400).json({ error: 'invalid_json', message: 'Request body must be valid JSON.' });
    return;
  }
  console.error('[http]', error);
  if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// ─────────────────────────────────────────────────────────────────────────────
// Single-process frontend delivery: Vite middleware in dev, static build in prod.
// ─────────────────────────────────────────────────────────────────────────────
let vite: ViteDevServer | undefined;
const clientDir = path.resolve(process.cwd(), 'dist/client');

async function bootstrap(): Promise<void> {
  if (isDev) {
    const { createServer } = await import('vite');
    vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    app.use(vite.middlewares);
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') return next();
      try {
        const template = readFileSync(path.resolve(process.cwd(), 'src/client/index.html'), 'utf-8');
        const html = await vite!.transformIndexHtml(req.originalUrl, template);
        res.status(200).type('html').send(html);
      } catch (error) {
        vite!.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  } else {
    if (!existsSync(path.join(clientDir, 'index.html'))) {
      console.warn('[boot] dist/client/index.html missing. Run `npm run build` before `npm start`.');
    }
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  }

  const server = createHttpServer(app);
  attachRealtime(server);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  瓮城 WÈNGCHÉNG  //  adaptive cyber-deception grid`);
    console.log(`  ➜  URL:      http://localhost:${PORT}`);
    console.log(`  ➜  Portal:   http://localhost:${PORT}/portal`);
    console.log(`  ➜  LLM:      ${llm.providerLabel}`);
    console.log(`  ➜  Demo token: ${demoAdminRequired ? 'required for protected actions' : 'not configured'}`);
    console.log(`  ➜  Mode:     ${isDev ? 'development (Vite middleware)' : 'production (static build)'}\n`);
  });
}

bootstrap().catch((error) => {
  console.error('[boot] fatal', error);
  process.exit(1);
});
