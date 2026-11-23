import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TourStep {
  id: string;
  targetId: string;
  title: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

const PAD = 16;
const GAP = 24;
const MARGIN = 16;
const DIM = 'oklch(0.25 0.018 210 / 0.62)';

function sameBox(a: Box | null, b: Box): boolean {
  return (
    a !== null &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height &&
    a.bottom === b.bottom &&
    a.right === b.right
  );
}

export default function SpotlightTour({ steps, currentStep, onNext, onBack, onSkip }: Props) {
  const step = steps[currentStep]!;
  const [box, setBox] = useState<Box | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: MARGIN, left: MARGIN });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);

  const measure = useCallback(() => {
    const element = document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`);
    if (!element) {
      setBox(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    const next: Box = {
      top: Math.max(0, rect.top - PAD),
      left: Math.max(0, rect.left - PAD),
      right: Math.min(window.innerWidth, rect.right + PAD),
      bottom: Math.min(window.innerHeight, rect.bottom + PAD),
      width: 0,
      height: 0,
    };
    next.width = Math.max(0, next.right - next.left);
    next.height = Math.max(0, next.bottom - next.top);
    setBox((prev) => (sameBox(prev, next) ? prev : next));
  }, [step.targetId]);

  const placeTooltip = useCallback(() => {
    if (!box || !tooltipRef.current) return;
    const width = tooltipRef.current.offsetWidth;
    const height = tooltipRef.current.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const centeredLeft = box.left + box.width / 2 - width / 2;
    const clampLeft = (value: number) =>
      Math.min(Math.max(MARGIN, value), Math.max(MARGIN, viewportWidth - width - MARGIN));
    const clampTop = (value: number) =>
      Math.min(Math.max(MARGIN, value), Math.max(MARGIN, viewportHeight - height - MARGIN));

    const fitsBelow = box.bottom + GAP + height <= viewportHeight - MARGIN;
    const fitsAbove = box.top - GAP - height >= MARGIN;
    const horizontalCenterY = box.top + box.height / 2 - height / 2;

    let next = { top: MARGIN, left: clampLeft(centeredLeft) };
    if (fitsBelow) {
      next = { top: box.bottom + GAP, left: clampLeft(centeredLeft) };
    } else if (fitsAbove) {
      next = { top: box.top - GAP - height, left: clampLeft(centeredLeft) };
    } else if (box.right + GAP + width <= viewportWidth - MARGIN) {
      next = { top: clampTop(horizontalCenterY), left: box.right + GAP };
    } else if (box.left - GAP - width >= MARGIN) {
      next = { top: clampTop(horizontalCenterY), left: box.left - GAP - width };
    }

    setTooltipPos((prev) => (prev.top === next.top && prev.left === next.left ? prev : next));
  }, [box]);

  useEffect(() => {
    let cancelled = false;
    const frames: number[] = [];

    const trackFor = (durationMs: number) => {
      const started = performance.now();
      const tick = () => {
        if (cancelled) return;
        measure();
        if (performance.now() - started < durationMs) frames.push(requestAnimationFrame(tick));
      };
      frames.push(requestAnimationFrame(tick));
    };

    let attempts = 0;
    const locate = () => {
      if (cancelled) return;
      const element = document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`);
      if (element) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center', inline: 'center' });
        measure();
        trackFor(900);
        return;
      }
      if (attempts < 40) {
        attempts += 1;
        frames.push(requestAnimationFrame(locate));
      }
    };

    locate();
    return () => {
      cancelled = true;
      frames.forEach((frame) => cancelAnimationFrame(frame));
    };
  }, [measure, step.targetId]);

  useEffect(() => {
    const update = () => measure();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [measure]);

  useEffect(() => {
    const element = document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`);
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, step.targetId]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [currentStep]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'Escape') onSkip();
      if (event.key === 'ArrowRight') onNext();
      if (event.key === 'ArrowLeft' && currentStep > 0) onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentStep, onBack, onNext, onSkip]);

  useLayoutEffect(() => {
    placeTooltip();
  }, [placeTooltip, step.id]);

  const safeBox = box ?? { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="absolute left-0 right-0" style={{ top: 0, height: safeBox.top, background: DIM }} aria-hidden="true" />
      <div className="absolute left-0 right-0" style={{ top: safeBox.bottom, bottom: 0, background: DIM }} aria-hidden="true" />
      <div
        className="absolute"
        style={{ top: safeBox.top, left: 0, width: safeBox.left, height: safeBox.height, background: DIM }}
        aria-hidden="true"
      />
      <div
        className="absolute"
        style={{ top: safeBox.top, left: safeBox.right, right: 0, height: safeBox.height, background: DIM }}
        aria-hidden="true"
      />

      {box && (
        <div
          className="tour-ring pointer-events-none absolute left-0 top-0 z-[1] rounded-2xl border-2"
          style={{
            transform: `translate3d(${box.left}px, ${box.top}px, 0)`,
            width: box.width,
            height: box.height,
          }}
          aria-hidden="true"
        />
      )}

      <div
        key={step.id}
        ref={tooltipRef}
        className="tour-card surface absolute z-[2] flex w-[min(520px,calc(100vw-32px))] flex-col gap-6 p-6 sm:p-8"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="tour-seal" aria-hidden="true">瓮</span>
            <span className="section-label">Step {currentStep + 1} of {steps.length}</span>
          </div>
          <div className="flex items-center gap-2" aria-hidden="true">
            {steps.map((item, index) => (
              <span
                key={item.id}
                className={`tour-dot ${index <= currentStep ? 'is-active' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3
            className="tour-rise font-semibold tracking-[-0.02em] text-ink"
            style={{ fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)', animationDelay: '80ms' }}
          >
            {step.title}
          </h3>
          <p
            className="tour-rise max-w-[65ch] leading-7 text-muted"
            style={{ fontSize: 'clamp(0.95rem, 1.05vw, 1.0625rem)', animationDelay: '140ms' }}
          >
            {step.body}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <button onClick={onSkip} className="focus-ring tour-quiet min-h-[44px] px-2 text-sm font-medium text-faint">
            Skip tour
          </button>
          <div className="flex gap-2">
            <button
              onClick={onBack}
              disabled={currentStep === 0}
              className="btn btn-quiet min-h-[44px] px-5 py-2 text-sm"
            >
              Back
            </button>
            <button ref={nextRef} onClick={onNext} className="btn btn-primary min-h-[44px] px-5 py-2 text-sm">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
