"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Suivi « en direct » : la page se met à jour toute seule (par défaut chaque minute) tant qu'elle est
 * affichée ; en arrière-plan, rien n'est rechargé, et la mise à jour reprend dès le retour sur l'onglet.
 */
export function LiveRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300" data-testid="live">
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-teal" />
      </span>
      En direct
    </span>
  );
}
