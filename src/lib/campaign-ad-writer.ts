import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { REPORT_MODEL } from "@/lib/daily-report";
import { AD_LIMITS, adIssues } from "@/lib/visibility";

export type Ad = { title: string; points: string[]; text: string };

export const AD_WRITER_SYSTEM = `Tu améliores l'annonce d'une entreprise française (artisan, TPE, PME) qui sera présentée par e-mail à d'autres entreprises.
Règles absolues :
- Garde STRICTEMENT les faits donnés : n'invente aucun chiffre, aucune certification, aucun client, aucune année, aucune garantie, aucun délai.
- Français simple, clair et professionnel, vouvoiement, phrases courtes. Pas de majuscules d'insistance, pas d'emoji, pas de superlatifs (« meilleur », « n°1 »).
- Aucun lien, aucune adresse e-mail, aucun numéro de téléphone (le contact passe par la messagerie du site).
- Titre : ${AD_LIMITS.title} caractères au plus, dit ce que fait l'entreprise et où. Points forts : au plus 3, ${AD_LIMITS.point} caractères chacun, uniquement tirés du texte fourni. Présentation : ${AD_LIMITS.text} caractères au plus.
Réponds uniquement en JSON : {"title": "...", "points": ["..."], "text": "..."}.`;

/** Version claire de l'annonce, sans rien inventer ; null si la réponse n'est pas exploitable ou enfreint les règles. */
export async function improveAd(ad: Ad, ctx: { company: string; city: string | null; objective: string }, client?: Pick<Anthropic, "messages">): Promise<Ad | null> {
  if (!process.env.ANTHROPIC_API_KEY && !client) return null;
  const ai = client ?? new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const res = await ai.messages.create({
    model: REPORT_MODEL,
    max_tokens: 700,
    system: AD_WRITER_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify({ entreprise: ctx.company, ville: ctx.city, objectif: ctx.objective, annonce: ad }) }],
  });
  const raw = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    const p = JSON.parse(json) as Partial<Ad>;
    const out: Ad = {
      title: String(p.title ?? "").trim().slice(0, AD_LIMITS.title),
      points: (Array.isArray(p.points) ? p.points : []).map((x) => String(x).trim().slice(0, AD_LIMITS.point)).filter(Boolean).slice(0, 3),
      text: String(p.text ?? "").trim().slice(0, AD_LIMITS.text),
    };
    if (out.title.length < 5 || adIssues(out).length) return null;
    return out;
  } catch {
    return null;
  }
}
