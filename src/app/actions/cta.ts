"use server";

import { track } from "@/lib/analytics";

/** Clic sur un appel à l'action (identifiant du bouton et page uniquement, aucune donnée personnelle). */
export async function trackCta(cta: string, path: string) {
  if (!/^[a-z0-9_-]{1,60}$/.test(cta) || !/^\/[^\s]{0,200}$/.test(path)) return;
  await track("cta_click", { cta, path: path.split("?")[0] });
}
