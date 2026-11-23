import type { AttackCategory, SessionRecord, ThreatAnalysis } from '../shared/types.js';
import { llm, type AnalysisContext, type LlmAnalysis } from './llm.js';
import { state } from './state.js';
import { shortId, truncate } from './util.js';

const MITRE: Record<AttackCategory, string[]> = {
  none: [],
  recon: ['T1595: Active Scanning', 'T1087: Account Discovery'],
  sqli: ['T1190: Exploit Public-Facing Application', 'T1119: Automated Collection'],
  traversal: ['T1083: File and Directory Discovery', 'T1190: Exploit Public-Facing Application'],
  rce: ['T1059: Command and Scripting Interpreter', 'T1190: Exploit Public-Facing Application'],
  scraping: ['T1595.002: Vulnerability Scanning', 'T1119: Automated Collection'],
  novel: ['T1595.001: Scanning IP Blocks', 'T1190: Exploit Public-Facing Application'],
};

function buildContext(session: SessionRecord): AnalysisContext {
  return {
    sessionId: session.id,
    riskScore: state.computeRisk(session),
    categories: [...new Set([
      session.category,
      ...session.payloads.map((p) => p.category),
    ])].filter((c) => c !== 'none'),
    requests: session.pathHistory.map((entry, index) => {
      const [method = 'GET', ...rest] = entry.split(' ');
      return {
        method,
        path: rest.join(' ') || '/',
        category: session.payloads[index]?.category ?? session.category,
        at: session.lastSeenAt - (session.pathHistory.length - index) * 1000,
      };
    }),
    payloads: session.payloads.map((p) => ({ category: p.category, value: p.value, signature: p.signature })),
    decoys: [...session.decoysTouched],
    secondsWasted: Math.round(session.timeWastedMs / 100) / 10,
    aiWakeups: session.aiWakeups,
  };
}

function proceduralAnalysis(ctx: AnalysisContext): ThreatAnalysis {
  const primary = ctx.categories[0] ?? 'none';
  const mitre = [...new Set(ctx.categories.flatMap((c) => MITRE[c] ?? []))];
  const topPayload = ctx.payloads[0]?.value ?? 'no explicit payload captured';
  const reqCount = ctx.requests.length || 1;
  const narrative =
    `Session ${ctx.sessionId} exhibited ${ctx.categories.join(' / ') || 'unclassified'} behaviour across ` +
    `${reqCount} observed request${reqCount === 1 ? '' : 's'}. The outer gate classified the traffic in microseconds ` +
    `and diverted it into the Wèngchéng courtyard before any real inner route was reached. ` +
    `${primary === 'recon' ? 'The actor enumerated administrative and secret-bearing surfaces, ' : ''}` +
    `${primary === 'sqli' || primary === 'novel' ? `The actor submitted a structured payload (${truncate(topPayload, 120)}) against an internal-looking endpoint; ` : ''}` +
    `${ctx.decoys.length ? `the actor interacted with ${ctx.decoys.length} synthetic asset${ctx.decoys.length === 1 ? '' : 's'} ` : ''}` +
    `and spent ${ctx.secondsWasted}s inside an adaptive tarpit. No production data, credentials, or services were exposed; ` +
    `all observed artifacts were canaries.`;

  const keyFindings = [
    `Primary behaviour: ${primary.toUpperCase()} with deterministic signature match (0 tokens).`,
    `Captured ${ctx.payloads.length} payload${ctx.payloads.length === 1 ? '' : 's'}; ${truncate(topPayload, 110)}.`,
    `Decoys touched: ${ctx.decoys.join(', ') || 'none'}. Every asset is monitored and synthetic.`,
    `${ctx.secondsWasted}s of attacker time consumed via a progressive tarpit, from 400ms to 3500ms.`,
  ];

  const riskScore = Math.min(200, Math.round(ctx.riskScore + ctx.decoys.length * 2));
  return {
    id: shortId('RPT'),
    sessionId: ctx.sessionId,
    at: Date.now(),
    narrative,
    mitre: mitre.length ? mitre : ['T1595: Active Scanning'],
    riskScore,
    confidence: 78,
    provider: 'Procedural Threat Engine · 0 tokens',
    keyFindings,
    recommendation: ctx.categories.includes('sqli')
      ? 'Keep the synthetic schema mirror cached and add the captured signature to the sentinel blocklist review queue.'
      : 'Maintain the decoy topology, rotate canary values, and review source-IP reputation at the perimeter.',
  };
}

function applyAi(analysis: ThreatAnalysis, ai: LlmAnalysis): ThreatAnalysis {
  return {
    ...analysis,
    narrative: ai.narrative || analysis.narrative,
    keyFindings: ai.keyFindings.length ? ai.keyFindings : analysis.keyFindings,
    recommendation: ai.recommendation || analysis.recommendation,
    mitre: ai.mitre.length ? ai.mitre : analysis.mitre,
    riskScore: ai.riskScore || analysis.riskScore,
    confidence: ai.confidence || analysis.confidence,
    provider: llm.providerLabel,
  };
}

class ThreatAnalyst {
  /** Only an explicit deeper-report request wakes the model. Idle summaries stay token-free. */
  async synthesize(sessionId: string, forceAi = false): Promise<ThreatAnalysis | null> {
    const session = state.sessions.get(sessionId);
    if (!session) return null;
    const base = proceduralAnalysis(buildContext(session));
    let result = base;

    if (forceAi && llm.configured) {
      const ai = await llm.synthesizeAnalysis(buildContext(session));
      if (ai) result = applyAi(base, ai);
    }

    state.setAnalysis(sessionId, result);
    return result;
  }

  /** Lightweight, token-free summary produced when a session goes quiet. */
  summarizeOnIdle(session: SessionRecord): ThreatAnalysis {
    const analysis = proceduralAnalysis(buildContext(session));
    state.setAnalysis(session.id, analysis);
    return analysis;
  }

  markdown(session: SessionRecord, analysis: ThreatAnalysis): string {
    const rows = session.pathHistory.map((p) => `| ${p} |`).join('\n') || '| _none captured_ |';
    const payloads = session.payloads
      .map((p) => `- **${p.signature}** (${p.category}): \`${truncate(p.value, 220)}\``)
      .join('\n') || '- None captured';
    return `# Wèngchéng Executive Incident Report

**Session:** \`${session.id}\`  
**Generated:** ${new Date(analysis.at).toISOString()}  
**Risk score:** ${analysis.riskScore} / 200  
**Confidence:** ${analysis.confidence}%  
**Analysis provider:** ${analysis.provider}  
**Source IP:** \`${session.ip}\`  
**Client:** ${truncate(session.userAgent, 140)}

## Executive Summary

${analysis.narrative}

## Key Findings

${analysis.keyFindings.map((f) => `- ${f}`).join('\n')}

## MITRE ATT&CK Mapping

${analysis.mitre.map((m) => `- ${m}`).join('\n')}

## Observed Request Sequence

| Request |
| --- |
${rows}

## Captured Payloads

${payloads}

## Deception Assets Engaged

${session.decoysTouched.map((d) => `- \`${d}\``).join('\n') || '- None'}

## Containment Outcome

- Requests diverted before reaching the protected Wèngchéng Inner Ward: **${session.requestCount}**
- Attacker time consumed: **${Math.round(session.timeWastedMs / 100) / 10}s**
- Portcullis lockdown engaged: **${session.portcullis ? 'YES' : 'no'}**
- AI wakeups consumed by this session: **${session.aiWakeups}**
- Estimated tokens saved by heuristic/cache layer: **${session.tokensSaved.toLocaleString()}**

## Recommended Action

${analysis.recommendation}

---
_Generated by Wèngchéng (瓮城) Adaptive Cyber-Deception Platform. All affected assets are synthetic canaries._
`;
  }

  json(session: SessionRecord, analysis: ThreatAnalysis): string {
    return JSON.stringify({
      report: analysis,
      session: {
        id: session.id,
        ip: session.ip,
        userAgent: session.userAgent,
        status: session.status,
        startedAt: new Date(session.startedAt).toISOString(),
        lastSeenAt: new Date(session.lastSeenAt).toISOString(),
        riskScore: session.riskScore,
        requestCount: session.requestCount,
        pathHistory: session.pathHistory,
        decoysTouched: session.decoysTouched,
        payloads: session.payloads,
        timeWastedSeconds: Math.round(session.timeWastedMs / 100) / 10,
        tarpitLevel: session.tarpitLevel,
        portcullis: session.portcullis,
        aiWakeups: session.aiWakeups,
        tokensSaved: session.tokensSaved,
      },
      disclaimer: 'All decoy artifacts are synthetic canaries. No production data was exposed.',
    }, null, 2);
  }
}

export const analyst = new ThreatAnalyst();
