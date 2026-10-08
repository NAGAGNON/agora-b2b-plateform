"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError, userMessage } from "@/lib/errors";
import { parseForm, type ActionResult } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { buildDailyCampaign, enrichCampaignAndSend, enrichmentReport, processSendQueue, runManualCampaign, syncOpportunityStates } from "@/lib/outreach/pipeline";
import { loadReferentials, loadSettings, realSendBlockers } from "@/lib/outreach/data";
import { mapProspectRows, parseCsv } from "@/lib/outreach/csv";
import { configuredSearchers, enrichCompany } from "@/lib/outreach/enrich";

/** Réservé aux administrateurs de la plateforme (contrôle répété en base par la RLS). */
async function admin() {
  const session = await getSession();
  if (!session?.isAdmin) throw new Error("Accès refusé");
  return { session, supabase: await createClient() };
}

async function audit(userId: string, action: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await createAdminClient().from("audit_logs").insert({ actor_user_id: userId, action, entity_type: "outreach", entity_id: entityId, metadata: metadata as never });
}

const done = (message: string): ActionResult => {
  revalidatePath("/outreach", "layout");
  return { ok: true, message };
};

// ---------------------------------------------------------------- Paramètres
const bool = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const settingsSchema = z.object({
  min_score: z.coerce.number().int().min(0).max(100),
  max_opportunities_per_email: z.coerce.number().int().min(1).max(20),
  min_days_between_contacts: z.coerce.number().int().min(0).max(365),
  max_contacts_per_30_days: z.coerce.number().int().min(1).max(30),
  daily_send_cap: z.coerce.number().int().min(0).max(10000),
  total_daily_send_cap: z.coerce.number().int().min(0).max(10000),
  hourly_send_cap: z.coerce.number().int().min(0).max(2000),
  send_interval_seconds: z.coerce.number().int().min(0).max(300),
  max_send_attempts: z.coerce.number().int().min(1).max(10),
  min_days_before_deadline: z.coerce.number().int().min(0).max(60),
  lookback_days: z.coerce.number().int().min(1).max(30),
  max_prospects_per_opportunity: z.coerce.number().int().min(1).max(5000),
  dry_run: bool,
  require_validation: bool,
  discovery_enabled: bool,
  include_individual_entrepreneurs: bool,
  enrichment_enabled: bool,
  enrichment_daily_limit: z.coerce.number().int().min(0).max(50000),
  sender_name: z.string().trim().min(2).max(120),
  reply_to: z.union([z.literal(""), z.email({ error: "Adresse de réponse invalide" })]),
  subject_template: z.string().trim().min(5).max(200),
  intro_template: z.string().trim().min(20).max(1000),
});

export async function saveOutreachSettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(settingsSchema, fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await admin();
  const { reply_to, ...rest } = parsed.data;
  const { error } = await supabase
    .from("outreach_settings")
    .update({ ...rest, reply_to: reply_to || null, updated_at: new Date().toISOString(), updated_by: session.userId })
    .eq("id", true);
  if (error) return { ok: false, error: userMessage(error) };
  await audit(session.userId, "outreach.settings", "settings", { min_score: rest.min_score, dry_run: rest.dry_run });
  return done("Paramètres enregistrés.");
}

// ---------------------------------------------------------------- Exécution manuelle
export async function runOutreachNow(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { session } = await admin();
  const force = fd.get("force") === "1";
  try {
    const db = createAdminClient();
    const settings = await loadSettings(db);
    const sync = await syncOpportunityStates(db, settings);
    const r = await buildDailyCampaign(db, { force, deadline: Date.now() + 200_000 });
    await audit(session.userId, "outreach.run", r.campaignId ?? "none", { force, ...sync });
    if (r.skipped) return done(`${r.skipped}. Synchronisation : ${sync.new} nouvelle(s), ${sync.modified} modifiée(s), ${sync.expired} expirée(s).`);
    return done(`Campagne préparée : ${r.stats?.emails_prepared ?? 0} e-mail(s), ${r.stats?.no_email ?? 0} entreprise(s) sans adresse.`);
  } catch (e) {
    logServerError("outreach run", e);
    return { ok: false, error: `La préparation a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` };
  }
}

/**
 * « Lancer une campagne maintenant » : campagne manuelle complète (entreprises → adresses → envoi),
 * autant de fois que voulu dans la journée. La campagne automatique n'est pas modifiée.
 */
export async function launchManualCampaign(): Promise<ActionResult> {
  const { session } = await admin();
  try {
    const r = await runManualCampaign(createAdminClient(), { userId: session.userId });
    await audit(session.userId, "outreach.manual_run", r.build.campaignId ?? "none", { ...(r.build.stats ?? {}), sent: r.send?.sent ?? 0 });
    revalidatePath("/outreach");
    revalidatePath("/outreach/campagnes");
    const st = r.build.stats ?? {};
    const parts = [
      `Campagne manuelle lancée : ${st.companies_selected ?? 0} entreprise(s) sélectionnée(s)`,
      r.enrichment ? `${r.enrichment.found} adresse(s) trouvée(s)` : null,
      r.send ? `${r.send.sent} e-mail(s) envoyé(s)${r.send.simulated ? `, ${r.send.simulated} simulé(s)` : ""}` : "en attente de votre validation (Paramètres)",
      st.excluded_frequency ? `${st.excluded_frequency} entreprise(s) déjà contactée(s) récemment, non relancée(s)` : null,
    ].filter(Boolean);
    return done(`${parts.join(" · ")}.`);
  } catch (e) {
    logServerError("outreach manual run", e);
    return { ok: false, error: `Le lancement a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` };
  }
}

/** « Tester la connexion SMTP » (Paramètres) : connexion et authentification, sans envoyer d'e-mail. */
export async function testSmtpConnection(): Promise<ActionResult> {
  await admin();
  if (!(await rateLimit("smtp-test", 10, 3600))) return { ok: false, error: "10 tests par heure au maximum." };
  const { verifySmtp } = await import("@/lib/email/smtp");
  const r = await verifySmtp();
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
}

// ---------------------------------------------------------------- Campagnes
const campaignSchema = z.object({ campaignId: z.uuid() });

export async function validateCampaign(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(campaignSchema.extend({ mode: z.enum(["simulation", "real"]) }), fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await admin();
  const db = createAdminClient();
  const settings = await loadSettings(db);
  const real = parsed.data.mode === "real";
  if (real) {
    const blockers = realSendBlockers(settings);
    if (blockers.length) return { ok: false, error: `Envoi réel impossible : ${blockers.join(" ")}` };
  }
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .update({ status: "VALIDATED", dry_run: !real, validated_at: new Date().toISOString(), validated_by: session.userId })
    .eq("id", parsed.data.campaignId)
    .eq("status", "READY")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: userMessage(error) };
  if (!data) return { ok: false, error: "Cette campagne n'est plus en prévisualisation." };
  await audit(session.userId, real ? "outreach.validate" : "outreach.simulate", parsed.data.campaignId);
  const r = await processSendQueue(db, { deadline: Date.now() + 45_000 });
  return done(
    real
      ? `Campagne validée : ${r.sent} e-mail(s) envoyé(s)${r.failed ? `, ${r.failed} échec(s)` : ""}. La suite partira selon la limite quotidienne.`
      : `Simulation terminée : ${r.simulated} e-mail(s) simulé(s) — aucun envoi réel.`,
  );
}

export async function cancelCampaign(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(campaignSchema, fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await admin();
  const { error } = await supabase.from("outreach_campaigns").update({ status: "CANCELLED" }).eq("id", parsed.data.campaignId).in("status", ["READY", "VALIDATED", "SENDING"]);
  if (error) return { ok: false, error: userMessage(error) };
  await supabase.from("outreach_recipients").update({ status: "EXCLUDED", error: "Campagne annulée" }).eq("campaign_id", parsed.data.campaignId).in("status", ["PENDING", "QUEUED"]);
  await audit(session.userId, "outreach.cancel", parsed.data.campaignId);
  return done("Campagne annulée : plus aucun e-mail ne partira.");
}

const templatesSchema = campaignSchema.extend({ subject_template: z.string().trim().min(5).max(200), intro_template: z.string().trim().min(20).max(1000) });

export async function saveCampaignTemplates(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(templatesSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await admin();
  const { error } = await supabase
    .from("outreach_campaigns")
    .update({ subject_template: parsed.data.subject_template, intro_template: parsed.data.intro_template })
    .eq("id", parsed.data.campaignId)
    .eq("status", "READY");
  if (error) return { ok: false, error: userMessage(error) };
  return done("Modèle de l'e-mail mis à jour pour cette campagne.");
}

/** Exclut (ou réintègre) une entreprise de la campagne. */
export async function toggleRecipient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ recipientId: z.uuid(), exclude: bool }), fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await admin();
  const { data: r } = await supabase.from("outreach_recipients").select("status, email, campaign:outreach_campaigns(status)").eq("id", parsed.data.recipientId).maybeSingle();
  const cStatus = (r?.campaign as unknown as { status: string } | null)?.status;
  if (!r || cStatus !== "READY") return { ok: false, error: "Modification possible uniquement pendant la prévisualisation." };
  const status = parsed.data.exclude ? "EXCLUDED" : r.email ? "PENDING" : "NO_EMAIL";
  if (!parsed.data.exclude && r.status !== "EXCLUDED") return { ok: true, message: "Inchangé." };
  const { error } = await supabase.from("outreach_recipients").update({ status, error: parsed.data.exclude ? "Exclue manuellement" : null }).eq("id", parsed.data.recipientId);
  if (error) return { ok: false, error: userMessage(error) };
  return done(parsed.data.exclude ? "Entreprise exclue de la campagne." : "Entreprise réintégrée.");
}

/** Retire (ou remet) une opportunité : pour un destinataire, ou pour toute la campagne. */
export async function toggleOpportunity(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ opportunityId: z.uuid(), recipientId: z.uuid().optional(), campaignId: z.uuid().optional(), exclude: bool }), fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await admin();
  let ids: string[] = [];
  if (parsed.data.recipientId) ids = [parsed.data.recipientId];
  else if (parsed.data.campaignId) {
    const { data } = await supabase.from("outreach_recipients").select("id").eq("campaign_id", parsed.data.campaignId).limit(10000);
    ids = (data ?? []).map((r) => r.id);
  }
  if (!ids.length) return { ok: false, error: "Aucun destinataire concerné." };
  for (let i = 0; i < ids.length; i += 300) {
    const { error } = await supabase.from("outreach_recipient_opportunities").update({ excluded: parsed.data.exclude }).in("recipient_id", ids.slice(i, i + 300)).eq("opportunity_id", parsed.data.opportunityId);
    if (error) return { ok: false, error: userMessage(error) };
  }
  return done(parsed.data.exclude ? "Opportunité retirée de la sélection." : "Opportunité remise dans la sélection.");
}

const recipientTextSchema = z.object({ recipientId: z.uuid(), subject: z.string().trim().max(200), intro: z.string().trim().max(1000) });

export async function saveRecipientText(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(recipientTextSchema, fd);
  if (!parsed.success) return parsed.result;
  const { supabase } = await admin();
  const { error } = await supabase
    .from("outreach_recipients")
    .update({ subject: parsed.data.subject || null, intro: parsed.data.intro || null })
    .eq("id", parsed.data.recipientId)
    .in("status", ["PENDING", "NO_EMAIL", "EXCLUDED"]);
  if (error) return { ok: false, error: userMessage(error) };
  return done("E-mail personnalisé enregistré.");
}

// ---------------------------------------------------------------- Prospects
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const prospectSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Nom requis").max(200),
  email: z.union([z.literal(""), z.email({ error: "Adresse e-mail invalide" })]).optional(),
  email_source: optional(300),
  siren: z.union([z.literal(""), z.string().regex(/^\d{9}$/, "SIREN : 9 chiffres")]).optional(),
  naf_code: z.union([z.literal(""), z.string().regex(/^\d{2}\.\d{2}[A-Z]$/, "Code NAF au format 43.21A")]).optional(),
  activity: optional(2000),
  services: optional(500),
  sectors: z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.string())),
  city: optional(120),
  department_code: optional(3),
  intervention_zone: z.enum(["LOCAL", "REGIONAL", "NATIONAL"]),
  website: optional(300),
  contact_name: optional(120),
  source: z.string().trim().min(3, "Indiquez l'origine des données").max(300),
});

export async function saveProspect(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(prospectSchema, fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await admin();
  const d = parsed.data;
  if (d.email && !d.email_source) return { ok: false, error: "Indiquez d'où provient l'adresse e-mail (traçabilité).", fieldErrors: { email_source: "Origine de l'adresse requise" } };
  const ref = await loadReferentials(createAdminClient());
  const row = {
    name: d.name,
    email: d.email ? d.email.toLowerCase() : null,
    email_source: d.email ? d.email_source : null,
    siren: d.siren || null,
    naf_code: d.naf_code || null,
    activity: d.activity,
    services: d.services ? d.services.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
    sectors: (d.sectors ?? []).filter((s) => ref.sectorSlugs.includes(s)),
    city: d.city,
    department_code: d.department_code,
    region: ref.department(d.department_code)?.region ?? null,
    intervention_zone: d.intervention_zone,
    website: d.website,
    contact_name: d.contact_name,
    source: d.source,
    updated_at: new Date().toISOString(),
  };
  const { error } = d.id ? await supabase.from("outreach_prospects").update(row).eq("id", d.id) : await supabase.from("outreach_prospects").insert(row);
  if (error) return { ok: false, error: error.code === "23505" ? "Une entreprise avec ce SIREN ou cette adresse existe déjà." : userMessage(error) };
  await audit(session.userId, d.id ? "outreach.prospect.update" : "outreach.prospect.create", d.id ?? d.name);
  return done(d.id ? "Entreprise mise à jour." : "Entreprise ajoutée.");
}

export async function setProspectStatus(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: z.uuid(), status: z.enum(["ACTIVE", "EXCLUDED", "DO_NOT_CONTACT"]), reason: optional(300) }), fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await admin();
  const { data: p, error } = await supabase
    .from("outreach_prospects")
    .update({ status: parsed.data.status, excluded_reason: parsed.data.status === "ACTIVE" ? null : (parsed.data.reason ?? "Exclusion manuelle"), updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("email, siren")
    .single();
  if (error) return { ok: false, error: userMessage(error) };
  if (parsed.data.status === "DO_NOT_CONTACT") {
    const rows = [p.email ? { kind: "EMAIL", value: p.email.toLowerCase() } : null, p.siren ? { kind: "SIREN", value: p.siren } : null].filter((r): r is { kind: string; value: string } => r !== null);
    if (rows.length) await supabase.from("outreach_suppressions").upsert(rows.map((r) => ({ ...r, reason: "MANUAL", created_by: session.userId })), { onConflict: "kind,value", ignoreDuplicates: true });
    await supabase.from("outreach_recipients").update({ status: "SUPPRESSED" }).eq("prospect_id", parsed.data.id).in("status", ["PENDING", "QUEUED"]);
  }
  await audit(session.userId, "outreach.prospect.status", parsed.data.id, { status: parsed.data.status });
  return done(parsed.data.status === "ACTIVE" ? "Entreprise réactivée." : parsed.data.status === "DO_NOT_CONTACT" ? "Ajoutée à la liste « Ne plus contacter »." : "Entreprise exclue.");
}

export async function importProspects(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { session, supabase } = await admin();
  const file = fd.get("file");
  const source = String(fd.get("source") ?? "").trim();
  if (source.length < 3) return { ok: false, error: "Indiquez l'origine du fichier (ex. « Fichier acheté à … le … », « Salon … »).", fieldErrors: { source: "Origine requise" } };
  if (fd.get("attest") !== "on") return { ok: false, error: "Confirmez que les données ont été obtenues légalement et peuvent être utilisées pour de la prospection B2B." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez un fichier CSV." };
  if (file.size > 3.5 * 1024 * 1024) return { ok: false, error: "Fichier trop volumineux (3,5 Mo maximum) : découpez-le en plusieurs fichiers." };
  const ref = await loadReferentials(createAdminClient());
  const { items, errors } = mapProspectRows(parseCsv(await file.text()), ref.sectorSlugs);
  if (items.length === 0) return { ok: false, error: errors.slice(0, 5).join(" ") || "Aucune ligne valide." };
  let created = 0;
  let updated = 0;
  for (let i = 0; i < items.length; i += 200) {
    const part = items.slice(i, i + 200);
    const sirens = part.map((p) => p.siren).filter((s): s is string => Boolean(s));
    const emails = part.map((p) => p.email).filter((s): s is string => Boolean(s));
    const [{ data: bySiren }, { data: byEmail }] = await Promise.all([
      sirens.length ? supabase.from("outreach_prospects").select("id, siren").in("siren", sirens) : Promise.resolve({ data: [] as { id: string; siren: string | null }[] }),
      emails.length ? supabase.from("outreach_prospects").select("id, email").in("email", emails) : Promise.resolve({ data: [] as { id: string; email: string | null }[] }),
    ]);
    for (const p of part) {
      const existing = (p.siren && bySiren?.find((x) => x.siren === p.siren)) || (p.email && byEmail?.find((x) => x.email === p.email)) || null;
      const row = {
        ...p,
        region: p.region ?? ref.department(p.department_code)?.region ?? null,
        email_source: p.email ? (p.email_source ?? source) : null,
        source,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        // Mise à jour sans effacer les informations déjà connues
        const patch = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)));
        const { error } = await supabase.from("outreach_prospects").update(patch as typeof row).eq("id", existing.id);
        if (error) errors.push(`${p.name} : ${userMessage(error)}`);
        else updated++;
      } else {
        const { error } = await supabase.from("outreach_prospects").insert(row);
        if (error) errors.push(`${p.name} : ${error.code === "23505" ? "doublon" : userMessage(error)}`);
        else created++;
      }
    }
  }
  await audit(session.userId, "outreach.import", source, { created, updated, errors: errors.length });
  revalidatePath("/outreach", "layout");
  return { ok: true, message: `${created} entreprise(s) ajoutée(s), ${updated} mise(s) à jour${errors.length ? `, ${errors.length} ligne(s) ignorée(s) : ${errors.slice(0, 3).join(" ; ")}` : ""}.` };
}

/** Recherche immédiate des adresses des entreprises sans e-mail d'une campagne, puis envoi. */
export async function enrichCampaignNow(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(campaignSchema, fd);
  if (!parsed.success) return parsed.result;
  const { session } = await admin();
  if (configuredSearchers().length === 0) return { ok: false, error: "Recherche d'adresses désactivée sur le serveur." };
  try {
    const r = await enrichCampaignAndSend(createAdminClient(), { campaignId: parsed.data.campaignId, deadline: Date.now() + 240_000 });
    await audit(session.userId, "outreach.enrich.campaign", parsed.data.campaignId, r.enrichment);
    return done(`${enrichmentReport(r.enrichment)}${r.send.sent ? ` ${r.send.sent} e-mail(s) envoyé(s).` : ""}`);
  } catch (e) {
    logServerError("outreach enrich campaign", e);
    return { ok: false, error: `La recherche a échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` };
  }
}

/** Recherche immédiate de l'adresse générique d'une entreprise (site officiel → page Contact). */
export async function enrichProspectNow(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: z.uuid() }), fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await admin();
  const searchers = configuredSearchers();
  const { data: p } = await supabase.from("outreach_prospects").select("id, name, city, siren, website, email, status").eq("id", parsed.data.id).single();
  if (!p) return { ok: false, error: "Entreprise introuvable." };
  if (p.status !== "ACTIVE") return { ok: false, error: "Cette entreprise n'est pas active (exclue ou « Ne plus contacter »)." };
  if (!p.website && searchers.length === 0) return { ok: false, error: "Recherche d'adresses désactivée sur le serveur : renseignez le site internet de l'entreprise." };
  const r = await enrichCompany(p, searchers);
  const now = new Date().toISOString();
  const { data: blocked } = r.email ? await supabase.from("outreach_suppressions").select("id").in("value", [r.email, r.email.split("@")[1]]).limit(1) : { data: [] };
  const email = r.email && !(blocked ?? []).length ? r.email : null;
  const { error } = await supabase
    .from("outreach_prospects")
    .update({ enrichment_status: email ? "FOUND" : r.status === "FOUND" ? "NO_EMAIL" : r.status, enriched_at: now, enrichment_note: r.note || null, website: r.website ?? p.website, ...(email && !p.email ? { email, email_source: r.source } : {}), updated_at: now })
    .eq("id", p.id);
  if (error) return { ok: false, error: error.code === "23505" ? "Cette adresse est déjà utilisée par une autre entreprise." : userMessage(error) };
  await audit(session.userId, "outreach.prospect.enrich", p.id, { status: r.status });
  revalidatePath("/outreach", "layout");
  if (email) return { ok: true, message: `Adresse trouvée : ${email}` };
  return { ok: true, message: r.note || "Aucune adresse générique trouvée." };
}

// ---------------------------------------------------------------- Liste d'exclusion
export async function addSuppression(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ value: z.string().trim().min(3).max(200), note: optional(300) }), fd);
  if (!parsed.success) return parsed.result;
  const v = parsed.data.value.toLowerCase().replace(/\s/g, "");
  const kind = /^\d{9}$/.test(v) ? "SIREN" : v.includes("@") ? "EMAIL" : /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v) ? "DOMAIN" : null;
  if (!kind) return { ok: false, error: "Saisissez une adresse e-mail, un nom de domaine (ex. entreprise.fr) ou un SIREN (9 chiffres)." };
  const { session, supabase } = await admin();
  const { error } = await supabase.from("outreach_suppressions").upsert({ kind, value: v, reason: "MANUAL", note: parsed.data.note, created_by: session.userId }, { onConflict: "kind,value" });
  if (error) return { ok: false, error: userMessage(error) };
  await audit(session.userId, "outreach.suppression.add", v);
  return done("Ajouté à la liste « Ne plus contacter ».");
}

export async function removeSuppression(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: z.uuid() }), fd);
  if (!parsed.success) return parsed.result;
  const { session, supabase } = await admin();
  const { data } = await supabase.from("outreach_suppressions").select("reason, value").eq("id", parsed.data.id).maybeSingle();
  if (data?.reason === "UNSUBSCRIBE") return { ok: false, error: "Une désinscription demandée par le destinataire ne peut pas être retirée." };
  const { error } = await supabase.from("outreach_suppressions").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: userMessage(error) };
  await audit(session.userId, "outreach.suppression.remove", data?.value ?? parsed.data.id);
  return done("Retiré de la liste d'exclusion.");
}
