import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, X } from "lucide-react";
import LogoMark from "./Logo";
import Button from "./Button";
import { gsap, prefersReduced } from "../lib/motion";

type Origin = { x: number; y: number };

const TABS = {
  local: { label: "Local", cmds: ["npm install", "cp .env.example .env", "npm run dev"], note: "Then open http://localhost:3000" },
  prod: { label: "Production", cmds: ["npm run build", "npm start"], note: "One process serves the API and the built app on $PORT" },
} as const;

const ENV = [
  ["NVIDIA_API_KEY", "not set", "Primary NIM endpoint"],
  ["NVIDIA_MODEL", "meta/llama-3.1-8b-instruct", "NIM model id"],
  ["OPENROUTER_API_KEY", "not set", "Used when the NVIDIA key is unset"],
  ["OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free", "OpenRouter model id"],
  ["PORT", "3000", "Listen port"],
  ["DEMO_ADMIN_TOKEN", "not set", "Protects simulator actions, reset, the 403 gate and AI reports"],
];

const STEPS = [
  "Open the dashboard.",
  "Take the guided tour beside Run the full demo.",
  "Run npm run attacker in a second terminal, or use the simulator buttons.",
  "Click a hostile session on the topology map and write a report.",
  "Engage the portcullis to show the 403 gate.",
];

const QUADS = [
  { k: "tl", clip: "inset(0 50% 50% 0)", dx: -1, dy: -1 },
  { k: "tr", clip: "inset(0 0 50% 50%)", dx: 1, dy: -1 },
  { k: "br", clip: "inset(50% 0 0 50%)", dx: 1, dy: 1 },
  { k: "bl", clip: "inset(50% 50% 0 0)", dx: -1, dy: 1 },
];

/**
 * Origin-aware full-screen wiper. The button colour expands to cover the page, the page changes,
 * then the colour collapses into the logo. The logo splits to the corners, a card appears, and it reassembles on close.
 */
export default function QuickStart({ origin, onClose }: { origin: Origin; onClose: () => void }) {
  const wiper = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const logoWrap = useRef<HTMLDivElement>(null);
  const quads = useRef<(HTMLDivElement | null)[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const closing = useRef(false);
  const pRef = useRef<{ r: number; x: number; y: number } | null>(null);
  const [tab, setTab] = useState<keyof typeof TABS>("local");
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  const maxR = () => Math.hypot(window.innerWidth, window.innerHeight);
  const centerOfLogo = () => {
    const r = logoWrap.current!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const corner = (q: (typeof QUADS)[number]) => {
    const m = window.innerWidth < 640 ? 48 : 96;
    return { x: q.dx * (window.innerWidth / 2 - m), y: q.dy * (window.innerHeight / 2 - m) };
  };

  useLayoutEffect(() => {
    const w = wiper.current!;
    const ov = overlay.current!;
    const p = { r: 0, x: origin.x, y: origin.y };
    const apply = () => {
      w.style.clipPath = `circle(${p.r}px at ${p.x}px ${p.y}px)`;
    };
    apply();

    pRef.current = p;
    gsap.set(logoWrap.current, { xPercent: -50, yPercent: -50 });
    gsap.set(quads.current, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
    gsap.set(card.current, { opacity: 0, y: 48, scale: 0.96 });

    if (prefersReduced()) {
      ov.style.visibility = "visible";
      QUADS.forEach((q, i) => gsap.set(quads.current[i], { ...corner(q), scale: 0.5 }));
      gsap.set(card.current, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    gsap.set(logoWrap.current, { opacity: 0, scale: 0.7 });
    const tl = gsap.timeline({ defaults: { ease: "lsp" } });
    tlRef.current = tl;
    tl.to(p, { r: maxR(), duration: 1, onUpdate: apply })
      .add(() => {
        ov.style.visibility = "visible";
      })
      .to(logoWrap.current, { opacity: 1, scale: 1, duration: 0.01 })
      .add(() => {
        const c = centerOfLogo();
        gsap.to(p, { r: 0, x: c.x, y: c.y, duration: 1.1, ease: "lsp", onUpdate: apply });
      }, "+=0.05")
      .to(logoWrap.current, { scale: 1.06, duration: 0.5, yoyo: true, repeat: 1 }, "<0.3")
      .add(() => {
        QUADS.forEach((q, i) => {
          const c = corner(q);
          gsap.to(quads.current[i], { x: c.x, y: c.y, scale: 0.55, rotate: q.dx * q.dy * 6, duration: 1.3, ease: "lsp", delay: i * 0.06 });
        });
      }, "+=0.5")
      .to(card.current, { opacity: 1, y: 0, scale: 1, duration: 1.1 }, "<0.35")
      .add(() => card.current?.focus({ preventScroll: true }));

    return () => {
      tl.kill();
      gsap.killTweensOf(p);
      gsap.killTweensOf(quads.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    tlRef.current?.kill();
    gsap.killTweensOf(quads.current);
    if (pRef.current) gsap.killTweensOf(pRef.current);
    if (prefersReduced()) return onClose();

    const w = wiper.current!;
    const ov = overlay.current!;
    const c = centerOfLogo();
    const p = { r: 0, x: c.x, y: c.y };
    pRef.current = p;
    const apply = () => {
      w.style.clipPath = `circle(${p.r}px at ${p.x}px ${p.y}px)`;
    };
    // Reverse of the opening: card leaves, the four pieces reassemble, then the colour wipes back
    gsap
      .timeline({ defaults: { ease: "lsp" }, onComplete: onClose })
      .to(card.current, { opacity: 0, y: 32, scale: 0.96, duration: 0.6 })
      .to(quads.current, { x: 0, y: 0, scale: 1, rotate: 0, duration: 1.1, stagger: 0.05 }, "<0.1")
      .to(logoWrap.current, { scale: 1.08, duration: 0.35, yoyo: true, repeat: 1 }, ">-0.2")
      .to(p, { r: maxR(), duration: 1, onUpdate: apply }, ">")
      .add(() => {
        ov.style.visibility = "hidden";
      })
      .to(p, { r: 0, x: origin.x, y: origin.y, duration: 1, onUpdate: apply }, "+=0.05");
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    const text = TABS[tab].cmds.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    window.setTimeout(() => setCopied("idle"), 3200);
  };

  return (
    <>
      <div
        ref={overlay}
        role="dialog"
        aria-modal="true"
        aria-label="Quick start"
        className="fixed inset-0 z-90 overflow-hidden bg-deep text-ink"
        style={{ visibility: "hidden" }}
      >
        <div ref={logoWrap} className="kinetic absolute top-1/2 left-1/2" style={{ width: "var(--logo-size)", height: "var(--logo-size)" }}>
          {QUADS.map((q, i) => (
            <div
              key={q.k}
              ref={(el) => {
                quads.current[i] = el;
              }}
              aria-hidden="true"
              className="kinetic absolute top-1/2 left-1/2"
              style={{ width: "var(--logo-size)", height: "var(--logo-size)", clipPath: q.clip }}
            >
              <LogoMark className="h-full w-full" />
            </div>
          ))}
        </div>

        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto px-4 py-16">
          <div
            ref={card}
            tabIndex={-1}
            className="kinetic relative flex max-h-full w-full max-w-[680px] flex-col gap-6 overflow-y-auto rounded-[32px] border border-line bg-surface p-6 outline-none md:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-3xl">Quick start</h2>
                <p className="text-sm text-muted">No Docker, no keys needed for the first run.</p>
              </div>
              <Button variant="ghost" onClick={close} aria-label="Close quick start" className="-mt-2 -mr-2 px-0!">
                <X size={20} aria-hidden="true" />
              </Button>
            </div>

            <div role="tablist" aria-label="Run mode" className="flex w-fit gap-2 rounded-full bg-deep/60 p-2">
              {(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => (
                <button
                  key={k}
                  role="tab"
                  type="button"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-[background-color,color] duration-500 ease-lsp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    tab === k ? "bg-ink text-deep" : "text-muted hover:text-ink"
                  }`}
                >
                  {TABS[k].label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <ol className="flex flex-col gap-2 rounded-3xl bg-deep p-4">
                {TABS[tab].cmds.map((c, i) => (
                  <li key={c} className="flex items-center gap-4 text-sm">
                    <span className="tnum w-6 text-xs text-muted">{i + 1}</span>
                    <span className="font-semibold text-ink">{c}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted">{TABS[tab].note}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={copy}
                icon={copied === "ok" ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                className="w-full sm:w-fit"
              >
                {copied === "ok" ? "Copied" : "Copy commands"}
              </Button>
              <p role="status" className="min-h-6 text-xs text-muted">
                {copied === "ok" && `Copied ${TABS[tab].cmds.length} commands. Paste them into your terminal in order.`}
                {copied === "fail" && "The browser blocked clipboard access. Select the commands above and copy them by hand."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <details className="group rounded-3xl border border-line">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-3xl px-4 text-sm font-semibold hover:bg-surface-2">
                  Optional model keys
                  <ChevronDown size={18} aria-hidden="true" className="chev transition-transform duration-500 ease-lsp" />
                </summary>
                <div className="flex flex-col gap-4 px-4 pb-4">
                  <p className="text-xs leading-relaxed text-muted">Either key enables AI decoys. With neither, procedural decoys are used.</p>
                  <dl className="flex flex-col gap-4">
                    {ENV.map(([k, d, p]) => (
                      <div key={k} className="flex flex-col gap-2 border-t border-line pt-4">
                        <dt className="text-xs font-semibold text-ink">{k}</dt>
                        <dd className="text-xs text-muted">
                          Default: {d}. {p}.
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </details>
              <details className="group rounded-3xl border border-line">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-3xl px-4 text-sm font-semibold hover:bg-surface-2">
                  First demo path
                  <ChevronDown size={18} aria-hidden="true" className="chev transition-transform duration-500 ease-lsp" />
                </summary>
                <ol className="flex flex-col gap-2 px-4 pb-4">
                  {STEPS.map((s, i) => (
                    <li key={s} className="flex gap-4 text-xs leading-relaxed text-muted">
                      <span className="tnum w-4 shrink-0 text-accent">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          </div>
        </div>
      </div>

      <div ref={wiper} aria-hidden="true" className="pointer-events-none fixed inset-0 z-100 bg-accent" />
    </>
  );
}
