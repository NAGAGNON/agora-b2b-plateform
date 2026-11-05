import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logServerError } from "@/lib/errors";
import { REPORT_MODEL } from "@/lib/daily-report";
import { runNeedCampaign } from "@/lib/needs";
import { env } from "@/lib/env";
import { processEmailOutbox } from "@/lib/email/outbox";

type DB = SupabaseClient<Database>;

/** Décision de relecture d'un besoin publié. */
export const ReviewSchema = z.object({
  decision: z.enum(["APPROVE", "REQUEST_CHANGES", "MANUAL"]),
  /** Message à l'auteur (demande de précisions) ou note interne (relecture par l'équipe) */
  reason: z.string(),
  /** Secteur le plus juste (slug de la liste) quand celui choisi ne correspond pas au besoin, sinon null */
  better_sector: z.string().nullable(),
});
export type Review = z.infer<typeof ReviewSchema>;

const SYSTEM = `Tu relis, pour l'équipe de LinkProB2B (plateforme française de mise en relation entre entreprises), les besoins publiés par des entreprises inscrites avant leur mise en ligne.

Décisions possibles :
- APPROVE : besoin professionnel réel et compréhensible (achat de prestation, de travaux, de fournitures, recherche de sous-traitant ou de partenaire) : une entreprise du métier peut comprendre ce qui est demandé et y répondre. Ne sois pas pointilleux : un besoin court mais clair est approuvé.
- REQUEST_CHANGES : besoin professionnel légitime mais trop vague pour qu'une entreprise puisse répondre (on ne comprend pas ce qui est demandé), ou qui contient un numéro de téléphone ou une adresse e-mail personnelle dans le texte (les échanges passent par la messagerie de la plateforme). reason = message poli à l'auteur, en français, qui dit précisément quoi préciser ou retirer (2 à 3 phrases, signé implicitement par « l'équipe LinkProB2B », sans jamais parler de robot, d'automate ni d'intelligence artificielle).
- MANUAL : tout ce qui n'est pas clairement un besoin professionnel légitime : publicité ou offre de service déguisée (l'auteur vend au lieu d'acheter), offre d'emploi ou recrutement, demande de particulier, contenu illégal, trompeur, arnaque, financement douteux, contenu choquant, texte incohérent ou de test. reason = note interne courte pour l'équipe.

better_sector : si le secteur choisi par l'auteur ne correspond manifestement pas au métier demandé, donne le slug le plus juste parmi la liste fournie ; sinon null. N'invente jamais de slug.

Ne modifie pas le besoin, n'invente rien. En cas de doute entre APPROVE et MANUAL, choisis MANUAL.`;

type NeedForReview = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  origin: string;
  sector_slug: string | null;
  city: string | null;
  department_code: string | null;
  budget_min: number | null;
  budget_max: number | null;
  company: { name: string } | { name: string }[] | null;
};

/** Demande la décision de relecture. Exporté pour les tests (client injecté). */
export async function reviewNeed(need: NeedForReview, sectors: { slug: string; label: string }[], client: Pick<Anthropic, "beta"> = new Anthropic({ timeout: 60_000, maxRetries: 1 })): Promise<Review> {
  const company = Array.isArray(need.company) ? need.company[0]?.name : need.company?.name;
  const content = [
    `Entreprise qui publie : ${company ?? "inconnue"}`,
    `Titre : ${need.title}`,
    `Secteur choisi : ${need.sector_slug ?? "aucun"}`,
    `Lieu : ${[need.city, need.department_code].filter(Boolean).join(" ") || "non précisé"}`,
    `Budget : ${need.budget_min ?? "?"} – ${need.budget_max ?? "?"} €`,
    "",
    "Description :",
    (need.description ?? "").slice(0, 6000),
    "",
    `Secteurs possibles (slug — libellé) :\n${sectors.map((s) => `${s.slug} — ${s.label}`).join("\n")}`,
  ].join("\n");
  const response = await client.beta.messages.parse({
    model: REPORT_MODEL,
    max_tokens: 1500,
    output_config: { format: betaZodOutputFormat(ReviewSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return { decision: "MANUAL", reason: "Relecture automatique impossible : à valider par l'équipe.", better_sector: null };
  return response.parsed_output;
}

export type AutoModerationResult = { id: string; decision: Review["decision"] | "SKIPPED"; note: string };

/**
 * Relecture automatique d'un besoin en attente : publication (puis mise en relation), demande de
 * précisions à l'auteur, ou laissé à l'équipe (cas douteux). Sans clé ANTHROPIC_API_KEY : laissé à l'équipe.
 */
export async function autoModerateNeed(db: DB, id: string, { client }: { client?: Pick<Anthropic, "beta"> } = {}): Promise<AutoModerationResult> {
  try {
    const { data } = await db
      .from("opportunities")
      .select("id, title, description, type, status, origin, sector_slug, city, department_code, budget_min, budget_max, company:companies(name)")
      .eq("id", id)
      .maybeSingle();
    const need = data as unknown as NeedForReview | null;
    if (!need || need.status !== "PENDING_REVIEW" || need.origin !== "INTERNAL") return { id, decision: "SKIPPED", note: "Pas en attente" };
    if (!process.env.ANTHROPIC_API_KEY && !client) return { id, decision: "SKIPPED", note: "Relecture automatique indisponible (clé absente)" };
    const { data: sectors } = await db.from("sectors").select("slug, label").order("label");
    const review = await reviewNeed(need, sectors ?? [], client);
    if (review.decision === "MANUAL") {
      // Laissé à l'équipe : noté une fois, pour ne pas relire ce besoin à chaque passage
      await db.from("audit_logs").insert({ action: "moderation.auto.manual", entity_type: "opportunity", entity_id: id, metadata: { reason: review.reason } });
      return { id, decision: "MANUAL", note: review.reason };
    }
    if (review.decision === "APPROVE" && review.better_sector && review.better_sector !== need.sector_slug && (sectors ?? []).some((s) => s.slug === review.better_sector)) {
      await db.from("opportunities").update({ sector_slug: review.better_sector }).eq("id", id).eq("status", "PENDING_REVIEW");
    }
    const { data: done, error } = await db.rpc("auto_moderate_opportunity", { p_opportunity_id: id, p_action: review.decision, p_reason: review.decision === "APPROVE" ? "" : review.reason });
    if (error) throw error;
    if (done && review.decision === "APPROVE") {
      // Publié : mise en relation (entreprises inscrites et envoi ciblé du jour)
      await runNeedCampaign(db, id, { deadline: Date.now() + 100_000 }).catch((e) => logServerError("need campaign after auto publish", e));
    }
    if (done && env.emailTransport) await processEmailOutbox(40).catch(() => undefined);
    return { id, decision: review.decision, note: review.reason };
  } catch (e) {
    logServerError("auto moderation", e);
    return { id, decision: "SKIPPED", note: e instanceof Error ? e.message : String(e) };
  }
}

/** Passage planifié : besoins en attente depuis plus de 5 minutes (publication manquée, erreur passagère). */
export async function processPendingNeeds(db: DB, { limit = 10 }: { limit?: number } = {}) {
  const { data } = await db
    .from("opportunities")
    .select("id, updated_at")
    .eq("status", "PENDING_REVIEW")
    .eq("origin", "INTERNAL")
    .lt("updated_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .order("updated_at")
    .limit(50);
  const ids = (data ?? []).map((r) => r.id);
  // Déjà relus et laissés à l'équipe depuis leur dernière modification : pas de nouvelle relecture
  const { data: seen } = ids.length ? await db.from("audit_logs").select("entity_id, created_at").eq("action", "moderation.auto.manual").in("entity_id", ids) : { data: [] };
  const todo = (data ?? []).filter((r) => !(seen ?? []).some((x) => x.entity_id === r.id && x.created_at >= r.updated_at)).slice(0, limit);
  const results: AutoModerationResult[] = [];
  for (const r of todo) results.push(await autoModerateNeed(db, r.id));
  return results;
}
