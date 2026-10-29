import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/**
 * Fonctionnalité réservée aux membres : un visiteur sans compte est envoyé vers l'inscription,
 * puis ramené exactement sur la page demandée (filtres compris) une fois son compte créé.
 */
export async function requireAccount(path: string, sp: Record<string, string | string[] | undefined> = {}) {
  if (await getSession()) return;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, x);
  const suite = qs.size ? `${path}?${qs}` : path;
  redirect(`/inscription?${new URLSearchParams({ suite })}`);
}
