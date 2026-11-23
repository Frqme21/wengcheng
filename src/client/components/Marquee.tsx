import { useEffect, useRef } from "react";
import { gsap, prefersReduced, debounce } from "../lib/motion";
import { scrollState } from "../lib/lenis";

const WORDS = ["Canary", "Tarpit", "Slow-drip", "Portcullis", "Decoy", "MITRE tags", "Sentinel"];

function Set({ hidden }: { hidden?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center gap-8 pr-8 motion-reduce:flex-wrap ${hidden ? "motion-reduce:hidden" : ""}`} aria-hidden={hidden}>
      {WORDS.map((w, i) => (
        <span key={w} className="flex items-center gap-8">
          <span className={`font-display text-[clamp(2rem,5.5vw,4.5rem)] leading-none ${i % 2 ? "text-muted" : "text-ink"}`}>{w}</span>
          <span className="h-2 w-2 rounded-full bg-accent" />
        </span>
      ))}
    </div>
  );
}

/** Marquee whose speed and skew follow the instantaneous Lenis scroll velocity */
export default function Marquee() {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el || prefersReduced()) return;
    let width = el.scrollWidth / 2;
    let x = 0;
    let skew = 0;
    const measure = debounce(() => {
      width = el.scrollWidth / 2;
    }, 150);
    window.addEventListener("resize", measure);

    const tick = (_t: number, dtMs: number) => {
      const v = scrollState.velocity;
      x -= (0.6 + Math.min(Math.abs(v), 40) * 0.45) * (dtMs / 16.67);
      if (x <= -width) x += width;
      skew += (Math.max(-8, Math.min(8, v * -0.35)) - skew) * 0.1;
      el.style.transform = `translate3d(${x}px,0,0) skewX(${skew}deg)`;
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      measure.cancel();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div className="overflow-hidden border-y border-line py-8" role="presentation">
      <div ref={track} className="kinetic flex w-max motion-reduce:w-auto">
        <Set />
        <Set hidden />
      </div>
    </div>
  );
}
