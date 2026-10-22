"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import { processMissingLogos } from "@/lib/company-logos";
import type { ActionResult } from "@/lib/validation";

/** Recherche immédiate des logos manquants sur les sites des entreprises (par lots, environ une minute). */
export async function fetchMissingLogos(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await processMissingLogos(createAdminClient(), { limit: 25, deadline: Date.now() + 70_000 });
    revalidatePath("/admin/entreprises");
    revalidatePath("/entreprises");
    return {
      ok: true,
      message: `${r.checked} entreprise(s) traitée(s) : ${r.found} logo(s) ajouté(s)${r.refreshed ? ` (dont ${r.refreshed} remplacé(s) par le logo de l'en-tête du site)` : ""}, ${r.noSite} sans site connu, ${r.notFound} sans logo exploitable, ${r.blocked} site(s) fermé(s) ou refusant l'exploration${r.errors ? `, ${r.errors} erreur(s)` : ""}.${r.remaining ? ` Il en reste ${r.remaining} : relancez, ou laissez la tâche quotidienne continuer.` : ""}`,
    };
  } catch (e) {
    logServerError("admin logos", e);
    return { ok: false, error: "La recherche des logos a échoué. Réessayez plus tard." };
  }
}
