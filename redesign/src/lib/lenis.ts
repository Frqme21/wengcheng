import type Lenis from "lenis";

let instance: Lenis | null = null;

export const getLenis = () => instance;
export const setLenis = (l: Lenis | null) => {
  instance = l;
};

/** Live scroll values shared with the WebGL background and the marquee */
export const scrollState = { progress: 0, velocity: 0, y: 0 };

const expo = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

export function scrollToTarget(target: string | number) {
  const l = instance;
  let dest: string | number | HTMLElement = target;
  if (typeof target === "string") {
    const el = document.querySelector<HTMLElement>(target);
    if (!el) return;
    // A pinned section reports a fixed rect while pinned, so aim at its spacer instead
    const spacer = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el;
    dest = spacer;
  }
  if (l) {
    l.scrollTo(dest, { duration: 1.6, easing: expo, offset: typeof target === "string" ? -64 : 0 });
    return;
  }
  if (typeof dest === "number") window.scrollTo({ top: dest });
  else if (typeof dest !== "string") dest.scrollIntoView();
}
