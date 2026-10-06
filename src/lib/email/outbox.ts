import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { renderEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";

/** Traite la file d'attente des e-mails (appelé par la tâche planifiée). */
export async function processEmailOutbox(limit = 50): Promise<{ sent: number; skipped: number; failed: number }> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("email_outbox")
    .select("*")
    .eq("status", "PENDING")
    .lt("attempts", 5)
    .order("created_at")
    .limit(limit);
  const stats = { sent: 0, skipped: 0, failed: 0 };
  for (const row of rows ?? []) {
    const payload = (row.payload ?? {}) as { title?: string; body?: string; link?: string; items?: { label: string; url: string }[]; unsubscribe?: string };
    const { html, text } = renderEmail({
      title: payload.title ?? row.subject,
      paragraphs: payload.body ? [payload.body] : [],
      list: payload.items?.map((i) => ({ label: i.label, url: env.siteUrl + i.url })),
      cta: payload.link ? { label: "Voir sur LinkProB2B", url: env.siteUrl + payload.link } : undefined,
      footer: payload.unsubscribe
        ? `Vous recevez cet e-mail car vous avez créé une alerte. Se désabonner en un clic : ${env.siteUrl}${payload.unsubscribe}`
        : undefined,
    });
    const result = await sendEmail({ to: row.to_email, subject: row.subject, html, text });
    stats[result.status === "SENT" ? "sent" : result.status === "SKIPPED" ? "skipped" : "failed"]++;
    await admin
      .from("email_outbox")
      .update({
        status: result.status === "FAILED" && row.attempts + 1 < 5 ? "PENDING" : result.status,
        attempts: row.attempts + 1,
        last_error: result.error ?? null,
        sent_at: result.status === "SENT" ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
  }
  return stats;
}

/** Résumés quotidiens / hebdomadaires des alertes. */
export async function processAlertDigests(): Promise<{ alerts: number; emails: number }> {
  const admin = createAdminClient();
  const now = Date.now();
  const { data: alerts } = await admin
    .from("alerts")
    .select("id, name, frequency, last_sent_at, created_at, unsubscribe_token, user_id, users!inner(email, status, notify_email)")
    .eq("is_active", true)
    .in("frequency", ["DAILY", "WEEKLY"]);
  let emails = 0;
  for (const a of alerts ?? []) {
    const periodMs = a.frequency === "DAILY" ? 86_400_000 : 7 * 86_400_000;
    const since = a.last_sent_at ?? a.created_at;
    if (now - new Date(since).getTime() < periodMs - 60_000) continue;
    const user = a.users as unknown as { email: string; status: string; notify_email: boolean };
    const { data: matches } = await admin.rpc("alert_digest_matches", { p_alert_id: a.id, p_since: since });
    await admin.from("alerts").update({ last_sent_at: new Date().toISOString() }).eq("id", a.id);
    if (!matches?.length || user.status !== "ACTIVE") continue;
    await admin.from("notifications").insert({
      user_id: a.user_id,
      type: "alert_digest",
      title: `Alerte « ${a.name} » : ${matches.length} nouvelle(s) opportunité(s)`,
      link: "/dashboard/alertes",
    });
    await admin.from("email_outbox").insert({
      user_id: a.user_id,
      to_email: user.email,
      template: "alert_digest",
      subject: `${matches.length} nouvelle(s) opportunité(s) pour votre alerte « ${a.name} »`,
      payload: {
        title: `Votre alerte « ${a.name} »`,
        body: `${matches.length} opportunité(s) correspondent à vos critères depuis le dernier envoi.`,
        items: matches.map((m) => ({ label: m.title, url: `/opportunites/${m.id}` })),
        unsubscribe: `/alertes/desabonnement?jeton=${a.unsubscribe_token}`,
      },
    });
    emails++;
  }
  return { alerts: alerts?.length ?? 0, emails };
}
