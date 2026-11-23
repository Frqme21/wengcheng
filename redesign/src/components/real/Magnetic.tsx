import { useEffect, useRef, type ReactNode } from 'react';

/** Isolated primary actions get a 44px magnetic pull radius per LSP. */
export default function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const radius = 44;
      const strength = distance < radius ? (1 - distance / radius) * 8 : 0;
      element.style.transform = distance === 0
        ? 'translate3d(0, 0, 0)'
        : `translate3d(${((dx / distance) * strength).toFixed(2)}px, ${((dy / distance) * strength).toFixed(2)}px, 0)`;
    };
    const onLeave = () => { element.style.transform = 'translate3d(0, 0, 0)'; };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      onLeave();
    };
  }, []);

  return <span ref={ref} className="magnetic">{children}</span>;
}
