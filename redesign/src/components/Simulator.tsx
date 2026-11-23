import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, RotateCcw, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import "@material/web/switch/switch.js";
import Button from "./Button";
import { Reveal, SectionHead } from "./ui";
import { EASE_ARR } from "../lib/motion";
import { useGrid } from "../hooks/useGrid";
import { readDemoToken, saveDemoToken } from "../hooks/demoToken";
import type { SimulatorAction } from "../shared/types";

type ActionId = "legitimate" | "sqli" | "recon" | "novel" | "scrape";

const ACTIONS: { id: ActionId; label: string; path: string; kind: "clean" | "attack" }[] = [
  { id: "legitimate", label: "Clean request", path: "GET /portal/api/users", kind: "clean" },
  { id: "recon", label: "Known probe", path: "GET /.env", kind: "attack" },
  { id: "sqli", label: "SQL injection", path: "GET /portal/api/users?id=1 OR 1=1", kind: "attack" },
  { id: "novel", label: "Novel probe", path: "GET /portal/api/v2/ledger/reconcile?id=7", kind: "attack" },
  { id: "scrape", label: "Scraper burst", path: "Rapid automated crawl", kind: "attack" },
];

const BADGE: Record<string, string> = {
  passthrough: "bg-pass/15 text-pass",
  decoy: "bg-accent/15 text-accent",
  tarpit: "bg-accent/15 text-accent",
  blocked: "bg-accent/20 text-accent",
};

function verdict(disposition: string, status: number) {
  if (disposition === "blocked" || status === 403) return "BLOCKED";
  if (disposition === "passthrough") return "PASS";
  if (disposition === "tarpit") return "WAKE";
  return "DIVERT";
}

function short(text: string) {
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

export default function Simulator() {
  const { snapshot, responses, toasts, connected, send, clear } = useGrid();
  const [sel, setSel] = useState<ActionId>("legitimate");
  const [token, setToken] = useState(() => readDemoToken());
  const [busy, setBusy] = useState(false);
  const busyTimer = useRef<number | null>(null);

  useEffect(() => () => { if (busyTimer.current) window.clearTimeout(busyTimer.current); }, []);

  const gate = snapshot?.portcullis.engaged ?? false;
  const totals = snapshot?.totals;
  const selected = ACTIONS.find((a) => a.id === sel)!;
  const gateRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = gateRef.current as any;
    if (!el) return;
    const onChange = () => {
      if (el.selected !== gate) toggleGate();
    };
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, [gate, toggleGate]);

  const llmLabel = useMemo(() => {
    if (!snapshot) return "Connecting...";
    if (snapshot.llm.configured) {
      const provider = snapshot.llm.mode === "nvidia" ? "NVIDIA NIM" : snapshot.llm.mode === "openrouter" ? "OpenRouter" : snapshot.llm.mode;
      return `AI ready · ${provider} · ${snapshot.llm.model}`;
    }
    return "Offline procedural mode · no API key needed";
  }, [snapshot]);

  function markBusy() {
    setBusy(true);
    if (busyTimer.current) window.clearTimeout(busyTimer.current);
    busyTimer.current = window.setTimeout(() => setBusy(false), 900);
  }

  function sendAction(action: SimulatorAction) {
    markBusy();
    send({ type: "simulate", action });
  }

  function toggleGate() {
    markBusy();
    send({ type: "portcullis", engaged: !gate });
  }

  function onReset() {
    markBusy();
    clear();
    send({ type: "reset" });
  }

  function saveTok() {
    saveDemoToken(token);
  }

  const log = responses.slice(0, 8);

  return (
    <section id="economics" className="relative py-16 md:py-24 lg:py-32">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 md:px-8">
        <Reveal>
          <SectionHead
            eyebrow="04 Live demo"
            title="Send a real request."
            lead="This is wired to the real Wèngchéng backend. Normal traffic passes through. Suspicious traffic gets decoys. NVIDIA NIM/OpenRouter is used when configured; offline procedural fallback works with no keys."
          />
        </Reveal>

        <Reveal className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-pass" : "bg-accent"}`} />
                <span className="text-xs font-semibold tracking-wider text-muted uppercase">{connected ? "Live backend connected" : "Connecting to backend"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full border border-line px-2 py-2">{llmLabel}</span>
                <span className={`rounded-full border px-2 py-2 ${gate ? "border-accent/50 text-accent" : "border-line text-muted"}`}>{gate ? "403 gate on" : "403 gate off"}</span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {ACTIONS.map((a) => {
                const on = sel === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    data-tour-id={`sim-${a.id}`}
                    onClick={() => setSel(a.id)}
                    className={`flex min-h-14 flex-col items-start justify-center gap-0 rounded-lg border px-4 py-2 text-left transition-[background-color,border-color] duration-500 ease-lsp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                      on ? "border-ink bg-surface-2" : "border-line hover:border-muted hover:bg-surface-2/60"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span className={`h-2 w-2 rounded-full ${a.kind === "clean" ? "bg-pass" : "bg-accent"}`} />
                      {a.label}
                    </span>
                    <span className="w-full truncate text-xs text-muted">{a.path}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary" onClick={() => sendAction(selected.id)} icon={<Send size={16} aria-hidden="true" />}>
                {busy ? "Sending..." : "Send request"}
              </Button>
              <Button variant="ghost" onClick={onReset} disabled={!snapshot} icon={<RotateCcw size={16} aria-hidden="true" />}>
                Reset
              </Button>
              <label className="flex min-h-12 items-center gap-2 rounded-lg border border-line bg-deep/40 px-4 text-xs text-muted">
                <span>Demo admin token</span>
                <input
                  aria-label="Demo access token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onBlur={saveTok}
                  placeholder="optional"
                  className="w-32 bg-transparent text-ink outline-none placeholder:text-muted/70"
                />
              </label>
            </div>

            <ul aria-live="polite" className="flex min-h-48 flex-col gap-2">
              <AnimatePresence initial={false} mode="popLayout">
                {log.map((r) => {
                  const v = verdict(r.disposition, r.status);
                  return (
                    <motion.li
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: -16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ duration: 0.7, ease: EASE_ARR }}
                      className="flex flex-col gap-2 rounded-lg bg-deep/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`rounded-lg px-2 py-0 leading-6 text-[11px] font-semibold tracking-wider ${BADGE[r.disposition] ?? "bg-surface-2 text-muted"}`}>{v}</span>
                          <span className="truncate text-xs text-ink">{r.path}</span>
                        </span>
                        <span className="tnum shrink-0 text-xs text-muted">{r.latencyMs.toFixed(2)} ms</span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted">
                        {r.body ? short(typeof r.body === "string" ? r.body : JSON.stringify(r.body)) : `${r.method} ${r.path} returned ${r.status}`}
                      </p>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {log.length === 0 && (
                <li className="flex items-start gap-2 rounded-lg border border-dashed border-line p-4 text-xs leading-relaxed text-muted">
                  <Info size={16} className="mt-px shrink-0 text-pass" aria-hidden="true" />
                  No requests yet. Pick an action and send it to the real backend.
                </li>
              )}
            </ul>

            {toasts.length > 0 && (
              <div className="space-y-2" aria-live="polite">
                {toasts.map((t) => (
                  <div key={t.id} className={`rounded-lg border px-4 py-2 text-xs ${t.level === "warn" ? "border-accent/40 text-accent" : t.level === "success" ? "border-pass/40 text-pass" : "border-line text-muted"}`}>
                    {t.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
            <div className="rounded-xl border border-line bg-deep/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-muted uppercase">403 gate</p>
                  <p className="mt-2 text-sm font-medium text-ink">{gate ? "Locked" : "Unlocked"}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {gate ? "Hostile traffic gets a hard 403." : "Hostile traffic can be diverted to decoys."}
                  </p>
                </div>
                <md-switch
                  ref={gateRef as any}
                  selected={gate}
                  aria-label="Toggle 403 gate"
                  data-tour-id="gate-toggle"
                  className="shrink-0"
                  style={{
                    ['--md-sys-color-primary' as any]: 'oklch(0.72 0.17 45)',
                    ['--md-sys-color-on-primary' as any]: 'oklch(0.18 0.03 45)',
                    ['--md-sys-color-primary-container' as any]: 'oklch(0.72 0.17 45)',
                    ['--md-sys-color-on-primary-container' as any]: 'oklch(0.18 0.03 45)',
                    ['--md-sys-color-surface-container-highest' as any]: 'oklch(0.25 0.016 235)',
                    ['--md-sys-color-outline' as any]: 'oklch(0.45 0.016 235)',
                    ['--md-sys-color-on-surface' as any]: 'oklch(0.96 0.01 90)',
                    ['--md-sys-color-on-surface-variant' as any]: 'oklch(0.76 0.015 235)',
                    ['--md-switch-selected-handle-color' as any]: 'oklch(0.18 0.03 45)',
                    ['--md-switch-selected-track-color' as any]: 'oklch(0.72 0.17 45)',
                    ['--md-switch-selected-hover-handle-color' as any]: 'oklch(0.18 0.03 45)',
                    ['--md-switch-selected-pressed-handle-color' as any]: 'oklch(0.18 0.03 45)',
                    ['--md-switch-selected-focus-handle-color' as any]: 'oklch(0.18 0.03 45)',
                    ['--md-switch-selected-hover-track-color' as any]: 'oklch(0.72 0.17 45)',
                    ['--md-switch-selected-pressed-track-color' as any]: 'oklch(0.72 0.17 45)',
                    ['--md-switch-selected-focus-track-color' as any]: 'oklch(0.72 0.17 45)',
                    ['--md-switch-handle-color' as any]: 'oklch(0.76 0.015 235)',
                    ['--md-switch-track-color' as any]: 'oklch(0.25 0.016 235)',
                    ['--md-switch-track-outline-color' as any]: 'oklch(0.45 0.016 235)',
                    ['--md-switch-hover-handle-color' as any]: 'oklch(0.96 0.01 90)',
                    ['--md-switch-pressed-handle-color' as any]: 'oklch(0.96 0.01 90)',
                    ['--md-switch-focus-handle-color' as any]: 'oklch(0.96 0.01 90)',
                  }}
                />
              </div>
            </div>

            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Live counters</p>
            <div className="grid gap-4">
              <Stat icon={ShieldCheck} label="Requests checked" value={totals?.requests ?? 0} />
              <Stat icon={ShieldAlert} label="Diverted to fake city" value={totals?.diverted ?? 0} />
              <Stat icon={ShieldCheck} label="Tokens saved" value={totals?.tokensSaved ?? 0} />
              <Stat icon={ShieldAlert} label="AI wakeups" value={totals?.aiWakeups ?? 0} />
            </div>
            <div className="mt-auto rounded-lg bg-deep/60 p-4 text-xs leading-relaxed text-muted">
              <p className="font-semibold text-ink">NVIDIA NIM / fallback</p>
              <p className="mt-2">Backend uses `NVIDIA_API_KEY` + `NVIDIA_MODEL` when set, OpenRouter if configured, or offline procedural decoys with no keys. This panel shows the live backend status.</p>
            </div>
          </aside>
        </Reveal>
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-deep/60 p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={16} aria-hidden="true" />
        <span className="text-xs">{label}</span>
      </div>
      <span className="tnum text-lg font-semibold text-ink">{value.toLocaleString()}</span>
    </div>
  );
}
