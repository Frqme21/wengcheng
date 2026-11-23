import { useEffect, useRef, useState } from 'react';
import type { SessionRecord, ThreatAnalysis } from '../../shared/types';
import { PALETTE } from '../theme';

interface Props {
  session: SessionRecord | null;
  open: boolean;
  latestAnalysis: ThreatAnalysis | null;
  analyzing: boolean;
  aiReady: boolean;
  onClose: () => void;
  onAnalyze: (sessionId: string, forceAi: boolean) => void;
}

const DECOY_LABELS: Record<string, string> = {
  'decoy-auth-db': 'Fake database',
  'decoy-env-vault': 'Fake secrets file',
  'decoy-payroll': 'Fake admin data',
  'tarpit-sink': 'Slow export',
  'novel:generic': 'AI invented answer',
};

const CATEGORY_SUMMARY: Record<string, string> = {
  none: 'It looked like a normal visit.',
  recon: 'It went looking for secret files.',
  sqli: 'It tried an old SQL trick.',
  traversal: 'It tried to reach files outside the app.',
  rce: 'It tried to run a command.',
  scraping: 'It tried to scrape data too quickly.',
  novel: 'It asked for something we had not seen before.',
};

function plainText(value: string): string {
  return value.replace(/\s\u2014\s/g, ', ');
}

function riskTone(score: number, hostile: boolean) {
  if (!hostile) return { color: PALETTE.sage, label: 'Normal visit' };
  if (score >= 100) return { color: PALETTE.rust, label: 'High risk' };
  if (score >= 55) return { color: PALETTE.clay, label: 'Suspicious' };
  return { color: PALETTE.teal, label: 'Watching' };
}

function Gauge({ score, hostile }: { score: number; hostile: boolean }) {
  const tone = riskTone(score, hostile);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, score / 200) * circumference;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke={PALETTE.line} strokeWidth="8" />
        <circle
          className="gauge-progress"
          cx="50" cy="50" r={radius} fill="none" stroke={tone.color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-lg font-semibold" style={{ color: tone.color }}>{score}</span>
        <span className="text-[9px] text-faint">risk score</span>
      </div>
    </div>
  );
}

export default function SessionDrawer({
  session, open, latestAnalysis, analyzing, aiReady, onClose, onAnalyze,
}: Props) {
  const asideRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !asideRef.current) return;
      const focusable = [...asideRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!mounted || !session) return null;

  const hostile = session.status !== 'legitimate';
  const tone = riskTone(session.riskScore, hostile);
  const analysis = session.analysis ?? (latestAnalysis?.sessionId === session.id ? latestAnalysis : null);
  const seconds = session.timeWastedMs / 1000;

  return (
    <div
      className={`drawer-backdrop fixed inset-0 z-50 flex justify-end bg-ink/25 ${closing ? 'is-closing' : ''}`}
      onClick={onClose}
    >
      <aside
        ref={asideRef}
        data-tour-id="session-drawer"
        className={`drawer-panel flex h-full w-full max-w-[544px] flex-col border-l border-line bg-card ${closing ? 'is-closing' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-6">
          <div className="flex flex-col gap-2">
            <div className="section-label">Session details</div>
            <h2 id="drawer-title" className="num text-lg font-semibold text-ink">{session.id}</h2>
            <p className="text-xs text-faint">Started {new Date(session.startedAt).toLocaleTimeString()}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-line text-muted transition-[color,border-color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-rust/50 hover:text-rust active:scale-[0.98]"
            aria-label="Close session details"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="drawer-stagger flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="surface-raised p-6">
            <div className="flex items-center gap-6">
              <Gauge score={session.riskScore} hostile={hostile} />
              <div className="flex min-w-0 flex-col gap-4">
                <span
                  className="tag"
                  style={{
                    color: tone.color,
                    borderColor: `color-mix(in oklch, ${tone.color} 33%, transparent)`,
                    backgroundColor: `color-mix(in oklch, ${tone.color} 7%, transparent)`,
                  }}
                >
                  {tone.label}
                </span>
                <p className="text-sm leading-relaxed text-ink">
                  {hostile
                    ? `This session made ${session.requestCount} ${session.requestCount === 1 ? 'request' : 'requests'}. ${CATEGORY_SUMMARY[session.category] ?? 'It looked suspicious.'}`
                    : 'This session made normal requests and reached the real app.'}
                </p>
                <p className="text-xs leading-relaxed text-faint">
                  {hostile
                    ? `We kept it busy for ${seconds.toFixed(1)} seconds and showed it ${session.decoysTouched.length} fake ${session.decoysTouched.length === 1 ? 'answer' : 'answers'}.`
                    : 'No fake answers were shown and no AI was used.'}
                </p>
              </div>
            </div>
          </div>

          <Section title="The short version">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Requests" value={String(session.requestCount)} />
              <Stat label="Time wasted by attacker" value={`${seconds.toFixed(1)}s`} accent={PALETTE.clay} />
              <Stat label="Times AI was used" value={String(session.aiWakeups)} accent={PALETTE.plum} />
              <Stat label="Tokens saved" value={session.tokensSaved.toLocaleString()} accent={PALETTE.sage} />
            </div>
          </Section>

          <Section title="Fake answers they touched">
            <div className="flex flex-wrap gap-2">
              {session.decoysTouched.length === 0 && <span className="text-xs text-faint">None. This visitor stayed on the real path.</span>}
              {session.decoysTouched.map((id) => (
                <span key={id} className="tag border-teal/35 bg-teal/[0.06] text-teal">
                  {DECOY_LABELS[id] ?? id}
                </span>
              ))}
            </div>
          </Section>

          <Section title="What they tried">
            {session.payloads.length === 0 ? (
              <div className="text-xs text-faint">No attack payloads were captured.</div>
            ) : (
              <div className="space-y-2">
                {session.payloads.map((payload) => (
                  <div key={payload.id} className="surface-raised p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium text-rust">{plainText(payload.signature)}</span>
                      <span className="text-faint">{CATEGORY_SUMMARY[payload.category] ?? payload.category}</span>
                    </div>
                    <div className="num mt-2 break-all text-[11px] leading-relaxed text-muted">{plainText(payload.value)}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Request order">
            {session.pathHistory.length === 0 ? (
              <div className="text-xs text-faint">No requests were recorded.</div>
            ) : (
              <ol className="space-y-2">
                {session.pathHistory.slice(0, 12).map((path, index) => (
                  <li key={`${path}-${index}`} className="num flex gap-4 text-[11px] text-muted">
                    <span className="shrink-0 text-faint">{String(index + 1).padStart(2, '0')}</span>
                    <span className="break-all">{plainText(path)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {analysis && (
            <Section title="Analyst summary">
              <div className="space-y-4 rounded-xl border border-plum/25 bg-plum/[0.035] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-faint">
                  <span className="text-plum">{plainText(analysis.provider)}</span>
                  <span className="num">{analysis.confidence}% confidence</span>
                </div>
                <p className="text-sm leading-relaxed text-ink">{plainText(analysis.narrative)}</p>
                {analysis.keyFindings.length > 0 && (
                  <ul className="space-y-2 text-xs leading-relaxed text-muted">
                    {analysis.keyFindings.map((finding) => (
                      <li key={finding} className="flex gap-2"><span className="text-plum">•</span> {plainText(finding)}</li>
                    ))}
                  </ul>
                )}
                {analysis.mitre.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {analysis.mitre.map((item) => (
                      <span key={item} className="tag border-line text-faint">{plainText(item)}</span>
                    ))}
                  </div>
                )}
                <div className="border-t border-plum/15 pt-4 text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-ink">Suggested action:</span> {plainText(analysis.recommendation)}
                </div>
              </div>
            </Section>
          )}
        </div>

        <footer className="space-y-2 border-t border-line-soft bg-paper/60 px-6 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              disabled={analyzing}
              onClick={() => onAnalyze(session.id, false)}
              className="btn btn-quiet"
            >
              {analyzing ? 'Writing report' : 'Write a short report'}
            </button>
            <button
              disabled={analyzing}
              onClick={() => onAnalyze(session.id, true)}
              className="btn border-plum/40 bg-plum/[0.08] text-plum hover:bg-plum/[0.14]"
            >
              {analyzing ? 'Writing report' : 'Use AI for a deeper report'}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <a className="btn btn-quiet min-h-11 text-xs" href={`/api/reports/${encodeURIComponent(session.id)}.md`} download>
              Download report
            </a>
            <a className="btn btn-quiet min-h-11 text-xs" href={`/api/reports/${encodeURIComponent(session.id)}.json`} download>
              Download raw data
            </a>
          </div>
          <p className="text-center text-[11px] text-faint">
            {aiReady
              ? 'The short report uses saved rules. The deeper report calls the model and costs tokens.'
              : 'Both reports are generated locally right now. No model key is needed.'}
          </p>
        </footer>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="section-label">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value, accent = PALETTE.ink }: { label: string; value: string; accent?: string }) {
  return (
    <div className="surface-raised p-4">
      <div className="text-[11px] leading-snug text-faint">{label}</div>
      <div className="num mt-2 text-lg font-semibold" style={{ color: accent }}>{value}</div>
    </div>
  );
}
