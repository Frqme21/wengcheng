import 'dotenv/config';
import OpenAI from 'openai';
import type { AttackCategory, LlmMode } from '../shared/types.js';
import { state } from './state.js';
import { truncate } from './util.js';

export interface DecoyContext {
  sessionId: string;
  category: AttackCategory;
  method: string;
  path: string;
  query: string;
  payload: string;
  userAgent: string;
}

export interface AnalysisContext {
  sessionId: string;
  riskScore: number;
  categories: AttackCategory[];
  requests: Array<{ method: string; path: string; category: AttackCategory; at: number }>;
  payloads: Array<{ category: AttackCategory; value: string; signature: string }>;
  decoys: string[];
  secondsWasted: number;
  aiWakeups: number;
}

export interface LlmAnalysis {
  narrative: string;
  keyFindings: string[];
  recommendation: string;
  mitre: string[];
  riskScore: number;
  confidence: number;
}

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

class LlmClient {
  readonly mode: LlmMode;
  readonly model: string;
  readonly configured: boolean;
  private client: OpenAI | null = null;

  constructor() {
    const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();
    const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();

    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS?.trim() || (nvidiaKey ? '45000' : '14000'));

    if (nvidiaKey) {
      this.mode = 'nvidia';
      this.model = process.env.NVIDIA_MODEL?.trim() || 'meta/llama-3.1-8b-instruct';
      this.client = new OpenAI({
        apiKey: nvidiaKey,
        baseURL: NVIDIA_BASE,
        timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 45_000,
        maxRetries: 0,
      });
    } else if (openrouterKey) {
      this.mode = 'openrouter';
      this.model = process.env.OPENROUTER_MODEL?.trim() || 'meta-llama/llama-3.1-8b-instruct:free';
      this.client = new OpenAI({
        apiKey: openrouterKey,
        baseURL: OPENROUTER_BASE,
        timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 14_000,
        maxRetries: 0,
        defaultHeaders: {
          'HTTP-Referer': 'https://wengcheng.local',
          'X-Title': 'Wengcheng Deception Grid',
        },
      });
    } else {
      this.mode = 'offline';
      this.model = 'procedural-engine-v2';
    }
    this.configured = this.client !== null;
    state.setLlm(this.mode, this.model);
  }

  get providerLabel(): string {
    if (this.mode === 'nvidia') return `NVIDIA NIM · ${this.model}`;
    if (this.mode === 'openrouter') return `OpenRouter · ${this.model}`;
    return 'Offline Procedural Engine · no keys required';
  }

  /** Synthesize a novel synthetic decoy. Returns null when offline or on any API failure. */
  async synthesizeDecoy(ctx: DecoyContext): Promise<Record<string, unknown> | null> {
    if (!this.client) return null;
    const prompt = `You are the AI decoy synthesis module of Wèngchéng, a defensive cyber-deception platform.
An attacker has probed an UNKNOWN endpoint. Invent a believable FAKE database/API response that wastes their time and looks like a real vulnerable internal service.
Never include real secrets, real credentials, or real personal data. Everything must be obviously synthetic on inspection but plausible to a scanner.

Attacker request:
- session: ${ctx.sessionId}
- method: ${ctx.method}
- path: ${ctx.path}
- query: ${truncate(ctx.query, 300)}
- payload: ${truncate(ctx.payload, 300)}
- category: ${ctx.category}
- user agent: ${truncate(ctx.userAgent, 120)}

Return ONLY a minified JSON object (no markdown, no prose) with this shape:
{"decoyLabel":"short service name","table":"invented table name","columns":["col1","col2"],"rows":[{"col1":"synthetic value","col2":"synthetic value"}],"note":"fake internal notice"}`;
    const raw = await this.complete(prompt, 620, 0.85);
    if (!raw) return null;
    return parseJsonObject(raw);
  }

  /** Produce an AI narrative for a session. Returns null when offline or on API failure. */
  async synthesizeAnalysis(ctx: AnalysisContext): Promise<LlmAnalysis | null> {
    if (!this.client) return null;
    const prompt = `You are a senior SOC threat analyst. Write a concise incident assessment for the following captured deception-session telemetry. Be specific to the observed evidence, avoid generic filler.

Session: ${ctx.sessionId}
Risk score (deterministic): ${ctx.riskScore}/200
Categories: ${ctx.categories.join(', ') || 'none'}
Time wasted in tarpit: ${ctx.secondsWasted}s
AI wakeups consumed: ${ctx.aiWakeups}
Decoys touched: ${ctx.decoys.join(', ') || 'none'}
Requests:
${ctx.requests.slice(0, 16).map((r) => `- ${r.method} ${truncate(r.path, 140)} [${r.category}]`).join('\n') || '- none'}
Captured payloads:
${ctx.payloads.slice(0, 10).map((p) => `- [${p.category}] ${truncate(p.value, 200)}`).join('\n') || '- none'}

Return ONLY a minified JSON object (no markdown, no prose):
{"narrative":"2-4 sentence plain-English threat narrative","keyFindings":["finding 1","finding 2","finding 3"],"recommendation":"one concrete defensive action","mitre":["T1595","T1190"],"riskScore":${ctx.riskScore},"confidence":85}`;
    const raw = await this.complete(prompt, 780, 0.35);
    if (!raw) return null;
    const parsed = parseJsonObject(raw);
    if (!parsed) return null;
    return {
      narrative: typeof parsed.narrative === 'string' ? parsed.narrative : '',
      keyFindings: Array.isArray(parsed.keyFindings)
        ? parsed.keyFindings.filter((x): x is string => typeof x === 'string').slice(0, 5)
        : [],
      recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
      mitre: Array.isArray(parsed.mitre)
        ? parsed.mitre.filter((x): x is string => typeof x === 'string').slice(0, 6)
        : [],
      riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : ctx.riskScore,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80,
    };
  }

  private async complete(prompt: string, maxTokens: number, temperature: number): Promise<string | null> {
    if (!this.client) return null;
    state.beginLlm();
    try {
      const extra: Record<string, unknown> = {};
      if (this.mode === 'nvidia') {
        // Nemotron models on NVIDIA NIM support thinking control; keep configurable.
        const thinking = process.env.NVIDIA_ENABLE_THINKING?.trim().toLowerCase();
        if (thinking === 'true' || thinking === '1') {
          extra.chat_template_kwargs = { enable_thinking: true };
        } else if (thinking === 'false' || thinking === '0') {
          extra.chat_template_kwargs = { enable_thinking: false };
        }
      }
      const effectiveMaxTokens = this.mode === 'nvidia' ? Math.max(maxTokens, 1400) : maxTokens;
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a precise JSON-only defensive security automation engine.' },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: effectiveMaxTokens,
        ...extra,
      } as any);
      const usage = response.usage;
      if (usage) {
        state.countTokensSpent((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0));
      }
      const content = response.choices[0]?.message?.content ?? null;
      if (!content) {
        const reason = response.choices[0]?.finish_reason ?? 'unknown';
        console.warn('[llm] empty content from model, finish_reason=', reason);
      }
      return content;
    } catch (error) {
      const err = error as Error & { status?: number; code?: string };
      const detail = [err.message, err.status ? `status=${err.status}` : '', err.code ? `code=${err.code}` : ''].filter(Boolean).join(' ');
      console.warn('[llm] request failed, falling back to procedural generation:', detail);
      return null;
    } finally {
      state.endLlm();
    }
  }
}

/** Tolerant JSON extraction for small instruction-tuned models. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export const llm = new LlmClient();
