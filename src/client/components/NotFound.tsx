import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import LogoMark from "./Logo";
import Button from "./Button";
import { gsap, prefersReduced } from "../lib/motion";

export default function NotFound() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "404 | Wèngchéng 瓮城";
    if (prefersReduced() || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-in]", { opacity: 0, y: 40, duration: 1.3, stagger: 0.1, ease: "lsp" });
      gsap.from("[data-logo]", { opacity: 0, scale: 0.7, rotate: -12, duration: 1.5, ease: "lsp" });
    }, root);
    return () => {
      ctx.revert();
      document.title = "Wèngchéng 瓮城 | Adaptive Cyber-Deception Grid";
    };
  }, []);

  return (
    <div ref={root} className="relative flex min-h-svh items-center justify-center overflow-x-hidden bg-deep px-4 py-16 text-ink">
      <main className="flex max-w-[680px] flex-col items-center gap-8 text-center">
        <div data-logo className="kinetic" style={{ width: "var(--logo-size)", height: "var(--logo-size)" }}>
          <LogoMark className="h-full w-full" />
        </div>
        <div className="flex flex-col items-center gap-4">
          <span data-in className="tnum text-xs font-semibold tracking-[0.32em] text-accent uppercase">
            Error 404
          </span>
          <h1 data-in className="text-[clamp(2rem,5vw,3.5rem)] leading-tight">
            This gate leads nowhere.
          </h1>
          <p data-in className="max-w-[48ch] text-base leading-relaxed text-muted">
            The address you opened does not exist here. Nothing is hiding behind it, not even a decoy.
          </p>
        </div>
        <div data-in>
          <Button
            variant="primary"
            magnetic={40}
            onClick={() => {
              window.location.hash = "";
            }}
            icon={<ArrowLeft size={18} aria-hidden="true" />}
            className="flex-row-reverse"
          >
            Back to Wèngchéng
          </Button>
        </div>
      </main>
    </div>
  );
}
