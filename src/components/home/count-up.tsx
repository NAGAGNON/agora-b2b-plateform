"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Nombre réel animé : monte de 0 à sa valeur quand il apparaît à l'écran, puis glisse vers la
 * nouvelle valeur à chaque mise à jour (nouvelle inscription). Sans animation si le système le
 * demande ; la valeur exacte est rendue côté serveur.
 */
export function CountUp({ value, duration = 1400 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const from = useRef<number | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }
    const run = (start: number) => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    if (seen.current) {
      // Mise à jour en direct : de l'ancienne valeur à la nouvelle
      run(from.current ?? value);
      from.current = value;
      return () => cancelAnimationFrame(frame);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        seen.current = true;
        from.current = value;
        run(0);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString("fr-FR")}
    </span>
  );
}
