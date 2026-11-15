import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;
const DAY = 86_400_000;
const nowMs = () => Date.now();

/**
 * Demande de résultat par e-mail : 3 semaines après la date limite d'une réponse envoyée, une seule
 * fois, aux administrateurs de l'entreprise. Contrôlée par le réglage « application_reminders » (activé). Les rappels de date limite existent déjà
 * (offres suivies : 7 jours puis 2 jours avant).
 */
export async function processApplicationReminders(db: Db = createAdminClient(), { limit = 50 } = {}) {
  const { data: setting } = await db.from("platform_settings").select("value").eq("key", "application_reminders").maybeSingle();
  if ((setting?.value as { enabled?: boolean } | null)?.enabled !== true) return { sent: 0, skipped: "Rappels désactivés (réglage application_reminders)" };
  const before = new Date(nowMs() - 21 * DAY).toISOString();
  const { data: items } = await db
    .from("pipeline_items")
    .select("id, company_id, result_asked_at, opportunity:opportunities!inner(id, title, response_deadline)")
    .eq("stage", "RESPONSE_SENT")
    .is("result_email_at", null)
    .lt("opportunity.response_deadline", before)
    .limit(limit);
  let sent = 0;
  for (const i of items ?? []) {
    const o = Array.isArray(i.opportunity) ? i.opportunity[0] : i.opportunity;
    if (!o) continue;
    // Résultat déjà demandé sur le site récemment : pas d'e-mail en plus
    if (i.result_asked_at && new Date(i.result_asked_at).getTime() > nowMs() - 14 * DAY) {
      await db.from("pipeline_items").update({ result_email_at: new Date().toISOString() }).eq("id", i.id);
      continue;
    }
    const { data: admins } = await db.from("company_members").select("user_id").eq("company_id", i.company_id).eq("role", "COMPANY_ADMIN");
    for (const a of admins ?? []) {
      await db.rpc("notify_user", {
        p_user_id: a.user_id,
        p_type: "application_result",
        p_title: `Avez-vous eu le résultat ? ${o.title}`.slice(0, 200),
        p_body: `Vous avez répondu à « ${o.title} ». La date limite est passée depuis 3 semaines : avez-vous eu le résultat ? Indiquez-le en un clic. Si votre offre n'a pas été retenue, vous pouvez demander à l'acheteur les motifs du rejet pour progresser.`,
        p_link: `/dashboard/candidatures/${o.id}`,
        p_send_email: true,
      });
    }
    await db.from("pipeline_items").update({ result_email_at: new Date().toISOString() }).eq("id", i.id);
    sent++;
  }
  return { sent };
}
