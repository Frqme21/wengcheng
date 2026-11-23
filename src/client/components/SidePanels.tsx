import type { AttackCategory, RequestEvent, TelemetrySnapshot } from '../../shared/types';

const CATEGORY_LABELS: Record<AttackCategory, string> = {
  none: 'normal visit',
  recon: 'secret file scan',
  sqli: 'SQL trick',
  traversal: 'file path trick',
  rce: 'command trick',
  scraping: 'fast scraping',
  novel: 'new request',
};

function plainText(value: string): string {
  return value.replace(/\s\u2014\s/g, ', ');
}

function summarize(event: RequestEvent): string {
  if (event.disposition === 'blocked') return 'Blocked before reaching anything';
  if (event.disposition === 'passthrough') return 'Normal request reached the real app';
  if (event.disposition === 'tarpit') return 'Scraper slowed down with a large fake file';

  const byCategory: Record<AttackCategory, string> = {
    none: 'Got a believable fake answer',
    recon: 'Secret file scan got fake secrets',
    sqli: 'SQL trick got a fake database answer',
    traversal: 'File path trick got a fake file answer',
    rce: 'Command trick got a fake command answer',
    scraping: 'Scraper got a fake file, sent slowly',
    novel: 'New request made the AI invent a fake answer',
  };
  return byCategory[event.category];
}

function dispositionTag(event: RequestEvent): { label: string; className: string } {
  switch (event.disposition) {
    case 'passthrough':
      return { label: 'Real app', className: 'border-sage/35 bg-sage/[0.07] text-sage' };
    case 'decoy':
      return { label: 'Fake answer', className: 'border-teal/35 bg-teal/[0.07] text-teal' };
    case 'tarpit':
      return { label: 'Slowed down', className: 'border-clay/35 bg-clay/[0.07] text-clay' };
    case 'blocked':
      return { label: 'Blocked', className: 'border-rust/45 bg-rust/10 text-rust' };
  }
}

export function EventStream({
  events, onSelect, selectedId,
}: {
  events: RequestEvent[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <section className="surface animate-rise flex min-h-[320px] flex-col overflow-hidden" aria-labelledby="requests-title">
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-6 py-4">
        <div>
          <div className="section-label">Most recent first</div>
          <h3 id="requests-title" className="text-sm font-semibold text-ink">Recent requests</h3>
        </div>
        <span className="tag border-line text-faint num">{events.length} shown</span>
      </div>

      <div className="stagger max-h-[380px] flex-1 overflow-y-auto">
        {events.length === 0 && (
          <div className="px-5 py-12 text-center text-sm leading-relaxed text-faint">
            No requests yet. Use a button above to send one.
          </div>
        )}
        {events.map((event) => {
          const tag = dispositionTag(event);
          return (
            <button
              key={event.id}
              onClick={() => onSelect(event.sessionId)}
              className={`focus-ring block min-h-11 w-full border-b border-line-soft px-6 py-4 text-left transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-raised/70 ${selectedId === event.sessionId ? 'bg-teal/[0.05]' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{summarize(event)}</span>
                <span className={`tag shrink-0 text-[11px] ${tag.className}`}>{tag.label}</span>
              </div>
              <div className="num mt-2 truncate text-[11px] text-muted">{event.method} {plainText(event.path)}</div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-faint">
                <span>{CATEGORY_LABELS[event.category]}</span>
                <span className="num">{event.latencyMs} ms · {event.sessionId.slice(-6)}</span>
              </div>
              {event.route && (
                <div className="mt-2 text-[11px] text-clay">
                  Quietly sent to the fake city
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function CachePanel({ snapshot }: { snapshot: TelemetrySnapshot | null }) {
  const entries = snapshot?.cache ?? [];
  return (
    <section className="surface animate-rise flex min-h-[320px] flex-col overflow-hidden" aria-labelledby="cache-title">
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-6 py-4">
        <div>
          <div className="section-label">Fast answers, no model call</div>
          <h3 id="cache-title" className="text-sm font-semibold text-ink">Saved fake answers</h3>
        </div>
        <span className="tag border-sage/35 bg-sage/[0.06] text-sage num">{entries.length} saved</span>
      </div>

      <p className="border-b border-line-soft px-6 py-3 text-xs leading-relaxed text-faint">
        The first time a trick appears we build a decoy. After that, the same answer is reused instantly.
      </p>

      <div className="stagger max-h-[300px] flex-1 overflow-y-auto">
        {entries.length === 0 && (
          <div className="px-5 py-10 text-center text-sm leading-relaxed text-faint">
            No fake answers saved yet. Send a suspicious request to create one.
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.key} className="border-b border-line-soft px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="num truncate text-xs text-ink">{plainText(entry.pathPattern)}</span>
              <span className={`tag shrink-0 text-[11px] ${
                entry.source === 'ai'
                  ? 'border-plum/40 bg-plum/[0.07] text-plum'
                  : 'border-line text-faint'
              }`}>
                {entry.source === 'ai' ? 'Written by AI once' : 'Built in'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-faint">
              <span>Fake answer for {CATEGORY_LABELS[entry.category]}</span>
              <span className="num">Used {entry.hits} {entry.hits === 1 ? 'time' : 'times'}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LlmPanel({ snapshot }: { snapshot: TelemetrySnapshot | null }) {
  const llm = snapshot?.llm;
  const configured = llm?.configured ?? false;
  const totals = snapshot?.totals;
  const saved = totals?.tokensSaved ?? 0;
  const spent = totals?.tokensSpent ?? 0;
  const withoutAi = saved + spent > 0 ? Math.round((saved / (saved + spent)) * 100) : 100;

  return (
    <section className="surface animate-rise p-6" aria-labelledby="ai-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="section-label">Only when needed</div>
          <h3 id="ai-title" className="text-sm font-semibold text-ink">AI use</h3>
        </div>
        <span className={`tag ${configured ? 'border-plum/40 bg-plum/[0.07] text-plum' : 'border-line text-faint'}`}>
          {configured ? 'AI ready' : 'Saved decoys only'}
        </span>
      </div>

      <div className="stagger mt-6 grid grid-cols-2 gap-4">
        <div className="surface-raised p-4">
          <div className="text-[11px] text-faint">Times the AI was used</div>
          <div className="num mt-2 text-xl font-semibold text-plum">{totals?.aiWakeups ?? 0}</div>
        </div>
        <div className="surface-raised p-4">
          <div className="text-[11px] text-faint">Tokens spent</div>
          <div className="num mt-2 text-xl font-semibold text-clay">{spent}</div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Answered without the AI</span>
          <span className="num font-semibold text-sage">{withoutAi}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line-soft">
          <div
            className="h-full w-full origin-left rounded-full bg-sage transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `scaleX(${withoutAi / 100})` }}
          />
        </div>
        <div className="num mt-2 text-[11px] text-faint">{saved.toLocaleString()} tokens saved</div>
      </div>

      <p className="mt-6 border-t border-line-soft pt-4 text-xs leading-relaxed text-faint">
        {configured
          ? `Using ${llm?.model ?? 'the configured model'}. Normal traffic and known tricks never wake the model. A new kind of request wakes it once, then the answer is saved.`
          : 'No model is configured. Built-in fake answers handle every request, and new requests get a procedural decoy.'}
      </p>
    </section>
  );
}
