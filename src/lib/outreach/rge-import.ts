import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { USER_AGENT, hostOf, isGenericCompanyEmail } from "@/lib/outreach/enrich";
import { logServerError } from "@/lib/errors";

type Db = SupabaseClient<Database>;

const DATASET = "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines";
const STATE_KEY = "private.rge_import";
/** Annuaire relu au plus une fois par semaine (mises à jour de l'ADEME). */
const REFRESH_DAYS = 7;

type Row = Record<string, unknown>;
const text = (row: Row, keys: string[]) => keys.map((k) => row[k]).find((v): v is string => typeof v === "string" && v.trim() !== "")?.trim() ?? null;

/** Coordonnées d'une ligne de l'annuaire RGE (adresse générique ou au nom de l'entreprise uniquement). */
export function rgeContact(row: Row): { siren: string; email: string | null; website: string | null } | null {
  const siren = String(row.siret ?? "").replace(/\s/g, "").slice(0, 9);
  if (!/^\d{9}$/.test(siren)) return null;
  const site = text(row, ["site_internet", "site_web", "siteweb", "web"]);
  let website: string | null = null;
  try {
    website = site ? `https://${new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).hostname}` : null;
  } catch {
    website = null;
  }
  const mail = (text(row, ["email", "e_mail", "courriel", "mail", "adresse_mail"]) ?? "").toLowerCase();
  const name = text(row, ["nom_entreprise", "raison_sociale", "nom"]) ?? "";
  const email = mail && isGenericCompanyEmail(mail, website ? hostOf(website) : (mail.split("@")[1] ?? null), name) ? mail : null;
  return email || website ? { siren, email, website } : null;
}

/**
 * Import EN MASSE de l'annuaire officiel des entreprises RGE (ADEME, Licence Ouverte) : en quelques
 * requêtes, toutes les entreprises prospectées qui y figurent reçoivent l'e-mail professionnel et le
 * site qu'elles y publient — bien plus rapide que la recherche entreprise par entreprise.
 * Aucune donnée de l'annuaire n'est stockée en dehors des entreprises déjà prospectées.
 */
export async function importRgeContacts(db: Db, { deadline = Date.now() + 120_000, fetchImpl = fetch, force = false }: { deadline?: number; fetchImpl?: typeof fetch; force?: boolean } = {}) {
  const { data: state } = await db.from("platform_settings").select("value").eq("key", STATE_KEY).maybeSingle();
  const prev = (state?.value ?? {}) as { finished_at?: string; next?: string | null };
  if (!force && !prev.next && prev.finished_at && Date.now() - new Date(prev.finished_at).getTime() < REFRESH_DAYS * 86_400_000) return { skipped: "annuaire déjà importé cette semaine" };
  const result = { lines: 0, matched: 0, emails: 0, websites: 0, finished: false };
  let url: string | null = prev.next ?? `${DATASET}?size=5000&select=${encodeURIComponent("siret,email,site_internet,nom_entreprise")}`;
  while (url && Date.now() < deadline) {
    const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Annuaire RGE : HTTP ${res.status}`);
    const body = (await res.json()) as { results?: Row[]; next?: string };
    const rows = body.results ?? [];
    result.lines += rows.length;
    const bySiren = new Map<string, { email: string | null; website: string | null }>();
    for (const r of rows) {
      const c = rgeContact(r);
      if (!c) continue;
      const cur = bySiren.get(c.siren);
      bySiren.set(c.siren, { email: cur?.email ?? c.email, website: cur?.website ?? c.website });
    }
    const sirens = [...bySiren.keys()];
    for (let i = 0; i < sirens.length; i += 300) {
      const { data: prospects } = await db.from("outreach_prospects").select("id, siren, website").in("siren", sirens.slice(i, i + 300)).is("email", null).eq("status", "ACTIVE");
      for (const p of prospects ?? []) {
        const c = bySiren.get(p.siren!);
        if (!c) continue;
        result.matched++;
        const now = new Date().toISOString();
        const patch = c.email
          ? { email: c.email, email_source: "Annuaire officiel des entreprises RGE (ADEME, données ouvertes) — coordonnées publiées par l'entreprise", enrichment_status: "FOUND", enriched_at: now, enrichment_note: null, enrichment_deferred_until: null, website: p.website ?? c.website, updated_at: now }
          : { website: p.website ?? c.website, updated_at: now };
        const { error } = await db.from("outreach_prospects").update(patch).eq("id", p.id);
        if (error) {
          if (error.code !== "23505") logServerError("rge import", error);
          continue;
        }
        if (c.email) {
          result.emails++;
          // Campagnes en cours (du jour, ou dédiées à un besoin) : l'entreprise devient prête à recevoir l'e-mail
          const { data: waiting } = await db
            .from("outreach_recipients")
            .select("id, campaign:outreach_campaigns!inner(campaign_date, kind)")
            .eq("prospect_id", p.id)
            .eq("status", "NO_EMAIL");
          const recent = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
          const ids = (waiting ?? [])
            .filter((w) => {
              const camp = Array.isArray(w.campaign) ? w.campaign[0] : w.campaign;
              return camp && (camp.kind === "NEED" || camp.campaign_date >= recent);
            })
            .map((w) => w.id);
          if (ids.length) await db.from("outreach_recipients").update({ email: c.email, status: "PENDING", updated_at: now }).in("id", ids);
        } else if (c.website && !p.website) result.websites++;
      }
    }
    url = body.next ?? null;
  }
  result.finished = !url;
  await db.from("platform_settings").upsert({
    key: STATE_KEY,
    value: { next: url, finished_at: result.finished ? new Date().toISOString() : (prev.finished_at ?? null), last: result },
    description: "Import de l'annuaire RGE (ADEME) : reprise et dernière exécution",
  });
  return result;
}
