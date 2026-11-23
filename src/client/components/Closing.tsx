import { ArrowUpRight, FlaskConical, Database, Radio, Sparkles, UserX, ArrowUp } from "lucide-react";
import Button from "./Button";
import { Reveal, SectionHead } from "./ui";
import { scrollToTarget } from "../lib/lenis";

const LIMITS = [
  { i: FlaskConical, t: "A research prototype", d: "It is a demo, not a production intrusion prevention system." },
  { i: Database, t: "Memory only", d: "Telemetry lives in memory and resets when the process restarts." },
  { i: Radio, t: "Simulated attackers", d: "Hostile traffic comes from the simulator or scripts/attacker.py, not a network tap." },
  { i: Sparkles, t: "AI can be wrong", d: "Model output is decision support. The short procedural report always works offline." },
  { i: UserX, t: "No real data", d: "The mock portal contains no real customer data." },
];

export default function Closing({ onOpen }: { onOpen: (el: HTMLButtonElement) => void }) {
  return (
    <>
      <section id="limits" className="relative py-16 md:py-24 lg:py-32">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 md:px-8">
          <Reveal>
            <SectionHead eyebrow="05 Limits" title="What it is not." />
          </Reveal>
          <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIMITS.map(({ i: Icon, t, d }, idx) => (
              <div
                key={t}
                className={`flex flex-col gap-4 rounded-[32px] p-6 ${idx % 3 === 0 ? "bg-surface" : idx % 3 === 1 ? "bg-surface-2" : "border border-line"}`}
              >
                <Icon size={24} className="text-muted" aria-hidden="true" />
                <h3 className="font-sans text-base font-semibold text-ink">{t}</h3>
                <p className="max-w-[40ch] text-sm leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="relative py-16 md:py-24 lg:py-32">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-8 px-4 md:px-8">
          <Reveal className="flex flex-col items-start gap-8">
            <h2 className="max-w-[16ch] text-[clamp(2.25rem,5.4vw,4.5rem)] leading-[1.05]">Three commands to run it.</h2>
            <p className="max-w-[65ch] text-base text-muted md:text-lg">Works offline with procedural decoys. Add a model key only for AI decoys.</p>
            <Button
              variant="primary"
              magnetic={48}
              onClick={(e) => onOpen(e.currentTarget)}
              icon={<ArrowUpRight size={18} aria-hidden="true" />}
            >
              Quick start
            </Button>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-line py-16">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 px-4 sm:flex-row sm:items-center md:px-8">
          <div className="flex flex-col gap-2">
            <span className="font-display text-2xl text-ink">瓮城 Wèngchéng</span>
            <span className="text-sm text-muted">Zero tokens for normal traffic. Zero Docker required locally.</span>
          </div>
          <Button variant="ghost" onClick={() => scrollToTarget(0)} icon={<ArrowUp size={16} aria-hidden="true" />}>
            Back to top
          </Button>
        </div>
      </footer>
    </>
  );
}
