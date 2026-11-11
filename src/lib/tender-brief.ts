import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOAMP_ENDPOINT, TED_ENDPOINT, tedText } from "@/lib/collect/connectors";
import { REPORT_MODEL } from "@/lib/daily-report";
import { logServerError } from "@/lib/errors";

/**
 * Fiche synthèse d'un appel d'offres (avantage Pro) : l'essentiel de l'avis officiel en 30 secondes
 * (dates, lots, pièces à fournir, jugement des offres, à faire, pièges). Préparée une fois depuis
 * l'avis BOAMP complet, puis conservée. Uniquement les faits écrits dans l'avis : rien n'est déduit.
 */
export const BriefSchema = z.object({
  summary: z.string().describe("Ce que veut l'acheteur, en 1 ou 2 phrases simples"),
  deadline: z.string().nullable().describe("Date et heure limite de remise des offres, ex. « lundi 7 décembre 2026 à 12 h »"),
  site_visit: z.string().nullable().describe("Visite : obligatoire ou non, dates et lieu ; null si l'avis n'en parle pas"),
  duration: z.string().nullable().describe("Durée du marché ou délai d'exécution"),
  pricing: z.string().nullable().describe("Forme des prix (forfaitaires, unitaires, accord-cadre…) ou montant estimé"),
  lots: z.array(z.string()).describe("Un élément par lot : « Lot 1 · intitulé » ; vide s'il n'y a pas de lots"),
  documents: z.array(z.string()).describe("Pièces et justificatifs demandés, une ligne courte chacun"),
  judging: z.string().describe("Comment l'offre sera jugée (critères, pondérations, négociation) ; si renvoyé au règlement, le dire"),
  todo: z.array(z.string()).max(6).describe("Actions concrètes à faire, dans l'ordre, avec les dates"),
  warnings: z.array(z.string()).max(4).describe("Pièges réels tirés de l'avis (visite obligatoire, pas de variantes, prix forfaitaires, qualification exigée…)"),
});
export type TenderBrief = z.infer<typeof BriefSchema>;

const SYSTEM = `Tu rédiges des fiches synthèse d'appels d'offres publics pour des artisans et des PME françaises.
Règles absolues :
- Utilise UNIQUEMENT les informations écrites dans l'avis fourni. N'invente rien : ni date, ni montant, ni pièce, ni critère.
- Si une information est absente, mets null (ou une liste vide). Pour les critères renvoyés au règlement de consultation, dis-le simplement.
- Français simple, phrases courtes, aucun jargon inutile. Dates en toutes lettres avec le jour de la semaine quand elles sont connues.
- Les « à faire » et « points d'attention » doivent découler directement de l'avis.`;

/** Identifiant de l'avis BOAMP (« 26-108110 ») tiré de l'adresse de la source. */
export function boampId(url: string | null | undefined): string | null {
  return url ? (/idweb[:=](\d{2}-\d+)/i.exec(url)?.[1] ?? null) : null;
}

/** Avis BOAMP complet, en texte (données officielles publiques). */
export async function boampNoticeText(idweb: string): Promise<string | null> {
  const url = `${BOAMP_ENDPOINT}?where=${encodeURIComponent(`idweb="${idweb}"`)}&limit=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const r = ((await res.json()) as { results?: Record<string, unknown>[] }).results?.[0];
  if (!r) return null;
  const head = ["objet", "nomacheteur", "procedure_libelle", "nature_libelle", "famille_libelle", "datelimitereponse", "dateparution", "type_marche", "descripteur_libelle", "criteres"]
    .map((k) => (r[k] != null ? `${k} : ${Array.isArray(r[k]) ? (r[k] as unknown[]).join(", ") : String(r[k])}` : null))
    .filter(Boolean)
    .join("\n");
  return `${head}\n\nAvis complet (JSON officiel) :\n${String(r.donnees ?? "").slice(0, 14_000)}`;
}

/** Numéro de publication TED (« 771559-2026 ») tiré de l'adresse de la source. */
export function tedId(url: string | null | undefined): string | null {
  return url ? (/ted\.europa\.eu\/[a-z]{2}\/notice\/(?:-\/detail\/)?(\d{1,8}-\d{4})/i.exec(url)?.[1] ?? null) : null;
}

const TED_FIELDS = [
  "notice-title", "buyer-name", "procedure-type", "contract-nature", "place-of-performance", "classification-cpv",
  "title-lot", "description-lot", "estimated-value-lot", "duration-period-value-lot", "duration-period-unit-lot",
  "deadline-receipt-tender-date-lot", "deadline-receipt-request-date-lot", "award-criterion-description-lot",
  "selection-criterion-description-lot", "publication-date",
];

/** Valeurs lisibles d'un champ TED (en français de préférence), toutes les valeurs des lots comprises. */
function tedValues(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.flatMap(tedValues);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const lang = o.fra ?? o.FRA ?? o.eng ?? o.ENG;
    return lang !== undefined ? tedValues(lang) : [tedText(o) ?? ""].filter(Boolean);
  }
  return [String(v)];
}

/** Avis TED en texte (API de recherche officielle, anonyme), champ par champ. */
export async function tedNoticeText(pub: string): Promise<string | null> {
  const res = await fetch(TED_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: `publication-number=${pub}`, fields: TED_FIELDS, limit: 1, scope: "ALL" }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const n = ((await res.json()) as { notices?: Record<string, unknown>[] }).notices?.[0];
  if (!n) return null;
  const lines = TED_FIELDS.map((k) => {
    const vals = [...new Set(tedValues(n[k]).map((x) => x.trim()).filter(Boolean))];
    return vals.length ? `${k} : ${vals.join(" | ")}` : null;
  }).filter(Boolean);
  return lines.length ? `Avis européen (TED) n° ${pub}\n${lines.join("\n")}`.slice(0, 14_000) : null;
}

/** Fiche déjà préparée, ou null. */
export async function storedBrief(opportunityId: string, db = createAdminClient()): Promise<TenderBrief | null> {
  const { data } = await db.from("tender_briefs").select("content").eq("opportunity_id", opportunityId).maybeSingle();
  const parsed = BriefSchema.safeParse(data?.content);
  return parsed.success ? parsed.data : null;
}

/**
 * Prépare (une seule fois) la fiche d'un appel d'offres issu du BOAMP. Renvoie null si l'offre n'a pas
 * d'avis BOAMP, si l'avis est introuvable ou si la clé du service de rédaction est absente.
 */
export async function ensureBrief(opportunityId: string, { db = createAdminClient(), client }: { db?: ReturnType<typeof createAdminClient>; client?: Pick<Anthropic, "beta"> } = {}): Promise<TenderBrief | null> {
  const existing = await storedBrief(opportunityId, db);
  if (existing) return existing;
  if (!process.env.ANTHROPIC_API_KEY && !client) return null;
  const { data: sources } = await db.from("opportunity_sources").select("original_url").eq("opportunity_id", opportunityId);
  // Avis BOAMP en priorité (le plus complet), sinon l'avis européen TED
  const idweb = (sources ?? []).map((s) => boampId(s.original_url)).find(Boolean);
  const ted = idweb ? null : (sources ?? []).map((s) => tedId(s.original_url)).find(Boolean);
  if (!idweb && !ted) return null;
  const ref = idweb ? `BOAMP ${idweb}` : `TED ${ted}`;
  try {
    const text = idweb ? await boampNoticeText(idweb) : await tedNoticeText(ted!);
    if (!text) return null;
    const ai = client ?? new Anthropic({ timeout: 60_000, maxRetries: 1 });
    const response = await ai.beta.messages.parse({
      model: REPORT_MODEL,
      // Fiche complète : 2 000 jetons coupaient la réponse en plein milieu sur les avis longs (JSON tronqué)
      max_tokens: 8000,
      output_config: { format: betaZodOutputFormat(BriefSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Avis ${ref} :\n\n${text}` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    const brief = response.parsed_output;
    await db.from("tender_briefs").upsert({ opportunity_id: opportunityId, content: brief as never, source_ref: ref });
    return brief;
  } catch (e) {
    logServerError("tender brief", e);
    return null;
  }
}

/**
 * Préparation à l'avance (passage quotidien) : les appels d'offres BOAMP ouverts les plus récents dans
 * les métiers des entreprises abonnées ou en essai, dans la limite de `limit` fiches par passage.
 */
export async function prepareBriefs(db = createAdminClient(), { limit = 25, deadline = Date.now() + 60_000 } = {}) {
  const now = new Date().toISOString();
  // Phase de lancement gratuite : la fiche est offerte à tous, donc préparée pour toutes les entreprises inscrites
  const freeLaunch = (await db.rpc("free_launch")).data === true;
  const { data: companies } = freeLaunch
    ? await db.from("companies").select("id").eq("is_demo", false).eq("status", "ACTIVE")
    : await db.from("companies").select("id").or(`plan_code.in.(PRO,BUSINESS),trial_ends_at.gt.${now}`);
  const ids = (companies ?? []).map((c) => c.id);
  if (!ids.length) return { prepared: 0, skipped: "Aucune entreprise abonnée ou en essai" };
  const { data: profiles } = await db.from("company_profiles").select("sectors").in("company_id", ids);
  const sectors = [...new Set((profiles ?? []).flatMap((p) => p.sectors ?? []))];
  if (!sectors.length) return { prepared: 0, skipped: "Aucun métier renseigné" };
  const { data: opps } = await db
    .from("opportunities")
    .select("id")
    .eq("status", "PUBLISHED")
    .eq("origin", "EXTERNAL")
    .eq("is_demo", false)
    .in("sector_slug", sectors)
    .gt("response_deadline", now)
    .order("published_at", { ascending: false })
    .limit(limit * 4);
  const { data: done } = (opps ?? []).length ? await db.from("tender_briefs").select("opportunity_id").in("opportunity_id", (opps ?? []).map((o) => o.id)) : { data: [] };
  const has = new Set((done ?? []).map((d) => d.opportunity_id));
  let prepared = 0;
  for (const o of opps ?? []) {
    if (prepared >= limit || Date.now() > deadline) break;
    if (has.has(o.id)) continue;
    if (await ensureBrief(o.id, { db })) prepared++;
  }
  return { prepared };
}
