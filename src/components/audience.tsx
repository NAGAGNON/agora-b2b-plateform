"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Mesure d'audience interne : une page vue par navigation et le temps de lecture
 * (onglet visible uniquement). Aucun cookie ; l'identifiant de visite vit dans
 * sessionStorage et disparaît à la fermeture de l'onglet. Respecte Do Not Track / GPC.
 */
function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem("lp-visite");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("lp-visite", id);
    }
    return id;
  } catch {
    return null;
  }
}

export function AudienceTracker() {
  const pathname = usePathname();
  const current = useRef<{ id: number; sid: string; visibleMs: number; since: number | null } | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;
    const sid = sessionId();
    if (!sid) return;

    const elapsed = () => {
      const c = current.current;
      return c ? c.visibleMs + (c.since !== null ? Date.now() - c.since : 0) : 0;
    };
    const flush = () => {
      const c = current.current;
      if (!c) return;
      const body = JSON.stringify({ t: "time", sid: c.sid, id: c.id, ms: Math.round(elapsed()) });
      if (!navigator.sendBeacon?.("/api/audience", body)) {
        void fetch("/api/audience", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    };
    const onVisibility = () => {
      const c = current.current;
      if (!c) return;
      if (document.visibilityState === "hidden") {
        if (c.since !== null) c.visibleMs += Date.now() - c.since;
        c.since = null;
        flush();
      } else if (c.since === null) {
        c.since = Date.now();
      }
    };

    let cancelled = false;
    const referrer = sessionStorage.getItem("lp-visite-ref") === null ? document.referrer : "";
    try {
      sessionStorage.setItem("lp-visite-ref", "1");
    } catch {}
    void fetch("/api/audience", {
      method: "POST",
      body: JSON.stringify({ t: "view", sid, path: pathname, ref: referrer || undefined, w: window.innerWidth }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { id?: number } | null) => {
        if (!cancelled && d?.id) current.current = { id: d.id, sid, visibleMs: 0, since: document.visibilityState === "visible" ? Date.now() : null };
      })
      .catch(() => {});

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
      current.current = null;
    };
  }, [pathname]);

  return null;
}
