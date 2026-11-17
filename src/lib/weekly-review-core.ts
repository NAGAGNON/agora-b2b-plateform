import { z } from "zod";

/** Résumé rédigé par l'Analyste du lundi. */
export const WeeklySummarySchema = z.object({
  titre: z.string().describe("Une phrase qui résume la semaine, en français simple"),
  points: z
    .array(
      z.object({
        tendance: z.enum(["hausse", "baisse", "stable", "alerte"]),
        texte: z.string().describe("Un constat chiffré, une ou deux phrases"),
      }),
    )
    .describe("3 à 5 constats, du plus important au moins important"),
  actions: z.array(z.string()).describe("1 à 3 actions concrètes pour la semaine qui commence"),
});
export type WeeklySummary = z.infer<typeof WeeklySummarySchema>;

export type WeeklyMetric = { cle: string; libelle: string; semaine: number; precedente: number };
export type WeeklyFacts = { semaine: { du: string; au: string }; precedente: { du: string; au: string }; chiffres: WeeklyMetric[] };

const DAY = 86_400_000;
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Jour (AAAA-MM-JJ) décalé de `n` jours. */
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/**
 * Semaine analysée : du lundi au dimanche précédant le lundi de la semaine en cours (heure de Paris),
 * et la semaine d'avant pour la comparaison. Renvoie des jours AAAA-MM-JJ.
 */
export function weekDays(now: Date) {
  const today = ymd(now);
  const dow = WEEKDAYS.indexOf(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(now));
  const thisMonday = addDays(today, -dow);
  const start = addDays(thisMonday, -7);
  return { start, end: addDays(start, 6), prevStart: addDays(start, -7), prevEnd: addDays(start, -1), nextMonday: thisMonday };
}

/** Évolution en % (null si la semaine d'avant est à 0). */
export function variation(m: Pick<WeeklyMetric, "semaine" | "precedente">): number | null {
  return m.precedente > 0 ? Math.round(((m.semaine - m.precedente) / m.precedente) * 100) : null;
}

/** Nombres écrits dans le résumé mais absents des faits (contrôle anti-invention). */
export function unknownNumbers(s: WeeklySummary, facts: WeeklyFacts): string[] {
  const allowed = new Set<string>();
  const add = (v: number | null) => v !== null && allowed.add(String(Math.abs(v)));
  for (const m of facts.chiffres) {
    add(m.semaine);
    add(m.precedente);
    add(m.semaine - m.precedente);
    add(variation(m));
  }
  for (const d of [facts.semaine.du, facts.semaine.au, facts.precedente.du, facts.precedente.au]) d.split("-").forEach((x) => allowed.add(String(Number(x))));
  const text = [s.titre, ...s.points.map((p) => p.texte), ...s.actions].join(" ").replace(/(\d)[\s  ](?=\d{3}\b)/g, "$1");
  const found = (text.match(/\d+/g) ?? []).map((n) => String(Number(n)));
  return [...new Set(found.filter((n) => !allowed.has(n)))];
}

/** « 9 novembre ». */
export const frDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).replace(/^1 /, "1er ");
/** « du 9 au 15 novembre ». */
export const frWeek = (w: { du: string; au: string }) => `du ${frDay(w.du)} au ${frDay(w.au)}`;

const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Résumé de secours, calculé directement à partir des chiffres (si la rédaction échoue). */
export function fallbackSummary(facts: WeeklyFacts): WeeklySummary {
  const ranked = facts.chiffres
    .filter((m) => m.semaine > 0 || m.precedente > 0)
    .map((m) => ({ m, delta: m.semaine - m.precedente, v: variation(m) }))
    .sort((a, b) => Math.abs(b.v ?? (b.delta ? 100 : 0)) - Math.abs(a.v ?? (a.delta ? 100 : 0)));
  const points = ranked.slice(0, 5).map(({ m, delta, v }) => ({
    tendance: (delta > 0 ? "hausse" : delta < 0 ? "baisse" : "stable") as WeeklySummary["points"][number]["tendance"],
    texte: `${m.libelle} : ${m.semaine} cette semaine contre ${m.precedente} la semaine d'avant${v !== null && delta !== 0 ? ` (${delta > 0 ? "+" : "−"}${Math.abs(v)} %)` : ""}.`,
  }));
  const signups = facts.chiffres.find((m) => m.cle === "inscrits");
  return {
    titre: !signups ? "Bilan de la semaine." : signups.semaine === 0 ? "Aucun nouvel inscrit cette semaine." : `${pl(signups.semaine, "nouvel inscrit", "nouveaux inscrits")} cette semaine.`,
    points: points.length ? points : [{ tendance: "stable", texte: "Aucune activité mesurée cette semaine." }],
    actions: [],
  };
}

/** Jour calendaire à Paris (AAAA-MM-JJ) d'un horodatage. */
export const parisDate = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
