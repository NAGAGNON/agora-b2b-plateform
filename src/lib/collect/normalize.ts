import { createHash } from "node:crypto";
import type { OpportunityType } from "@/lib/constants";

/** Opportunité externe normalisée, indépendante de la source. */
export type NormalizedOpportunity = {
  externalId: string;
  type: Extract<OpportunityType, "PUBLIC_TENDER" | "EXTERNAL_OPPORTUNITY">;
  title: string;
  summary: string | null;
  description: string;
  buyer: string | null;
  originalUrl: string;
  publishedAt: string | null; // AAAA-MM-JJ
  deadline: string | null; // ISO 8601
  departmentCode: string | null;
  city: string | null;
  cpv: string[];
  keywords: string[];
  sectorSlug: string | null;
  status: "ACTIVE" | "CANCELLED";
};

export type MapResult = { ok: true; item: NormalizedOpportunity } | { ok: false; reason: string };

const STOPWORDS = new Set([
  "le", "la", "les", "de", "des", "du", "d", "l", "un", "une", "et", "en", "a", "au", "aux", "pour", "par", "sur", "avec",
  "dans", "ou", "the", "of", "and", "for", "marche", "marches", "lot", "lots", "accord", "cadre", "prestations", "prestation",
]);

/** Minuscules, sans accents, sans ponctuation, espaces normalisés. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokens(s: string): Set<string> {
  return new Set(
    normalizeText(s)
      .split(" ")
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Similarité de Jaccard entre deux titres (0 à 1). */
export function titleSimilarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Clé de rapprochement entre sources : acheteur normalisé + date limite (jour).
 * Les candidats partageant cette clé sont ensuite comparés sur le titre.
 */
export function dedupKey(buyer: string | null, deadline: string | null): string | null {
  const b = normalizeText(buyer)
    .split(" ")
    .filter((t) => !STOPWORDS.has(t))
    .join(" ")
    .slice(0, 60);
  if (!b || !deadline) return null;
  return `${b}|${deadline.slice(0, 10)}`;
}

export const DUPLICATE_TITLE_THRESHOLD = 0.5;

/**
 * Même consultation publiée par deux sources ? (dates limites déjà identiques)
 * Titre proche ET acheteur proche (les intitulés d'acheteur varient d'une source à
 * l'autre : « Syndicat mixte du Planétarium » / « … de Bretagne »), ou titre quasi identique.
 */
export function isSameConsultation(a: { title: string; buyer: string | null }, b: { title: string; buyer: string | null }): boolean {
  const t = titleSimilarity(a.title, b.title);
  if (t >= 0.8) return true;
  if (t < DUPLICATE_TITLE_THRESHOLD || !a.buyer || !b.buyer) return false;
  const ba = normalizeText(a.buyer);
  const bb = normalizeText(b.buyer);
  return titleSimilarity(ba, bb) >= 0.5 || ba.includes(bb) || bb.includes(ba);
}

/** Empreinte du contenu pour détecter les modifications d'une annonce. */
export function contentHash(item: NormalizedOpportunity): string {
  const stable = [item.title, item.summary, item.description, item.buyer, item.deadline, item.departmentCode, item.originalUrl, item.status].join("\u0001");
  return createHash("sha256").update(stable).digest("hex").slice(0, 32);
}

export function cleanString(v: unknown, max = 500): string | null {
  if (v === null || v === undefined) return null;
  const s = (Array.isArray(v) ? v.join(", ") : String(v)).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

export function asArray(v: unknown): string[] {
  if (v === null || v === undefined || v === "") return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  return String(v)
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Date AAAA-MM-JJ ou ISO → ISO (fin de journée heure de Paris si sans heure). */
export function toIsoDeadline(v: unknown): string | null {
  const s = cleanString(v, 40);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T23:59:00+01:00`).toISOString();
  // Format TED : date suivie du fuseau, sans heure (« 2026-10-23+02:00 »)
  const dateTz = s.match(/^(\d{4}-\d{2}-\d{2})([+-]\d{2}:\d{2}|Z)$/);
  if (dateTz) return new Date(`${dateTz[1]}T23:59:00${dateTz[2]}`).toISOString();
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})/);
  const d = new Date(compact && !s.includes("-") ? `${compact[1]}-${compact[2]}-${compact[3]}T23:59:00+01:00` : s.replace(/([+-]\d{2}:\d{2})Z?$/, "$1"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toDate(v: unknown): string | null {
  const iso = toIsoDeadline(v);
  return iso ? iso.slice(0, 10) : null;
}

export function isSafeUrl(u: string | null): u is string {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
