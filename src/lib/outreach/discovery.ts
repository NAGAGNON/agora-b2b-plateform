/**
 * Découverte d'entreprises par l'API publique « Recherche d'entreprises »
 * (https://recherche-entreprises.api.gouv.fr — données SIRENE de l'INSEE,
 * Licence Ouverte 2.0, accès libre sans clé, limite 7 requêtes/seconde).
 *
 * Seules des informations professionnelles sont conservées : dénomination,
 * SIREN/SIRET, code NAF, adresse du siège, tranche d'effectif. Les noms des
 * dirigeants ne sont PAS conservés. Cette source ne fournit pas d'adresse
 * e-mail : un prospect découvert ainsi n'est contactable qu'après ajout d'une
 * adresse professionnelle issue d'une source autorisée (import, saisie).
 */

export const DISCOVERY_SOURCE = "API Recherche d'entreprises (SIRENE — INSEE, Licence Ouverte 2.0)";
const BASE = "https://recherche-entreprises.api.gouv.fr/search";

export type DiscoveredCompany = {
  name: string;
  siren: string;
  siret: string | null;
  naf_code: string | null;
  city: string | null;
  postal_code: string | null;
  department_code: string | null;
  size_range: string | null;
  is_individual_entrepreneur: boolean;
  source_ref: string;
};

type ApiCompany = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string | null;
  activite_principale?: string | null;
  tranche_effectif_salarie?: string | null;
  nature_juridique?: string | null;
  etat_administratif?: string | null;
  complements?: { est_entrepreneur_individuel?: boolean | null } | null;
  siege?: {
    siret?: string | null;
    code_postal?: string | null;
    libelle_commune?: string | null;
    commune?: string | null;
    departement?: string | null;
    activite_principale?: string | null;
    etat_administratif?: string | null;
  } | null;
};

/** Tranches d'effectif INSEE → libellé. */
const SIZE: Record<string, string> = {
  "00": "0 salarié", "01": "1 à 2 salariés", "02": "3 à 5 salariés", "03": "6 à 9 salariés", "11": "10 à 19 salariés",
  "12": "20 à 49 salariés", "21": "50 à 99 salariés", "22": "100 à 199 salariés", "31": "200 à 249 salariés", "32": "250 à 499 salariés",
  "41": "500 à 999 salariés", "42": "1 000 à 1 999 salariés", "51": "2 000 à 4 999 salariés", "52": "5 000 à 9 999 salariés", "53": "10 000 salariés et plus",
};

export function mapApiCompany(c: ApiCompany): DiscoveredCompany | null {
  if (!c.siren || !/^\d{9}$/.test(c.siren)) return null;
  if ((c.etat_administratif ?? "A") !== "A" || (c.siege?.etat_administratif ?? "A") !== "A") return null;
  const name = (c.nom_raison_sociale || c.nom_complet || "").trim();
  if (!name) return null;
  const ei = Boolean(c.complements?.est_entrepreneur_individuel) || c.nature_juridique === "1000";
  return {
    name: name.slice(0, 200),
    siren: c.siren,
    siret: c.siege?.siret && /^\d{14}$/.test(c.siege.siret) ? c.siege.siret : null,
    naf_code: c.siege?.activite_principale ?? c.activite_principale ?? null,
    city: c.siege?.libelle_commune ?? null,
    postal_code: c.siege?.code_postal ?? null,
    department_code: c.siege?.departement ?? null,
    size_range: c.tranche_effectif_salarie ? (SIZE[c.tranche_effectif_salarie] ?? null) : null,
    is_individual_entrepreneur: ei,
    source_ref: `SIREN ${c.siren}`,
  };
}

/**
 * Entreprises actives d'un code NAF dans un département (une page de résultats).
 * `fetchImpl` permet les tests sans réseau.
 */
export async function discoverCompanies(
  naf: string,
  department: string,
  { page = 1, perPage = 25, fetchImpl = fetch }: { page?: number; perPage?: number; fetchImpl?: typeof fetch } = {},
): Promise<{ companies: DiscoveredCompany[]; totalPages: number }> {
  const url = `${BASE}?activite_principale=${encodeURIComponent(naf)}&departement=${encodeURIComponent(department)}&etat_administratif=A&per_page=${perPage}&page=${page}`;
  const res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": "LinkProB2B-Outreach/1.0 (+https://www.linkprob2b.com)" }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 429) throw new Error("Limite de requêtes de l'API atteinte (429)");
  if (!res.ok) throw new Error(`API Recherche d'entreprises : HTTP ${res.status}`);
  const body = (await res.json()) as { results?: ApiCompany[]; total_pages?: number };
  const companies = (body.results ?? []).map(mapApiCompany).filter((c): c is DiscoveredCompany => c !== null);
  return { companies, totalPages: body.total_pages ?? 1 };
}
