import { useEffect, useRef } from "react";
import { gsap, prefersReduced } from "../lib/motion";
import { scrollState, scrollToTarget } from "../lib/lenis";
import type { Phase } from "../App";

const LINKS = [
  { id: "#flow", label: "Flow" },
  { id: "#courtyard", label: "Courtyard" },
  { id: "#economics", label: "Economics" },
  { id: "#stack", label: "Stack" },
  { id: "#limits", label: "Limits" },
];

const NAME = "Wèngchéng".split("");

export default function Header({ phase }: { phase: Phase }) {
  const lettersRef = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Letter-by-letter brand reveal as the logo lands
  const revealed = useRef(false);
  const tween = useRef<gsap.core.Tween | null>(null);
  useEffect(() => {
    const letters = lettersRef.current?.querySelectorAll("span");
    if (!letters) return;
    if (phase === "loading" || phase === "intro") {
      if (!prefersReduced()) gsap.set(letters, { opacity: 0, y: 10 });
      return;
    }
    if (revealed.current) return;
    revealed.current = true;
    if (prefersReduced()) {
      gsap.set(letters, { opacity: 1, y: 0 });
      return;
    }
    tween.current = gsap.to(letters, { opacity: 1, y: 0, duration: 0.9, stagger: 0.06, delay: 0.7, ease: "lsp" });
  }, [phase]);
  useEffect(() => () => void tween.current?.kill(), []);

  // Scroll progress hairline
  useEffect(() => {
    const set = gsap.quickSetter(bar.current, "scaleX");
    const tick = () => set(scrollState.progress);
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/70 bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 md:px-8">
        <button
          type="button"
          onClick={() => scrollToTarget(0)}
          aria-label="Wèngchéng, back to top"
          className="flex min-h-12 items-center gap-4 rounded-full pr-4 transition-opacity duration-500 ease-lsp hover:opacity-80"
        >
          <div id="logo-slot" className="h-10 w-10 shrink-0" />
          <span className="flex items-center gap-4">
            <span className="font-display text-xl text-ink">瓮城</span>
            <span ref={lettersRef} className="hidden items-center text-[11px] tracking-[0.24em] text-muted uppercase sm:flex">
              {NAME.map((c, i) => (
                <span key={i} className="inline-block">
                  {c}
                </span>
              ))}
            </span>
          </span>
        </button>

        <nav aria-label="Sections" className="hidden items-center gap-2 md:flex">
          {LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => scrollToTarget(l.id)}
              className="inline-flex min-h-12 items-center rounded-full px-4 text-sm text-muted transition-colors duration-500 ease-lsp hover:bg-surface-2 hover:text-ink focus-visible:text-ink"
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>
      <div ref={bar} className="absolute right-0 -bottom-px left-0 h-px origin-left scale-x-0 bg-accent" />
    </header>
  );
}
