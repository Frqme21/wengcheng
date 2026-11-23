import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import LogoMark from "./Logo";
import Button from "./Button";
import { gsap, prefersReduced, debounce } from "../lib/motion";
import type { Phase } from "../App";

type Props = {
  phase: Phase;
  fontsReady: boolean;
  glReady: boolean;
  onLoaded: () => void;
  onEnter: () => void;
  onDone: () => void;
};

/**
 * Preloader, then the logo choreography. One persistent logo element:
 * it draws in while assets compile, waits above "Enter", then glides to the header slot (FLIP).
 */
export default function Intro({ phase, fontsReady, glReady, onLoaded, onEnter, onDone }: Props) {
  const curtain = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const target = useRef(8);
  const shown = useRef(0);
  const loadedCalled = useRef(false);

  useEffect(() => {
    target.current = 8 + (fontsReady ? 32 : 0) + (glReady ? 60 : 0);
  }, [fontsReady, glReady]);

  // Count up, holding the viewport until every critical asset is ready
  useEffect(() => {
    if (phase !== "loading") return;
    let raf = 0;
    const tick = () => {
      const t = target.current;
      if (shown.current < t) shown.current = Math.min(t, shown.current + Math.max((t - shown.current) * 0.07, 0.35));
      setPct(Math.floor(shown.current));
      if (shown.current >= 100 && !loadedCalled.current) {
        loadedCalled.current = true;
        onLoaded();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, onLoaded]);

  const place = useCallback((mode: "intro" | "site") => {
    const el = logo.current;
    const dest = mode === "intro" ? slot.current : document.getElementById("logo-slot");
    if (!el || !dest) return;
    const S = el.offsetWidth;
    const r = dest.getBoundingClientRect();
    gsap.set(el, { x: r.left + r.width / 2 - S / 2, y: r.top + r.height / 2 - S / 2, scale: r.width / S });
  }, []);

  useLayoutEffect(() => {
    if (phase === "entering") return;
    place(phase === "site" ? "site" : "intro");
    const onResize = debounce(() => place(phase === "site" ? "site" : "intro"), 150);
    window.addEventListener("resize", onResize);
    return () => {
      onResize.cancel();
      window.removeEventListener("resize", onResize);
    };
  }, [phase, place]);

  const enter = useCallback(() => {
    if (phase !== "intro") return;
    onEnter();
    const el = logo.current;
    const dest = document.getElementById("logo-slot");
    if (!el || !dest) return onDone();
    const S = el.offsetWidth;
    const r = dest.getBoundingClientRect();
    const to = { x: r.left + r.width / 2 - S / 2, y: r.top + r.height / 2 - S / 2, scale: r.width / S };

    if (prefersReduced()) {
      gsap.set(el, to);
      gsap.set(curtain.current, { yPercent: -100 });
      return onDone();
    }
    gsap
      .timeline({ onComplete: onDone })
      .to(controls.current, { opacity: 0, y: 16, duration: 0.5, ease: "lsp" })
      .to(curtain.current, { yPercent: -100, duration: 1.3, ease: "lsp" }, 0.15)
      .to(el, { ...to, duration: 1.4, ease: "lsp" }, 0.15);
  }, [onDone, onEnter, phase]);

  useEffect(() => {
    if (phase === "intro" && navigator.webdriver) enter();
  }, [enter, phase]);

  const loading = phase === "loading";
  const leaving = phase === "entering" || phase === "site";
  const skipped = useRef(phase === "site").current;
  if (skipped) return null;

  return (
    <>
      {phase !== "site" && (
        <div ref={curtain} aria-hidden={leaving} className="kinetic fixed inset-0 z-60 bg-deep">
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-8 px-4">
            <div ref={slot} style={{ width: "var(--logo-size)", height: "var(--logo-size)" }} />
            <div ref={controls} className="pointer-events-auto grid place-items-center">
              <div
                role="progressbar"
                aria-label="Loading assets"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className={`col-start-1 row-start-1 flex flex-col items-center gap-2 transition-opacity duration-700 ease-lsp ${
                  loading ? "opacity-100" : "opacity-0"
                }`}
              >
                <span className="tnum text-3xl font-semibold tracking-wide text-ink">{String(pct).padStart(2, "0")}%</span>
                <span className="text-xs tracking-[0.24em] text-muted uppercase">
                  {!fontsReady ? "Loading type" : !glReady ? "Compiling shaders" : "Ready"}
                </span>
              </div>

              <div
                {...({ inert: loading } as any)}
                className={`col-start-1 row-start-1 flex flex-col items-center gap-6 transition-[opacity,transform] duration-700 ease-lsp ${
                  loading ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="font-display text-4xl text-ink">瓮城</span>
                  <span className="text-xs tracking-[0.32em] text-muted uppercase">Wèngchéng</span>
                </div>
                <Button variant="primary" magnetic={40} onClick={enter} icon={<ArrowRight size={18} aria-hidden="true" />}>
                  Enter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        ref={logo}
        aria-hidden="true"
        className="kinetic pointer-events-none fixed top-0 left-0 z-70 text-ink"
        style={{ width: "var(--logo-size)", height: "var(--logo-size)" }}
      >
        <LogoMark ring={loading ? pct / 100 : 1} className="h-full w-full" />
      </div>
    </>
  );
}
