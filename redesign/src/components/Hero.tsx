import { useEffect, useLayoutEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import Button from "./Button";
import { gsap, prefersReduced } from "../lib/motion";
import { scrollToTarget } from "../lib/lenis";
import type { Phase } from "../App";

const STATS = [
  { v: "<2", u: "ms", l: "per decision" },
  { v: "0", u: "", l: "tokens for clean traffic" },
  { v: "0", u: "", l: "Docker needed locally" },
];

export default function Hero({ phase }: { phase: Phase }) {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (prefersReduced() || !root.current) return;
    gsap.set(root.current.querySelectorAll("[data-in]"), { opacity: 0, y: 40 });
  }, []);

  const revealed = useRef(false);
  const tween = useRef<gsap.core.Tween | null>(null);
  useEffect(() => {
    if (!root.current || phase === "loading" || phase === "intro" || revealed.current) return;
    revealed.current = true;
    const items = root.current.querySelectorAll("[data-in]");
    if (prefersReduced()) {
      gsap.set(items, { opacity: 1, y: 0 });
      return;
    }
    tween.current = gsap.to(items, { opacity: 1, y: 0, duration: 1.4, stagger: 0.12, delay: 0.8, ease: "lsp" });
  }, [phase]);
  useEffect(() => () => void tween.current?.kill(), []);

  return (
    <section id="top" ref={root} className="relative flex min-h-svh items-center py-24 md:py-32">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-16 px-4 md:px-8">
        <div className="flex max-w-[680px] flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 data-in className="text-[clamp(2.5rem,6.2vw,5rem)] leading-[1.04]">
              Attackers meet the wrong city.
            </h1>
            <p data-in className="text-base text-muted md:text-lg">
              Adaptive cyber-deception grid.
            </p>
          </div>
          <div data-in className="flex">
            <Button
              variant="primary"
              magnetic={40}
              onClick={() => scrollToTarget("#economics")}
              icon={<ArrowDown size={18} aria-hidden="true" />}
            >
              Run the demo
            </Button>
          </div>
        </div>

        <dl data-in className="grid max-w-[680px] grid-cols-3 gap-4 border-t border-line pt-8 md:gap-8">
          {STATS.map((s) => (
            <div key={s.l} className="flex flex-col gap-2">
              <dt className="tnum font-display text-3xl text-ink md:text-4xl">
                {s.v}
                <span className="text-xl text-accent">{s.u}</span>
              </dt>
              <dd className="text-xs leading-snug text-muted md:text-sm">{s.l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
