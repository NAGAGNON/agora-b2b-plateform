"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const KEY = "lp-return-point";
const RESTORE = "lp-return-restore";

/** Pages où l'on « cherche » (on y revient avec « Continuer mes recherches »). */
const isBrowsing = (path: string) =>
  path === "/" ||
  path === "/opportunites" ||
  (/^\/opportunites\//.test(path) && !/^\/opportunites\/[0-9a-f-]{36}$/i.test(path)) ||
  path.startsWith("/acheteurs") ||
  path.startsWith("/entreprises") ||
  path === "/dashboard/recommandations" ||
  path === "/dashboard/favoris" ||
  path === "/dashboard/opportunites";

type Point = { url: string; y: number };

export function readReturnPoint(): Point | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Point) : null;
  } catch {
    return null;
  }
}

/** Retour exact : même adresse (filtres, page) puis même position dans la page. */
export function goBackToSearch(fallback = "/opportunites") {
  const p = readReturnPoint();
  try {
    if (p) sessionStorage.setItem(RESTORE, JSON.stringify(p));
  } catch {
    // ignoré : retour sans la position
  }
  window.location.assign(p?.url ?? fallback);
}

/**
 * Mémorise la dernière page de recherche consultée et la position de défilement, et la restaure au
 * retour. Invisible ; une seule instance dans la mise en page du site.
 */
export function ReturnPointTracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    // Retour demandé : on remet la page à la même hauteur une fois le contenu affiché
    let restore: number | null = null;
    const qs0 = search.toString();
    const here = `${pathname}${qs0 ? `?${qs0}` : ""}`;
    try {
      const v = sessionStorage.getItem(RESTORE);
      const r = v ? (JSON.parse(v) as Point) : null;
      // Seulement sur la page de recherche visée (pas sur la page quittée, rafraîchie juste avant)
      if (r && r.url === here) {
        sessionStorage.removeItem(RESTORE);
        restore = r.y;
      }
    } catch {
      // ignoré
    }
    if (restore && restore > 0) {
      let tries = 0;
      const target = restore;
      const tick = () => {
        if (document.documentElement.scrollHeight >= target + window.innerHeight || tries > 40) window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
        else {
          tries++;
          setTimeout(tick, 100);
        }
      };
      tick();
    }
    if (!isBrowsing(pathname)) return;
    const qs = search.toString();
    const url = `${pathname}${qs ? `?${qs}` : ""}`;
    const save = () => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ url, y: Math.round(window.scrollY) }));
      } catch {
        // ignoré
      }
    };
    save();
    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        save();
      }, 250);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (t) clearTimeout(t);
      save();
    };
  }, [pathname, search]);

  return null;
}
