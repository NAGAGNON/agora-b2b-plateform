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

function sourceTag(): string | undefined {
  try {
    const v = new URLSearchParams(window.location.search).get("utm_source");
    return v && /^[a-z0-9._-]{1,60}$/i.test(v) ? v.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export function AudienceTracker() {
  const pathname = usePathname();
  const current = useRef<{ id: number; sid: string; visibleMs: number; since: number | null } | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;
    // Navigateur piloté par un programme (robots d'exploration qui exécutent les pages) : pas une visite
    if (nav.webdriver) return;
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
    const firstView = sessionStorage.getItem("lp-visite-ref") === null;
    const referrer = firstView ? document.referrer : "";
    // Page vue comptée après 2 secondes de présence, onglet visible : les robots qui affichent une page
    // et repartent aussitôt (par paquets, sans provenance) ne sont plus comptés comme des visites
    let timer: ReturnType<typeof setTimeout> | null = null;
    const send = () => fetch("/api/audience", {
      method: "POST",
      // Étiquette de provenance des liens du site (e-mails de prospection, veille, suivi) : première page de la visite
      body: JSON.stringify({ t: "view", sid, path: pathname, ref: referrer || undefined, src: firstView ? sourceTag() : undefined, w: window.innerWidth }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { id?: number } | null) => {
        if (!cancelled && d?.id) current.current = { id: d.id, sid, visibleMs: 2000, since: document.visibilityState === "visible" ? Date.now() : null };
      })
      .catch(() => {});
    const record = () => {
      if (cancelled) return;
      try {
        sessionStorage.setItem("lp-visite-ref", "1");
      } catch {}
      void send();
    };
    const arm = () => {
      if (timer || document.visibilityState !== "visible") return;
      timer = setTimeout(record, 2000);
    };
    arm();
    const onShow = () => arm();

    document.addEventListener("visibilitychange", onShow);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
      current.current = null;
    };
  }, [pathname]);

  return null;
}
