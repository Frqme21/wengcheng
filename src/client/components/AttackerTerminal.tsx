import { useState } from 'react';
import type { SimulatorResponse } from '../../shared/types';
import type { SimulatorStatus } from '../useGrid';

interface Props {
  responses: SimulatorResponse[];
  pending: SimulatorStatus[];
  onInspect: (sessionId: string) => void;
}

function plainText(value: string): string {
  return value.replace(/\s—\s/g, ', ');
}

function responseTone(response: SimulatorResponse): { label: string; className: string } {
  if (response.status === 403) {
    return { label: 'Blocked by 403', className: 'border-rust/45 bg-rust/10 text-rust' };
  }
  if (response.disposition === 'passthrough' && response.status < 400) {
    return { label: 'Reached the real app', className: 'border-sage/35 bg-sage/[0.07] text-sage' };
  }
  if (response.disposition === 'decoy' && response.status >= 200 && response.status < 400) {
    return { label: 'Fake answer', className: 'border-teal/35 bg-teal/[0.07] text-teal' };
  }
  return { label: `HTTP ${response.status}`, className: 'border-clay/35 bg-clay/[0.07] text-clay' };
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export default function AttackerTerminal({ responses, pending, onInspect }: Props) {
  const [tab, setTab] = useState<'replies' | 'preview'>('replies');
  const latest = responses[0];
  const current = pending[pending.length - 1];

  return (
    <section className="surface flex min-h-[420px] flex-col overflow-hidden" aria-labelledby="attacker-title">
      <div className="border-b border-line-soft bg-rust/[0.035] px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rust" />
            <div>
              <div className="section-label">Captured from the fake city</div>
              <h3 id="attacker-title" className="text-sm font-semibold text-ink">What the attacker sees</h3>
            </div>
          </div>
          <div className="flex gap-1 rounded-xl border border-line bg-paper p-1">
            {(['replies', 'preview'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === item ? 'bg-teal/10 text-teal' : 'text-faint hover:text-muted'
                }`}
                aria-pressed={tab === item}
              >
                {item === 'replies' ? 'Replies' : 'Page preview'}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Everything below came from a real request to this server. The data inside the replies is fake on purpose.
        </p>
      </div>

      {current && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-clay/[0.045] px-5 py-2.5 text-xs text-clay">
          <span className="num truncate">Sending {current.label}: {current.path}</span>
          <span className="shrink-0">Waiting for reply</span>
        </div>
      )}

      {responses.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-raised text-teal">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 7 7 5-7 5V7Zm9 0h5m-5 5h5m-5 5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-ink">No replies captured yet</p>
          <p className="mt-1 max-w-[38ch] text-xs leading-relaxed text-faint">
            Choose a request above. The real reply will appear here, exactly as the fake city sent it.
          </p>
        </div>
      ) : tab === 'replies' ? (
        <div className="max-h-[620px] flex-1 space-y-4 overflow-y-auto bg-paper p-4" aria-live="polite">
          {responses.map((response) => {
            const tone = responseTone(response);
            return (
              <article key={response.id} className="surface-raised overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-2.5">
                  <span className={`tag px-2 py-0.5 text-[11px] ${tone.className}`}>{tone.label}</span>
                  <span className="num text-[11px] text-faint">{response.latencyMs} ms</span>
                </div>
                <div className="space-y-2 px-3 py-3">
                  <div className="num break-all text-[11px] leading-relaxed text-teal">
                    {response.method} http://aegiscloud.invalid{response.path}
                  </div>
                  <div className="num text-[11px] text-muted">HTTP/1.1 {response.status}</div>
                  {response.note && (
                    <div className="text-[11px] leading-relaxed text-faint">{plainText(response.note)}</div>
                  )}
                  {response.aiWakeup && (
                    <div className="text-[11px] text-plum">The AI was used once to invent this answer.</div>
                  )}
                  <pre className="term-line num max-h-64 overflow-auto rounded-lg border border-line-soft bg-paper p-3 text-[11px] leading-relaxed text-muted">
                    {response.body}
                  </pre>
                  <button
                    onClick={() => onInspect(response.sessionId)}
                    className="focus-ring text-xs font-medium text-teal hover:text-ink"
                  >
                    Inspect this session
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 bg-paper p-4">
          {!latest ? (
            <div className="text-sm text-faint">No reply to preview yet.</div>
          ) : latest.body.trim().startsWith('<') ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-faint">
                <span>Fake page preview</span>
                <span className="num truncate">aegiscloud.invalid{latest.path}</span>
              </div>
              <iframe
                title="Fake page preview"
                sandbox=""
                srcDoc={latest.body}
                className="h-[440px] w-full rounded-xl border border-line bg-white"
              />
            </div>
          ) : (
            <div className="surface-raised overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-line-soft px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-rust/70" />
                <span className="h-2 w-2 rounded-full bg-clay/70" />
                <span className="h-2 w-2 rounded-full bg-sage/70" />
                <span className="num ml-3 truncate text-[11px] text-faint">aegiscloud.invalid{latest.path}</span>
              </div>
              <pre className="term-line num max-h-[420px] overflow-auto p-4 text-[11px] leading-relaxed text-muted">
                {formatBody(latest.body)}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
