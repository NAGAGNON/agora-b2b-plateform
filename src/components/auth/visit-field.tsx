"use client";

import { useEffect, useRef } from "react";

/**
 * Identifiant de la visite en cours (mesure d'audience interne, sans cookie) joint à l'inscription :
 * permet de savoir d'où arrivent les inscrits (première page et provenance de la visite).
 */
export function VisitField() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const v = sessionStorage.getItem("lp-visite");
      if (ref.current && v && /^[0-9a-f-]{36}$/i.test(v)) ref.current.value = v;
    } catch {}
  }, []);
  return <input ref={ref} type="hidden" name="visite" defaultValue="" />;
}
