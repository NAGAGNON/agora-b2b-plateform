"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { APPLICATION_GUIDE } from "@/lib/application-guide";
import { ChecksSchema, RESULT_LABEL, ResultSchema, SubmissionSchema, readJourney, type Journey, type Submission } from "@/lib/journey";
import type { Database } from "@/lib/database.types";

type Stage = Database["public"]["Enums"]["pipeline_stage"];
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const ORDER: Stage[] = ["DETECTED", "QUALIFIED", "INTERESTED", "RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"];
const rank = (s: Stage) => ORDER.indexOf(s);
const DAY = 86_400_000;
const nowMs = () => Date.now();
const todayParis = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

export type ApplicationPrompt =
  | { kind: "apply"; opportunityId: string; title: string; buyer: string | null; deadline: string | null }
  | { kind: "result"; opportunityId: string; title: string; buyer: string | null; deadline: string | null };

/**
 * Question à poser au retour sur le site : d'abord le résultat d'une réponse envoyée dont la date
 * limite est passée depuis plus de 3 semaines, sinon « cet appel d'offres vous intéresse ? » pour une annonce officielle
 * consultée (il y a plus de 10 minutes et moins de 14 jours). Une seule question à la fois.
 */
export async function nextApplicationPrompt(): Promise<ApplicationPrompt | null> {
  const session = await getSession();
  if (!session?.activeCompany) return null;
  const companyId = session.activeCompany.company.id;
  const db = await createClient();
  const now = nowMs();

  const { data: items } = await db
    .from("pipeline_items")
    .select("opportunity_id, stage, result_asked_at, opportunity:opportunities(id, title, external_buyer_name, response_deadline)")
    .eq("company_id", companyId);
  const tracked = new Map((items ?? []).map((i) => [i.opportunity_id, i]));
  for (const i of items ?? []) {
    const o = Array.isArray(i.opportunity) ? i.opportunity[0] : i.opportunity;
    if (i.stage !== "RESPONSE_SENT" || !o?.response_deadline) continue;
    const due = new Date(o.response_deadline).getTime() + 21 * DAY < now;
    const asked = i.result_asked_at && new Date(i.result_asked_at).getTime() > now - 14 * DAY;
    if (due && !asked) return { kind: "result", opportunityId: o.id, title: o.title, buyer: o.external_buyer_name, deadline: o.response_deadline };
  }

  const admin = createAdminClient();
  const { data: clicks } = await admin
    .from("analytics_events")
    .select("properties, created_at")
    .eq("event_name", "source_outbound_clicked")
    .eq("user_id", session.userId)
    .gte("created_at", new Date(now - 14 * DAY).toISOString())
    .lte("created_at", new Date(now - 10 * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  const ids = [...new Set((clicks ?? []).map((c) => (c.properties as { opportunity_id?: string } | null)?.opportunity_id).filter((x): x is string => Boolean(x && z.uuid().safeParse(x).success)))];
  if (!ids.length) return null;
  const { data: answers } = await db.from("application_prompts").select("opportunity_id, answer, updated_at").eq("user_id", session.userId).in("opportunity_id", ids);
  const answered = new Map((answers ?? []).map((a) => [a.opportunity_id, a]));
  for (const id of ids) {
    const a = answered.get(id);
    // « Plus tard » : reposée le lendemain ; toute autre réponse : plus jamais
    if (a && (a.answer !== "LATER" || new Date(a.updated_at).getTime() > now - DAY)) continue;
    // Déjà dans le suivi de l'entreprise (pipeline ou candidature) : rien à demander
    if (tracked.has(id)) continue;
    const { data: o } = await db.from("opportunities").select("id, title, external_buyer_name, response_deadline").eq("id", id).maybeSingle();
    if (!o) continue;
    return { kind: "apply", opportunityId: o.id, title: o.title, buyer: o.external_buyer_name, deadline: o.response_deadline };
  }
  return null;
}

type Db = Awaited<ReturnType<typeof createClient>>;
type JournalKind = "NOTE" | "START" | "STEP" | "SENT" | "WON" | "LOST";
/** Entrée du journal de suivi (jamais bloquant). */
async function logJournal(db: Db, companyId: string, opportunityId: string, userId: string, kind: JournalKind, body: string) {
  await db.from("application_journal").insert({ company_id: companyId, opportunity_id: opportunityId, user_id: userId, kind, body: body.slice(0, 2000) }).then(
    () => undefined,
    () => undefined,
  );
}

/** Première action concrète sur un dossier (étape, pièce, mémoire, note, dépôt) : le travail a réellement commencé. */
async function markWorkStarted(db: Db, companyId: string, opportunityId: string) {
  await db
    .from("pipeline_items")
    .update({ work_started_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("opportunity_id", opportunityId)
    .is("work_started_at", null)
    .then(
      () => undefined,
      () => undefined,
    );
}

/** Ajoute (ou fait avancer, jamais reculer) la candidature dans le suivi de l'entreprise. */
async function advance(opportunityId: string, stage: Stage, extra: { submitted_at?: string } = {}): Promise<Result> {
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const companyId = session.activeCompany.company.id;
  const db = await createClient();
  const { data: item } = await db.from("pipeline_items").select("id, stage").eq("company_id", companyId).eq("opportunity_id", opportunityId).maybeSingle();
  const { error } = item
    ? await db
        .from("pipeline_items")
        .update({ ...(rank(item.stage) < rank(stage) ? { stage } : {}), ...extra, updated_by: session.userId })
        .eq("id", item.id)
    : await db.from("pipeline_items").insert({ company_id: companyId, opportunity_id: opportunityId, stage, ...extra, updated_by: session.userId });
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  const moved = !item || rank(item.stage) < rank(stage);
  if (moved && stage === "RESPONSE_PREPARING") await logJournal(db, companyId, opportunityId, session.userId, "START", "Candidature commencée.");
  if (moved && stage === "RESPONSE_SENT") await logJournal(db, companyId, opportunityId, session.userId, "SENT", "Réponse déposée sur la plateforme de l'acheteur.");
  if (rank(stage) >= rank("RESPONSE_SENT")) await markWorkStarted(db, companyId, opportunityId);
  revalidatePath("/dashboard/candidatures");
  revalidatePath("/dashboard/pipeline");
  return { ok: true };
}

const Answer = z.enum(["INTERESTED", "SENT", "PREPARING", "NOT_FOR_ME", "LATER"]);

/** Réponse à « Cet appel d'offres vous intéresse ? » : suivi simple, guide pour gagner, pas pour moi ou plus tard. */
export async function answerApplicationPrompt(opportunityId: string, answer: string, reason?: string): Promise<Result> {
  const a = Answer.safeParse(answer);
  if (!z.uuid().safeParse(opportunityId).success || !a.success) return { ok: false, error: "Réponse invalide." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous." };
  if (!(await rateLimit("application-prompt", 60, 3600))) return { ok: false, error: "Trop de demandes. Réessayez plus tard." };
  const db = await createClient();
  const { error } = await db
    .from("application_prompts")
    .upsert({ user_id: session.userId, opportunity_id: opportunityId, answer: a.data, reason: reason?.trim().slice(0, 200) || null, updated_at: new Date().toISOString() }, { onConflict: "user_id,opportunity_id" });
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  if (a.data === "INTERESTED") return advance(opportunityId, "QUALIFIED");
  if (a.data === "SENT") return advance(opportunityId, "RESPONSE_SENT", { submitted_at: todayParis() });
  if (a.data === "PREPARING") return advance(opportunityId, "RESPONSE_PREPARING");
  return { ok: true };
}

/** Résultat d'une réponse envoyée : gagnée, perdue ou toujours en attente (reposée dans 2 semaines). */
export async function answerApplicationResult(opportunityId: string, result: "WON" | "LOST" | "WAITING"): Promise<Result> {
  if (!z.uuid().safeParse(opportunityId).success || !["WON", "LOST", "WAITING"].includes(result)) return { ok: false, error: "Réponse invalide." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Connectez-vous." };
  const db = await createClient();
  const { error } = await db
    .from("pipeline_items")
    .update({ ...(result === "WAITING" ? {} : { stage: result }), result_asked_at: new Date().toISOString(), updated_by: session.userId })
    .eq("company_id", session.activeCompany.company.id)
    .eq("opportunity_id", opportunityId);
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  if (result !== "WAITING")
    await logJournal(db, session.activeCompany.company.id, opportunityId, session.userId, result, result === "WON" ? "Marché remporté !" : "Offre non retenue.");
  revalidatePath("/dashboard/candidatures");
  revalidatePath("/dashboard/pipeline");
  return { ok: true };
}

const Reminder = z.object({
  date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  text: z.string().trim().max(200),
});

/**
 * Après le dépôt : « Me rappeler le … » (relancer l'acheteur, résultat attendu…). Le rappel est la
 * « prochaine action » du suivi : il apparaît dans « À faire maintenant » et dans les notifications le jour venu.
 * Date vide : rappel supprimé.
 */
export async function setApplicationReminder(opportunityId: string, date: string, text: string): Promise<Result> {
  const r = Reminder.safeParse({ date, text });
  if (!z.uuid().safeParse(opportunityId).success || !r.success) return { ok: false, error: "Date invalide." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Connectez-vous." };
  if (r.data.date && r.data.date < todayParis()) return { ok: false, error: "Choisissez une date à venir." };
  const db = await createClient();
  const companyId = session.activeCompany.company.id;
  const { data: item } = await db.from("pipeline_items").select("id").eq("company_id", companyId).eq("opportunity_id", opportunityId).maybeSingle();
  if (!item) return { ok: false, error: "Candidature introuvable." };
  const { error } = await db
    .from("pipeline_items")
    .update({ next_action: r.data.date ? r.data.text || "Faire le point sur ma candidature" : null, next_action_at: r.data.date || null, updated_by: session.userId })
    .eq("id", item.id);
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  if (r.data.date) {
    const day = new Date(`${r.data.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    await logJournal(db, companyId, opportunityId, session.userId, "NOTE", `Rappel prévu le ${day} : ${r.data.text || "faire le point sur ma candidature"}.`);
  }
  revalidatePath(`/dashboard/candidatures/${opportunityId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** « J'ai déposé ma réponse » depuis le suivi. */
export async function markApplicationSent(opportunityId: string): Promise<Result> {
  if (!z.uuid().safeParse(opportunityId).success) return { ok: false, error: "Offre introuvable." };
  return advance(opportunityId, "RESPONSE_SENT", { submitted_at: todayParis() });
}

/** Coche ou décoche une étape du guide de réponse (la candidature est créée au besoin). */
export async function toggleGuideStep(opportunityId: string, step: number, done: boolean): Promise<Result<{ done: number[] }>> {
  if (!z.uuid().safeParse(opportunityId).success || !Number.isInteger(step) || step < 0 || step >= APPLICATION_GUIDE.length) return { ok: false, error: "Étape inconnue." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const companyId = session.activeCompany.company.id;
  const db = await createClient();
  const { data: item } = await db.from("pipeline_items").select("id, guide_done, stage").eq("company_id", companyId).eq("opportunity_id", opportunityId).maybeSingle();
  const set = new Set((item?.guide_done ?? []).map(Number));
  if (done) set.add(step);
  else set.delete(step);
  const next = [...set].sort((a, b) => a - b);
  const { error } = item
    ? await db
        .from("pipeline_items")
        // Une étape cochée sur une offre « à l'étude » : la candidature passe en préparation
        .update({ guide_done: next, ...(done && rank(item.stage) < rank("RESPONSE_PREPARING") ? { stage: "RESPONSE_PREPARING" as Stage } : {}), updated_by: session.userId })
        .eq("id", item.id)
    : await db.from("pipeline_items").insert({ company_id: companyId, opportunity_id: opportunityId, stage: "RESPONSE_PREPARING", guide_done: next, updated_by: session.userId });
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  if (done && !(item?.guide_done ?? []).map(Number).includes(step)) await logJournal(db, companyId, opportunityId, session.userId, "STEP", `Étape faite : ${APPLICATION_GUIDE[step].title}.`);
  if (done) await markWorkStarted(db, companyId, opportunityId);
  revalidatePath("/dashboard/candidatures");
  return { ok: true, done: next };
}

/** « Oui, je la garde pour plus tard » (case à cocher) : enregistrée dans Mes candidatures ; décocher la retire. */
export async function keepForLater(opportunityId: string, value = true): Promise<Result> {
  if (!z.uuid().safeParse(opportunityId).success) return { ok: false, error: "Offre introuvable." };
  if (value) {
    const r = await advance(opportunityId, "INTERESTED");
    if (!r.ok) return r;
    const session = await getSession();
    if (session?.activeCompany) await logJournal(await createClient(), session.activeCompany.company.id, opportunityId, session.userId, "NOTE", "Offre gardée pour plus tard.");
    return r;
  }
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Connectez-vous." };
  const db = await createClient();
  // Décocher : l'offre n'est plus enregistrée (elle redevient une simple consultation)
  const { error } = await db
    .from("pipeline_items")
    .delete()
    .eq("company_id", session.activeCompany.company.id)
    .eq("opportunity_id", opportunityId)
    .eq("stage", "INTERESTED");
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  revalidatePath("/dashboard/candidatures");
  revalidatePath("/dashboard/pipeline");
  return { ok: true };
}

/** « Cette offre ne m'intéresse plus » : retirée de mes candidatures (et du pipeline), plus jamais proposée. */
export async function withdrawApplication(opportunityId: string): Promise<Result> {
  if (!z.uuid().safeParse(opportunityId).success) return { ok: false, error: "Offre introuvable." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Connectez-vous." };
  const db = await createClient();
  const { error } = await db.from("pipeline_items").delete().eq("company_id", session.activeCompany.company.id).eq("opportunity_id", opportunityId);
  if (error) return { ok: false, error: "Action impossible. Réessayez." };
  await db
    .from("application_prompts")
    .upsert({ user_id: session.userId, opportunity_id: opportunityId, answer: "NOT_FOR_ME", reason: "Retirée de mes candidatures", updated_at: new Date().toISOString() }, { onConflict: "user_id,opportunity_id" })
    .then(
      () => undefined,
      () => undefined,
    );
  revalidatePath("/dashboard/candidatures");
  revalidatePath("/dashboard/pipeline");
  return { ok: true };
}

/** « Oui, je prépare ma candidature » : la candidature passe en préparation. */
export async function startApplicationGuide(opportunityId: string): Promise<Result> {
  if (!z.uuid().safeParse(opportunityId).success) return { ok: false, error: "Offre introuvable." };
  return advance(opportunityId, "RESPONSE_PREPARING");
}

/** Coche ou décoche une pièce à fournir (liste tirée de l'avis officiel). */
export async function toggleDocStep(opportunityId: string, index: number, done: boolean): Promise<Result<{ done: number[] }>> {
  if (!z.uuid().safeParse(opportunityId).success || !Number.isInteger(index) || index < 0 || index > 39) return { ok: false, error: "Pièce inconnue." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const db = await createClient();
  const { data: item } = await db.from("pipeline_items").select("id, docs_done").eq("company_id", session.activeCompany.company.id).eq("opportunity_id", opportunityId).maybeSingle();
  const set = new Set((item?.docs_done ?? []).map(Number));
  if (done) set.add(index);
  else set.delete(index);
  const next = [...set].sort((a, b) => a - b);
  // Première pièce cochée sur une offre seulement consultée : la candidature commence
  const { error } = item
    ? await db.from("pipeline_items").update({ docs_done: next, updated_by: session.userId }).eq("id", item.id)
    : await db.from("pipeline_items").insert({ company_id: session.activeCompany.company.id, opportunity_id: opportunityId, stage: "RESPONSE_PREPARING", docs_done: next, updated_by: session.userId });
  if (!item) revalidatePath("/dashboard/candidatures");
  if (!error && done) await markWorkStarted(db, session.activeCompany.company.id, opportunityId);
  return error ? { ok: false, error: "Enregistrement impossible. Réessayez." } : { ok: true, done: next };
}

/** Enregistre le brouillon du mémoire technique (privé à l'entreprise). */
export async function saveDraft(opportunityId: string, draft: string): Promise<Result> {
  if (!z.uuid().safeParse(opportunityId).success || typeof draft !== "string" || draft.length > 40000) return { ok: false, error: "Brouillon trop long." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const db = await createClient();
  const cid = session.activeCompany.company.id;
  const { data: item } = await db.from("pipeline_items").select("id").eq("company_id", cid).eq("opportunity_id", opportunityId).maybeSingle();
  // Mémoire commencé sur une offre seulement consultée : la candidature commence
  const { error } = item
    ? await db.from("pipeline_items").update({ draft, updated_by: session.userId }).eq("id", item.id)
    : await db.from("pipeline_items").insert({ company_id: cid, opportunity_id: opportunityId, stage: "RESPONSE_PREPARING", draft, updated_by: session.userId });
  if (!item) revalidatePath("/dashboard/candidatures");
  if (!error && draft.trim()) await markWorkStarted(db, cid, opportunityId);
  return error ? { ok: false, error: "Enregistrement impossible. Réessayez." } : { ok: true };
}

export type JournalEntry = { id: string; kind: string; body: string; created_at: string; author: string | null; mine: boolean };

/** Ajoute une note au journal de suivi de la candidature. */
export async function addJournalNote(opportunityId: string, body: string): Promise<Result<{ entry: JournalEntry }>> {
  const text = typeof body === "string" ? body.trim() : "";
  if (!z.uuid().safeParse(opportunityId).success || !text || text.length > 2000) return { ok: false, error: "Note vide ou trop longue." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  if (!(await rateLimit("application-journal", 120, 3600))) return { ok: false, error: "Trop de notes. Réessayez plus tard." };
  const db = await createClient();
  const { data, error } = await db
    .from("application_journal")
    .insert({ company_id: session.activeCompany.company.id, opportunity_id: opportunityId, user_id: session.userId, kind: "NOTE", body: text })
    .select("id, kind, body, created_at")
    .single();
  if (error || !data) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  await markWorkStarted(db, session.activeCompany.company.id, opportunityId);
  return { ok: true, entry: { ...data, author: "Vous", mine: true } };
}

/** Supprime une de ses notes du journal. */
export async function deleteJournalNote(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Note introuvable." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous." };
  const db = await createClient();
  const { error } = await db.from("application_journal").delete().eq("id", id).eq("user_id", session.userId).eq("kind", "NOTE");
  return error ? { ok: false, error: "Suppression impossible." } : { ok: true };
}

/** Parcours en 7 étapes : enregistre les réponses d'une étape (éligibilité, capacités, dépôt). */
export async function saveJourney(
  opportunityId: string,
  section: "eligibility" | "capacities" | "submission",
  value: unknown,
): Promise<Result<{ journey: Journey }>> {
  if (!z.uuid().safeParse(opportunityId).success) return { ok: false, error: "Offre introuvable." };
  const parsed = section === "submission" ? SubmissionSchema.safeParse(value) : ChecksSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Réponse invalide." };
  if (!(await rateLimit("journey", 240, 3600))) return { ok: false, error: "Trop d'enregistrements. Réessayez dans un moment." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Créez d'abord le profil de votre entreprise." };
  const companyId = session.activeCompany.company.id;
  const db = await createClient();
  const { data: item } = await db.from("pipeline_items").select("id, stage, journey").eq("company_id", companyId).eq("opportunity_id", opportunityId).maybeSingle();
  const journey = { ...readJourney(item?.journey), [section]: parsed.data } as Journey;
  const sub = section === "submission" ? (parsed.data as Submission) : null;
  const toSent = sub?.status === "submitted" && (!item || rank(item.stage) < rank("RESPONSE_SENT"));
  const patch = {
    journey: journey as unknown as Database["public"]["Tables"]["pipeline_items"]["Row"]["journey"],
    updated_by: session.userId,
    ...(toSent ? { stage: "RESPONSE_SENT" as Stage, submitted_at: sub?.date ?? todayParis() } : {}),
  };
  const { error } = item
    ? await db.from("pipeline_items").update(patch).eq("id", item.id)
    : await db.from("pipeline_items").insert({ company_id: companyId, opportunity_id: opportunityId, stage: toSent ? "RESPONSE_SENT" : "RESPONSE_PREPARING", ...patch });
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  if (toSent) {
    await logJournal(db, companyId, opportunityId, session.userId, "SENT", `Candidature déposée${sub?.platform ? ` sur ${sub.platform}` : ""}${sub?.reference ? ` (référence ${sub.reference})` : ""}.`);
    await markWorkStarted(db, companyId, opportunityId);
  }
  revalidatePath("/dashboard/candidatures");
  return { ok: true, journey };
}

/** Étape 7 : ajoute une nouvelle étape au suivi du résultat (historique conservé). */
export async function addJourneyResult(opportunityId: string, value: unknown): Promise<Result<{ journey: Journey }>> {
  if (!z.uuid().safeParse(opportunityId).success) return { ok: false, error: "Offre introuvable." };
  const parsed = ResultSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Réponse invalide." };
  const session = await getSession();
  if (!session?.activeCompany) return { ok: false, error: "Connectez-vous." };
  const companyId = session.activeCompany.company.id;
  const db = await createClient();
  const { data: item } = await db.from("pipeline_items").select("id, journey").eq("company_id", companyId).eq("opportunity_id", opportunityId).maybeSingle();
  if (!item) return { ok: false, error: "Commencez d'abord la préparation de ce dossier." };
  const prev = readJourney(item.journey);
  const results = [...(prev.results ?? []), { ...parsed.data, at: new Date().toISOString() }].slice(-30);
  const journey = { ...prev, results };
  const final = parsed.data.status === "accepted" ? "WON" : parsed.data.status === "rejected" || parsed.data.status === "other_winner" ? "LOST" : null;
  const { error } = await db
    .from("pipeline_items")
    .update({ journey: journey as unknown as Database["public"]["Tables"]["pipeline_items"]["Row"]["journey"], updated_by: session.userId, ...(final ? { stage: final as Stage } : {}) })
    .eq("id", item.id);
  if (error) return { ok: false, error: "Enregistrement impossible. Réessayez." };
  await logJournal(db, companyId, opportunityId, session.userId, "NOTE", `Résultat : ${RESULT_LABEL[parsed.data.status]}${parsed.data.comment ? ` — ${parsed.data.comment}` : ""}.`);
  revalidatePath("/dashboard/candidatures");
  return { ok: true, journey };
}
