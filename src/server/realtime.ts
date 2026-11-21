import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  ClientCommand,
  ServerMessage,
  SimulatorAction,
  SimulatorResponse,
  TelemetrySnapshot,
} from '../shared/types.js';
import { analyst } from './analyst.js';
import { assertCommandAllowed, DemoAuthError } from './config.js';
import { state, TOKENS_SAVED_PER_SHORTCUT } from './state.js';
import { hash32, shortId } from './util.js';

const wss = new WebSocketServer({ noServer: true });
const clients = new Set<WebSocket>();
let broadcastScheduled = false;

export function attachRealtime(server: HttpServer): void {
  server.on('upgrade', (req, socket, head) => {
    const pathname = (req.url ?? '').split('?')[0];
    if (pathname !== '/ws') return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    send(ws, { type: 'snapshot', payload: state.snapshot() });
    ws.on('message', async (raw) => {
      try {
        const command = JSON.parse(String(raw)) as ClientCommand;
        await handleCommand(command);
      } catch (error) {
        if (!(error instanceof DemoAuthError)) console.warn('[ws] invalid command', error);
      }
    });
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  state.on('changed', scheduleBroadcast);
  setInterval(() => {
    // Synthesize a token-free session summary once a hostile session goes quiet.
    const now = Date.now();
    for (const session of state.sessions.values()) {
      if (
        session.status !== 'legitimate' &&
        session.requestCount > 0 &&
        !session.analysis &&
        now - session.lastSeenAt > 8_000
      ) {
        analyst.summarizeOnIdle(session);
      }
    }
    broadcast({ type: 'snapshot', payload: state.snapshot() });
  }, 900);
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(message: ServerMessage): void {
  const payload = JSON.stringify(message);
  for (const ws of clients) if (ws.readyState === WebSocket.OPEN) ws.send(payload);
}

function scheduleBroadcast(): void {
  if (broadcastScheduled) return;
  broadcastScheduled = true;
  setTimeout(() => {
    broadcastScheduled = false;
    const payload: TelemetrySnapshot = state.snapshot();
    broadcast({ type: 'snapshot', payload });
  }, 120);
}

export function emitToast(level: 'info' | 'warn' | 'success', message: string): void {
  broadcast({ type: 'toast', payload: { level, message } });
}

export async function handleCommand(command: ClientCommand): Promise<void> {
  if (!command || typeof command.type !== 'string') {
    emitToast('warn', 'Malformed control-plane command');
    return;
  }
  try {
    assertCommandAllowed(command);
  } catch (error) {
    if (error instanceof DemoAuthError) emitToast('warn', error.message);
    throw error;
  }
  switch (command.type) {
    case 'simulate':
      await runSimulation(command.action, command.token);
      break;
    case 'analyze': {
      const analysis = await analyst.synthesize(command.sessionId, Boolean(command.forceAi));
      if (analysis) {
        broadcast({ type: 'analysis-ready', payload: analysis });
        emitToast('success', `Incident report synthesized for ${command.sessionId}`);
      } else {
        emitToast('warn', `Unknown session ${command.sessionId}`);
      }
      break;
    }
    case 'portcullis':
      if (command.engaged) {
        state.engageLockdown('MANUAL: control-room override');
        emitToast('warn', 'Portcullis engaged. Hostile traffic now receives 403.');
      } else {
        state.releaseLockdown();
        emitToast('success', 'Portcullis released. Deception routing restored.');
      }
      break;
    case 'reset':
      state.reset();
      emitToast('info', 'Telemetry grid reset');
      break;
  }
}

interface SimulationRequest {
  path: string;
  method?: string;
  force?: string;
  note?: string;
}

const SIMULATION_PLANS: Record<SimulatorAction, { label: string; sessionId: string; requests: SimulationRequest[] }> = {
  legitimate: {
    label: 'Legitimate User',
    sessionId: `SIM-OK-${hash32(String(Date.now())).toString(16).slice(0, 6).toUpperCase()}`,
    requests: [
      { path: '/portal/api/overview' },
      { path: '/portal/api/billing', note: 'Authenticated session passes the outer gate untouched.' },
    ],
  },
  sqli: {
    label: 'SQLi Schema Dump',
    sessionId: `SIM-SQL-${hash32(String(Date.now() + 7)).toString(16).slice(0, 6).toUpperCase()}`,
    requests: [
      { path: "/portal/api/overview?q=id'%20OR%201%3D1--", note: "Classic SQL tautology served from cached synthetic ledger." },
      { path: "/portal/api/billing?invoice=1%27%20UNION%20SELECT%20*%20FROM%20information_schema.tables--" },
    ],
  },
  recon: {
    label: '.env & /admin Recon',
    sessionId: `SIM-REC-${hash32(String(Date.now() + 13)).toString(16).slice(0, 6).toUpperCase()}`,
    requests: [
      { path: '/.env', note: 'Synthetic secret canary returned instantly. Zero model calls.' },
      { path: '/admin', note: 'Fake admin console with canary bootstrap token.' },
      { path: '/wp-admin' },
    ],
  },
  novel: {
    label: 'Novel AI Wakeup Probe',
    sessionId: `SIM-AI-${hash32(String(Date.now() + 29)).toString(16).slice(0, 6).toUpperCase()}`,
    requests: [
      {
        path: "/portal/api/v2/ledger/reconcile?table=wp_quantum_ledger&filter=id'%20OR%201%3D1--&debug=true",
        note: 'Unknown endpoint + custom payload: cache miss wakes the LLM once to invent a decoy table.',
      },
    ],
  },
  scrape: {
    label: 'Slow-Drip Scraper',
    sessionId: `SIM-SCR-${hash32(String(Date.now() + 41)).toString(16).slice(0, 6).toUpperCase()}`,
    requests: [
      { path: '/portal/api/export?format=csv&page=1', force: 'scraping', note: 'Large fake CSV dripped byte-by-byte into the tarpit.' },
      { path: '/portal/api/export?format=csv&page=2', force: 'scraping' },
    ],
  },
  portcullis: {
    label: 'Portcullis Toggle',
    sessionId: `SIM-LOCK-${hash32(String(Date.now() + 53)).toString(16).slice(0, 6).toUpperCase()}`,
    requests: [],
  },
};

export async function runSimulation(action: SimulatorAction, token?: string): Promise<void> {
  if (action === 'portcullis') {
    const next = !state.lockdown.engaged;
    await handleCommand({ type: 'portcullis', engaged: next, token });
    return;
  }

  const plan = SIMULATION_PLANS[action];
  const port = process.env.PORT || '3000';
  const base = `http://127.0.0.1:${port}`;

  for (let i = 0; i < plan.requests.length; i += 1) {
    const request = plan.requests[i]!;
    const id = shortId('SIMR');
    const started = Date.now();
    broadcast({
      type: 'simulator-status',
      payload: { id, label: plan.label, phase: 'start', sessionId: plan.sessionId, path: request.path },
    });

    try {
      const headers: Record<string, string> = {
        'user-agent': 'WengchengJudgeSimulator/1.0 (+https://wengcheng.local)',
        'x-wc-sim-id': plan.sessionId,
        'x-wc-sim-action': action,
      };
      if (request.force) headers['x-wc-force-category'] = request.force;
      const response = await fetch(`${base}${request.path}`, {
        method: request.method ?? 'GET',
        headers,
        signal: AbortSignal.timeout(18_000),
      });
      const body = await response.text();
      const latencyMs = Date.now() - started;
      const result: SimulatorResponse = {
        id,
        sessionId: plan.sessionId,
        label: plan.label,
        at: Date.now(),
        method: request.method ?? 'GET',
        path: request.path,
        status: response.status,
        latencyMs,
        disposition: response.headers.get('x-wengcheng-decoy')
          ? 'decoy'
          : response.status === 403
            ? 'blocked'
            : 'passthrough',
        body,
        aiWakeup: response.headers.get('x-wengcheng-tokens') === 'ai-called',
        note: request.note,
      };
      broadcast({ type: 'simulator-response', payload: result });
    } catch (error) {
      broadcast({
        type: 'toast',
        payload: { level: 'warn', message: `Simulation request failed: ${(error as Error).message}` },
      });
    }

    // Small gap keeps the attacker-preview feed readable.
    if (i < plan.requests.length - 1) await new Promise((r) => setTimeout(r, 220));
  }

  const session = state.sessions.get(plan.sessionId);
  if (session && session.status !== 'legitimate' && !session.analysis) {
    analyst.summarizeOnIdle(session);
  }
}

/** Snapshot helper for the REST polling fallback. */
export function currentSnapshot(): TelemetrySnapshot {
  return state.snapshot();
}

export { TOKENS_SAVED_PER_SHORTCUT };
