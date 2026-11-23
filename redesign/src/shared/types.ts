/**
 * Shared wire contract for the Wèngchéng control plane.
 * Imported by both the Express server and the React client.
 */

export type AttackCategory =
  | 'none'
  | 'recon'
  | 'sqli'
  | 'traversal'
  | 'rce'
  | 'scraping'
  | 'novel';

export type Disposition = 'passthrough' | 'decoy' | 'tarpit' | 'blocked';

export type SessionStatus = 'legitimate' | 'suspicious' | 'trapped' | 'contained';

export interface CapturedPayload {
  id: string;
  at: number;
  category: AttackCategory;
  path: string;
  value: string;
  signature: string;
}

export interface RequestEvent {
  id: string;
  at: number;
  sessionId: string;
  method: string;
  path: string;
  category: AttackCategory;
  signature: string;
  disposition: Disposition;
  /** Set to DIVERTED_TO_URN when the sentinel silently rerouted hostile traffic. */
  route?: string;
  status: number;
  latencyMs: number;
  decoyId?: string;
  source: 'network' | 'simulator';
  aiWakeup: boolean;
  tokensSaved: number;
}

export interface ThreatAnalysis {
  id: string;
  sessionId: string;
  at: number;
  narrative: string;
  mitre: string[];
  riskScore: number;
  confidence: number;
  provider: string;
  keyFindings: string[];
  recommendation: string;
}

export interface SessionRecord {
  id: string;
  ip: string;
  userAgent: string;
  status: SessionStatus;
  startedAt: number;
  lastSeenAt: number;
  requestCount: number;
  riskScore: number;
  category: AttackCategory;
  decoysTouched: string[];
  payloads: CapturedPayload[];
  tarpitLevel: number;
  timeWastedMs: number;
  aiWakeups: number;
  tokensSaved: number;
  portcullis: boolean;
  pathHistory: string[];
  analysis?: ThreatAnalysis;
}

export interface DeceptionCacheEntry {
  key: string;
  category: AttackCategory;
  pathPattern: string;
  source: 'deterministic' | 'procedural' | 'ai';
  decoyId: string;
  hits: number;
  createdAt: number;
  preview: string;
}

export type LlmMode = 'nvidia' | 'openrouter' | 'offline';

export interface TelemetrySnapshot {
  at: number;
  demo: {
    adminTokenRequired: boolean;
  };
  totals: {
    requests: number;
    diverted: number;
    passive: number;
    activeTrapped: number;
    secondsWasted: number;
    aiWakeups: number;
    tokensSaved: number;
    tokensSpent: number;
    cacheHits: number;
    heuristicHits: number;
    avgDecisionMicros: number;
  };
  sessions: SessionRecord[];
  events: RequestEvent[];
  cache: DeceptionCacheEntry[];
  llm: {
    mode: LlmMode;
    model: string;
    configured: boolean;
    inFlight: number;
  };
  portcullis: {
    engaged: boolean;
    reason: string;
    engagedAt: number | null;
  };
  uptimeSeconds: number;
}

export interface SimulatorResponse {
  id: string;
  sessionId: string;
  label: string;
  at: number;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  disposition: Disposition;
  body: string;
  aiWakeup: boolean;
  note?: string;
}

export interface ClientCommandBase {
  token?: string;
}

export type ClientCommand = (
  | { type: 'simulate'; action: SimulatorAction }
  | { type: 'analyze'; sessionId: string; forceAi?: boolean }
  | { type: 'portcullis'; engaged: boolean }
  | { type: 'reset' }
) & ClientCommandBase;

export type SimulatorAction =
  | 'legitimate'
  | 'sqli'
  | 'recon'
  | 'novel'
  | 'scrape'
  | 'portcullis';

export interface ServerMessage {
  type: 'snapshot' | 'simulator-response' | 'simulator-status' | 'analysis-ready' | 'toast';
  payload: unknown;
}
