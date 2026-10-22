import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sectorLabel } from "@/lib/constants";

/**
 * Alertes par e-mail sans compte : un visiteur laisse seulement son adresse pour recevoir les
 * nouveaux marchés d'un métier et d'un département. Double confirmation (rien n'est envoyé avant
 * le clic sur le lien reçu), une sélection par semaine au plus, désinscription en un clic.
 * Les envois passent par la file d'e-mails du site (email_outbox), comme les autres e-mails.
 */

export const LEAD_CONSENT =
  "J'accepte de recevoir par e-mail les nouvelles opportunités correspondant à ces critères (une sélection par semaine au plus). Désinscription en un clic dans chaque e-mail.";
/** Intervalle minimal entre deux sélections envoyées à une même adresse. */
export const LEAD_DIGEST_INTERVAL_MS = 7 * 86_400_000;
const MAX_ITEMS = 10;

export type LeadCriteria = { sector: string | null; department: string | null; region: string | null };

export function leadCriteriaLabel(c: LeadCriteria, depName?: string | null, labels: Record<string, string> = {}) {
  const parts = [c.sector ? sectorLabel(c.sector, labels) : null, depName ? `${depName}${c.department ? ` (${c.department})` : ""}` : c.department ? `département ${c.department}` : c.region];
  return parts.filter(Boolean).join(" — ") || "toutes les opportunités";
}

/**
 * Inscription : nouvelle demande (ou nouvelle tentative après désinscription) → e-mail de
 * confirmation. Une adresse déjà confirmée pour ces critères n'est pas relancée.
 */
export async function subscribeLead(input: { email: string; criteria: LeadCriteria; opportunityId?: string | null; path?: string | null; criteriaLabel: string }) {
  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const { sector, department, region } = input.criteria;
  let q = db.from("alert_leads").select("id, status, token, confirmation_sent_at").eq("email", email);
  q = sector ? q.eq("sector_slug", sector) : q.is("sector_slug", null);
  q = department ? q.eq("department_code", department) : q.is("department_code", null);
  const { data: existing } = await q.maybeSingle();
  if (existing?.status === "CONFIRMED") return { state: "already" as const };
  // Pas plus d'une demande de confirmation toutes les 10 minutes pour la même adresse et les mêmes critères
  if (existing?.status === "PENDING" && existing.confirmation_sent_at && Date.now() - new Date(existing.confirmation_sent_at).getTime() < 10 * 60_000) {
    return { state: "pending" as const };
  }
  const row = {
    email,
    sector_slug: sector,
    department_code: department,
    region,
    source_opportunity_id: input.opportunityId ?? null,
    source_path: input.path ?? null,
    status: "PENDING",
    consent_text: LEAD_CONSENT,
    confirmation_sent_at: new Date().toISOString(),
    unsubscribed_at: null,
  };
  const { data: lead, error } = existing
    ? await db.from("alert_leads").update(row).eq("id", existing.id).select("id, token").single()
    : await db.from("alert_leads").insert(row).select("id, token").single();
  if (error || !lead) throw error ?? new Error("Inscription impossible");
  await db.from("email_outbox").insert({
    to_email: email,
    template: "lead_confirm",
    subject: "Confirmez votre alerte LinkProB2B",
    payload: {
      type: "lead_confirm",
      title: "Confirmez votre alerte",
      body: `Vous avez demandé à recevoir les nouveaux marchés « ${input.criteriaLabel} ». Confirmez votre adresse pour activer l'alerte. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail : aucun autre message ne vous sera envoyé.`,
      link: `/alertes/confirmer?jeton=${lead.token}`,
    },
  });
  return { state: "sent" as const };
}

export async function leadFromToken(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await createAdminClient().from("alert_leads").select("id, email, status, sector_slug, department_code, region, confirmed_at").eq("token", token).maybeSingle();
  return data;
}

export async function confirmLead(token: string) {
  const lead = await leadFromToken(token);
  if (!lead || lead.status === "UNSUBSCRIBED") return lead;
  if (lead.status === "PENDING") {
    await createAdminClient().from("alert_leads").update({ status: "CONFIRMED", confirmed_at: new Date().toISOString() }).eq("id", lead.id).eq("status", "PENDING");
  }
  return { ...lead, status: "CONFIRMED" };
}

export async function unsubscribeLead(token: string) {
  const lead = await leadFromToken(token);
  if (!lead) return null;
  await createAdminClient().from("alert_leads").update({ status: "UNSUBSCRIBED", unsubscribed_at: new Date().toISOString() }).eq("id", lead.id);
  return lead;
}

/**
 * Sélections hebdomadaires (tâche quotidienne) : pour chaque alerte confirmée dont le dernier
 * envoi date d'au moins 7 jours, les opportunités ouvertes publiées depuis, aux critères demandés.
 * Rien n'est envoyé s'il n'y a aucune nouveauté.
 */
export async function processLeadDigests({ now = Date.now(), limit = 300 } = {}) {
  const db = createAdminClient();
  const before = new Date(now - LEAD_DIGEST_INTERVAL_MS + 60_000).toISOString();
  const { data: leads } = await db
    .from("alert_leads")
    .select("id, email, token, sector_slug, department_code, region, confirmed_at, last_sent_at, emails_sent")
    .eq("status", "CONFIRMED")
    .or(`last_sent_at.is.null,last_sent_at.lt.${before}`)
    .order("last_sent_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  const { data: deps } = await db.from("departments").select("code, name");
  const depName = new Map((deps ?? []).map((d) => [d.code, d.name]));
  const { data: sectors } = await db.from("sectors").select("slug, label");
  const labels = Object.fromEntries((sectors ?? []).map((s) => [s.slug, s.label]));
  let emails = 0;
  for (const l of leads ?? []) {
    // Premier envoi : opportunités des 7 derniers jours (la personne vient de s'inscrire)
    const since = l.last_sent_at ?? new Date(Math.min(now, new Date(l.confirmed_at ?? now).getTime()) - LEAD_DIGEST_INTERVAL_MS).toISOString();
    if (!l.last_sent_at && l.confirmed_at && now - new Date(l.confirmed_at).getTime() < 86_400_000) continue; // laisser au moins un jour après la confirmation
    let q = db
      .from("opportunities")
      .select("id, title, city, department_code, response_deadline")
      .eq("status", "PUBLISHED")
      .eq("visibility", "PUBLIC")
      .eq("is_demo", false)
      .gt("published_at", since)
      .or(`response_deadline.is.null,response_deadline.gt.${new Date(now).toISOString()}`)
      .order("published_at", { ascending: false })
      .limit(MAX_ITEMS);
    if (l.sector_slug) q = q.eq("sector_slug", l.sector_slug);
    if (l.department_code) q = q.eq("department_code", l.department_code);
    else if (l.region) q = q.eq("region", l.region);
    const { data: opps } = await q;
    const sentAt = new Date(now).toISOString();
    if (!opps?.length) {
      // Rien de neuf : on réessaiera au prochain intervalle (pas d'e-mail vide)
      await db.from("alert_leads").update({ last_sent_at: sentAt }).eq("id", l.id);
      continue;
    }
    const label = leadCriteriaLabel({ sector: l.sector_slug, department: l.department_code, region: l.region }, l.department_code ? depName.get(l.department_code) : null, labels);
    await db.from("email_outbox").insert({
      to_email: l.email,
      template: "lead_digest",
      subject: `${opps.length} nouveau${opps.length > 1 ? "x" : ""} marché${opps.length > 1 ? "s" : ""} — ${label}`,
      payload: {
        type: "lead_digest",
        title: `Vos nouveaux marchés : ${label}`,
        body: `${opps.length} opportunité(s) publiée(s) depuis votre dernier e-mail. Créez votre compte gratuit pour suivre vos affaires, recevoir des alertes sur mesure et contacter les entreprises.`,
        items: opps.map((o) => ({ label: `${o.title}${o.city ? ` — ${o.city}` : ""}`, url: `/opportunites/${o.id}` })),
        link: `/inscription?email=${encodeURIComponent(l.email)}`,
        unsubscribe: `/alertes/arreter?jeton=${l.token}`,
      },
    });
    await db.from("alert_leads").update({ last_sent_at: sentAt, emails_sent: (l.emails_sent ?? 0) + 1 }).eq("id", l.id);
    emails++;
  }
  return { leads: leads?.length ?? 0, emails };
}
