/**
 * Sélection des opportunités de la veille : uniquement des annonces réelles, ouvertes et publiques,
 * choisies selon les critères explicitement renseignés (préférences de veille), à défaut les
 * données professionnelles réelles (secteurs et région de l'entreprise), sinon une sélection
 * générale récente et variée. Jamais d'annonce déjà envoyée au même destinataire.
 */
export type VeilleOpportunity = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  sector_slug: string | null;
  region: string | null;
  department_code: string | null;
  city: string | null;
  type: string;
  published_at: string | null;
  response_deadline: string | null;
  origin: string;
  external_buyer_name: string | null;
  source: string | null;
};

export type VeilleCriteria = { sectors: string[]; regions: string[]; types: string[]; keywords: string[] };
export type CriteriaBasis = "preferences" | "entreprise" | null;

export type AudienceMember = {
  user_id: string;
  email: string;
  full_name: string;
  frequency: string;
  sectors: string[];
  regions: string[];
  types: string[];
  keywords: string[];
  company_name: string | null;
  company_sectors: string[];
  company_region: string | null;
  consent: string;
};

export const MAX_ITEMS = 10;
/** Newsletter : en dessous de ce nombre d'annonces pertinentes, rien n'est envoyé à la personne. */
export const MIN_NEWSLETTER_ITEMS = 3;
export const MIN_DAILY_ITEMS = 1;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function criteriaFor(m: Pick<AudienceMember, "sectors" | "regions" | "types" | "keywords" | "company_sectors" | "company_region">): { criteria: VeilleCriteria; basis: CriteriaBasis } {
  const explicit = { sectors: m.sectors ?? [], regions: m.regions ?? [], types: m.types ?? [], keywords: (m.keywords ?? []).map((k) => k.trim()).filter((k) => k.length >= 2) };
  if (explicit.sectors.length || explicit.regions.length || explicit.types.length || explicit.keywords.length) return { criteria: explicit, basis: "preferences" };
  if (m.company_sectors?.length) return { criteria: { sectors: m.company_sectors, regions: m.company_region ? [m.company_region] : [], types: [], keywords: [] }, basis: "entreprise" };
  return { criteria: { sectors: [], regions: [], types: [], keywords: [] }, basis: null };
}

/** Score d'une annonce pour des critères ; null si elle ne correspond pas. */
export function matchScore(o: VeilleOpportunity, c: VeilleCriteria): number | null {
  let score = 0;
  if (c.sectors.length) {
    if (!o.sector_slug || !c.sectors.includes(o.sector_slug)) return null;
    score += 3;
  }
  if (c.regions.length) {
    if (!o.region || !c.regions.includes(o.region)) return null;
    score += 2;
  }
  if (c.types.length) {
    if (!c.types.includes(o.type)) return null;
    score += 1;
  }
  if (c.keywords.length) {
    const text = norm(`${o.title} ${o.summary ?? ""} ${(o.description ?? "").slice(0, 1500)}`);
    const hits = c.keywords.filter((k) => text.includes(norm(k))).length;
    // Mots-clés seuls : au moins un doit apparaître ; sinon ils départagent seulement
    if (!hits && !c.sectors.length && !c.regions.length && !c.types.length) return null;
    score += hits * 3;
  }
  return score;
}

const dedupKey = (o: VeilleOpportunity) => norm(`${o.title}|${o.external_buyer_name ?? ""}`).replace(/[^a-z0-9|]+/g, " ").trim();

/** Annonces encore valables : ouvertes au moins jusqu'à après-demain, source citée si externe, sans doublon. */
export function cleanPool(pool: VeilleOpportunity[], now = new Date()): VeilleOpportunity[] {
  const limit = now.getTime() + 2 * 86_400_000;
  const seen = new Set<string>();
  const out: VeilleOpportunity[] = [];
  for (const o of pool) {
    if (o.response_deadline && new Date(o.response_deadline).getTime() < limit) continue;
    if (o.origin === "EXTERNAL" && !o.source) continue;
    if (o.title.trim().length < 8) continue;
    const k = dedupKey(o);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

const recent = (a: VeilleOpportunity, b: VeilleOpportunity) => (b.published_at ?? "").localeCompare(a.published_at ?? "");

export function selectOpportunities(pool: VeilleOpportunity[], c: VeilleCriteria, basis: CriteriaBasis, exclude: Set<string>, max = MAX_ITEMS): VeilleOpportunity[] {
  const available = pool.filter((o) => !exclude.has(o.id));
  if (basis) {
    return available
      .map((o) => ({ o, s: matchScore(o, c) }))
      .filter((x): x is { o: VeilleOpportunity; s: number } => x.s !== null)
      .sort((a, b) => b.s - a.s || recent(a.o, b.o))
      .slice(0, max)
      .map((x) => x.o);
  }
  // Sélection générale : récentes, avec résumé et date limite de préférence, 2 au plus par secteur
  const ranked = [...available].sort((a, b) => Number(Boolean(b.summary && b.response_deadline)) - Number(Boolean(a.summary && a.response_deadline)) || recent(a, b));
  const perSector = new Map<string, number>();
  const out: VeilleOpportunity[] = [];
  for (const o of ranked) {
    const k = o.sector_slug ?? "autre";
    if ((perSector.get(k) ?? 0) >= 2) continue;
    perSector.set(k, (perSector.get(k) ?? 0) + 1);
    out.push(o);
    if (out.length >= max) break;
  }
  return out;
}
