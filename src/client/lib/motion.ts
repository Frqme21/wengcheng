import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(ScrollTrigger, CustomEase);

// The one easing curve used for every transition in the project
CustomEase.create("lsp", "0.16,1,0.3,1");

export const EASE = "lsp";
export const EASE_ARR: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export function debounce<T extends (...a: never[]) => void>(fn: T, ms = 150) {
  let t: number | undefined;
  const wrapped = (...a: Parameters<T>) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...a), ms);
  };
  wrapped.cancel = () => window.clearTimeout(t);
  return wrapped;
}

export { gsap, ScrollTrigger };
