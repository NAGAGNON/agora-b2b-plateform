"use client";

import { useEffect, useRef } from "react";

/**
 * Vidéo d'illustration de l'accueil (montage de photos libres, sans son, en boucle).
 * Lancée seulement si le système n'a pas demandé de réduire les animations ;
 * sinon l'image fixe placée dessous reste affichée.
 */
export function HeroVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);
  return (
    <video
      ref={ref}
      aria-hidden
      muted
      loop
      playsInline
      preload="metadata"
      poster="/media/hero-poster.webp"
      className={className}
    >
      <source src="/media/hero.webm" type="video/webm" />
      <source src="/media/hero.mp4" type="video/mp4" />
    </video>
  );
}
