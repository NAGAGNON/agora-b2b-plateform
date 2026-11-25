import { z } from "zod";

/**
 * Parcours de préparation en 7 étapes : réponses de l'entreprise, enregistrées par dossier
 * (pipeline_items.journey). Rien n'est déduit à sa place : c'est elle qui indique ce qu'elle a.
 */
export const CHECK_STATUSES = ["yes", "no", "check", "na"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export const CHECK_LABEL: Record<CheckStatus, string> = { yes: "Je l'ai", no: "Il me manque", check: "À vérifier", na: "Ne me concerne pas" };

const Check = z.object({ s: z.enum(CHECK_STATUSES), note: z.string().trim().max(300).optional() });
export const ChecksSchema = z.record(z.string().min(1).max(200), Check).refine((r) => Object.keys(r).length <= 30);
export type Checks = z.infer<typeof ChecksSchema>;

/** Étape 3 : les moyens de l'entreprise (toujours les mêmes rubriques, simples). */
export const CAPACITIES = [
  { key: "team", label: "Équipe disponible pour ce travail" },
  { key: "equipment", label: "Matériel et équipements" },
  { key: "skills", label: "Savoir-faire technique demandé" },
  { key: "cash", label: "Trésorerie pour avancer les frais" },
  { key: "delay", label: "Délais tenables" },
  { key: "partner", label: "Partenaire ou sous-traitant si besoin" },
] as const;

export const SUBMISSION_STATUSES = ["preparing", "ready", "submitted", "dropped"] as const;
export const SUBMISSION_LABEL: Record<(typeof SUBMISSION_STATUSES)[number], string> = {
  preparing: "Préparation en cours",
  ready: "Dossier prêt",
  submitted: "Candidature déposée",
  dropped: "Je ne réponds plus",
};
export const SubmissionSchema = z.object({
  status: z.enum(SUBMISSION_STATUSES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  platform: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(120).optional(),
});
export type Submission = z.infer<typeof SubmissionSchema>;

/** Étape 7 : suivi du résultat (historique, le plus récent en dernier). */
export const RESULT_STATUSES = ["waiting", "more_info", "review", "accepted", "rejected", "other_winner", "unknown"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];
export const RESULT_LABEL: Record<ResultStatus, string> = {
  waiting: "En attente de réponse",
  more_info: "Demande de complément",
  review: "En cours d'analyse",
  accepted: "Candidature retenue",
  rejected: "Candidature non retenue",
  other_winner: "Marché attribué à une autre entreprise",
  unknown: "Résultat inconnu",
};
export const ResultSchema = z.object({
  status: z.enum(RESULT_STATUSES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  comment: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(300).optional(),
  amount: z.number().nonnegative().max(1e10).optional(),
});
export type ResultEntry = z.infer<typeof ResultSchema> & { at: string };

export type Journey = { eligibility?: Checks; capacities?: Checks; submission?: Submission; results?: ResultEntry[] };

export function readJourney(v: unknown): Journey {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const checks = (x: unknown) => (ChecksSchema.safeParse(x).success ? (x as Checks) : undefined);
  const sub = SubmissionSchema.safeParse(o.submission);
  const results = Array.isArray(o.results) ? (o.results.filter((r) => ResultSchema.safeParse(r).success && typeof (r as ResultEntry).at === "string") as ResultEntry[]) : [];
  return { eligibility: checks(o.eligibility), capacities: checks(o.capacities), submission: sub.success ? sub.data : undefined, results };
}

/** Résumé d'une liste de vérifications : combien j'ai, il me manque, à vérifier. */
export function checkSummary(keys: string[], c: Checks | undefined) {
  const n = { yes: 0, no: 0, check: 0, na: 0, open: 0 };
  for (const k of keys) {
    const s = c?.[k]?.s;
    if (s) n[s]++;
    else n.open++;
  }
  return n;
}
