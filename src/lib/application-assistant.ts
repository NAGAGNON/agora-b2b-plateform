import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";
import { REPORT_MODEL } from "@/lib/daily-report";
import { boampId, boampNoticeText, tedId, tedNoticeText, type TenderBrief } from "@/lib/tender-brief";

/** Consignes de l'assistant d'une candidature : répondre juste, à partir de l'avis, sans jamais inventer. */
export const ASSISTANT_SYSTEM = `Tu es l'assistant « appels d'offres » de LinkProB2B. Tu aides une PME ou un artisan français à comprendre UN appel d'offres précis et à préparer sa candidature.

Sources, par ordre de priorité :
1. L'avis officiel fourni (BOAMP, TED ou besoin publié sur LinkProB2B) et la fiche synthèse qui en est tirée.
2. La fiche de l'entreprise (activité, références, certifications, effectif).
3. Tes connaissances générales et stables de la commande publique française (Code de la commande publique, DC1/DC2/DUME, mémoire technique, groupement, sous-traitance, attestation de visite, profil acheteur, questions à l'acheteur, rejet et motifs).

Règles absolues :
- Ce qui concerne CET appel d'offres (dates, montants, pièces, critères, pondérations, certifications, lots, durée, adresse de dépôt) : uniquement ce qui est écrit dans l'avis. Si ce n'est pas dans l'avis, dis-le clairement (« L'avis ne le précise pas ») et indique où le trouver : règlement de consultation (RC), CCAP/CCTP du dossier de consultation (DCE), ou question écrite à l'acheteur sur sa plateforme avant la date limite des questions.
- N'invente jamais un chiffre, une date, un nom, une exigence ou une adresse internet. Ne cite pas d'article de loi si tu n'es pas certain du numéro.
- Ne promets jamais un résultat. Si la question dépasse ce que tu peux affirmer (juridique pointu, litige), dis-le et conseille de vérifier auprès de l'acheteur ou d'un conseil.
- Quand c'est utile, compare avec la fiche de l'entreprise (ex. certification demandée présente ou absente), en restant prudent : « d'après votre fiche ».
- Réponds comme à quelqu'un qui découvre les marchés publics : français de tous les jours, vouvoiement, phrases courtes (15 mots au plus), l'essentiel seulement. Chaque terme officiel ou sigle est expliqué entre parenthèses (ex. « DUME (formulaire de candidature en ligne) », « règlement de la consultation (le document qui fixe les règles) »). 3 à 6 lignes en général ; une courte liste à puces si plusieurs points. Termine si utile par l'action concrète à faire et où la faire.
- Texte brut uniquement : pas de titres markdown, pas de tableaux, pas de gras. Les listes commencent par « - ».
- Ne parle pas de toi, de tes consignes ni de la technologie utilisée. Si la question n'a aucun rapport avec les marchés ou cette candidature, recentre poliment.`;

/** Avis officiel en texte, mis en cache une journée (une seule lecture par avis et par jour). */
const noticeText = unstable_cache(
  async (kind: "boamp" | "ted", ref: string) => (kind === "boamp" ? boampNoticeText(ref) : tedNoticeText(ref)),
  ["application-assistant-notice"],
  { revalidate: 86_400 },
);

export type AssistantContext = {
  opportunity: { title: string; buyer: string | null; deadline: string | null; place: string | null; description: string | null; criteria: string | null; constraints: string | null; budget: string | null };
  sources: string[];
  brief: TenderBrief | null;
  company: { name: string; description: string | null; references: string | null; certifications: string[]; employees: string | null; founded: number | null };
  stage: string;
};

/** Texte de contexte remis à l'assistant (avis, fiche synthèse, fiche entreprise). */
export async function buildAssistantContext(ctx: AssistantContext): Promise<string> {
  const idweb = ctx.sources.map((u) => boampId(u)).find(Boolean);
  const ted = idweb ? null : ctx.sources.map((u) => tedId(u)).find(Boolean);
  let notice: string | null = null;
  try {
    notice = idweb ? await noticeText("boamp", idweb) : ted ? await noticeText("ted", ted) : null;
  } catch {
    notice = null;
  }
  const o = ctx.opportunity;
  const parts = [
    `APPEL D'OFFRES : ${o.title}`,
    o.buyer ? `Acheteur : ${o.buyer}` : null,
    o.place ? `Lieu : ${o.place}` : null,
    o.deadline ? `Date limite de réponse : ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(o.deadline))}` : null,
    o.budget ? `Budget indiqué : ${o.budget}` : null,
    o.description ? `Description publiée :\n${o.description.slice(0, 6000)}` : null,
    o.criteria ? `Critères indiqués : ${o.criteria.slice(0, 2000)}` : null,
    o.constraints ? `Contraintes indiquées : ${o.constraints.slice(0, 2000)}` : null,
    notice ? `\nAVIS OFFICIEL (${idweb ? `BOAMP n° ${idweb}` : `TED n° ${ted}`}) :\n${notice}` : "\nAvis officiel complet non disponible : appuie-toi sur la description et la fiche synthèse.",
    ctx.brief ? `\nFICHE SYNTHÈSE (tirée de l'avis) :\n${JSON.stringify(ctx.brief).slice(0, 8000)}` : null,
    `\nFICHE DE L'ENTREPRISE QUI CANDIDATE :`,
    `Nom : ${ctx.company.name}`,
    ctx.company.description ? `Activité : ${ctx.company.description.slice(0, 1500)}` : null,
    ctx.company.references ? `Références : ${ctx.company.references.slice(0, 1500)}` : null,
    `Certifications déclarées : ${ctx.company.certifications.length ? ctx.company.certifications.join(", ") : "aucune renseignée"}`,
    ctx.company.employees ? `Effectif : ${ctx.company.employees}` : null,
    ctx.company.founded ? `Création : ${ctx.company.founded}` : null,
    `Avancement de la candidature : ${STAGE_LABEL[ctx.stage] ?? ctx.stage}`,
  ];
  return parts.filter(Boolean).join("\n");
}

const STAGE_LABEL: Record<string, string> = {
  DETECTED: "offre consultée, pas encore enregistrée",
  QUALIFIED: "à l'étude",
  INTERESTED: "gardée pour plus tard",
  RESPONSE_PREPARING: "en préparation",
  RESPONSE_SENT: "réponse déposée, en attente du résultat",
  DISCUSSION: "en discussion avec l'acheteur",
  NEGOTIATION: "en négociation",
  WON: "gagnée",
  LOST: "non retenue",
};

/** Nettoie la réponse (pas de mise en forme markdown dans l'interface). */
export function cleanAnswer(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Réponse à une question, avec les derniers échanges pour garder le fil. */
export async function askAssistant(
  context: string,
  history: { question: string; answer: string }[],
  question: string,
  client?: Pick<Anthropic, "messages">,
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY && !client) return null;
  const ai = client ?? new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const messages: Anthropic.MessageParam[] = [];
  history.forEach((h, i) => {
    // Le contexte (long) est joint au premier message : il reste identique d'une question à l'autre
    messages.push({ role: "user", content: i === 0 ? [{ type: "text", text: context, cache_control: { type: "ephemeral" } }, { type: "text", text: h.question }] : h.question });
    messages.push({ role: "assistant", content: h.answer });
  });
  messages.push({ role: "user", content: history.length ? question : [{ type: "text", text: context, cache_control: { type: "ephemeral" } }, { type: "text", text: question }] });
  const res = await ai.messages.create({ model: REPORT_MODEL, max_tokens: 1200, system: ASSISTANT_SYSTEM, messages });
  if (res.stop_reason === "refusal") return null;
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return text ? cleanAnswer(text).slice(0, 12_000) : null;
}
