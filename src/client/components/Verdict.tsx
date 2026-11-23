import { useEffect, useRef } from "react";
import { Globe, ShieldCheck, Building2, Landmark } from "lucide-react";
import { gsap, MOTION_OK } from "../lib/motion";
import { SectionHead } from "./ui";

const CAPTIONS = [
  {
    n: "01",
    t: "Read",
    d: "Sentinel classifies every request in under 2ms with regex signatures, path rules and sliding windows. No model is involved.",
  },
  {
    n: "02",
    t: "Pass",
    d: "Clean traffic goes straight to the real portal. No added latency, zero tokens spent.",
  },
  {
    n: "03",
    t: "Divert",
    d: "Hostile traffic is silently sent to the courtyard. Cached decoys answer known probes. A model wakes only for something novel.",
  },
];

export default function Verdict() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const q = gsap.utils.selector(el);
      const [p1, p2, p3] = q("[data-path]");
      const sentinel = q("[data-sentinel]");
      const portal = q("[data-portal]");
      const court = q("[data-court]");
      const chips = q("[data-chip]");
      const caps = q("[data-cap]");

      gsap.set([p1, p2, p3], { strokeDashoffset: 1 });
      gsap.set([...sentinel, ...portal, ...court], { opacity: 0.25 });
      gsap.set(chips, { opacity: 0, y: 8 });
      gsap.set([caps[1], caps[2]], { opacity: 0, y: 24 });

      const tl = gsap.timeline({
        defaults: { ease: "lsp" },
        scrollTrigger: { trigger: el, start: "top top", end: "+=260%", pin: true, scrub: 0.8, anticipatePin: 1 },
      });
      tl.to(p1, { strokeDashoffset: 0, duration: 1 })
        .to(sentinel, { opacity: 1, duration: 0.8 }, "<0.4")
        .to(caps[0], { opacity: 0, y: -24, duration: 0.6 }, "+=0.6")
        .to(caps[1], { opacity: 1, y: 0, duration: 0.6 }, "<0.1")
        .to(p2, { strokeDashoffset: 0, duration: 1.2 }, "<")
        .to(portal, { opacity: 1, duration: 0.8 }, "<0.8")
        .to(caps[1], { opacity: 0, y: -24, duration: 0.6 }, "+=0.8")
        .to(caps[2], { opacity: 1, y: 0, duration: 0.6 }, "<0.1")
        .to(p3, { strokeDashoffset: 0, duration: 1.2 }, "<")
        .to(court, { opacity: 1, duration: 0.8 }, "<0.8")
        .to(chips, { opacity: 1, y: 0, stagger: 0.2, duration: 0.6 }, ">-0.2")
        .to({}, { duration: 0.8 });

      return () => {
        gsap.set([p1, p2, p3, ...sentinel, ...portal, ...court, ...chips, ...caps], { clearProps: "all" });
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="flow" ref={root} className="relative flex min-h-svh items-center py-16 md:py-24">
      <div className="mx-auto grid w-full max-w-[1280px] items-center gap-12 px-4 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="flex flex-col gap-8">
          <SectionHead eyebrow="01 Flow" title="One request, two destinations." />
          <div className="stack-motion flex flex-col gap-8 motion-safe:gap-0">
            {CAPTIONS.map((c) => (
              <div key={c.n} data-cap className="flex max-w-[65ch] flex-col gap-2 border-l border-line pl-6">
                <span className="tnum text-sm font-semibold text-accent">
                  {c.n} <span className="text-ink">{c.t}</span>
                </span>
                <p className="text-base leading-relaxed text-muted">{c.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div role="img" aria-label="Diagram: a request reaches Sentinel, which sends clean traffic to the portal and hostile traffic to the courtyard." className="relative aspect-square w-full md:aspect-[16/10]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <g fill="none" strokeLinecap="round" strokeWidth="0.7">
              <path data-path d="M15 50H29" pathLength={1} strokeDasharray="1" stroke="oklch(0.76 0.015 235)" />
              <path data-path d="M45 50C54 50 52 22 59 22" pathLength={1} strokeDasharray="1" stroke="oklch(0.72 0.13 235)" />
              <path data-path d="M45 50C54 50 52 68 59 68" pathLength={1} strokeDasharray="1" stroke="oklch(0.72 0.17 45)" />
            </g>
          </svg>

          <div className="absolute top-1/2 left-[2%] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink">
            <Globe size={20} aria-hidden="true" />
          </div>

          <div
            data-sentinel
            className="absolute top-1/2 left-[29%] flex w-[16%] -translate-y-1/2 flex-col items-center gap-2 rounded-[24px] border border-line bg-surface-2 p-2 text-center md:p-4"
          >
            <ShieldCheck size={20} className="text-ink" aria-hidden="true" />
            <span className="hidden text-xs font-semibold text-ink md:block">Sentinel</span>
            <span className="tnum text-[11px] text-muted md:text-xs">{"<2ms"}</span>
          </div>

          <div
            data-portal
            className="absolute top-[22%] left-[59%] flex w-[40%] -translate-y-1/2 flex-col gap-2 rounded-[24px] border border-pass/50 bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <Building2 size={20} className="text-pass" aria-hidden="true" />
              <span className="rounded-lg bg-pass/15 px-2 py-0 leading-6 text-[11px] font-semibold tracking-wider text-pass">PASS</span>
            </div>
            <span className="text-sm font-semibold text-ink">Real portal</span>
            <span className="hidden text-xs text-muted md:block">AegisCloud, zero tokens</span>
          </div>

          <div
            data-court
            className="absolute top-[68%] left-[59%] flex w-[40%] -translate-y-1/2 flex-col gap-4 rounded-[24px] border border-accent/50 bg-court p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <Landmark size={20} className="text-accent" aria-hidden="true" />
              <span className="rounded-lg bg-accent/15 px-2 py-0 leading-6 text-[11px] font-semibold tracking-wider text-accent">DIVERT</span>
            </div>
            <span className="text-sm font-semibold text-ink">Courtyard</span>
            <div className="flex flex-wrap gap-2">
              <span data-chip className="rounded-lg bg-court-2 px-2 py-0 leading-6 text-[11px] text-ink">Canary</span>
              <span data-chip className="rounded-lg bg-court-2 px-2 py-0 leading-6 text-[11px] text-ink">Tarpit</span>
              <span data-chip title="Only for novel probes" className="rounded-lg border border-dashed border-accent/70 px-2 py-0 leading-6 text-[11px] text-accent">
                LLM
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
