import { PAGE_SIZE, type CompanyKind, type CompanySize, type OpportunityOrigin, type OpportunityType } from "@/lib/constants";
import { splitList } from "@/lib/format";
import { regionBySlug, slugify } from "@/lib/geo";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const ALL_TYPES: OpportunityType[] = ["NEED", "QUOTE_REQUEST", "PRIVATE_CONSULTATION", "PRIVATE_TENDER", "EXTERNAL_OPPORTUNITY", "PUBLIC_TENDER"];
const SIZES: CompanySize[] = ["INDEPENDANT", "TPE", "PME", "ETI", "GE"];
const SORTS = ["recent", "deadline", "relevance", "distance"] as const;
export type SortKey = (typeof SORTS)[number];

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== "" ? s.trim() : undefined;
}
function all(v: string | string[] | undefined): string[] {
  return (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
}

export type OpportunityFilters = {
  q?: string;
  sector?: string;
  /** Slug de région (France entière si absent) */
  region?: string;
  department?: string;
  /** Ville ou code postal saisi librement */
  city?: string;
  place?: string;
  radius?: number;
  /** Code de la source externe */
  source?: string;
  types: OpportunityType[];
  status: "OPEN" | "CLOSED" | "ALL";
  origin?: OpportunityOrigin;
  publishedSince?: string;
  publishedWithin?: string;
  deadlineBefore?: string;
  size?: CompanySize;
  skills: string[];
  sort: SortKey;
  page: number;
};

/** Lit et valide les filtres de recherche depuis l'URL (valeurs inconnues ignorées). */
export function parseOpportunityFilters(sp: RawSearchParams, now: Date = new Date()): OpportunityFilters {
  const sector = first(sp.secteur);
  const department = first(sp.departement);
  const radiusRaw = Number(first(sp.rayon));
  const types = all(sp.type).filter((t): t is OpportunityType => ALL_TYPES.includes(t as OpportunityType));
  const statusRaw = first(sp.statut);
  const originRaw = first(sp.origine);
  const within = first(sp.publiee);
  let publishedSince: string | undefined;
  if (within && ["7", "30", "90"].includes(within)) {
    publishedSince = new Date(now.getTime() - Number(within) * 86_400_000).toISOString().slice(0, 10);
  }
  const deadline = first(sp.echeance);
  const sortRaw = first(sp.tri);
  const pageRaw = Number(first(sp.page));
  const sizeRaw = first(sp.taille);
  const q = first(sp.q)?.slice(0, 200);
  // Ville saisie librement (« Saint-Malo ») ou identifiant (« saint-malo »)
  const placeRaw = first(sp.lieu);
  const place = placeRaw && /^[\p{L}0-9' ’-]{2,80}$/u.test(placeRaw) ? slugify(placeRaw) : undefined;
  const region = first(sp.region);
  const city = first(sp.ville)?.slice(0, 80);
  const source = first(sp.source);
  return {
    q,
    region: region && regionBySlug(region) ? region : undefined,
    city: city && /^[\p{L}0-9' -]{2,80}$/u.test(city) ? city : undefined,
    source: source && /^[a-z0-9-]{2,40}$/.test(source) ? source : undefined,
    sector: sector && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sector) && sector.length <= 60 ? sector : undefined,
    department: department && /^(\d{2,3}|2[AB])$/.test(department) ? department : undefined,
    place: place && place.length >= 2 ? place : undefined,
    radius: Number.isFinite(radiusRaw) && radiusRaw > 0 ? Math.min(Math.round(radiusRaw), 500) : undefined,
    types,
    status: statusRaw === "CLOSED" || statusRaw === "ALL" ? statusRaw : "OPEN",
    origin: originRaw === "INTERNAL" || originRaw === "EXTERNAL" ? originRaw : undefined,
    publishedSince,
    publishedWithin: publishedSince ? within : undefined,
    deadlineBefore: deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : undefined,
    size: SIZES.includes(sizeRaw as CompanySize) ? (sizeRaw as CompanySize) : undefined,
    skills: splitList(first(sp.competences), 10),
    sort: SORTS.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : q ? "relevance" : "recent",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 500) : 1,
  };
}

export function filtersToRpcArgs(f: OpportunityFilters, pageSize = PAGE_SIZE) {
  return {
    p_q: f.q,
    p_sector: f.sector,
    p_department: f.department,
    p_region: f.region ? regionBySlug(f.region)?.name : undefined,
    p_city: f.city,
    p_source: f.source,
    p_place: f.place,
    p_radius_km: f.place ? f.radius : undefined,
    p_types: f.types.length ? f.types : undefined,
    p_status: f.status,
    p_origin: f.origin,
    p_published_since: f.publishedSince,
    p_deadline_before: f.deadlineBefore,
    p_company_size: f.size,
    p_skills: f.skills.length ? f.skills : undefined,
    p_sort: f.sort,
    p_limit: pageSize,
    p_offset: (f.page - 1) * pageSize,
  };
}

/** Nombre de filtres actifs (hors recherche texte, tri et page). */
export function activeFilterCount(f: OpportunityFilters): number {
  return [f.sector, f.region, f.department, f.city, f.source, f.place, f.origin, f.publishedSince, f.deadlineBefore, f.size].filter(Boolean).length +
    (f.types.length ? 1 : 0) + (f.skills.length ? 1 : 0) + (f.status !== "OPEN" ? 1 : 0);
}

export type CompanyFilters = { q?: string; sector?: string; department?: string; kind?: CompanyKind; size?: CompanySize; skills: string[]; page: number };

export function parseCompanyFilters(sp: RawSearchParams): CompanyFilters {
  const sector = first(sp.secteur);
  const department = first(sp.departement);
  const kind = first(sp.type);
  const size = first(sp.taille);
  const pageRaw = Number(first(sp.page));
  return {
    q: first(sp.q)?.slice(0, 200),
    sector: sector && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sector) && sector.length <= 60 ? sector : undefined,
    department: department && /^(\d{2,3}|2[AB])$/.test(department) ? department : undefined,
    kind: kind === "SUPPLIER" || kind === "BUYER" || kind === "BOTH" ? kind : undefined,
    size: SIZES.includes(size as CompanySize) ? (size as CompanySize) : undefined,
    skills: splitList(first(sp.competences), 10),
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 500) : 1,
  };
}
