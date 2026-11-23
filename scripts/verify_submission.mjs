#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TOKEN = 'submission-audit-token';
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/home/frqme/.local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const results = [];
const httpStatuses = [];
const serverLogs = [];
let baseUrl = '';
let testPort = 0;
let server = null;
let chrome = null;
let chromeProfile = '';
let cdp = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(label, predicate, timeoutMs = 15000, intervalMs = 200) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

function sanitizedEnv(extra = {}) {
  return {
    ...process.env,
    ...extra,
    NVIDIA_API_KEY: '',
    OPENROUTER_API_KEY: '',
    NVIDIA_MODEL: '',
    OPENROUTER_MODEL: '',
  };
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('Could not reserve a test port')));
        return;
      }
      probe.close(() => resolve(address.port));
    });
  });
}

async function request(targetPath, options = {}) {
  const response = await fetch(`${baseUrl}${targetPath}`, options);
  const text = await response.text();
  httpStatuses.push(response.status);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, headers: response.headers, text, json };
}

function commandPayload(type, extra = {}, token = undefined) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-demo-token': token } : {}),
    },
    body: JSON.stringify({ type, ...extra }),
  };
}

async function snapshot() {
  const response = await request('/api/snapshot');
  assert.equal(response.status, 200, 'snapshot endpoint failed');
  return response.json;
}

async function record(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - started;
    results.push({ name, ok: true, detail, ms });
    console.log(`PASS  ${name}${detail ? ` (${detail})` : ''}`);
  } catch (error) {
    const ms = Date.now() - started;
    results.push({ name, ok: false, detail: error.message, ms });
    console.error(`FAIL  ${name}: ${error.message}`);
  }
}

function appendLogs(chunk, target) {
  target.push(chunk.toString());
}

async function startServer() {
  const env = sanitizedEnv({
    NODE_ENV: 'production',
    PORT: String(testPort),
    DEMO_ADMIN_TOKEN: TEST_TOKEN,
  });
  server = spawn('npm', ['start'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  server.stdout.on('data', (chunk) => appendLogs(chunk, serverLogs));
  server.stderr.on('data', (chunk) => appendLogs(chunk, serverLogs));

  await waitFor('production server health', async () => {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`server exited early: ${serverLogs.join('').slice(-500)}`);
    }
    const response = await fetch(`${baseUrl}/health`);
    return response.ok;
  }, 30000, 300);
}

async function stopProcessGroup(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
  }
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(2500),
  ]);
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch { /* already gone */ }
}

async function cleanup() {
  if (cdp?.ws) {
    try { cdp.ws.close(); } catch { /* already closed */ }
  }
  if (chrome) await stopProcessGroup(chrome);
  if (chromeProfile) {
    try { rmSync(chromeProfile, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  if (server) await stopProcessGroup(server);
}

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => {
    try {
      return readFileSync(candidate) && Boolean(candidate);
    } catch {
      return false;
    }
  });
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium executable.');
  return found;
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    ws.on('message', (raw) => {
      const message = JSON.parse(String(raw));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, timer } = this.pending.get(message.id);
        clearTimeout(timer);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      this.events.push(message);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 12000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Evaluation failed');
    return result.result.value;
  }

  eventsOf(method) {
    return this.events.filter((event) => event.method === method);
  }
}

async function launchBrowser() {
  const executable = findChrome();
  chromeProfile = mkdtempSync(path.join(tmpdir(), 'wengcheng-verify-'));
  chrome = spawn(executable, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    '--remote-debugging-port=0',
    `--user-data-dir=${chromeProfile}`,
    baseUrl,
  ], { cwd: ROOT, stdio: 'ignore', detached: true });

  const portFile = path.join(chromeProfile, 'DevToolsActivePort');
  const port = await waitFor('Chrome debugging port', () => {
    try {
      return Number(readFileSync(portFile, 'utf8').split('\n')[0]);
    } catch {
      return null;
    }
  }, 20000, 200);
  assert.ok(Number.isInteger(port) && port > 0, 'invalid Chrome debugging port');

  const target = await waitFor('Chrome page target', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await response.json();
    return targets.find((item) => item.type === 'page' && item.url.startsWith(baseUrl));
  }, 20000, 200);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  cdp = new CdpClient(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
}

async function bodyText() {
  return String(await cdp.evaluate('document.body.innerText'));
}

async function clickButton(text) {
  const expression = `(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent && item.textContent.includes(${JSON.stringify(text)}));
    if (!button) return false;
    button.click();
    return true;
  })()`;
  const clicked = await cdp.evaluate(expression);
  assert.equal(clicked, true, `button not found: ${text}`);
}

async function waitForBodyText(text, timeoutMs = 15000) {
  await waitFor(`body text: ${text}`, async () => (await bodyText()).includes(text), timeoutMs, 200);
}

function browserErrors() {
  const exceptions = cdp.eventsOf('Runtime.exceptionThrown');
  const consoleErrors = cdp.eventsOf('Runtime.consoleAPICalled').filter(
    (event) => event.params.type === 'error',
  );
  const badResponses = cdp.eventsOf('Network.responseReceived').filter(
    (event) => event.params.response.status >= 500,
  );
  return { exceptions, consoleErrors, badResponses };
}

async function runBuild() {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    env: sanitizedEnv(),
    stdio: 'inherit',
  });
  assert.equal(result.status, 0, 'npm run build returned a non-zero exit code');
  return 'typecheck, Vite, and server build';
}

async function checkHealthAndOfflineMode() {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.status, 'ok');
  assert.equal(health.json.llm, 'offline');

  const state = await snapshot();
  assert.equal(state.demo.adminTokenRequired, true);
  assert.equal(state.llm.mode, 'offline');
  assert.equal(state.llm.configured, false);
  assert.equal(state.totals.tokensSpent, 0);
  return 'health ok, LLM offline, token guard active';
}

async function checkOfflineTraffic() {
  const portal = await request('/portal');
  assert.equal(portal.status, 200);
  assert.match(portal.text, /AegisCloud|Inner Citadel/i);

  const envProbe = await request('/.env', { headers: { 'User-Agent': 'verify-scanner/1.0' } });
  assert.equal(envProbe.status, 200);
  assert.match(envProbe.text, /SYNTHETIC SECRET CANARY/);

  const adminProbe = await request('/admin', { headers: { 'User-Agent': 'verify-scanner/1.0' } });
  assert.equal(adminProbe.status, 200);
  assert.match(adminProbe.text, /SYNTHETIC SESSION/);

  const novel = await request(
    '/portal/api/v2/ledger/reconcile?table=offline_probe&filter=id%27%20OR%201%3D1--&debug=true',
    { headers: { 'x-wc-sim-id': 'VERIFY-OFFLINE-NOVEL' } },
  );
  assert.equal(novel.status, 200);
  assert.match(novel.text, /WENGCHENG_(?:PROCEDURAL_NOVEL|AI_SYNTHESIZED)_DECOY/);

  const analyzed = await request('/api/commands', commandPayload(
    'analyze',
    { sessionId: 'VERIFY-OFFLINE-NOVEL', forceAi: true },
    TEST_TOKEN,
  ));
  assert.equal(analyzed.status, 200);

  await waitFor('offline AI report', async () => {
    const state = await snapshot();
    return state.sessions.some((session) =>
      session.id === 'VERIFY-OFFLINE-NOVEL' && session.analysis &&
      /procedural|offline/i.test(session.analysis.provider));
  }, 10000, 200);

  const state = await snapshot();
  assert.equal(state.totals.tokensSpent, 0);
  return 'portal, canaries, novel probe, and AI report all use procedural fallback';
}

async function checkCacheAccounting() {
  const path = '/portal/api/v2/ledger/reconcile?table=cache_probe&filter=id%27%20OR%201%3D1--&debug=true';
  const headers = { 'x-wc-sim-id': 'VERIFY-CACHE' };

  await request('/api/commands', commandPayload('reset', {}, TEST_TOKEN));
  const before = await snapshot();

  const first = await request(path, { headers });
  assert.equal(first.status, 200);
  const afterFirst = await snapshot();

  const second = await request(path, { headers });
  assert.equal(second.status, 200);
  const afterSecond = await snapshot();

  assert.ok(afterSecond.totals.tokensSaved > afterFirst.totals.tokensSaved,
    'repeat novel probe did not increase tokensSaved');

  await request('/api/commands', commandPayload('reset', {}, TEST_TOKEN));
  const concurrentBefore = await snapshot();
  const concurrent = await Promise.all(Array.from({ length: 6 }, () => request(path, { headers })));
  assert.ok(concurrent.every((item) => item.status === 200), 'concurrent novel probe returned a non-200 status');
  const concurrentAfter = await snapshot();

  const cached = concurrentAfter.cache.find((entry) => entry.pathPattern.includes('ledger/reconcile'));
  assert.ok(cached, 'novel decoy was not cached');
  assert.ok(cached.hits >= 4, `expected repeated cache hits, saw ${cached.hits}`);
  assert.ok(concurrentAfter.totals.tokensSaved > concurrentBefore.totals.tokensSaved,
    'concurrent repeat probes did not increase tokensSaved');
  assert.equal(concurrentAfter.totals.aiWakeups, 0);
  assert.equal(concurrentAfter.totals.tokensSpent, 0);
  return `cache hits ${cached.hits}, tokensSaved ${concurrentAfter.totals.tokensSaved}, AI wakeups 0`;
}

async function expectRejection(label, payload, expectedStatus) {
  const response = await request('/api/commands', commandPayload(payload.type, payload, undefined));
  assert.equal(response.status, expectedStatus, `${label} had status ${response.status}`);
  assert.equal(response.json?.error, 'demo_token_required', `${label} had wrong error body`);
}

async function wsSend(command, token = undefined) {
  const url = `${baseUrl.replace(/^http/, 'ws')}/ws`;
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const messages = [];
  ws.on('message', (raw) => messages.push(JSON.parse(String(raw))));
  ws.send(JSON.stringify(token ? { ...command, token } : command));
  await delay(700);
  ws.close();
  return messages;
}

async function checkControlPlane() {
  const unauthorized = [
    { type: 'reset' },
    { type: 'portcullis', engaged: true },
    { type: 'simulate', action: 'sqli' },
    { type: 'simulate', action: 'novel' },
    { type: 'analyze', sessionId: 'VERIFY-AUTH', forceAi: false },
    { type: 'analyze', sessionId: 'VERIFY-AUTH', forceAi: true },
  ];

  for (const command of unauthorized) {
    await expectRejection(command.type, command, 401);
  }

  const wrong = await request('/api/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-demo-token': 'wrong-token' },
    body: JSON.stringify({ type: 'reset' }),
  });
  assert.equal(wrong.status, 403);

  const queryAllowed = await request('/api/commands?token=' + TEST_TOKEN, commandPayload('reset'));
  assert.equal(queryAllowed.status, 200);

  const telemetry = await request('/api/snapshot');
  assert.equal(telemetry.status, 200);
  const health = await request('/health');
  assert.equal(health.status, 200);

  for (const command of unauthorized) {
    const messages = await wsSend(command);
    const warning = messages.find((message) => message.type === 'toast' && message.payload.level === 'warn');
    assert.ok(warning, `WebSocket did not warn for ${command.type}`);
    assert.match(warning.payload.message, /demo token/i);
  }

  const wsAllowed = await wsSend({ type: 'reset' }, TEST_TOKEN);
  assert.ok(wsAllowed.some((message) =>
    message.type === 'toast' && message.payload.level === 'info' && /reset/i.test(message.payload.message)),
  'WebSocket token unlock did not run reset');

  return `${unauthorized.length} HTTP and WebSocket actions blocked, token unlock works`;
}

async function checkBrowserJourney() {
  await launchBrowser();
  await cdp.send('Page.reload', { ignoreCache: true });
  await waitForBodyText('Take 1-min Tour');
  await waitForBodyText('Play the whole story');
  await waitFor('controls enabled', async () => cdp.evaluate(
    `(() => {
      const button = [...document.querySelectorAll('button')]
        .find((item) => item.textContent && item.textContent.includes('Take 1-min Tour'));
      return Boolean(button && !button.disabled);
    })()`,
  ), 15000, 200);

  const coldText = await bodyText();
  assert.match(coldText, /Wèngchéng/);
  assert.match(coldText, /A fake city behind a real front door/);
  assert.equal(await cdp.evaluate(
    'Boolean(document.querySelector(\'[aria-label="Demo access token"]\'))',
  ), true, 'lock icon is missing');

  await cdp.evaluate('sessionStorage.removeItem("wengcheng-demo-token")');
  await cdp.send('Page.navigate', { url: `${baseUrl}/?token=${TEST_TOKEN}` });
  await waitFor('token auto-unlock', async () => {
    const stored = await cdp.evaluate('sessionStorage.getItem("wengcheng-demo-token")');
    const search = await cdp.evaluate('window.location.search');
    return stored === TEST_TOKEN && search === '';
  }, 15000, 200);
  await waitForBodyText('Take 1-min Tour');
  await waitFor('unlocked controls enabled', async () => cdp.evaluate(
    `(() => {
      const button = [...document.querySelectorAll('button')]
        .find((item) => item.textContent && item.textContent.includes('Take 1-min Tour'));
      return Boolean(button && !button.disabled);
    })()`,
  ), 15000, 200);

  await clickButton('Take 1-min Tour');
  await waitFor('tour dialog', async () => cdp.evaluate(
    'Boolean(document.querySelector(\'[role="dialog"][aria-label="Product tour"]\'))',
  ));
  for (let step = 1; step <= 6; step += 1) {
    await waitFor(`tour step ${step}`, async () => (await bodyText()).includes(`Step ${step} of 6`));
    await clickButton('Next');
    await delay(250);
    if (step === 6) {
      await waitFor('403 gate visible on final tour step', async () => (await bodyText()).includes('403 gate on'), 3000, 100);
    }
  }
  await waitFor('tour completion', async () => cdp.evaluate(
    '!document.querySelector(\'[role="dialog"][aria-label="Product tour"]\')',
  ), 15000, 200);

  const beforeDemo = await snapshot();
  await clickButton('Play the whole story');
  await waitFor('full story requests', async () => {
    const state = await snapshot();
    return state.totals.requests >= beforeDemo.totals.requests + 10 && !state.portcullis.engaged;
  }, 60000, 500);
  await waitForBodyText('Play the whole story', 20000);

  const errors = browserErrors();
  assert.equal(errors.exceptions.length, 0, `page exceptions: ${errors.exceptions.length}`);
  assert.equal(errors.consoleErrors.length, 0, `console errors: ${errors.consoleErrors.length}`);
  assert.equal(errors.badResponses.length, 0, `browser 5xx responses: ${errors.badResponses.length}`);
  return 'cold start, token unlock, tour, full story, and console checks';
}

async function checkReports() {
  const state = await snapshot();
  const session = state.sessions.find((item) => item.analysis);
  assert.ok(session, 'no analyzed session available for report download');
  const id = encodeURIComponent(session.id);

  const markdown = await request(`/api/reports/${id}.md`);
  assert.equal(markdown.status, 200);
  assert.match(markdown.headers.get('content-type') || '', /text\/markdown/);
  assert.match(markdown.headers.get('content-disposition') || '', /attachment/);
  assert.ok(markdown.text.length > 100, 'Markdown report is empty');

  const json = await request(`/api/reports/${id}.json`);
  assert.equal(json.status, 200);
  assert.match(json.headers.get('content-type') || '', /application\/json/);
  assert.ok(json.json && json.json.session, 'JSON report missing session data');
  return `reports for ${session.id}`;
}

async function checkAttackerCli() {
  const result = spawnSync('python3', [
    'scripts/attacker.py',
    '--host', '127.0.0.1',
    '--port', String(testPort),
    '--no-tarpit',
    '--delay', '0.1',
  ], { cwd: ROOT, env: sanitizedEnv(), encoding: 'utf8' });
  assert.equal(result.status, 0, `attacker.py exited ${result.status}: ${result.stderr}`);
  assert.match(result.stdout, /Attack sequence complete/);
  assert.match(result.stdout, /source=procedural|source=real/);
  return 'attacker.py completed with zero-key server';
}

async function checkNoServerErrors() {
  const log = serverLogs.join('\n');
  assert.doesNotMatch(log, /UnhandledPromiseRejection|unhandledRejection/);
  assert.doesNotMatch(log, /\[http\]|\[deception\] failed/);
  const bad = httpStatuses.filter((status) => status >= 500);
  assert.deepEqual(bad, [], `HTTP 5xx statuses observed: ${bad.join(', ')}`);
  return `${httpStatuses.length} HTTP responses checked, zero 5xx`;
}

async function finish(exitCode) {
  await cleanup();
  const passed = results.filter((item) => item.ok).length;
  console.log('\n================ SUBMISSION VERIFICATION SUMMARY ================');
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${String(result.name).padEnd(34)} ${result.ms}ms  ${result.detail ?? ''}`);
  }
  console.log('================================================================');
  console.log(`${passed}/${results.length} checks passed`);
  console.log(passed === results.length
    ? 'RESULT: PASS. Wèngchéng is ready for GenHacks submission.'
    : 'RESULT: FAIL. Fix the failed checks and rerun.');
  process.exit(exitCode);
}

async function main() {
  console.log('Wèngchéng submission verification');
  console.log('Building with LLM keys unset and demo token enabled.\n');

  await record('Build', runBuild);
  if (!results[0]?.ok) await finish(1);

  testPort = await getFreePort();
  baseUrl = `http://127.0.0.1:${testPort}`;
  console.log(`Test server: ${baseUrl}\n`);

  await startServer();

  await record('Health and offline config', checkHealthAndOfflineMode);
  await record('Offline traffic fallback', checkOfflineTraffic);
  await record('Cache and token accounting', checkCacheAccounting);
  await record('Auth and control plane', checkControlPlane);
  await record('Browser cold start and journeys', checkBrowserJourney);
  await record('Report downloads', checkReports);
  await record('Attacker CLI', checkAttackerCli);
  await record('No runtime or HTTP 5xx errors', checkNoServerErrors);

  const failed = results.some((item) => !item.ok);
  await finish(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(`FATAL: ${error.stack || error.message}`);
  results.push({ name: 'Verification harness', ok: false, detail: error.message, ms: 0 });
  await finish(1);
});
