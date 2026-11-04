"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

/**
 * Spot de présentation LinkProB2B (30 s, musique d'ambiance originale, sans voix) : lancé automatiquement, sans le son et en boucle,
 * sur ordinateur comme sur téléphone. Si le navigateur bloque la lecture automatique (mode économie
 * d'énergie, par exemple), elle démarre au premier geste du visiteur sur la page.
 * Le visiteur peut activer le son ou mettre la vidéo en pause.
 * Chargement différé : l'image d'aperçu s'affiche tout de suite ; la vidéo (environ 800 Ko) n'est
 * téléchargée qu'une fois la page affichée, pour ne pas ralentir le reste. Mode « économie de
 * données » du téléphone : la vidéo ne se charge qu'à la demande (bouton lecture).
 */
export function HeroVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [load, setLoad] = useState(false);

  // Téléchargement de la vidéo après l'affichage de la page (et quand le navigateur est disponible)
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (saveData) return;
    let idle: number | undefined;
    const go = () => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      idle = ric ? ric(() => setLoad(true), { timeout: 2500 }) : window.setTimeout(() => setLoad(true), 600);
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      if (idle !== undefined) {
        const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
        if (cic) cic(idle);
        else window.clearTimeout(idle);
      }
    };
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !load) return;
    v.load();
    v.muted = true;
    const start = () => {
      if (!userPaused.current && v.paused) v.play().catch(() => {});
    };
    start();
    v.addEventListener("canplay", start, { once: true });
    const events = ["pointerdown", "touchstart", "keydown"] as const;
    const onGesture = () => {
      start();
      events.forEach((e) => window.removeEventListener(e, onGesture));
    };
    events.forEach((e) => window.addEventListener(e, onGesture, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onGesture));
  }, [load]);

  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    if (!load) setLoad(true);
    v.muted = !v.muted;
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
    }
  };
  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
    if (!load) {
      // Pas encore chargée (économie de données) : chargement à la demande puis lecture
      userPaused.current = false;
      setLoad(true);
      return;
    }
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
    } else {
      userPaused.current = true;
      v.pause();
    }
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-full bg-navy-900/80 px-2.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-navy-900 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm";
  return (
    <>
      <video
        ref={ref}
        aria-label="Présentation vidéo de LinkProB2B"
        muted
        loop
        playsInline
        preload={load ? "auto" : "none"}
        poster="/media/spot-poster.webp"
        className={className}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      >
        {load && (
          <>
            <source src="/media/spot.webm" type="video/webm" />
            <source src="/media/spot.mp4" type="video/mp4" />
          </>
        )}
      </video>
      <div className="absolute right-2 bottom-6 z-10 flex gap-2 sm:right-3 sm:bottom-8">
        <button type="button" onClick={togglePlay} className={btn} aria-label={playing ? "Mettre la vidéo en pause" : "Lire la vidéo"}>
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <button type="button" onClick={toggleSound} className={btn}>
          {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
          {muted ? "Activer le son" : "Couper le son"}
        </button>
      </div>
    </>
  );
}
