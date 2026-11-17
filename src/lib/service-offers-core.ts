import { z } from "zod";

/**
 * Disponibilités : une entreprise annonce ce qu'elle peut faire, où et quand. Règles communes au
 * formulaire, aux pages et aux tests (aucun accès à la base ici).
 */

/** Coordonnées écrites dans le texte (les échanges passent par la messagerie du site). */
export function contactInfoIn(text: string | null | undefined): "email" | "phone" | null {
  const t = text ?? "";
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t)) return "email";
  if (/(?:\+33[\s.-]?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/.test(t)) return "phone";
  return null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const optionalDay = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || DAY.test(v), "Date invalide")
  .transform((v) => v || null);

/** Aujourd'hui à Paris (AAAA-MM-JJ). */
export const parisDay = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);

export const serviceOfferSchema = z
  .object({
    title: z.string().trim().min(5, "Au moins 5 caractères").max(140, "140 caractères au plus"),
    description: z.string().trim().min(20, "Décrivez en quelques phrases ce que vous pouvez faire (20 caractères au moins)").max(3000, "3 000 caractères au plus"),
    sector_slug: optionalText(80),
    department_code: optionalText(3),
    city: optionalText(120),
    nationwide: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    available_from: optionalDay,
    available_until: optionalDay,
    capacity: optionalText(140),
  })
  .superRefine((d, ctx) => {
    for (const key of ["title", "description", "capacity"] as const) {
      const found = contactInfoIn(d[key]);
      if (found)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Retirez ${found === "email" ? "l'adresse e-mail" : "le numéro de téléphone"} : les entreprises vous écrivent par la messagerie du site.`,
        });
    }
    if (!d.nationwide && !d.department_code) ctx.addIssue({ code: "custom", path: ["department_code"], message: "Choisissez un département, ou « Toute la France »." });
    if (d.available_until && d.available_until < parisDay()) ctx.addIssue({ code: "custom", path: ["available_until"], message: "Cette date est déjà passée." });
    if (d.available_from && d.available_until && d.available_until < d.available_from) ctx.addIssue({ code: "custom", path: ["available_until"], message: "La fin doit être après le début." });
  });
export type ServiceOfferInput = z.output<typeof serviceOfferSchema>;

const frDay = (day: string, today: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}), timeZone: "UTC" });

/** « Disponible dès maintenant », « Disponible à partir du 3 décembre », « … jusqu'au 20 janvier 2027 ». */
export function availabilityLabel(from: string | null, until: string | null, today = parisDay()): string {
  const start = !from || from <= today ? "Disponible dès maintenant" : `Disponible à partir du ${frDay(from, today)}`;
  return until ? `${start}, jusqu'au ${frDay(until, today)}` : start;
}

/** « Toute la France », « Finistère (29) · Brest ». */
export function zoneLabel(o: { nationwide: boolean; department_code: string | null; city: string | null }, departmentName?: string | null): string {
  if (o.nationwide) return "Toute la France";
  const dep = o.department_code ? `${departmentName ?? "Département"} (${o.department_code})` : null;
  return [dep, o.city].filter(Boolean).join(" · ") || "Zone non précisée";
}

/** État d'une disponibilité pour son entreprise. */
export function offerState(o: { status: string; expires_at: string }, now = new Date()): "online" | "expired" | "archived" | "removed" {
  if (o.status === "REMOVED") return "removed";
  if (o.status === "ARCHIVED") return "archived";
  return new Date(o.expires_at) > now ? "online" : "expired";
}
