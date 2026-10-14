"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REGIONS } from "@/lib/geo";
import { OPPORTUNITY_TYPE_LABELS } from "@/lib/constants";
import { splitList } from "@/lib/format";
import type { ActionResult } from "@/lib/validation";
import { unsubscribeVeille } from "@/lib/veille/tracking";

/** Désinscription confirmée depuis la page publique (lien de l'e-mail, sans connexion). */
export async function confirmVeilleUnsubscribe(fd: FormData) {
  const token = String(fd.get("jeton") ?? "");
  const ok = await unsubscribeVeille(token);
  redirect(`/veille/desabonnement?jeton=${encodeURIComponent(token)}${ok ? "&ok=1" : ""}`);
}

const schema = z.object({
  frequency: z.enum(["TWICE_WEEKLY", "DAILY", "NONE"], { message: "Choisissez une fréquence." }),
  consent: z.boolean(),
  sectors: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(40),
  regions: z.array(z.string().refine((r) => REGIONS.some((x) => x.name === r))).max(20),
  types: z.array(z.string().refine((t) => t in OPPORTUNITY_TYPE_LABELS)).max(10),
  keywords: z.array(z.string().min(2).max(60)).max(20),
});

/** Préférences de veille : choix explicite de l'utilisateur, enregistré tel quel. */
export async function saveVeillePreferences(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Session expirée : reconnectez-vous." };
  const parsed = schema.safeParse({
    frequency: fd.get("frequency"),
    consent: fd.get("consent") === "on",
    sectors: fd.getAll("sectors").map(String),
    regions: fd.getAll("regions").map(String),
    types: fd.getAll("types").map(String),
    keywords: splitList(String(fd.get("keywords") ?? ""), 20),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Préférences invalides." };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: current } = await supabase.from("veille_preferences").select("consent_at").eq("user_id", session.userId).maybeSingle();
  if (d.frequency !== "NONE" && !d.consent && !current?.consent_at) {
    return { ok: false, error: "Cochez la case d'accord pour recevoir la veille par e-mail.", fieldErrors: { consent: "Accord requis" } };
  }
  if (d.frequency === "DAILY" && !d.sectors.length && !d.regions.length && !d.types.length && !d.keywords.length) {
    return { ok: false, error: "Pour les alertes quotidiennes, indiquez au moins un critère (secteur, région, type ou mot-clé).", fieldErrors: { sectors: "Au moins un critère" } };
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("veille_preferences").upsert(
    {
      user_id: session.userId,
      frequency: d.frequency,
      sectors: d.sectors,
      regions: d.regions,
      types: d.types as never,
      keywords: d.keywords,
      ...(d.frequency !== "NONE" && d.consent ? { consent_at: now, consent_source: "preferences" } : {}),
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  // Nouvel accord explicite donné par la personne elle-même : sa désinscription précédente est levée
  // (jamais pour une adresse invalide ou une plainte)
  if (d.frequency !== "NONE" && d.consent) {
    await createAdminClient().from("veille_suppressions").delete().eq("email", session.email.toLowerCase()).eq("reason", "UNSUBSCRIBE");
  }
  revalidatePath("/dashboard/veille");
  return {
    ok: true,
    message:
      d.frequency === "DAILY"
        ? "Alertes quotidiennes activées : vous recevrez chaque jour les nouvelles opportunités correspondant à vos critères (s'il y en a)."
        : d.frequency === "TWICE_WEEKLY"
          ? "Veille enregistrée : vous recevrez une sélection le lundi et le vendredi."
          : "Veille désactivée. Votre compte reste actif.",
  };
}
