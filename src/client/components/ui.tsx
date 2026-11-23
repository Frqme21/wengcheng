import { useEffect, useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, MOTION_OK } from "../lib/motion";

export function SectionHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <span className="tnum text-xs font-semibold tracking-[0.24em] text-accent uppercase">{eyebrow}</span>
      <h2 className="max-w-[18ch] text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.08]">{title}</h2>
      {lead ? <p className="max-w-[65ch] text-base leading-relaxed text-muted md:text-lg">{lead}</p> : null}
    </div>
  );
}

/** Fades children up once when they scroll into view. Static when motion is reduced. */
export function Reveal({
  children,
  className = "",
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const items = Array.from(el.children);
      gsap.set(items, { opacity: 0, y: 40 });
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top 85%",
        once: true,
        onEnter: () =>
          gsap.to(items, { opacity: 1, y: 0, duration: 1.2, stagger, ease: "lsp", overwrite: "auto" }),
      });
      return () => {
        st.kill();
        gsap.set(items, { clearProps: "opacity,transform" });
      };
    });
    return () => mm.revert();
  }, [stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
