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
const BriefBase = z.object({
  summary: z.string().describe("Ce que veut l'acheteur, dit simplement : quel travail, où, pour qui, pour combien de temps. 2 ou 3 phrases courtes"),
  deadline: z.string().nullable().describe("Date et heure limite pour déposer l'offre, ex. « lundi 7 décembre 2026 à 12 h »"),
  site_visit: z.string().nullable().describe("Visite des lieux : obligatoire ou non, date et lieu, en une phrase courte ; null si l'avis n'en parle pas"),
  duration: z.string().nullable().describe("Durée du contrat ou délai pour faire le travail, en mots simples (ex. « 4 ans », « 6 mois de travaux »)"),
  pricing: z.string().nullable().describe("Comment les prix sont fixés, en mots simples (ex. « Un prix fixe pour tout le chantier »), ou montant estimé ; null si l'avis n'en dit rien"),
  lots: z.array(z.string()).describe("Un élément par lot (une partie du marché) : « Lot 1 · intitulé simple : ce qu'il comprend en une phrase » ; vide s'il n'y a pas de lots"),
  documents: z.array(z.string()).describe("Pièces à fournir, une ligne courte chacune ; chaque sigle est expliqué entre parenthèses (ex. « Kbis (extrait d'immatriculation de l'entreprise) »)"),
  judging: z.string().describe("Comment l'offre sera notée, en 1 ou 2 phrases simples (ex. « Le prix compte pour 40 % de la note, la qualité du travail proposé pour 60 % ») ; si l'avis renvoie au règlement de la consultation, le dire simplement"),
  todo: z.array(z.string()).max(6).describe("5 actions au plus, dans l'ordre ; chacune commence par un verbe (« Téléchargez… », « Inscrivez-vous… », « Déposez… ») et donne la date quand l'avis la donne"),
  warnings: z.array(z.string()).max(4).describe("3 pièges réels au plus, tirés de l'avis et dits simplement (ex. « Visite obligatoire : sans elle, votre offre sera refusée »)"),
});
/** Préparer sa réponse : conditions pour candidater, dépôt, notation et conseils (tirés de l'avis uniquement). */
const BriefExtra = z.object({
  buyer: z
    .string()
    .nullable()
    .describe("Qui achète, en une phrase simple : le nom de l'acheteur, ce qu'il est (mairie, hôpital, office HLM, établissement public…) et sa ville quand l'avis la donne ; null si l'avis ne le dit pas"),
  details: z
    .array(z.string())
    .max(8)
    .describe(
      "Le besoin en détail, 4 à 8 points simples tirés de l'avis : le travail précis à faire (les prestations citées), les lieux ou bâtiments concernés, les quantités ou volumes, comment le travail est commandé (une seule fois ou au fur et à mesure), la date de début, les reconductions, les montants minimum ou maximum, ce qui est exclu. Chaque point est une phrase complète et claire",
    ),
  key_dates: z
    .array(z.object({ label: z.string(), date: z.string() }))
    .max(6)
    .describe("Les dates utiles écrites dans l'avis, dans l'ordre (ex. « Questions à poser avant » · « mardi 5 janvier 2027 » ; « Visite des lieux » ; « Dépôt des offres » ; « Début du contrat ») ; liste vide si l'avis n'en donne pas d'autre que la date limite"),
  official: z
    .array(z.string())
    .max(6)
    .describe("Ce que la personne trouvera en ouvrant l'annonce officielle puis le site de l'acheteur, d'après l'avis : documents du dossier (règlement de la consultation, cahier des charges, formulaires de prix…), inscription demandée, contact pour les questions. Une ligne simple chacune, chaque terme officiel expliqué entre parenthèses"),
  certifications: z
    .array(z.string())
    .max(8)
    .describe("Qualifications, certifications, habilitations ou labels exigés des candidats, recopiés tels qu'écrits dans l'avis (ex. « Qualibat 1311 ou équivalent », « RGE », « ISO 9001 ») ; liste vide si l'avis n'en exige aucun"),
  capacity: z
    .array(z.string())
    .max(6)
    .describe("Autres conditions pour répondre écrites dans l'avis (chiffre d'affaires minimum, assurances, travaux déjà réalisés du même type, nombre de salariés, matériel) ; une ligne courte et simple chacune. Si l'avis renvoie ces conditions au règlement de la consultation, une seule ligne qui le dit"),
  submission: z
    .string()
    .nullable()
    .describe("Où et comment déposer l'offre, en 1 ou 2 phrases simples : nom du site de l'acheteur, dépôt en ligne obligatoire, signature électronique (expliquée) ; null si l'avis n'en dit rien"),
  submission_url: z.string().nullable().describe("Adresse internet du profil d'acheteur ou de la plateforme de dépôt, recopiée exactement depuis l'avis ; null si l'avis n'en donne pas"),
  criteria: z
    .array(z.object({ label: z.string(), weight: z.number().nullable() }))
    .max(8)
    .describe("Critères de notation en mots simples (ex. « Prix », « Qualité du travail proposé », « Délai ») et leur poids en pourcentage quand l'avis le donne (weight null sinon) ; liste vide si l'avis renvoie au règlement de la consultation"),
  tips: z
    .array(z.string())
    .max(5)
    .describe("3 conseils au plus, concrets et simples, pour obtenir la meilleure note, tirés uniquement des critères, exigences et pièges de cet avis (ex. « La qualité compte pour 60 % : expliquez en détail comment vous ferez le travail et avec qui »). Aucun conseil général sans lien avec l'avis"),
});
/** Schéma demandé lors de la préparation (tous les champs). */
const BriefGenSchema = BriefBase.merge(BriefExtra);
/**
 * Style de rédaction des fiches. 2 : langage simple (mots de tous les jours, sigles expliqués). 3 : fiche
 * détaillée (le besoin point par point, l'acheteur, les dates, ce que contient l'annonce officielle).
 * Une fiche d'un style plus ancien est réécrite quand quelqu'un l'ouvre (jamais à l'avance).
 */
export const BRIEF_STYLE = 3;
/** Fiche conservée : les fiches préparées avant l'ajout des rubriques « Préparer sa réponse » restent valides. */
export const BriefSchema = BriefBase.merge(BriefExtra.partial()).extend({ style: z.number().optional() });
export type TenderBrief = z.infer<typeof BriefSchema>;
/** Fiche complète (avec les conditions pour candidater, le dépôt, la notation et les conseils) ? */
export const isFullBrief = (b: TenderBrief | null | undefined): b is TenderBrief => Array.isArray(b?.certifications);
/** Fiche complète et rédigée dans le style actuel (langage simple) ? */
export const isCurrentBrief = (b: TenderBrief | null | undefined): b is TenderBrief => isFullBrief(b) && b.style === BRIEF_STYLE;

const SYSTEM = `Tu rédiges des fiches synthèse d'appels d'offres publics pour des artisans et de petites entreprises françaises. Beaucoup n'ont jamais répondu à un marché public : écris pour quelqu'un qui découvre, comme si tu lui expliquais l'annonce de vive voix.

Règles absolues :
- Utilise UNIQUEMENT les informations écrites dans l'avis fourni. N'invente rien : ni date, ni montant, ni pièce, ni critère.
- Si une information est absente, mets null (ou une liste vide). N'écris jamais « non précisé » dans un champ.
- Certifications et conditions pour répondre : uniquement celles que l'avis exige. Les certifications sont recopiées telles qu'elles sont écrites ; si l'avis n'en exige pas, liste vide.
- Adresse de dépôt : uniquement une adresse internet écrite dans l'avis, recopiée à l'identique.
- Conseils : chaque conseil s'appuie sur un critère, une exigence ou un piège présent dans l'avis. Jamais de promesse de résultat.

Langage simple (très important) :
- Des mots de tous les jours et des phrases courtes : une idée par phrase, 20 mots au plus. Pas de jargon administratif.
- Sois complet : la personne doit comprendre exactement ce qu'on lui demande et ce qu'elle trouvera dans l'annonce officielle, sans avoir à la lire. Reprends tous les faits utiles de l'avis (travail précis, lieux, quantités, durée, montants, dates, pièces, conditions), reformulés simplement.
- Ne répète pas la même information d'une rubrique à l'autre.
- Les « à faire » commencent par un verbe (« Téléchargez… », « Inscrivez-vous… », « Déposez… ») et donnent la date quand l'avis la donne.
- Remplace le jargon par des mots simples. Quand un terme officiel est utile (pour retrouver un document ou une pièce), explique-le entre parenthèses, en quelques mots, la première fois. Exemples :
  « règlement de la consultation (le document qui fixe les règles de l'appel d'offres) » ; « cahier des charges (la description détaillée du travail) » ;
  « DUME (formulaire de candidature en ligne) » ; « DC1 et DC2 (formulaires de candidature) » ; « Kbis (extrait d'immatriculation de l'entreprise) » ;
  « mémoire technique (le document où vous expliquez comment vous ferez le travail) » ; « BPU (liste des prix à l'unité à remplir) » ; « DPGF (tableau des prix à remplir) » ;
  « accord-cadre (contrat de plusieurs années : le travail est commandé au fur et à mesure) » ; « bons de commande (commandes passées au fur et à mesure) » ;
  « variante (une autre solution que celle demandée) » ; « lot (une partie du marché : on peut répondre à un seul lot) » ;
  « groupement (répondre à plusieurs entreprises ensemble) » ; « sous-traitance (confier une partie du travail à une autre entreprise) » ;
  « profil d'acheteur (le site internet où l'acheteur publie le dossier et reçoit les offres) ».
- Notation : dis ce qui compte et combien, sans le mot « pondération » (« Le prix compte pour 40 % de la note, la qualité du travail proposé pour 60 % »).
- Dates en toutes lettres avec le jour de la semaine quand elles sont connues (« lundi 7 décembre 2026 à 12 h »).
- Si l'avis renvoie une information au règlement de la consultation, dis-le en une phrase simple : « Le détail est dans le règlement de la consultation, à télécharger sur le site de l'acheteur ».`;

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

type Generated = { brief: TenderBrief } | { reason: "no-key" | "no-source" | "no-notice" | "refusal" | "error" };

/** Rédige la fiche depuis l'avis officiel (BOAMP, sinon TED) et l'enregistre. */
async function generateBrief(opportunityId: string, existing: TenderBrief | null, db: ReturnType<typeof createAdminClient>, client?: Pick<Anthropic, "beta">): Promise<Generated> {
  if (!process.env.ANTHROPIC_API_KEY && !client) return { reason: "no-key" };
  const { data: sources } = await db.from("opportunity_sources").select("original_url").eq("opportunity_id", opportunityId);
  // Avis BOAMP en priorité (le plus complet), sinon l'avis européen TED
  const idweb = (sources ?? []).map((s) => boampId(s.original_url)).find(Boolean);
  const ted = idweb ? null : (sources ?? []).map((s) => tedId(s.original_url)).find(Boolean);
  if (!idweb && !ted) return { reason: "no-source" };
  const ref = idweb ? `BOAMP ${idweb}` : `TED ${ted}`;
  try {
    const text = idweb ? await boampNoticeText(idweb) : await tedNoticeText(ted!);
    if (!text) return { reason: "no-notice" };
    const ai = client ?? new Anthropic({ timeout: 60_000, maxRetries: 1 });
    const response = await ai.beta.messages.parse({
      model: REPORT_MODEL,
      // Fiche complète : 2 000 jetons coupaient la réponse en plein milieu sur les avis longs (JSON tronqué)
      max_tokens: 8000,
      output_config: { format: betaZodOutputFormat(BriefGenSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Avis ${ref} :\n\n${text}` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return { reason: "refusal" };
    const brief: TenderBrief = { ...response.parsed_output, style: BRIEF_STYLE };
    // Adresse de dépôt : gardée seulement si elle figure telle quelle dans l'avis (jamais devinée)
    const url = brief.submission_url?.trim() ?? null;
    brief.submission_url = url && /^https?:\/\/[^\s]+$/i.test(url) && text.includes(url.replace(/\/$/, "")) ? url : null;
    // Réécriture d'une fiche déjà suivie : les cases cochées par les membres (« à faire », pièces)
    // désignent des lignes par leur rang, ces listes sont donc gardées telles quelles
    if (existing) {
      const { data: checked } = await db.from("pipeline_items").select("brief_done, docs_done").eq("opportunity_id", opportunityId);
      if ((checked ?? []).some((p) => (p.brief_done ?? []).length > 0)) brief.todo = existing.todo;
      if ((checked ?? []).some((p) => (p.docs_done ?? []).length > 0)) brief.documents = existing.documents;
    }
    // Consommation réelle (mesure du coût des fiches)
    const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    await db.from("tender_briefs").upsert({
      opportunity_id: opportunityId,
      content: brief as never,
      source_ref: ref,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
      generated_at: new Date().toISOString(),
    });
    return { brief };
  } catch (e) {
    logServerError("tender brief", e);
    return { reason: "error" };
  }
}

/**
 * Prépare (une seule fois) la fiche d'un appel d'offres issu du BOAMP. Renvoie null si l'offre n'a pas
 * d'avis BOAMP, si l'avis est introuvable ou si la clé du service de rédaction est absente.
 * Une fiche d'un style plus ancien est réécrite à ce moment-là (la personne attend quelques secondes).
 */
export async function ensureBrief(opportunityId: string, { db = createAdminClient(), client }: { db?: ReturnType<typeof createAdminClient>; client?: Pick<Anthropic, "beta"> } = {}): Promise<TenderBrief | null> {
  const existing = await storedBrief(opportunityId, db);
  if (isCurrentBrief(existing)) return existing;
  // Fiche absente ou d'un style plus ancien : rédigée maintenant, à l'ouverture (l'ancienne reste en secours).
  // Une seule rédaction à la fois : si elle est déjà lancée (ouverture de l'offre), on attend son résultat.
  const { data: claimed, error } = await db.rpc("claim_brief_generation", { p_opportunity_id: opportunityId });
  if (error || claimed) {
    try {
      const r = await generateBrief(opportunityId, existing, db, client);
      return "brief" in r ? r.brief : existing;
    } finally {
      if (!error) await db.from("brief_generations").delete().eq("opportunity_id", opportunityId);
    }
  }
  for (const end = Date.now() + BRIEF_WAIT_MS; Date.now() < end; ) {
    await new Promise((ok) => setTimeout(ok, 1500));
    const { count } = await db.from("brief_generations").select("opportunity_id", { count: "exact", head: true }).eq("opportunity_id", opportunityId);
    if (!count) break;
  }
  return (await storedBrief(opportunityId, db)) ?? existing;
}

/** Temps d'attente maximal d'une rédaction déjà lancée par une autre demande. */
const BRIEF_WAIT_MS = 90_000;

/**
 * Réécriture progressive en langage simple (style BRIEF_STYLE) des fiches des offres encore ouvertes :
 * celles que des membres suivent d'abord, puis les dates limites les plus proches. Plusieurs fiches à
 * la fois, dans la limite du temps donné ; une fiche dont l'avis est introuvable est retentée le lendemain.
 */
export async function rewriteBriefs(
  db = createAdminClient(),
  { limit = 60, deadline = Date.now() + 180_000, concurrency = 3, client }: { limit?: number; deadline?: number; concurrency?: number; client?: Pick<Anthropic, "beta"> } = {},
) {
  if (!process.env.ANTHROPIC_API_KEY && !client) return { rewritten: 0, skipped: "Clé du service de rédaction absente" };
  const { data, error } = await db.rpc("briefs_to_rewrite", { p_style: BRIEF_STYLE, p_limit: limit });
  if (error) throw error;
  const queue = (data ?? []).map((r) => r.opportunity_id);
  if (!queue.length) return { rewritten: 0, skipped: "Toutes les fiches ouvertes sont à jour" };
  let rewritten = 0;
  let failed = 0;
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const id = queue.shift()!;
      const r = await generateBrief(id, await storedBrief(id, db), db, client);
      if ("brief" in r) {
        rewritten++;
        continue;
      }
      failed++;
      // Échec (avis introuvable, refus, erreur) : l'ancienne fiche reste affichée, nouvel essai le lendemain
      const { data: row } = await db.from("tender_briefs").select("content").eq("opportunity_id", id).maybeSingle();
      if (row) await db.from("tender_briefs").update({ content: { ...(row.content as Record<string, unknown>), rewrite_failed_at: new Date().toISOString() } as never }).eq("opportunity_id", id);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return { rewritten, failed, remaining: queue.length };
}

/**
 * Préparation à l'avance (passage quotidien) : les appels d'offres BOAMP ouverts les plus récents dans
 * les métiers des entreprises abonnées ou en essai, dans la limite de `limit` fiches par passage.
 */
export async function prepareBriefs(db = createAdminClient(), { limit = 25, deadline = Date.now() + 60_000, concurrency = 1, everyone = false }: { limit?: number; deadline?: number; concurrency?: number; everyone?: boolean } = {}) {
  const now = new Date().toISOString();
  // Phase de lancement gratuite : la fiche est offerte à tous, donc préparée pour toutes les entreprises inscrites
  const freeLaunch = (await db.rpc("free_launch")).data === true;
  const { data: companies } = freeLaunch
    ? await db.from("companies").select("id").eq("is_demo", false).eq("status", "ACTIVE")
    : await db.from("companies").select("id").or(`plan_code.in.(PRO,BUSINESS),trial_ends_at.gt.${now}`);
  const ids = (companies ?? []).map((c) => c.id);
  const { data: profiles } = ids.length ? await db.from("company_profiles").select("sectors").in("company_id", ids) : { data: [] };
  const sectors = [...new Set((profiles ?? []).flatMap((p) => p.sectors ?? []))];
  if (!sectors.length && !everyone) return { prepared: 0, skipped: "Aucun métier renseigné" };
  const pick = async (sectorFilter: string[] | null) => {
    let q = db.from("opportunities").select("id").eq("status", "PUBLISHED").eq("origin", "EXTERNAL").eq("is_demo", false).gt("response_deadline", now);
    if (sectorFilter) q = q.in("sector_slug", sectorFilter);
    const { data } = await q.order("published_at", { ascending: false }).limit(limit * 8);
    return (data ?? []).map((o) => o.id);
  };
  // D'abord les métiers des entreprises inscrites, puis (option) toutes les offres ouvertes, les plus récentes d'abord
  const candidates = [...new Set([...(sectors.length ? await pick(sectors) : []), ...(everyone ? await pick(null) : [])])];
  const has = new Set<string>();
  for (let i = 0; i < candidates.length; i += 300) {
    const { data: done } = await db.from("tender_briefs").select("opportunity_id").in("opportunity_id", candidates.slice(i, i + 300));
    for (const d of done ?? []) has.add(d.opportunity_id);
  }
  const queue = candidates.filter((id) => !has.has(id)).slice(0, limit);
  let prepared = 0;
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const id = queue.shift()!;
      if (await ensureBrief(id, { db })) prepared++;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(8, concurrency)) }, worker));
  return { prepared, remaining: queue.length };
}
