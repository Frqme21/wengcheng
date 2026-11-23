import type { TelemetrySnapshot } from '../../shared/types';
import { PALETTE } from '../theme';

interface Props {
  snapshot: TelemetrySnapshot | null;
}

type Accent = 'rust' | 'clay' | 'plum' | 'sage';

const ACCENTS: Record<Accent, string> = {
  rust: PALETTE.rust,
  clay: PALETTE.clay,
  plum: PALETTE.plum,
  sage: PALETTE.sage,
};

function Bar({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-8 items-end gap-1" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={index}
          className="w-1.5 rounded-t-sm"
          style={{
            height: `${Math.max(12, (value / max) * 100)}%`,
            background: color,
            opacity: 0.4 + index * 0.06,
          }}
        />
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  help,
  explanation,
  accent,
  bars,
}: {
  label: string;
  value: string;
  unit?: string;
  help: string;
  explanation: string;
  accent: Accent;
  bars: number[];
}) {
  const color = ACCENTS[accent];
  return (
    <div className="surface p-6" style={{ borderTop: `2px solid ${color}` }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{label}</h3>
            <span
              title={help}
              tabIndex={0}
              className="focus-ring flex h-11 w-11 shrink-0 cursor-help items-center justify-center"
              aria-label={help}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-[10px] text-faint">?</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="num text-3xl font-semibold" style={{ color }}>{value}</span>
            {unit && <span className="text-sm text-faint">{unit}</span>}
          </div>
          <p className="mt-2 max-w-[32ch] text-xs leading-relaxed text-faint">{explanation}</p>
        </div>
        <div className="shrink-0 pt-1"><Bar values={bars} color={color} /></div>
      </div>
    </div>
  );
}

export default function MetricsBar({ snapshot }: Props) {
  const totals = snapshot?.totals;
  const events = snapshot?.events ?? [];

  return (
    <section aria-label="Live numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        label="Attackers in the fake city"
        value={String(totals?.activeTrapped ?? 0)}
        help="Sessions the gate marked as suspicious. They receive fake answers instead of reaching the real app."
        explanation="Each dot on the map is one of these sessions. Click it to see what that attacker tried."
        accent="rust"
        bars={events.slice(0, 6).map((event) => (event.disposition === 'passthrough' ? 1 : 5))}
      />
      <Metric
        label="Time taken from attackers"
        value={(totals?.secondsWasted ?? 0).toFixed(1)}
        unit="seconds"
        help="The extra time added to hostile replies. The gate slows replies from 400ms up to 3500ms and sends large files slowly."
        explanation="This is time a scanner spends waiting on us instead of attacking the real system."
        accent="clay"
        bars={events.slice(0, 6).map((event) => event.latencyMs)}
      />
      <Metric
        label="Times the AI was used"
        value={String(totals?.aiWakeups ?? 0)}
        help="A model call happens only for a new kind of probe with no saved decoy, or when you ask for an AI report."
        explanation={`The model is ${snapshot?.llm.configured ? `ready (${snapshot.llm.model})` : 'not configured, so built-in decoys are used'}.`}
        accent="plum"
        bars={events.slice(0, 6).map((event) => (event.aiWakeup ? 6 : 1))}
      />
      <Metric
        label="Model calls avoided"
        value={(totals?.tokensSaved ?? 0).toLocaleString()}
        unit="tokens"
        help="Estimated tokens not spent because fast rules and saved decoys answered instead of the model."
        explanation={`${totals?.heuristicHits ?? 0} quick decisions and ${totals?.cacheHits ?? 0} saved decoy replays so far.`}
        accent="sage"
        bars={events.slice(0, 6).map((event) => event.tokensSaved / 100)}
      />
    </section>
  );
}
