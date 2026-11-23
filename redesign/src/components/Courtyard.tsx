import { useEffect, useRef } from "react";
import { Feather, Hourglass, Bot } from "lucide-react";
import { gsap, MOTION_OK } from "../lib/motion";
import { SectionHead } from "./ui";

const ENDPOINTS = ["/.env", "/admin", "/wp-admin", "/api/dump"];
const R0 = 56;

export default function Courtyard() {
  const root = useRef<HTMLElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const court = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const courtEl = court.current;
    const ringEl = ring.current;
    const innerEl = inner.current;
    const baseEl = base.current;
    if (!el || !courtEl || !ringEl || !innerEl || !baseEl) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const proxy = { r: R0 };
      const apply = () => {
        courtEl.style.clipPath = `circle(${proxy.r}px at 50% 50%)`;
        ringEl.style.transform = `translate3d(-50%,-50%,0) scale(${proxy.r / R0})`;
        ringEl.style.opacity = String(Math.max(0, 1 - Math.max(0, proxy.r - window.innerWidth * 0.5) / (window.innerWidth * 0.35)));
      };
      apply();
      gsap.set(innerEl, { scale: 0.9, opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "+=220%",
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
      tl.to(proxy, { r: () => Math.hypot(window.innerWidth, window.innerHeight) / 2 + 96, duration: 1, ease: "power2.inOut", onUpdate: apply }, 0)
        .to(baseEl, { opacity: 0, scale: 0.94, duration: 0.5, ease: "lsp" }, 0.15)
        .to(innerEl, { scale: 1, opacity: 1, duration: 0.6, ease: "lsp" }, 0.4);

      return () => {
        courtEl.style.clipPath = "";
        ringEl.style.transform = "";
        ringEl.style.opacity = "";
        gsap.set([innerEl, baseEl], { clearProps: "all" });
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="courtyard" ref={root} className="relative overflow-hidden motion-safe:h-svh">
      <div
        ref={base}
        className="kinetic mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-16 md:px-8 md:py-24 motion-safe:absolute motion-safe:inset-0 motion-safe:items-center motion-safe:justify-between motion-safe:text-center"
      >
        <SectionHead eyebrow="02 Courtyard" title="Behind the portal, a courtyard." />
        <p className="text-sm text-muted motion-reduce:hidden">Scroll to open the gate.</p>
      </div>

      <div
        ref={ring}
        aria-hidden="true"
        className="kinetic pointer-events-none absolute top-1/2 left-1/2 z-20 hidden h-28 w-28 motion-safe:block"
        style={{ transform: "translate3d(-50%,-50%,0)" }}
      >
        <svg viewBox="0 0 112 112" className="h-full w-full overflow-visible">
          <circle cx="56" cy="56" r="55" fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div ref={court} className="kinetic relative z-10 bg-court motion-safe:absolute motion-safe:inset-0 motion-safe:flex motion-safe:items-center">
        <div ref={inner} className="kinetic mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-16 md:px-8 md:py-24">
          <h3 className="max-w-[20ch] text-[clamp(1.75rem,3.4vw,2.75rem)] leading-tight">Where hostile sessions end up.</h3>
          <div className="grid gap-4 md:grid-cols-3 md:gap-6">
            <article className="flex flex-col gap-4 rounded-[32px] border border-accent/30 bg-court-2 p-6">
              <Feather size={24} className="text-accent" aria-hidden="true" />
              <h4 className="text-lg font-semibold">Canary decoys</h4>
              <p className="text-sm leading-relaxed text-muted">Known probes get cached, believable answers. Zero tokens.</p>
              <ul className="flex flex-wrap gap-2">
                {ENDPOINTS.map((e) => (
                  <li key={e} className="rounded-lg bg-deep/70 px-2 py-0 leading-6 text-xs text-ink">
                    {e}
                  </li>
                ))}
              </ul>
            </article>
            <article className="flex flex-col gap-4 rounded-[32px] bg-deep/70 p-6">
              <Hourglass size={24} className="text-ink" aria-hidden="true" />
              <h4 className="text-lg font-semibold">Adaptive tarpits</h4>
              <p className="text-sm leading-relaxed text-muted">Slow-drip replies spend the attacker&apos;s time, not your budget.</p>
              <span className="tnum w-fit rounded-lg bg-court-2 px-2 py-0 leading-6 text-xs text-ink">Tightens as they push</span>
            </article>
            <article className="flex flex-col gap-4 rounded-[32px] border border-dashed border-accent/60 p-6">
              <Bot size={24} className="text-accent" aria-hidden="true" />
              <h4 className="text-lg font-semibold">On-demand fake service</h4>
              <p className="text-sm leading-relaxed text-muted">Only for genuinely novel probes. Generated once, then cached.</p>
              <span className="w-fit rounded-lg bg-accent/15 px-2 py-0 leading-6 text-xs text-accent">Wakes the model once</span>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
