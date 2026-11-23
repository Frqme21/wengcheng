import type { MouseEvent } from 'react';
import type { SimulatorAction } from '../../shared/types';
import Magnetic from './Magnetic';
import { PALETTE } from '../theme';

interface Props {
  onSimulate: (action: SimulatorAction) => void;
  onPlayDemo: (event: MouseEvent<HTMLButtonElement>) => void;
  onTakeTour: (event: MouseEvent<HTMLButtonElement>) => void;
  onReset: () => void;
  engaged: boolean;
  busy: boolean;
  demoStatus: string | null;
  aiReady: boolean;
}

type Tone = 'sage' | 'rust' | 'clay' | 'plum';

function buildActions(aiReady: boolean): Array<{
  action: SimulatorAction;
  step: string;
  label: string;
  outcome: string;
  tone: Tone;
}> {
  return [
    { action: 'legitimate', step: '1', label: 'Send a normal visitor', outcome: 'Real app answers. No AI.', tone: 'sage' },
    { action: 'sqli', step: '2', label: 'Try an old SQL trick', outcome: 'Saved fake ledger. No AI.', tone: 'rust' },
    { action: 'recon', step: '3', label: 'Look for secret files', outcome: 'Fake secrets and admin page.', tone: 'clay' },
    {
      action: 'novel',
      step: '4',
      label: 'Ask for a new endpoint',
      outcome: aiReady ? 'AI invents a fake table once.' : 'Saved rule invents a fake table once.',
      tone: 'plum',
    },
    { action: 'scrape', step: '5', label: 'Scrape data too fast', outcome: 'Large fake file, sent slowly.', tone: 'clay' },
  ];
}

const TOUR_IDS: Partial<Record<SimulatorAction, string>> = {
  legitimate: 'sim-legitimate',
  sqli: 'sim-sqli',
  novel: 'sim-novel',
  portcullis: 'gate-toggle',
};

const TONES: Record<Tone, { border: string; bg: string; text: string; dot: string }> = {
  sage: { border: 'hover:border-sage/50', bg: 'bg-sage/[0.05]', text: 'text-sage', dot: PALETTE.sage },
  rust: { border: 'hover:border-rust/50', bg: 'bg-rust/[0.05]', text: 'text-rust', dot: PALETTE.rust },
  clay: { border: 'hover:border-clay/50', bg: 'bg-clay/[0.05]', text: 'text-clay', dot: PALETTE.clay },
  plum: { border: 'hover:border-plum/50', bg: 'bg-plum/[0.05]', text: 'text-plum', dot: PALETTE.plum },
};

function PlayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 2.8 13 8l-8.5 5.2V2.8Z" fill="currentColor" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5V6H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TourIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.6V8l2.3 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ControlBar({
  onSimulate,
  onPlayDemo,
  onTakeTour,
  onReset,
  engaged,
  busy,
  demoStatus,
  aiReady,
}: Props) {
  const disabled = busy;
  const actions = buildActions(aiReady);

  return (
    <section className="surface animate-rise px-6 py-16 sm:px-8" aria-labelledby="try-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-[65ch] flex-col gap-2">
          <div className="section-label">Interactive demo</div>
          <h2 id="try-title" className="text-lg font-semibold text-ink">Send a request and watch what happens</h2>
          <p className="text-sm leading-relaxed text-muted">
            Every button sends a real HTTP request to this server. The reply appears in the attacker view on the right.
          </p>
        </div>
        <div className="stagger flex flex-wrap items-start gap-2">
          <Magnetic>
            <button className="btn btn-primary" onClick={onPlayDemo} disabled={disabled}>
              <PlayIcon />
              {demoStatus ?? 'Play the whole story'}
            </button>
          </Magnetic>
          <Magnetic>
            <button className="btn btn-quiet" onClick={onTakeTour} disabled={disabled}>
              <TourIcon />
              Take 1-min Tour
            </button>
          </Magnetic>
          <button className="btn btn-quiet" onClick={onReset} disabled={disabled}>
            <ResetIcon />
            Start over
          </button>
        </div>
      </div>

      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((item) => {
          const tone = TONES[item.tone];
          return (
            <button
              key={item.action}
              data-tour-id={TOUR_IDS[item.action]}
              disabled={disabled}
              onClick={() => onSimulate(item.action)}
              className={`focus-ring flex min-h-11 items-start gap-4 rounded-lg border border-line px-4 py-4 text-left transition-[border-color,background-color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${tone.bg} ${tone.border}`}
            >
              <span
                className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-paper text-xs"
                style={{ color: tone.dot }}
              >
                {item.step}
              </span>
              <span className="flex min-w-0 flex-col gap-2">
                <span className="block text-sm font-semibold text-ink">{item.label}</span>
                <span className={`block text-xs ${tone.text}`}>{item.outcome}</span>
              </span>
            </button>
          );
        })}

        <button
          data-tour-id="gate-toggle"
          disabled={disabled}
          onClick={() => onSimulate('portcullis')}
          className={`focus-ring flex min-h-11 items-start gap-4 rounded-lg border px-4 py-4 text-left transition-[border-color,background-color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
            engaged
              ? 'border-rust/50 bg-rust/[0.07]'
              : 'border-line bg-card hover:border-rust/40'
          }`}
        >
          <span className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-paper text-xs ${engaged ? 'text-rust' : 'text-faint'}`}>
            {engaged ? 'ON' : 'OFF'}
          </span>
          <span className="flex min-w-0 flex-col gap-2">
            <span className="block text-sm font-semibold text-ink">
              {engaged ? 'Turn off the 403 gate' : 'Turn on the 403 gate'}
            </span>
            <span className="block text-xs text-rust">
              {engaged ? 'Hostile traffic is being blocked.' : 'Hostile traffic will get a 403 response.'}
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
