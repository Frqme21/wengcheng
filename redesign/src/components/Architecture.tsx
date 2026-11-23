import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Reveal, SectionHead } from "./ui";
import { EASE_ARR } from "../lib/motion";

const FILES = [
  { f: "server/index.ts", s: "Bootstrap", d: "Express with Vite middleware in development and static delivery in production. The WebSocket attaches to the same process." },
  { f: "server/sentinel.ts", s: "Zero-token classifier", d: "Pre-compiled regex signatures, path rules, user-agent signatures and fixed-memory sliding windows. Synchronous, under 2ms." },
  { f: "server/deception.ts", s: "Decoys and tarpits", d: "Cache keyed by category and normalized path, procedural decoys, and an adaptive tarpit with slow-drip replies." },
  { f: "server/analyst.ts", s: "Narratives and reports", d: "Threat narratives, MITRE tags, and Markdown or JSON incident reports." },
  { f: "server/llm.ts", s: "Model client", d: "OpenAI-compatible NVIDIA NIM or OpenRouter client with JSON repair and a per-session call cap." },
  { f: "server/state.ts", s: "Telemetry store", d: "In-memory telemetry, sliding windows and lockdown state." },
  { f: "server/portal.ts", s: "Inner citadel", d: "The protected AegisCloud Enterprise Portal, reached only on a PASS verdict." },
  { f: "server/realtime.ts", s: "Control plane", d: "WebSocket telemetry plus the one-click simulator used for demos." },
  { f: "client/", s: "SOC dashboard", d: "Vite, React and Tailwind with an SVG topology map, a session drawer and an attacker view." },
];

const ENDPOINTS: { title: string; tone: "pass" | "hot" | "plain"; items: string[] }[] = [
  { title: "Real portal, PASS only", tone: "pass", items: ["/portal", "/portal/api/overview", "/portal/api/users", "/portal/api/billing", "/portal/admin"] },
  { title: "Synthetic canaries", tone: "hot", items: ["/.env", "/admin", "/wp-admin", "/api/dump"] },
  { title: "Novel probe, wakes the model once", tone: "hot", items: ["/portal/api/v2/ledger/reconcile?..."] },
  { title: "Control and telemetry", tone: "plain", items: ["/api/snapshot", "/api/commands", "/api/reports/:id.md", "/health", "/ws"] },
];

export default function Architecture() {
  const [open, setOpen] = useState<string | null>("server/sentinel.ts");

  return (
    <section id="stack" className="relative py-16 md:py-24 lg:py-32">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 md:px-8">
        <Reveal>
          <SectionHead eyebrow="04 Stack" title="One process, nine moving parts." lead="Tap a file to see what it does." />
        </Reveal>

        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <Reveal className="flex flex-col divide-y divide-line rounded-[32px] border border-line bg-surface p-2">
            {FILES.map((x) => {
              const on = open === x.f;
              return (
                <div key={x.f} className="flex flex-col">
                  <button
                    type="button"
                    aria-expanded={on}
                    onClick={() => setOpen(on ? null : x.f)}
                    className="flex min-h-14 items-center justify-between gap-4 rounded-3xl px-4 py-2 text-left transition-colors duration-500 ease-lsp hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
                  >
                    <span className="flex flex-col gap-0 sm:flex-row sm:items-baseline sm:gap-4">
                      <span className="text-sm font-semibold text-ink">{x.f}</span>
                      <span className="text-xs text-muted">{x.s}</span>
                    </span>
                    <Plus
                      size={18}
                      aria-hidden="true"
                      className={`shrink-0 text-muted transition-transform duration-500 ease-lsp ${on ? "rotate-45 text-accent" : ""}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.6, ease: EASE_ARR }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[65ch] px-4 pb-4 text-sm leading-relaxed text-muted">{x.d}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </Reveal>

          <Reveal className="flex flex-col gap-4">
            {ENDPOINTS.map((g) => (
              <div
                key={g.title}
                className={`flex flex-col gap-4 rounded-[32px] p-6 ${
                  g.tone === "pass" ? "border border-pass/40 bg-surface" : g.tone === "hot" ? "border border-accent/30 bg-court" : "bg-surface-2"
                }`}
              >
                <h3 className="font-sans text-sm font-semibold tracking-wide text-ink">{g.title}</h3>
                <ul className="flex flex-wrap gap-2">
                  {g.items.map((i) => (
                    <li key={i} className="rounded-lg bg-deep/60 px-2 py-0 leading-6 text-xs text-ink">
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
