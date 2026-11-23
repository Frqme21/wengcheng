type Props = {
  /** 0..1 draw progress, used by the preloader */
  ring?: number;
  className?: string;
};

/** Wèngchéng mark: the urn-city ring, its gate and one canary dot */
export default function LogoMark({ ring = 1, className }: Props) {
  const dot = ring > 0.85 ? 1 : Math.max(0, (ring - 0.5) * 2);
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true" focusable="false">
      <circle
        cx="50"
        cy="50"
        r="46"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - ring}
        transform="rotate(-90 50 50)"
        style={{ opacity: ring <= 0 ? 0 : 1 }}
      />
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: ring }}>
        <path d="M27 76V54a23 23 0 0 1 46 0v22" />
        <path d="M19 76h62" />
        <path d="M42 76V63a8 8 0 0 1 16 0v13" strokeWidth="2.5" />
      </g>
      <circle cx="50" cy="42" r="4.5" fill="var(--color-accent)" style={{ opacity: dot }} />
    </svg>
  );
}
