import { useEffect, useRef, useState } from 'react';

interface Props {
  engaged: boolean;
  busy: boolean;
  traveling: boolean;
}

/** The 瓮 seal is an active brand actor: it greets, follows the cursor inside a
 *  44px pull radius, travels with full-screen wipes, and stamps on gate changes. */
export default function BrandSeal({ engaged, busy, traveling }: Props) {
  const sealRef = useRef<HTMLSpanElement>(null);
  const previousEngaged = useRef(engaged);
  const [stamping, setStamping] = useState(false);

  useEffect(() => {
    if (previousEngaged.current === engaged) return;
    previousEngaged.current = engaged;
    setStamping(true);
    const timer = window.setTimeout(() => setStamping(false), 560);
    return () => window.clearTimeout(timer);
  }, [engaged]);

  useEffect(() => {
    const element = sealRef.current;
    if (!element || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const radius = 44;
      const directionX = distance === 0 ? 0 : dx / distance;
      const directionY = distance === 0 ? 0 : dy / distance;
      const strength = distance < radius ? (1 - distance / radius) * 10 : 0;
      element.style.setProperty('--pull-x', `${(directionX * strength).toFixed(2)}px`);
      element.style.setProperty('--pull-y', `${(directionY * strength).toFixed(2)}px`);
    };
    const onLeave = () => {
      element.style.setProperty('--pull-x', '0px');
      element.style.setProperty('--pull-y', '0px');
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      onLeave();
    };
  }, []);

  return (
    <span
      ref={sealRef}
      className={`brand-seal${engaged ? ' is-engaged' : ''}${busy ? ' is-busy' : ''}${traveling ? ' is-traveling' : ''}${stamping ? ' is-stamping' : ''}`}
      aria-hidden="true"
    >
      瓮
    </span>
  );
}
