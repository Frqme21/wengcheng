import type { AttackCategory, SessionRecord, TelemetrySnapshot } from '../../shared/types';
import { PALETTE } from '../theme';

interface Props {
  snapshot: TelemetrySnapshot | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const DECOY_NODES = [
  { id: 'decoy-auth-db', label: 'Fake database', x: 720, y: 414, color: PALETTE.teal },
  { id: 'decoy-env-vault', label: 'Fake secrets file', x: 918, y: 414, color: PALETTE.clay },
  { id: 'decoy-payroll', label: 'Fake admin data', x: 720, y: 456, color: PALETTE.plum },
  { id: 'tarpit-sink', label: 'Slow export', x: 918, y: 456, color: PALETTE.rust },
];

function categoryLabel(category: AttackCategory): string {
  const labels: Record<AttackCategory, string> = {
    none: 'normal visit',
    recon: 'secret file scan',
    sqli: 'SQL trick',
    traversal: 'file path trick',
    rce: 'command trick',
    scraping: 'fast scraping',
    novel: 'new kind of request',
  };
  return labels[category];
}

function riskColor(session: SessionRecord): string {
  if (session.riskScore >= 100) return PALETTE.rust;
  if (session.riskScore >= 55) return PALETTE.clay;
  return PALETTE.teal;
}

function riskLabel(score: number): string {
  if (score >= 100) return 'high risk';
  if (score >= 55) return 'suspicious';
  return 'watching';
}

function NodeBox({
  x, y, w, h, title, subtitle, color, badge,
}: {
  x: number; y: number; w: number; h: number;
  title: string; subtitle: string; color: string; badge: string;
}) {
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h} rx="14"
        fill={PALETTE.card} stroke={color} strokeOpacity="0.55" strokeWidth="1.4"
      />
      <rect x={x} y={y} width="4" height={h} rx="2" fill={color} />
      <text x={x + 20} y={y + 34} fill={PALETTE.ink} fontSize="15" fontWeight="600" fontFamily="Inter, sans-serif">
        {title}
      </text>
      <text x={x + 20} y={y + 56} fill={PALETTE.muted} fontSize="11" fontFamily="Inter, sans-serif">
        {subtitle}
      </text>
      <rect x={x + w - 116} y={y + 14} width="98" height="22" rx="11" fill={color} fillOpacity="0.09" stroke={color} strokeOpacity="0.35" />
      <text x={x + w - 67} y={y + 29} textAnchor="middle" fill={color} fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif">
        {badge}
      </text>
    </g>
  );
}

export default function TopologyMap({ snapshot, selectedId, onSelect }: Props) {
  const sessions = (snapshot?.sessions ?? [])
    .filter((s) => s.status !== 'legitimate')
    .slice(0, 7);
  const engaged = snapshot?.portcullis.engaged ?? false;
  const avgMs = (snapshot?.totals.avgDecisionMicros ?? 0) / 1000;

  return (
    <div data-tour-id="traffic-map" className="surface animate-rise overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft px-6 py-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${sessions.length > 0 ? 'bg-rust' : 'bg-sage'}`} />
          <span className="text-sm font-semibold text-ink">One request, two possible paths</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="tag border-line text-faint num">{snapshot?.uptimeSeconds ?? 0}s uptime</span>
          <span className={`tag ${engaged ? 'border-rust/45 bg-rust/10 text-rust' : 'border-sage/35 bg-sage/[0.06] text-sage'}`}>
            {engaged ? '403 gate on' : '403 gate off'}
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox="0 0 1160 560" className="min-w-[760px] w-full" role="img" aria-label="Map of how requests are routed to the real app or the fake city">
          <defs>
            <linearGradient id="gateFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={PALETTE.teal} stopOpacity="0.14" />
              <stop offset="100%" stopColor={PALETTE.card} stopOpacity="0.98" />
            </linearGradient>
          </defs>

          <rect x="36" y="104" width="250" height="320" rx="18" fill={PALETTE.raised} fillOpacity="0.6" stroke={PALETTE.line} strokeDasharray="5 7" />
          <text x="56" y="96" fill={PALETTE.faint} fontSize="10" fontFamily="Inter, sans-serif" letterSpacing="1.4">VISITORS</text>

          <rect x="700" y="92" width="420" height="150" rx="18" fill={PALETTE.raised} fillOpacity="0.5" stroke={PALETTE.teal} strokeOpacity="0.35" strokeDasharray="5 7" />
          <text x="720" y="84" fill={PALETTE.teal} fontSize="10" fontFamily="Inter, sans-serif" letterSpacing="1.4">REAL APP, PROTECTED</text>
          <NodeBox x={720} y={110} w={380} h={104} title="Real app" subtitle="Normal visitors pass straight through" color={PALETTE.teal} badge="PROTECTED" />

          <rect x="700" y="284" width="420" height="244" rx="18" fill={PALETTE.raised} fillOpacity="0.5" stroke={PALETTE.clay} strokeOpacity="0.35" strokeDasharray="5 7" />
          <text x="720" y="276" fill={PALETTE.clay} fontSize="10" fontFamily="Inter, sans-serif" letterSpacing="1.4">FAKE CITY, DECOYS</text>
          <NodeBox
            x={720} y={300} w={380} h={84}
            title="Fake city" subtitle="Suspicious visitors get believable fake answers"
            color={engaged ? PALETTE.rust : PALETTE.clay}
            badge={engaged ? 'GATE ON' : 'TRAPPING'}
          />

          <path d="M 288 250 C 320 250, 340 250, 366 250" stroke={PALETTE.teal} strokeWidth="2" fill="none" className="flow-line" opacity="0.75" />
          <path d="M 486 230 C 590 180, 640 154, 716 154" stroke={PALETTE.teal} strokeWidth="2" fill="none" className="flow-line" opacity="0.75" />
          <path d="M 486 270 C 590 330, 640 360, 716 360" stroke={engaged ? PALETTE.rust : PALETTE.clay} strokeWidth="2" fill="none" className="flow-line" opacity="0.8" />

          <g>
            <circle cx="160" cy="250" r="42" fill={PALETTE.card} stroke={PALETTE.line} strokeWidth="1.5" />
            <text x="160" y="246" textAnchor="middle" fill={PALETTE.ink} fontSize="13" fontWeight="600" fontFamily="Inter, sans-serif">Requests</text>
            <text x="160" y="264" textAnchor="middle" fill={PALETTE.muted} fontSize="10" fontFamily="Inter, sans-serif">arriving now</text>
            <text x="160" y="316" textAnchor="middle" fill={PALETTE.faint} fontSize="10" fontFamily="Inter, sans-serif" className="num">
              {snapshot?.totals.requests ?? 0} checked
            </text>
          </g>

          {sessions.map((session, i) => {
            const cx = 306 + i * 9;
            const cy = 250 + (i % 2 === 0 ? -18 : 18);
            const color = riskColor(session);
            const selected = selectedId === session.id;
            return (
              <g
                key={session.id}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${session.id.slice(-6)}, ${categoryLabel(session.category)}, ${riskLabel(session.riskScore)}`}
                onClick={() => onSelect(session.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(session.id);
                }}
              >
                <title>{`${session.id.slice(-6)}: ${categoryLabel(session.category)}. ${riskLabel(session.riskScore)}. Click to inspect.`}</title>
                <circle cx={cx} cy={cy} r="22" fill="transparent" />
                <circle className="map-dot" cx={cx} cy={cy} r={selected ? 12 : 9} fill={PALETTE.card} stroke={color} strokeWidth={selected ? 2.4 : 1.7} />
                <circle cx={cx} cy={cy} r="3" fill={color} />
              </g>
            );
          })}

          <g>
            <path d="M 372 190 L 438 190 L 486 250 L 438 310 L 372 310 L 324 250 Z" fill="url(#gateFill)" stroke={PALETTE.teal} strokeWidth="1.8" />
            <text x="405" y="240" textAnchor="middle" fill={PALETTE.ink} fontSize="15" fontWeight="600" fontFamily="Inter, sans-serif">Front gate</text>
            <text x="405" y="260" textAnchor="middle" fill={PALETTE.teal} fontSize="10" fontFamily="Inter, sans-serif">Decides in {avgMs.toFixed(2)} ms</text>
            <text x="405" y="280" textAnchor="middle" fill={PALETTE.faint} fontSize="9" fontFamily="Inter, sans-serif">Rules and saved patterns</text>
            <rect x="344" y="330" width="122" height="24" rx="12" fill={PALETTE.teal} fillOpacity="0.08" stroke={PALETTE.teal} strokeOpacity="0.35" />
            <text x="405" y="346" textAnchor="middle" fill={PALETTE.teal} fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif">NO AI FOR KNOWN TRICKS</text>
          </g>

          {engaged && (
            <g>
              <line x1="540" y1="310" x2="540" y2="430" stroke={PALETTE.rust} strokeWidth="5" strokeDasharray="9 6" />
              <text x="540" y="452" textAnchor="middle" fill={PALETTE.rust} fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">Hostile traffic gets 403</text>
            </g>
          )}

          {DECOY_NODES.map((node) => {
            const touched = snapshot?.sessions.some((s) => s.decoysTouched.includes(node.id)) ?? false;
            return (
              <g key={node.id}>
                <rect
                  x={node.x} y={node.y} width="180" height="32" rx="11"
                  fill={PALETTE.card} stroke={node.color} strokeOpacity={touched ? 0.7 : 0.28}
                />
                <circle cx={node.x + 16} cy={node.y + 16} r="4" fill={node.color} opacity={touched ? 1 : 0.35} />
                <text x={node.x + 30} y={node.y + 21} fill={touched ? PALETTE.ink : PALETTE.muted} fontSize="11" fontFamily="Inter, sans-serif">
                  {node.label}
                </text>
                <text x={node.x + 168} y={node.y + 21} textAnchor="end" fill={node.color} fontSize="9" fontFamily="Inter, sans-serif">
                  {touched ? 'TOUCHED' : 'READY'}
                </text>
              </g>
            );
          })}

          <g transform="translate(50, 478)">
            <text x="0" y="0" fill={PALETTE.faint} fontSize="9" fontFamily="Inter, sans-serif" letterSpacing="1.4">HOW TO READ THIS</text>
            <circle cx="7" cy="20" r="4" fill={PALETTE.teal} /><text x="18" y="24" fill={PALETTE.muted} fontSize="10" fontFamily="Inter, sans-serif">Watching</text>
            <circle cx="92" cy="20" r="4" fill={PALETTE.clay} /><text x="103" y="24" fill={PALETTE.muted} fontSize="10" fontFamily="Inter, sans-serif">Suspicious</text>
            <circle cx="184" cy="20" r="4" fill={PALETTE.rust} /><text x="195" y="24" fill={PALETTE.muted} fontSize="10" fontFamily="Inter, sans-serif">High risk</text>
            <text x="0" y="54" fill={PALETTE.faint} fontSize="10" fontFamily="Inter, sans-serif">Click a dot between the requests and the gate to inspect it.</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
