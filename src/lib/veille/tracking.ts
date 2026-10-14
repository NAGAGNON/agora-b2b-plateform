import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/format";
import { logServerError } from "@/lib/errors";

/** Envoi de veille correspondant au jeton d'un e-mail (null si inconnu). */
export async function sendFromToken(token: string | null | undefined) {
  if (!token || !isUuid(token)) return null;
  const { data } = await createAdminClient().from("veille_sends").select("id, user_id, email, opportunity_ids, opened_at, clicked_at, unsubscribed_at").eq("token", token).maybeSingle();
  return data;
}

export async function recordVeilleEvent(token: string | null | undefined, type: "OPEN" | "CLICK", opportunityId?: string) {
  try {
    const s = await sendFromToken(token);
    if (!s) return;
    const db = createAdminClient();
    const now = new Date().toISOString();
    await db.from("veille_events").insert({ send_id: s.id, type, opportunity_id: opportunityId && s.opportunity_ids.includes(opportunityId) ? opportunityId : null });
    // Un clic vaut aussi ouverture (images souvent bloquées par les messageries)
    if (!s.opened_at) await db.from("veille_sends").update({ opened_at: now }).eq("id", s.id).is("opened_at", null);
    if (type === "CLICK" && !s.clicked_at) await db.from("veille_sends").update({ clicked_at: now }).eq("id", s.id).is("clicked_at", null);
  } catch (e) {
    logServerError("veille event", e);
  }
}

/** Désinscription immédiate : veille arrêtée (compte conservé) et adresse ajoutée à la liste d'exclusion. */
export async function unsubscribeVeille(token: string | null | undefined): Promise<boolean> {
  const s = await sendFromToken(token);
  if (!s) return false;
  const db = createAdminClient();
  const now = new Date().toISOString();
  await db.from("veille_suppressions").upsert({ email: s.email.toLowerCase(), reason: "UNSUBSCRIBE" }, { onConflict: "email", ignoreDuplicates: true });
  await db.from("veille_preferences").upsert({ user_id: s.user_id, frequency: "NONE", updated_at: now }, { onConflict: "user_id" });
  if (!s.unsubscribed_at) {
    await db.from("veille_sends").update({ unsubscribed_at: now }).eq("id", s.id);
    await db.from("veille_events").insert({ send_id: s.id, type: "UNSUBSCRIBE" });
  }
  // Envois encore en attente pour cette personne : annulés
  await db.from("veille_sends").update({ status: "SKIPPED", error: "Désinscription" }).eq("user_id", s.user_id).eq("status", "PENDING");
  return true;
}
