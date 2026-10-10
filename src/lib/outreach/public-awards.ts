import type { Db } from "@/lib/outreach/data";
import { logServerError } from "@/lib/errors";

/**
 * Ciblage Outreach : entreprises qui répondent régulièrement aux appels d'offres publics.
 *
 *  - Profils visés (codes NAF, INSEE) : BTP et travaux publics, bureaux d'études et sociétés
 *    d'ingénierie, entreprises industrielles et de maintenance, services aux collectivités.
 *  - Marchés publics remportés : nombre de marchés dont l'entreprise est titulaire, d'après les
 *    données essentielles de la commande publique (DECP — ministère de l'Économie, jeu
 *    « decp-2022-marches-valides », Licence Ouverte 2.0). Les titulaires y sont identifiés par
 *    SIRET (titulaire_id_1 à 3) : la recherche se fait sur le SIREN (9 premiers chiffres).
 */
export const DECP_SOURCE = "DECP — données essentielles de la commande publique (data.economie.gouv.fr, Licence Ouverte 2.0)";
export const DECP_ENDPOINT = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp-2022-marches-valides/records";
/** Délai avant une nouvelle vérification d'une entreprise (les attributions évoluent lentement). */
export const AWARDS_REFRESH_DAYS = 90;

/** Préfixes NAF des métiers habitués des marchés publics. */
const PUBLIC_PROCUREMENT_NAF: { prefix: string; label: string }[] = [
  // BTP et travaux publics
  { prefix: "41.", label: "BTP" },
  { prefix: "42.", label: "travaux publics" },
  { prefix: "43.", label: "BTP" },
  // Bureaux d'études, ingénierie, contrôle technique, architecture
  { prefix: "71.1", label: "ingénierie et études techniques" },
  { prefix: "71.20", label: "contrôle technique" },
  { prefix: "74.90B", label: "ingénierie et études techniques" },
  // Industrie et maintenance
  { prefix: "25.", label: "industrie" },
  { prefix: "27.", label: "industrie" },
  { prefix: "28.", label: "industrie" },
  { prefix: "33.", label: "maintenance et réparation" },
  // Services aux collectivités
  { prefix: "36.", label: "services aux collectivités" },
  { prefix: "37.", label: "services aux collectivités" },
  { prefix: "38.", label: "services aux collectivités" },
  { prefix: "39.", label: "services aux collectivités" },
  { prefix: "81.", label: "services aux collectivités" },
  { prefix: "80.10", label: "services aux collectivités" },
  { prefix: "80.20", label: "services aux collectivités" },
  { prefix: "49.39A", label: "services aux collectivités" },
  { prefix: "56.29A", label: "services aux collectivités" },
  { prefix: "35.30", label: "services aux collectivités" },
];

/** Activité typique des entreprises qui répondent aux appels d'offres publics (null sinon). */
export function publicProcurementProfile(naf: string | null | undefined): string | null {
  if (!naf) return null;
  return PUBLIC_PROCUREMENT_NAF.find((p) => naf.startsWith(p.prefix))?.label ?? null;
}

/** Nombre minimal de salariés d'après la tranche INSEE enregistrée (« 10 à 19 salariés » → 10). */
export function minEmployees(sizeRange: string | null | undefined): number | null {
  const m = sizeRange?.replace(/\s/g, "").match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

const SIREN = /^\d{9}$/;

/** Requête DECP : nombre de marchés dont l'entreprise (SIREN) est l'un des titulaires. */
export function decpAwardsUrl(siren: string): string {
  if (!SIREN.test(siren)) throw new Error("SIREN invalide");
  const where = [1, 2, 3].map((i) => `startswith(titulaire_id_${i}, "${siren}")`).join(" OR ");
  return `${DECP_ENDPOINT}?${new URLSearchParams({ where, limit: "1", select: "titulaire_id_1" })}`;
}

export async function decpAwardsCount(siren: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  const res = await fetchImpl(decpAwardsUrl(siren), {
    headers: { Accept: "application/json", "User-Agent": "LinkProB2B-Outreach/1.0 (+https://www.linkprob2b.com)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429) throw new Error("Limite de requêtes DECP atteinte (429)");
  if (!res.ok) throw new Error(`DECP : HTTP ${res.status}`);
  const body = (await res.json()) as { total_count?: unknown };
  if (typeof body.total_count !== "number" || !Number.isFinite(body.total_count) || body.total_count < 0) throw new Error("DECP : réponse inattendue (total_count absent)");
  return body.total_count;
}

/**
 * Met à jour le nombre de marchés publics remportés des entreprises jamais vérifiées (ou vérifiées
 * il y a plus de 90 jours), métiers visés en premier. Bornée en nombre et en temps ; s'arrête à la
 * première erreur (limite de débit, source injoignable, format inattendu) sans rien écrire.
 */
export async function refreshPublicAwards(
  db: Db,
  { nafCodes, deadline = Date.now() + 30_000, max = 120, fetchImpl = fetch, pause = 150 }: { nafCodes?: string[]; deadline?: number; max?: number; fetchImpl?: typeof fetch; pause?: number } = {},
) {
  const result = { checked: 0, winners: 0, errors: 0, stopped: null as string | null };
  const stale = new Date(Date.now() - AWARDS_REFRESH_DAYS * 86_400_000).toISOString();
  let q = db
    .from("outreach_prospects")
    .select("id, siren, naf_code")
    .eq("status", "ACTIVE")
    .not("siren", "is", null)
    .or(`public_awards_checked_at.is.null,public_awards_checked_at.lt.${stale}`)
    .order("public_awards_checked_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(Math.max(max * 4, 200));
  if (nafCodes?.length) q = q.in("naf_code", [...new Set(nafCodes)].slice(0, 200));
  const { data, error } = await q;
  if (error) throw error;
  // Métiers habitués des marchés publics d'abord
  const queue = (data ?? []).sort((x, y) => Number(Boolean(publicProcurementProfile(y.naf_code))) - Number(Boolean(publicProcurementProfile(x.naf_code)))).slice(0, max);
  for (const p of queue) {
    if (Date.now() > deadline) break;
    try {
      const n = await decpAwardsCount(p.siren!, fetchImpl);
      await db.from("outreach_prospects").update({ public_awards_count: n, public_awards_checked_at: new Date().toISOString() }).eq("id", p.id);
      result.checked++;
      if (n > 0) result.winners++;
    } catch (e) {
      // Limite de débit, source injoignable ou format inattendu : rien n'est écrit, nouvel essai au prochain passage
      result.errors++;
      result.stopped = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      logServerError("outreach DECP", e);
      break;
    }
    if (pause) await new Promise((r) => setTimeout(r, pause));
  }
  return result;
}
