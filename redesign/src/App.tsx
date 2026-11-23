import { useCallback, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap, ScrollTrigger, prefersReduced } from "./lib/motion";
import { getLenis, scrollState, setLenis } from "./lib/lenis";
import NetworkBackground from "./components/NetworkBackground";
import Intro from "./components/Intro";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Verdict from "./components/Verdict";
import Courtyard from "./components/Courtyard";
import Marquee from "./components/Marquee";
import Simulator from "./components/Simulator";
import Architecture from "./components/Architecture";
import Closing from "./components/Closing";
import QuickStart from "./components/QuickStart";
import NotFound from "./components/NotFound";

export type Phase = "loading" | "intro" | "entering" | "site";

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const f = () => setHash(window.location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return hash;
}

function Site() {
  const auto = typeof navigator !== "undefined" && navigator.webdriver;
  const [phase, setPhase] = useState<Phase>(auto ? "site" : "loading");
  const [fontsReady, setFontsReady] = useState(auto);
  const [glReady, setGlReady] = useState(auto);
  const [qs, setQs] = useState<{ x: number; y: number } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  // Text and layout initialise instantly. Fonts and WebGL load beneath the preloader.
  useEffect(() => {
    let alive = true;
    const done = () => alive && setFontsReady(true);
    if (document.fonts?.ready) document.fonts.ready.then(done);
    else done();
    const t1 = window.setTimeout(done, 4000);
    const t2 = window.setTimeout(() => alive && setGlReady(true), 9000);
    return () => {
      alive = false;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // Smooth scroll, driven by the GSAP ticker so ScrollTrigger stays in sync
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: !prefersReduced(), autoRaf: false });
    lenis.stop();
    setLenis(lenis);
    const onScroll = () => {
      scrollState.progress = lenis.progress;
      scrollState.velocity = lenis.velocity;
      scrollState.y = lenis.scroll;
      ScrollTrigger.update();
    };
    lenis.on("scroll", onScroll);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.off("scroll", onScroll);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  useEffect(() => {
    const l = getLenis();
    if (!l) return;
    if (phase === "site" && !qs) l.start();
    else l.stop();
  }, [phase, qs]);

  useEffect(() => {
    if (phase !== "site") return;
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [phase]);

  const onLoaded = useCallback(() => setPhase("intro"), []);
  const onEnter = useCallback(() => setPhase("entering"), []);
  const onDone = useCallback(() => setPhase("site"), []);
  const onGl = useCallback(() => setGlReady(true), []);

  const openQuickStart = (el: HTMLButtonElement) => {
    trigger.current = el;
    const r = el.getBoundingClientRect();
    setQs({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  const closeQuickStart = useCallback(() => {
    setQs(null);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }, []);

  const hidden = phase !== "site" || !!qs;

  return (
    <div className="relative min-h-svh overflow-x-hidden bg-bg text-ink">
      <NetworkBackground onReady={onGl} />

      <div className="relative z-10" inert={hidden} aria-hidden={hidden}>
        <Header phase={phase} />
        <main>
          <Hero phase={phase} />
          <Verdict />
          <Courtyard />
          <Marquee />
          <Simulator />
          <Architecture />
          <Closing onOpen={openQuickStart} />
        </main>
      </div>

      <Intro phase={phase} fontsReady={fontsReady} glReady={glReady} onLoaded={onLoaded} onEnter={onEnter} onDone={onDone} />

      {qs && <QuickStart origin={qs} onClose={closeQuickStart} />}
    </div>
  );
}

export default function App() {
  const hash = useHash();
  // Any hash route other than the root is an unknown address
  if (hash.startsWith("#/") && hash !== "#/") return <NotFound />;
  return <Site />;
}
