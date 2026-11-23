import { EventEmitter } from 'node:events';
import type {
  AttackCategory,
  DeceptionCacheEntry,
  RequestEvent,
  SessionRecord,
  TelemetrySnapshot,
  ThreatAnalysis,
} from '../shared/types.js';
import { demoAdminRequired } from './config.js';
import { clamp, hash32, shortId } from './util.js';

const MAX_EVENTS = 140;
const MAX_SESSIONS = 80;
const SESSION_TTL_MS = 12 * 60 * 1000;
const MAX_DECISION_SAMPLES = 400;

/** Estimated token spend avoided by one deterministic shortcut. */
export const TOKENS_SAVED_PER_SHORTCUT = 720;
/** Estimated token spend avoided when a cached decoy is replayed. */
export const TOKENS_SAVED_PER_CACHE_HIT = 1000;

export const DECOYS = [
  { id: 'decoy-auth-db', label: 'Decoy Auth DB', kind: 'database' },
  { id: 'decoy-env-vault', label: 'Synthetic .env Vault', kind: 'secret' },
  { id: 'decoy-payroll', label: 'Fake Payroll API', kind: 'api' },
  { id: 'tarpit-sink', label: 'Tarpit Sink', kind: 'sink' },
] as const;

interface Lockdown {
  engaged: boolean;
  reason: string;
  engagedAt: number | null;
}

class WengchengState extends EventEmitter {
  readonly startedAt = Date.now();
  readonly sessions = new Map<string, SessionRecord>();
  readonly events: RequestEvent[] = [];
  readonly cache = new Map<string, DeceptionCacheEntry>();
  readonly slidingWindows = new Map<string, number[]>();

  lockdown: Lockdown = { engaged: false, reason: '', engagedAt: null };

  private totals = {
    requests: 0,
    diverted: 0,
    passive: 0,
    aiWakeups: 0,
    tokensSaved: 0,
    tokensSpent: 0,
    cacheHits: 0,
    heuristicHits: 0,
    wastedMs: 0,
  };

  private decisionSamples: number[] = [];
  private recentThreats: number[] = [];
  private _llmInFlight = 0;
  private llmModeValue: TelemetrySnapshot['llm']['mode'] = 'offline';
  private llmModelValue = 'procedural-engine-v2';

  // ---------------------------------------------------------------- sessions

  getOrCreateSession(ip: string, userAgent: string, forcedId?: string): SessionRecord {
    const id = forcedId || `SES-${hash32(`${ip}|${userAgent}`).toString(16).toUpperCase().padStart(8, '0')}`;
    const existing = this.sessions.get(id);
    if (existing) {
      existing.lastSeenAt = Date.now();
      return existing;
    }
    const session: SessionRecord = {
      id,
      ip,
      userAgent: userAgent.slice(0, 120),
      status: 'legitimate',
      startedAt: Date.now(),
      lastSeenAt: Date.now(),
      requestCount: 0,
      riskScore: 0,
      category: 'none',
      decoysTouched: [],
      payloads: [],
      tarpitLevel: 0,
      timeWastedMs: 0,
      aiWakeups: 0,
      tokensSaved: 0,
      portcullis: false,
      pathHistory: [],
    };
    this.sessions.set(id, session);
    if (this.sessions.size > MAX_SESSIONS) {
      const oldest = [...this.sessions.values()].sort((a, b) => a.lastSeenAt - b.lastSeenAt)[0];
      if (oldest) this.sessions.delete(oldest.id);
    }
    return session;
  }

  touchSession(sessionId: string): SessionRecord | undefined {
    const session = this.sessions.get(sessionId);
    if (session) session.lastSeenAt = Date.now();
    return session;
  }

  applyDecision(sessionId: string, category: AttackCategory, diverted: boolean, micros: number): void {
    this.totals.requests += 1;
    this.totals.passive += diverted ? 0 : 1;
    this.decisionSamples.push(micros);
    if (this.decisionSamples.length > MAX_DECISION_SAMPLES) this.decisionSamples.shift();

    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.requestCount += 1;
    session.lastSeenAt = Date.now();
    if (category !== 'none') {
      session.category = category;
      if (session.status === 'legitimate') session.status = 'suspicious';
    }
    if (diverted && session.status !== 'contained') session.status = 'trapped';
    session.riskScore = this.computeRisk(session);
  }

  recordEvent(event: RequestEvent): void {
    this.events.unshift(event);
    if (this.events.length > MAX_EVENTS) this.events.length = MAX_EVENTS;
    const session = this.sessions.get(event.sessionId);
    if (session) {
      session.pathHistory.unshift(`${event.method} ${event.path}`);
      if (session.pathHistory.length > 24) session.pathHistory.length = 24;
      session.timeWastedMs += event.latencyMs;
      this.totals.wastedMs += event.latencyMs;
      session.riskScore = this.computeRisk(session);
    }
    this.emit('changed');
  }

  addPayload(sessionId: string, payload: {
    category: AttackCategory;
    path: string;
    value: string;
    signature: string;
  }): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.payloads.unshift({ id: shortId('pl'), at: Date.now(), ...payload });
    if (session.payloads.length > 24) session.payloads.length = 24;
  }

  addDecoy(sessionId: string, decoyId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.decoysTouched.includes(decoyId)) return;
    session.decoysTouched.unshift(decoyId);
    session.riskScore = this.computeRisk(session);
  }

  bumpTarpit(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    session.tarpitLevel = clamp(session.tarpitLevel + 1, 0, 5);
    session.riskScore = this.computeRisk(session);
    return session.tarpitLevel;
  }

  // ------------------------------------------------------------- economics

  countHeuristicHit(sessionId: string, tokens = TOKENS_SAVED_PER_SHORTCUT): number {
    this.totals.heuristicHits += 1;
    this.totals.tokensSaved += tokens;
    const session = this.sessions.get(sessionId);
    if (session) session.tokensSaved += tokens;
    this.emit('changed');
    return tokens;
  }

  countCacheHit(sessionId: string, key: string, tokens = TOKENS_SAVED_PER_CACHE_HIT): number {
    this.totals.cacheHits += 1;
    this.totals.tokensSaved += tokens;
    const entry = this.cache.get(key);
    if (entry) entry.hits += 1;
    const session = this.sessions.get(sessionId);
    if (session) session.tokensSaved += tokens;
    this.emit('changed');
    return tokens;
  }

  countTokensSpent(tokens: number): void {
    this.totals.tokensSpent += Math.max(0, Math.round(tokens || 0));
    this.emit('changed');
  }

  countAiWakeup(sessionId: string): void {
    this.totals.aiWakeups += 1;
    const session = this.sessions.get(sessionId);
    if (session) session.aiWakeups += 1;
    this.emit('changed');
  }

  setLlm(mode: TelemetrySnapshot['llm']['mode'], model: string): void {
    this.llmModeValue = mode;
    this.llmModelValue = model;
  }

  beginLlm(): void {
    this._llmInFlight += 1;
    this.emit('changed');
  }

  endLlm(): void {
    this._llmInFlight = Math.max(0, this._llmInFlight - 1);
    this.emit('changed');
  }

  get llmInFlight(): number {
    return this._llmInFlight;
  }

  // --------------------------------------------------------------- sliding window

  /** Returns the number of hits in the last `windowMs` milliseconds. */
  slidingWindow(key: string, windowMs: number): number {
    const now = Date.now();
    const hits = (this.slidingWindows.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.push(now);
    this.slidingWindows.set(key, hits);
    if (this.slidingWindows.size > 500) {
      for (const [k, v] of this.slidingWindows) if (v[v.length - 1]! < now - windowMs) this.slidingWindows.delete(k);
    }
    return hits.length;
  }

  noteThreat(severity: number): void {
    const now = Date.now();
    this.recentThreats = this.recentThreats.filter((t) => now - t < 30_000);
    this.recentThreats.push(now);
    if (!this.lockdown.engaged && (this.recentThreats.length >= 14 || severity >= 5)) {
      this.engageLockdown('AUTO: hostile burst threshold exceeded (14 events / 30s)');
    }
  }

  // ---------------------------------------------------------------- lockdown

  engageLockdown(reason: string): void {
    if (this.lockdown.engaged) return;
    this.lockdown = { engaged: true, reason, engagedAt: Date.now() };
    for (const session of this.sessions.values()) {
      if (session.status === 'trapped' || session.status === 'suspicious') {
        session.portcullis = true;
        session.status = 'contained';
      }
    }
    this.emit('changed');
  }

  releaseLockdown(): void {
    this.lockdown = { engaged: false, reason: '', engagedAt: null };
    for (const session of this.sessions.values()) {
      session.portcullis = false;
      if (session.status === 'contained') session.status = 'trapped';
    }
    this.emit('changed');
  }

  // ------------------------------------------------------------------ cache

  findCache(key: string): DeceptionCacheEntry | undefined {
    return this.cache.get(key);
  }

  putCache(entry: DeceptionCacheEntry): void {
    this.cache.set(entry.key, entry);
    if (this.cache.size > 200) {
      const oldest = [...this.cache.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) this.cache.delete(oldest.key);
    }
    this.emit('changed');
  }

  // ----------------------------------------------------------------- reports

  setAnalysis(sessionId: string, analysis: ThreatAnalysis): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.analysis = analysis;
    this.emit('analysis-ready', analysis);
    this.emit('changed');
  }

  // ---------------------------------------------------------------- snapshot

  computeRisk(session: SessionRecord): number {
    let score = 0;
    const severity: Record<AttackCategory, number> = {
      none: 0, recon: 12, traversal: 20, scraping: 18, sqli: 32, rce: 42, novel: 26,
    };
    score += severity[session.category] ?? 0;
    score += Math.min(30, session.requestCount * 3);
    score += Math.min(24, session.payloads.length * 6);
    score += Math.min(18, session.decoysTouched.length * 6);
    score += Math.min(20, session.tarpitLevel * 4);
    if (session.portcullis) score += 12;
    return clamp(Math.round(score), 0, 200);
  }

  snapshot(): TelemetrySnapshot {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastSeenAt > SESSION_TTL_MS) this.sessions.delete(id);
    }
    const avgDecisionMicros = this.decisionSamples.length
      ? this.decisionSamples.reduce((a, b) => a + b, 0) / this.decisionSamples.length
      : 0;
    return {
      at: now,
      demo: { adminTokenRequired: demoAdminRequired },
      totals: {
        requests: this.totals.requests,
        diverted: this.totals.diverted,
        passive: this.totals.passive,
        activeTrapped: [...this.sessions.values()].filter(
          (s) => s.status === 'trapped' || s.status === 'contained',
        ).length,
        secondsWasted: Math.round(this.totals.wastedMs / 100) / 10,
        aiWakeups: this.totals.aiWakeups,
        tokensSaved: this.totals.tokensSaved,
        tokensSpent: this.totals.tokensSpent,
        cacheHits: this.totals.cacheHits,
        heuristicHits: this.totals.heuristicHits,
        avgDecisionMicros: Math.round(avgDecisionMicros * 100) / 100,
      },
      sessions: [...this.sessions.values()]
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
        .slice(0, 40)
        .map((s) => ({ ...s })),
      events: this.events.slice(0, 60).map((e) => ({ ...e })),
      cache: [...this.cache.values()]
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 30)
        .map((c) => ({ ...c })),
      llm: {
        mode: this.llmModeValue,
        model: this.llmModelValue,
        configured: this.llmModeValue !== 'offline',
        inFlight: this.llmInFlight,
      },
      portcullis: { ...this.lockdown },
      uptimeSeconds: Math.floor((now - this.startedAt) / 1000),
    };
  }

  markDiverted(): void {
    this.totals.diverted += 1;
  }

  reset(): void {
    this.sessions.clear();
    this.events.length = 0;
    this.cache.clear();
    this.slidingWindows.clear();
    this.recentThreats = [];
    this.decisionSamples = [];
    this.totals = {
      requests: 0, diverted: 0, passive: 0, aiWakeups: 0,
      tokensSaved: 0, tokensSpent: 0, cacheHits: 0, heuristicHits: 0, wastedMs: 0,
    };
    this.lockdown = { engaged: false, reason: '', engagedAt: null };
    this.emit('changed');
  }
}

export const state = new WengchengState();
