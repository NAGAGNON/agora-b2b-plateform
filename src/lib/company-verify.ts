import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logServerError } from "@/lib/errors";

type DB = SupabaseClient<Database>;
const API = "https://recherche-entreprises.api.gouv.fr/search";

type ApiCompany = { siren?: string; nom_complet?: string; nom_raison_sociale?: string | null; sigle?: string | null; etat_administratif?: string | null; siege?: { enseignes?: string[] | null; nom_commercial?: string | null } | null };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(sas|sasu|sarl|eurl|sa|sci|snc|ei|eirl|scop|ets|etablissements)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Le nom saisi correspond-il à un nom officiel (raison sociale, sigle, enseigne, nom commercial) ? */
export function nameMatches(entered: string, official: (string | null | undefined)[]) {
  const e = norm(entered);
  if (e.length < 2) return false;
  return official.some((o) => {
    const n = o ? norm(o) : "";
    if (n.length < 2) return false;
    return n === e || n.includes(e) || e.includes(n);
  });
}

/** Contrôle d'un SIREN dans l'annuaire officiel des entreprises (données SIRENE, source publique). */
export async function checkSiren(siren: string, name: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; note: string } | { ok: false; reason: string }> {
  if (!/^\d{9}$/.test(siren)) return { ok: false, reason: "SIREN invalide" };
  const res = await fetchImpl(`${API}?q=${siren}&per_page=1`, { headers: { Accept: "application/json", "User-Agent": "LinkProB2B/1.0 (+https://www.linkprob2b.com)" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return { ok: false, reason: `annuaire indisponible (HTTP ${res.status})` };
  const body = (await res.json()) as { results?: ApiCompany[] };
  const c = (body.results ?? []).find((x) => x.siren === siren);
  if (!c) return { ok: false, reason: "SIREN introuvable dans l'annuaire" };
  if (c.etat_administratif && c.etat_administratif !== "A") return { ok: false, reason: "entreprise fermée dans l'annuaire" };
  const official = [c.nom_complet, c.nom_raison_sociale, c.sigle, c.siege?.nom_commercial, ...(c.siege?.enseignes ?? [])];
  if (!nameMatches(name, official)) return { ok: false, reason: `nom différent de l'annuaire (${c.nom_complet ?? "?"})` };
  return { ok: true, note: `SIREN ${siren} contrôlé automatiquement dans l'Annuaire des entreprises (entreprise active : ${c.nom_complet ?? name}).` };
}

/** Vérifie une entreprise (badge « vérifiée ») si son SIREN et son nom correspondent à l'annuaire. Jamais bloquant. */
export async function autoVerifyCompany(db: DB, companyId: string, fetchImpl?: typeof fetch) {
  try {
    const { data: c } = await db.from("companies").select("id, name, siren, verified_at, is_demo").eq("id", companyId).maybeSingle();
    if (!c || c.verified_at || c.is_demo || !c.siren) return { verified: false, reason: c?.verified_at ? "déjà vérifiée" : "pas de SIREN" };
    const r = await checkSiren(c.siren.replace(/\s/g, "").slice(0, 9), c.name, fetchImpl);
    if (!r.ok) return { verified: false, reason: r.reason };
    const { data, error } = await db.rpc("auto_verify_company", { p_company_id: c.id, p_note: r.note });
    if (error) throw error;
    return { verified: Boolean(data), reason: r.note };
  } catch (e) {
    logServerError("auto verify company", e);
    return { verified: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Passage planifié : entreprises avec SIREN pas encore vérifiées (au plus `limit`, les plus récentes d'abord). */
export async function processUnverifiedCompanies(db: DB, { limit = 20 }: { limit?: number } = {}) {
  const { data } = await db.from("companies").select("id").is("verified_at", null).not("siren", "is", null).eq("is_demo", false).order("updated_at", { ascending: false }).limit(limit);
  let verified = 0;
  for (const c of data ?? []) if ((await autoVerifyCompany(db, c.id)).verified) verified++;
  return { checked: data?.length ?? 0, verified };
}
