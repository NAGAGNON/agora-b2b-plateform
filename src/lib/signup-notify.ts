import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportRecipients } from "@/lib/daily-report-email";
import { sendEmail } from "@/lib/email/send";
import { logServerError } from "@/lib/errors";
import { siteUrl } from "@/lib/seo";
import { professionalDomain, signupLookupLinks, type SignupLink } from "@/lib/signup-lookup";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Contenu de l'e-mail « nouvel inscrit » envoyé aux administrateurs (données enregistrées uniquement). */
export function renderSignupNotice(u: {
  name: string;
  email: string;
  origin: string | null;
  alertName: string | null;
  at: Date;
  jobTitle?: string | null;
  phone?: string | null;
  pages?: string[];
  company?: { name: string; detail: string | null } | null;
}) {
  const when = u.at.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" });
  const domain = professionalDomain(u.email);
  const rows: [string, string][] = [
    ["Nom", u.name || "(non renseigné)"],
    ["E-mail", `${u.email} (${domain ? "adresse professionnelle" : "messagerie personnelle"})`],
    ...(u.jobTitle ? [["Fonction", u.jobTitle] as [string, string]] : []),
    ...(u.phone ? [["Téléphone", u.phone] as [string, string]] : []),
    ...(u.company ? [["Entreprise", [u.company.name, u.company.detail].filter(Boolean).join(" — ")] as [string, string]] : []),
    ["Provenance", u.origin ?? "Inconnue (visite non mesurée)"],
    ...(u.pages?.length ? [["Pages vues avant", u.pages.join(" → ")] as [string, string]] : []),
    ...(u.company ? [] : [["Alerte créée", u.alertName ?? "Aucune (secteur inconnu à l'inscription)"] as [string, string]]),
    ["Date", when],
  ];
  const links: SignupLink[] = signupLookupLinks({ name: u.name, email: u.email, company: u.company?.name });
  const admin = `${siteUrl()}/admin`;
  const subject = u.company ? `Entreprise renseignée sur LinkProB2B : ${u.company.name} (${u.name || u.email})` : `Nouvel inscrit sur LinkProB2B : ${u.name || u.email}`;
  const text = [
    ...rows.map(([k, v]) => `${k} : ${v}`),
    "",
    ...(links.length ? ["Pour en savoir plus (liens de recherche, à vérifier) :", ...links.map((l) => `- ${l.label} : ${l.url}`), ""] : []),
    `Tableau de bord : ${admin}`,
  ].join("\n");
  const linksHtml = links.length
    ? `<p style="margin:20px 0 6px;font-size:13px;color:#64748b">Pour en savoir plus (liens de recherche : vérifiez qu'il s'agit bien de la bonne personne)</p><ul style="margin:0;padding-left:18px;font-size:14px;line-height:24px">${links.map((l) => `<li><a href="${esc(l.url)}" style="color:#0d9488;font-weight:600">${esc(l.label)}</a></li>`).join("")}</ul>`
    : "";
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#E8F4FD;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px">
<tr><td style="background:#0B1F3A;border-radius:12px 12px 0 0;padding:16px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><a href="${siteUrl()}" style="text-decoration:none"><img src="${siteUrl()}/brand/logo-white.png" width="160" height="32" alt="LinkProB2B" style="display:block;border:0;width:160px;height:32px;color:#ffffff;font-size:18px;font-weight:700"></a></td>
<td valign="middle" align="right" style="color:#99f6e4;font-size:14px;font-weight:600">${u.company ? "Entreprise renseignée" : "Nouvel inscrit"}</td>
</tr></table></td></tr>
<tr><td style="padding:20px 24px"><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:22px;color:#0f172a">
${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#64748b;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`).join("")}
</table>${linksHtml}<p style="margin:20px 0 0"><a href="${admin}" style="color:#0d9488;font-weight:600">Ouvrir le tableau de bord</a></p></td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}

/** Prévient les administrateurs (DAILY_REPORT_EMAIL, sinon super-administrateurs) d'une nouvelle inscription. Jamais bloquant. */
export async function notifyAdminsOfSignup(userId: string, alertName: string | null) {
  try {
    const ctx = await signupContext(userId);
    if (!ctx) return;
    const msg = renderSignupNotice({ ...ctx.info, alertName });
    for (const address of ctx.to) {
      const r = await sendEmail({ to: address, ...msg, idempotencyKey: `signup-notice-${userId}-${address}` });
      if (r.status === "FAILED") logServerError("signup notice", new Error(r.error ?? "échec d'envoi"));
    }
  } catch (e) {
    logServerError("signup notice", e);
  }
}

async function signupContext(userId: string) {
  const db = createAdminClient();
  const { data: u } = await db.from("users").select("email, full_name, is_demo, signup_visit, created_at, job_title, phone").eq("id", userId).maybeSingle();
  if (!u || u.is_demo) return null;
  const to = (await reportRecipients()).filter((a) => a !== u.email.toLowerCase());
  if (!to.length) return null;
  let origin: string | null = null;
  let pages: string[] = [];
  if (u.signup_visit) {
    origin = (await db.rpc("visit_origin", { p_session: u.signup_visit })).data ?? null;
    const { data: pv } = await db.from("page_views").select("path").eq("session_id", u.signup_visit).lte("created_at", u.created_at).order("created_at").limit(8);
    pages = [...new Set((pv ?? []).map((x) => x.path))].slice(0, 6);
  }
  return { to, info: { name: u.full_name, email: u.email, origin, at: new Date(u.created_at), jobTitle: u.job_title, phone: u.phone, pages } };
}

/** Second message quand l'inscrit renseigne son entreprise : nom, métier, ville, liens LinkedIn et annuaire. Jamais bloquant. */
export async function notifyAdminsOfCompany(userId: string, companyId: string) {
  try {
    const ctx = await signupContext(userId);
    if (!ctx) return;
    const { data: co } = await createAdminClient().from("companies").select("name, city, department_code, profile:company_profiles(sectors, skills)").eq("id", companyId).maybeSingle();
    if (!co) return;
    const profile = (Array.isArray(co.profile) ? co.profile[0] : co.profile) as { sectors?: string[]; skills?: string[] } | null;
    const detail = [profile?.sectors?.join(", "), profile?.skills?.length ? `compétences : ${profile.skills.join(", ")}` : null, co.city ?? (co.department_code ? `département ${co.department_code}` : null)].filter(Boolean).join(" — ") || null;
    const msg = renderSignupNotice({ ...ctx.info, alertName: null, company: { name: co.name, detail } });
    for (const address of ctx.to) {
      const r = await sendEmail({ to: address, ...msg, idempotencyKey: `company-notice-${companyId}-${address}` });
      if (r.status === "FAILED") logServerError("company notice", new Error(r.error ?? "échec d'envoi"));
    }
  } catch (e) {
    logServerError("company notice", e);
  }
}

/** Contenu de l'e-mail « intéressé par le tarif fondateur » envoyé aux administrateurs. */
export function renderFounderInterestNotice(u: { name: string; email: string; userId: string; company: string | null; wave: number; total: number; signedUpAt: Date; visitDays: number; at: Date }) {
  const fmt = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" });
  const rows: [string, string][] = [
    ["Nom", u.name || "(non renseigné)"],
    ["E-mail", u.email],
    ["Entreprise", u.company ?? "(pas encore d'entreprise)"],
    ["Vague", String(u.wave)],
    ["Inscrit le", fmt(u.signedUpAt)],
    ["Jours de visite", String(u.visitDays)],
    ["Date", fmt(u.at)],
  ];
  const activity = `${siteUrl()}/admin/activite/${u.userId}`;
  const subject = `Tarif fondateur : ${u.name || u.email} est intéressé (${u.total} au total)`;
  const text = [`${u.name || u.email} a rejoint la liste du tarif fondateur.`, "", ...rows.map(([k, v]) => `${k} : ${v}`), "", `Personnes sur la liste : ${u.total}`, `Ce qu'il a fait sur le site : ${activity}`].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#E8F4FD;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px">
<tr><td style="background:#0B1F3A;border-radius:12px 12px 0 0;padding:16px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><a href="${siteUrl()}" style="text-decoration:none"><img src="${siteUrl()}/brand/logo-white.png" width="160" height="32" alt="LinkProB2B" style="display:block;border:0;width:160px;height:32px;color:#ffffff;font-size:18px;font-weight:700"></a></td>
<td valign="middle" align="right" style="color:#99f6e4;font-size:14px;font-weight:600">Tarif fondateur</td>
</tr></table></td></tr>
<tr><td style="padding:20px 24px"><p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0B1F3A">${esc(u.name || u.email)} a rejoint la liste du tarif fondateur.</p><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:22px;color:#0f172a">
${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#64748b;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`).join("")}
</table><p style="margin:18px 0 0;font-size:14px;color:#0f172a">Personnes sur la liste : <strong>${u.total}</strong></p><p style="margin:12px 0 0"><a href="${activity}" style="color:#0d9488;font-weight:600">Voir ce qu'il a fait sur le site</a></p></td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}

/** Prévient les administrateurs quand un membre rejoint la liste du tarif fondateur. Jamais bloquant. */
export async function notifyAdminsOfFounderInterest(userId: string, wave: number) {
  try {
    const db = createAdminClient();
    const { data: u } = await db.from("users").select("email, full_name, is_demo, created_at").eq("id", userId).maybeSingle();
    if (!u || u.is_demo) return;
    const to = (await reportRecipients()).filter((a) => a !== u.email.toLowerCase());
    if (!to.length) return;
    const [{ data: m }, { count: total }, { count: days }] = await Promise.all([
      db.from("company_members").select("companies(name)").eq("user_id", userId).limit(1).maybeSingle(),
      db.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_name", "founder_interest"),
      db.from("user_visits").select("day", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    const company = (m?.companies as unknown as { name: string } | null)?.name ?? null;
    const msg = renderFounderInterestNotice({ name: u.full_name, email: u.email, userId, company, wave, total: total ?? 1, signedUpAt: new Date(u.created_at), visitDays: days ?? 0, at: new Date() });
    for (const address of to) {
      const r = await sendEmail({ to: address, ...msg, idempotencyKey: `founder-interest-${userId}-${address}` });
      if (r.status === "FAILED") logServerError("founder interest notice", new Error(r.error ?? "échec d'envoi"));
    }
  } catch (e) {
    logServerError("founder interest notice", e);
  }
}

/** Contenu de l'e-mail « besoin à relire » envoyé aux administrateurs quand la relecture automatique est indisponible. */
export function renderNeedToReviewNotice(n: { title: string; company: string | null; reason: string }) {
  const link = `${siteUrl()}/admin/moderation`;
  const subject = `Besoin à relire : ${n.title}`.slice(0, 140);
  const text = [
    "Un besoin attend votre relecture : la relecture automatique n'a pas pu le traiter.",
    "",
    `Besoin : ${n.title}`,
    `Entreprise : ${n.company ?? "(non renseignée)"}`,
    `Raison : ${n.reason}`,
    "",
    `Le relire et le publier : ${link}`,
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#E8F4FD;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px">
<tr><td style="background:#0B1F3A;border-radius:12px 12px 0 0;padding:16px 24px;color:#99f6e4;font-size:14px;font-weight:600">Besoin à relire</td></tr>
<tr><td style="padding:20px 24px"><p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0B1F3A">Un besoin attend votre relecture.</p>
<p style="margin:0 0 6px;font-size:14px;color:#0f172a"><strong>${esc(n.title)}</strong></p>
<p style="margin:0 0 6px;font-size:14px;color:#64748b">${esc(n.company ?? "(entreprise non renseignée)")}</p>
<p style="margin:0 0 16px;font-size:14px;color:#64748b">La relecture automatique n'a pas pu le traiter : ${esc(n.reason)}</p>
<p style="margin:0"><a href="${link}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Le relire et le publier</a></p></td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}

/** Prévient les administrateurs qu'un besoin doit être relu à la main (une seule fois par besoin). Jamais bloquant. */
export async function notifyAdminsOfNeedToReview(id: string, n: { title: string; company: string | null; reason: string }) {
  try {
    const to = await reportRecipients();
    const msg = renderNeedToReviewNotice(n);
    for (const address of to) {
      const r = await sendEmail({ to: address, ...msg, idempotencyKey: `need-to-review-${id}-${address}` });
      if (r.status === "FAILED") logServerError("need to review notice", new Error(r.error ?? "échec d'envoi"));
    }
  } catch (e) {
    logServerError("need to review notice", e);
  }
}
