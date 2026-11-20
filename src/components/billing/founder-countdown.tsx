"use client";

import { useEffect, useState } from "react";

/** Temps restant jusqu'à la fermeture de la liste (jours, heures, minutes, secondes). */
export function FounderCountdown({ endsAt, tone = "light" }: { endsAt: string; tone?: "light" | "dark" }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return null;
  const left = Math.max(0, end - now);
  const parts: [number, string][] = [
    [Math.floor(left / 86_400_000), "j"],
    [Math.floor(left / 3_600_000) % 24, "h"],
    [Math.floor(left / 60_000) % 60, "min"],
    [Math.floor(left / 1000) % 60, "s"],
  ];
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" data-testid="founder-countdown" aria-label="Temps restant pour rejoindre la liste">
      {parts.map(([v, u]) => (
        <span key={u} className={tone === "dark" ? "rounded-lg bg-white/10 px-2 py-1 font-bold text-white" : "rounded-lg bg-white px-2 py-1 font-bold text-navy ring-1 ring-teal/30"}>
          {String(v).padStart(2, "0")}
          <span className="ml-0.5 text-xs font-semibold opacity-70">{u}</span>
        </span>
      ))}
    </span>
  );
}
