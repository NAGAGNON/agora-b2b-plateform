"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";

/**
 * Spot de présentation LinkProB2B (30 s, voix off) : lancé sans le son et en boucle,
 * le visiteur active le son d'un clic. Si le système demande de réduire les animations,
 * rien ne démarre seul : l'image fixe s'affiche avec un bouton de lecture.
 */
export function HeroVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  const playWithSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    if (v.paused) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  };
  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) return playWithSound();
    v.muted = !v.muted;
  };

  return (
    <>
      <video
        ref={ref}
        aria-label="Présentation vidéo de LinkProB2B"
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/spot-poster.webp"
        className={className}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      >
        <source src="/media/spot.webm" type="video/webm" />
        <source src="/media/spot.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggleSound}
        className="absolute right-2 bottom-6 z-10 inline-flex items-center gap-1.5 rounded-full bg-navy-900/80 px-2.5 py-1.5 text-xs font-semibold sm:right-3 sm:bottom-8 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-navy-900"
      >
        {!playing ? (
          <>
            <Play className="size-4" aria-hidden /> Lire la vidéo
          </>
        ) : muted ? (
          <>
            <VolumeX className="size-4" aria-hidden /> Activer le son
          </>
        ) : (
          <>
            <Volume2 className="size-4" aria-hidden /> Couper le son
          </>
        )}
      </button>
    </>
  );
}
