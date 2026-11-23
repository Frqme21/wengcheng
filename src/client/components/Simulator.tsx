import { useEffect, useMemo, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useMotionValue } from "framer-motion";
import { Send, Info, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import Button from "./Button";
import { Reveal, SectionHead } from "./ui";
import { EASE_ARR } from "../lib/motion";

type Kind = "clean" | "known" | "severe" | "novel";
type Verdict = "PASS" | "DIVERT" | "WAKE" | "BLOCKED";

const REQS: { id: string; label: string; path: string; kind: Kind }[] = [
  { id: "clean", label: "Clean request", path: "GET /portal/api/users", kind: "clean" },
  { id: "env", label: "Known probe", path: "GET /.env", kind: "known" },
  { id: "cmd", label: "Command injection", path: "GET /portal/api/ping?host=;cat /etc/passwd", kind: "severe" },
  { id: "novel", label: "Novel probe", path: "GET /portal/api/v2/ledger/reconcile?id=7", kind: "novel" },
];

const SAVE = 1800;
const WAKE = 640;

type Entry = { id: number; verdict: Verdict; path: string; why: string; ms: number };

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const mv = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, ease: EASE_ARR });
    const off = mv.on("change", setDisplay);
    return () => {
      controls.stop();
      off();
    };
  }, [value, mv]);
  return (
    <span className="tnum">
      {display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}

const BADGE: Record<Verdict, string> = {
  PASS: "bg-pass/15 text-pass",
  DIVERT: "bg-accent/15 text-accent",
  WAKE: "bg-ink text-deep",
  BLOCKED: "bg-surface-2 text-ink border border-line",
};

export default function Simulator() {
  const [sel, setSel] = useState("clean");
  const [gate, setGate] = useState(false);
  const [log, setLog] = useState<Entry[]>([]);
  const [stats, setStats] = useState({ saved: 0, wakes: 0, spent: 0, msSum: 0, n: 0 });
  const cache = useRef(new Set<string>());
  const seq = useRef(0);

  const req = REQS.find((r) => r.id === sel)!;

  const send = () => {
    const ms = +(0.4 + Math.random() * 1.4).toFixed(2);
    let verdict: Verdict;
    let why: string;
    let saved = 0;
    let spent = 0;
    let wakes = 0;

    if (req.kind === "clean") {
      verdict = "PASS";
      why = "Passed to the real portal. Zero tokens and no added latency, even while the portcullis is engaged.";
      saved = SAVE;
    } else if (gate) {
      verdict = "BLOCKED";
      why = "The portcullis is engaged, so this session got the stylized 403. No decoy was built and no tokens were spent.";
      saved = SAVE;
    } else if (req.kind === "known") {
      verdict = "DIVERT";
      why = "Served from the deterministic decoy cache. The attacker sees a believable file full of fake keys.";
      saved = SAVE;
    } else if (req.kind === "severe") {
      verdict = "DIVERT";
      why = "Severity 5 signature. A canary answered, then the portcullis engaged on its own. The next hostile request gets the 403.";
      saved = SAVE;
      setGate(true);
    } else if (!cache.current.has(req.id)) {
      verdict = "WAKE";
      why = `No cached decoy for this path. The model was asked once (about ${WAKE} tokens) and the answer is now cached.`;
      spent = WAKE;
      wakes = 1;
      cache.current.add(req.id);
    } else {
      verdict = "DIVERT";
      why = "Replay served from the cache. Zero tokens, same believable answer.";
      saved = SAVE;
    }

    seq.current += 1;
    // Optimistic: results show instantly, nothing waits on a server round trip
    setLog((l) => [{ id: seq.current, verdict, path: req.path, why, ms }, ...l].slice(0, 5));
    setStats((s) => ({
      saved: s.saved + saved,
      wakes: s.wakes + wakes,
      spent: s.spent + spent,
      msSum: s.msSum + ms,
      n: s.n + 1,
    }));
  };

  const reset = () => {
    cache.current.clear();
    setLog([]);
    setStats({ saved: 0, wakes: 0, spent: 0, msSum: 0, n: 0 });
    setGate(false);
  };

  const tip = useMemo(() => {
    if (log.length === 0) return "Tip: send the novel probe twice. The first call wakes the model once, the second one is free.";
    if (log[0].verdict === "WAKE") return "That wake cost tokens once. Send the same probe again and watch the cache answer for free.";
    if (gate && req.kind === "clean") return "Clean traffic still passes. The portcullis only blocks hostile sessions.";
    if (gate) return "The gate is engaged. Hostile requests now return a 403, so no decoys or tokens are used.";
    return null;
  }, [log, gate, req.kind]);

  const avg = stats.n ? stats.msSum / stats.n : 0;

  return (
    <section id="economics" className="relative py-16 md:py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1280px] items-start gap-12 px-4 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <Reveal className="flex flex-col gap-8">
          <SectionHead
            eyebrow="03 Economics"
            title="Tokens only when novel."
            lead="Send the four request types and watch the same counters the dashboard shows."
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-2 rounded-[24px] bg-[oklch(0.9_0.012_90)] p-6 text-deep">
              <span className="text-xs font-semibold tracking-[0.16em] uppercase">Tokens saved</span>
              <span className="font-display text-5xl">
                <AnimatedNumber value={stats.saved} />
              </span>
              <span className="text-xs opacity-70">Estimate: {SAVE.toLocaleString("en-US")} tokens avoided per request.</span>
            </div>
            <div className="flex flex-col gap-2 rounded-[24px] border border-accent/40 bg-court p-6">
              <span className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">AI wakeups</span>
              <span className="font-display text-4xl text-accent">
                <AnimatedNumber value={stats.wakes} />
              </span>
            </div>
            <div className="flex flex-col gap-2 rounded-[24px] bg-surface-2 p-6">
              <span className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Tokens spent</span>
              <span className="font-display text-4xl text-ink">
                <AnimatedNumber value={stats.spent} />
              </span>
            </div>
            <div className="col-span-2 flex items-baseline justify-between gap-4 rounded-[24px] border border-line p-6">
              <span className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Avg sentinel decision</span>
              <span className="font-display text-3xl text-pass">
                <AnimatedNumber value={avg} decimals={2} />
                <span className="text-lg text-muted"> ms</span>
              </span>
            </div>
          </div>
        </Reveal>

        <Reveal className="flex flex-col">
          <div className="relative flex flex-col gap-6 overflow-hidden rounded-[32px] border border-line bg-surface p-6">
            <div
              className="relative -mx-6 -mt-6 h-12 overflow-hidden border-b border-line bg-deep/60"
              role="status"
              aria-live="polite"
            >
              <div
                aria-hidden="true"
                className={`kinetic absolute inset-0 flex justify-between px-6 transition-transform duration-700 ease-lsp ${
                  gate ? "translate-y-0" : "-translate-y-full"
                }`}
              >
                {Array.from({ length: 16 }).map((_, i) => (
                  <span key={i} className="h-full w-0.5 bg-accent/60" />
                ))}
              </div>
              <div className="relative flex h-full items-center gap-2 px-6 text-xs font-semibold tracking-wide text-ink">
                {gate ? (
                  <>
                    <ShieldAlert size={16} className="text-accent" aria-hidden="true" />
                    <span className="rounded-lg bg-deep/80 px-2 py-1">Portcullis engaged: hostile sessions get a 403</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} className="text-pass" aria-hidden="true" />
                    <span className="text-muted">Portcullis open</span>
                  </>
                )}
              </div>
            </div>

            <div role="radiogroup" aria-label="Request type" className="grid gap-2 sm:grid-cols-2">
              {REQS.map((r) => {
                const on = r.id === sel;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSel(r.id)}
                    className={`flex min-h-14 flex-col items-start justify-center gap-0 rounded-lg border px-4 py-2 text-left transition-[background-color,border-color] duration-500 ease-lsp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                      on ? "border-ink bg-surface-2" : "border-line hover:border-muted hover:bg-surface-2/60"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span className={`h-2 w-2 rounded-full ${r.kind === "clean" ? "bg-pass" : "bg-accent"}`} />
                      {r.label}
                    </span>
                    <span className="w-full truncate text-xs text-muted">{r.path}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary" onClick={send} icon={<Send size={16} aria-hidden="true" />}>
                Send request
              </Button>
              <button
                type="button"
                role="switch"
                aria-checked={gate}
                onClick={() => setGate((g) => !g)}
                className="inline-flex min-h-12 items-center gap-4 rounded-full border border-line bg-surface-2 px-4 text-sm text-ink transition-colors duration-500 ease-lsp hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
              >
                <span
                  aria-hidden="true"
                  className={`relative h-6 w-10 rounded-full transition-colors duration-500 ease-lsp ${gate ? "bg-ink" : "bg-line"}`}
                >
                  <span
                    className={`kinetic absolute top-1 left-1 h-4 w-4 rounded-full transition-[transform,background-color] duration-500 ease-lsp ${
                      gate ? "translate-x-4 bg-deep" : "translate-x-0 bg-ink"
                    }`}
                  />
                </span>
                Portcullis
              </button>
              <Button variant="ghost" onClick={reset} disabled={log.length === 0 && !gate} icon={<RotateCcw size={16} aria-hidden="true" />}>
                Reset
              </Button>
            </div>

            <ul aria-live="polite" className="flex min-h-48 flex-col gap-2">
              <AnimatePresence initial={false} mode="popLayout">
                {log.map((e) => (
                  <motion.li
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ duration: 0.7, ease: EASE_ARR }}
                    className="flex flex-col gap-2 rounded-lg bg-deep/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`rounded-lg px-2 py-0 leading-6 text-[11px] font-semibold tracking-wider ${BADGE[e.verdict]}`}>{e.verdict}</span>
                        <span className="truncate text-xs text-ink">{e.path}</span>
                      </span>
                      <span className="tnum shrink-0 text-xs text-muted">{e.ms.toFixed(2)} ms</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted">{e.why}</p>
                  </motion.li>
                ))}
              </AnimatePresence>
              {tip && (
                <li className="flex items-start gap-2 rounded-lg border border-dashed border-line p-4 text-xs leading-relaxed text-muted">
                  <Info size={16} className="mt-px shrink-0 text-pass" aria-hidden="true" />
                  {tip}
                </li>
              )}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
