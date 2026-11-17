import { SECTORS } from "@/lib/constants";
import { GUIDES } from "@/content/guides";
import { siteUrl } from "@/lib/seo";

// Présentation du site pour les assistants IA (ChatGPT, Perplexity…), au format llms.txt
export const revalidate = 86400;

export function GET() {
  const base = siteUrl();
  const text = `# LinkProB2B

> Plateforme française qui aide les entreprises (artisans, TPE, PME) à trouver des marchés : appels d'offres publics (BOAMP, TED) et besoins publiés par des entreprises, partout en France, mis à jour chaque jour. Chaque appel d'offres est expliqué en langage simple, avec un guide étape par étape pour répondre. Inscription gratuite.

## Ce que l'on trouve sur LinkProB2B
- [Appels d'offres et opportunités](${base}/opportunites) : marchés publics et besoins d'entreprises, par métier, région et département, avec alertes gratuites par e-mail.
- [Entreprises disponibles](${base}/disponibilites) : des entreprises annoncent ce qu'elles peuvent faire, où et à partir de quand ; on les contacte par la messagerie.
- [Annuaire des entreprises](${base}/entreprises) : prestataires, sous-traitants et partenaires par métier et par zone.
- [Acheteurs publics](${base}/acheteurs) : les acheteurs et leurs appels d'offres.
- [Publier un besoin](${base}/publier) : une entreprise décrit ce qu'elle cherche et reçoit des réponses de prestataires.
- [Analyses des marchés](${base}/analyses) : articles tirés des données des appels d'offres.

## Appels d'offres par métier
${SECTORS.map((s) => `- [${s.label}](${base}/opportunites/${s.slug})`).join("\n")}

## Guides en langage simple
${GUIDES.map((g) => `- [${g.title}](${base}/ressources/${g.slug}) : ${g.description}`).join("\n")}

## Pour comprendre le service
- [Comment ça marche](${base}/comment-ca-marche)
- [Pour les fournisseurs](${base}/fournisseurs)
- [Pour les demandeurs](${base}/demandeurs)
- [Questions fréquentes](${base}/faq)
- [Tarifs](${base}/tarifs)
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
