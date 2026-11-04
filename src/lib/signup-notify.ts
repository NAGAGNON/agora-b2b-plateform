import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportRecipients } from "@/lib/daily-report-email";
import { sendEmail } from "@/lib/email/send";
import { logServerError } from "@/lib/errors";
import { siteUrl } from "@/lib/seo";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Contenu de l'e-mail « nouvel inscrit » envoyé aux administrateurs (données enregistrées uniquement). */
export function renderSignupNotice(u: { name: string; email: string; origin: string | null; alertName: string | null; at: Date }) {
  const when = u.at.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" });
  const rows: [string, string][] = [
    ["Nom", u.name || "(non renseigné)"],
    ["E-mail", u.email],
    ["Provenance", u.origin ?? "Inconnue (visite non mesurée)"],
    ["Alerte créée", u.alertName ?? "Aucune (secteur inconnu à l'inscription)"],
    ["Date", when],
  ];
  const admin = `${siteUrl()}/admin`;
  const subject = `Nouvel inscrit sur LinkProB2B : ${u.name || u.email}`;
  const text = [...rows.map(([k, v]) => `${k} : ${v}`), "", `Tableau de bord : ${admin}`].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#E8F4FD;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px">
<tr><td style="background:#0B1F3A;border-radius:12px 12px 0 0;padding:16px 24px;color:#ffffff;font-weight:700;font-size:17px">LinkPro<span style="color:#14B8A6">B2B</span> — nouvel inscrit</td></tr>
<tr><td style="padding:20px 24px"><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:22px;color:#0f172a">
${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#64748b;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`).join("")}
</table><p style="margin:20px 0 0"><a href="${admin}" style="color:#0d9488;font-weight:600">Ouvrir le tableau de bord</a></p></td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}

/** Prévient les administrateurs (DAILY_REPORT_EMAIL, sinon super-administrateurs) d'une nouvelle inscription. Jamais bloquant. */
export async function notifyAdminsOfSignup(userId: string, alertName: string | null) {
  try {
    const db = createAdminClient();
    const { data: u } = await db.from("users").select("email, full_name, is_demo, signup_visit, created_at").eq("id", userId).maybeSingle();
    if (!u || u.is_demo) return;
    const to = (await reportRecipients()).filter((a) => a !== u.email.toLowerCase());
    if (!to.length) return;
    const origin = u.signup_visit ? ((await db.rpc("visit_origin", { p_session: u.signup_visit })).data ?? null) : null;
    const msg = renderSignupNotice({ name: u.full_name, email: u.email, origin, alertName, at: new Date(u.created_at) });
    for (const address of to) {
      const r = await sendEmail({ to: address, ...msg, idempotencyKey: `signup-notice-${userId}-${address}` });
      if (r.status === "FAILED") logServerError("signup notice", new Error(r.error ?? "échec d'envoi"));
    }
  } catch (e) {
    logServerError("signup notice", e);
  }
}
