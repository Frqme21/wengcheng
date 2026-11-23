import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { gsap, prefersReduced } from "../lib/motion";

type Variant = "primary" | "secondary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Pull radius in px (30 to 50) around the button edge */
  magnetic?: number;
  icon?: ReactNode;
};

const base =
  "relative inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold tracking-wide whitespace-nowrap select-none " +
  "transition-[background-color,color,border-color,box-shadow,opacity,filter] duration-500 ease-lsp " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-0 disabled:shadow-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-[0_0_0_0_oklch(0.72_0.17_45/0)] " +
    "enabled:hover:bg-[oklch(0.78_0.16_48)] enabled:hover:shadow-[0_0_0_8px_oklch(0.72_0.17_45/0.2)] " +
    "enabled:active:bg-[oklch(0.66_0.17_42)]",
  secondary:
    "bg-surface-2 text-ink border border-line " +
    "enabled:hover:bg-[oklch(0.3_0.018_235)] enabled:hover:border-muted enabled:active:bg-surface",
  ghost: "text-muted enabled:hover:text-ink enabled:hover:bg-surface-2 enabled:active:bg-surface",
};

export default function Button({ variant = "secondary", magnetic, icon, className = "", children, ...rest }: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !magnetic || prefersReduced()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.7, ease: "elastic.out(1, 0.6)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.7, ease: "elastic.out(1, 0.6)" });
    let active = false;

    const move = (e: PointerEvent) => {
      if (el.disabled) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const ex = Math.max(Math.abs(dx) - r.width / 2, 0);
      const ey = Math.max(Math.abs(dy) - r.height / 2, 0);
      const dist = Math.hypot(ex, ey);
      if (dist <= magnetic) {
        active = true;
        const pull = 0.32;
        xTo(Math.max(-magnetic, Math.min(magnetic, dx * pull)));
        yTo(Math.max(-magnetic, Math.min(magnetic, dy * pull)));
      } else if (active) {
        active = false;
        xTo(0);
        yTo(0);
      }
    };
    const leave = () => {
      active = false;
      xTo(0);
      yTo(0);
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "x,y" });
    };
  }, [magnetic]);

  return (
    <button ref={ref} className={`${base} ${variants[variant]} kinetic ${className}`} {...rest}>
      {children}
      {icon}
    </button>
  );
}
