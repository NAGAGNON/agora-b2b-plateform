import { z } from "zod";

/** Les membres du comité de direction. */
export const DIRECTORS = {
  DAF: {
    title: "Directeur financier",
    short: "DAF",
    focus:
      "les revenus, les abonnements payants, l'offre de lancement, le passage au payant et les coûts (envois d'e-mails, usage de l'intelligence artificielle). Tu défends la santé financière : prudent, exigeant, tu demandes un retour mesurable avant toute dépense.",
  },
  CMO: {
    title: "Directeur marketing et croissance",
    short: "CMO",
    focus:
      "les visites, Google et les articles, la prospection par e-mail, les inscriptions et leur provenance, la fidélité des inscrits. Tu défends la croissance : ambitieux mais tu proposes des tests limités et mesurables.",
  },
  CPO: {
    title: "Directeur produit",
    short: "CPO",
    focus:
      "l'usage réel du site par les membres : offres consultées, fiches de candidature, dossiers ouverts, travail commencé, questions à l'assistant, besoins publiés, ce qui est utilisé ou abandonné. Tu défends l'expérience des utilisateurs.",
  },
  CTO: {
    title: "Directeur technique",
    short: "CTO",
    focus:
      "le bon fonctionnement : tâches automatiques et étapes en échec, collecte des appels d'offres (sources, erreurs), échecs d'envoi d'e-mails et rebonds. Tu défends la stabilité : méthodique, tu contestes les délais irréalistes.",
  },
} as const;
export type DirectorKey = keyof typeof DIRECTORS;
export const DIRECTOR_KEYS = Object.keys(DIRECTORS) as DirectorKey[];
export const AUTHOR_LABEL: Record<string, string> = {
  DAF: "Directeur financier",
  CMO: "Directeur marketing",
  CPO: "Directeur produit",
  CTO: "Directeur technique",
  CEO: "CEO",
  FONDATEUR: "Vous (fondateur)",
  SYSTEME: "Système",
};

export const ProposalSchema = z.object({
  probleme: z.string().describe("Le problème ou l'opportunité, avec les chiffres qui le montrent"),
  decision: z.string().describe("La décision proposée, concrète et réalisable"),
  justification: z.string().describe("Pourquoi cette décision"),
  donnees: z.string().describe("Les chiffres utilisés, tels qu'ils figurent dans les données"),
  effet_attendu: z.string().describe("Ce qu'on peut raisonnablement espérer, sans promesse"),
  budget_eur: z.number().nullable().describe("Budget en euros si la décision coûte de l'argent, sinon null"),
  risques: z.string(),
  urgence: z.enum(["basse", "moyenne", "haute"]),
  indicateur: z.string().describe("Le chiffre à surveiller pour savoir si ça a marché"),
  cible: z.string().describe("Le résultat visé sur cet indicateur"),
  delai_jours: z.number().int().describe("Dans combien de jours vérifier le résultat (3 à 30)"),
});
export type Proposal = z.infer<typeof ProposalSchema>;

export const DirectorNoteSchema = z.object({
  constat: z.string().describe("2 à 4 phrases : ce que montrent les chiffres de ton domaine"),
  points: z.array(z.string()).describe("1 à 4 observations chiffrées"),
  propositions: z.array(ProposalSchema).describe("0 à 2 propositions ; aucune si rien ne le justifie"),
});
export type DirectorNote = z.infer<typeof DirectorNoteSchema>;

export const CritiqueSchema = z.object({
  critiques: z.array(
    z.object({
      ref: z.string().describe("La référence de la proposition (ex. P1)"),
      par: z.enum(["DAF", "CMO", "CPO", "CTO"]).describe("Le directeur qui critique (jamais l'auteur de la proposition)"),
      avis: z.enum(["favorable", "réservé", "défavorable"]),
      critique: z.string().describe("Les objections argumentées, 2 à 4 phrases"),
    }),
  ),
});

export const ArbitrageSchema = z.object({
  titre: z.string().describe("Le titre du comité du jour, une phrase"),
  message_au_fondateur: z.string().describe("3 à 6 phrases : l'essentiel de la situation et ce qui attend sa décision"),
  arbitrages: z.array(
    z.object({
      ref: z.string(),
      verdict: z.enum(["a_valider", "refusee", "plus_d_infos"]),
      raison: z.string().describe("La justification de l'arbitrage, 1 à 3 phrases"),
    }),
  ),
});
export type Arbitrage = z.infer<typeof ArbitrageSchema>;

export const STATUS: Record<string, { label: string; tone: "violet" | "orange" | "teal" | "rose" | "slate" | "navy" }> = {
  PROPOSEE: { label: "Proposée", tone: "slate" },
  A_VALIDER: { label: "À valider par vous", tone: "violet" },
  REFUSEE_CEO: { label: "Refusée par le CEO", tone: "slate" },
  PLUS_INFO: { label: "Plus d'infos demandées", tone: "orange" },
  VALIDEE: { label: "Validée", tone: "teal" },
  REFUSEE: { label: "Refusée par vous", tone: "rose" },
  EN_COURS: { label: "En cours", tone: "navy" },
  VERIFIEE: { label: "Vérifiée : réussie", tone: "teal" },
  ECHOUEE: { label: "Vérifiée : échec", tone: "rose" },
  ABANDONNEE: { label: "Abandonnée", tone: "slate" },
};

/** Ensemble des nombres présents dans les données (identifiants techniques exclus). */
export function allowedNumbers(...sources: unknown[]): Set<string> {
  const text = sources
    .map((s) => JSON.stringify(s))
    .join(" ")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, " ")
    .replace(/https?:\/\/[^"\s]+/g, " ");
  const set = new Set((text.match(/\d+(?:[.,]\d+)?/g) ?? []).flatMap((n) => [String(Number(n.replace(",", "."))), n.split(/[.,]/)[0]]));
  // Petits nombres d'énumération (« 2 propositions », « 3 jours ») et références P1, P2…
  for (let i = 0; i <= 10; i++) set.add(String(i));
  return set;
}

/** Nombres d'un texte absents des données (contrôle anti-invention). */
export function inventedNumbers(text: string, allowed: Set<string>): string[] {
  const clean = text.replace(/\bP\d+\b/g, " ").replace(/(\d)[\s  ](?=\d{3}\b)/g, "$1");
  const found = (clean.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => String(Number(n.replace(",", "."))));
  return [...new Set(found.filter((n) => !allowed.has(n) && !allowed.has(n.split(".")[0])))];
}

/** Champs d'une proposition qui doivent reposer sur les données (les cibles et budgets sont des objectifs). */
export const proposalFactText = (p: Proposal) => [p.probleme, p.justification, p.donnees].join(" ");
export const noteFactText = (n: Pick<DirectorNote, "constat" | "points">) => [n.constat, ...n.points].join(" ");
