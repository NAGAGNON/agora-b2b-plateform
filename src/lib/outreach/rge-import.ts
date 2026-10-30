import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { USER_AGENT, isPublishedContactEmail } from "@/lib/outreach/enrich";
import { logServerError } from "@/lib/errors";
import { departmentFromPostal } from "@/lib/outreach/csv";

type Db = SupabaseClient<Database>;

const DATASET = "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines";
// v2 : adresses nominatives publiées dans l'annuaire désormais retenues → relecture complète
const STATE_KEY = "private.rge_import_v2";
/** Annuaire relu au plus une fois par semaine (mises à jour de l'ADEME). */
const REFRESH_DAYS = 7;

type Row = Record<string, unknown>;
const text = (row: Row, keys: string[]) => keys.map((k) => row[k]).find((v): v is string => typeof v === "string" && v.trim() !== "")?.trim() ?? null;

/** Coordonnées d'une ligne de l'annuaire RGE : adresse publiée par l'entreprise pour être contactée. */
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
  const email = mail && isPublishedContactEmail(mail) ? mail : null;
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

const COMPANIES_KEY = "private.rge_companies_import";
/** Qualifications RGE des métiers d'études : bureaux d'études thermiques, auditeurs énergétiques, architectes. */
export const RGE_STUDY_DOMAINS = ["Architecte", "Etude thermique reglementaire", "Audit énergétique Maison individuelle", "Audit énergétique Logement collectif"];

/**
 * Secteur et mots du métier de chaque qualification RGE (domaine de l'annuaire). Les mots servent au
 * rapprochement avec les opportunités : une entreprise n'est retenue que si l'opportunité est de son
 * secteur ET (au-delà du département) emploie un mot de son métier — un poseur de fenêtres ne reçoit
 * pas un marché de voirie.
 */
const DOMAIN_PROFILES: [RegExp, string, string[]][] = [
  [/^isolation/i, "travaux-btp", ["isolation", "isolation thermique", "isolant"]],
  [/fen[eê]tres/i, "travaux-btp", ["menuiserie", "menuiseries", "menuiseries exterieures", "fenetres", "volets"]],
  [/projet complet de r[ée]novation/i, "travaux-btp", ["renovation energetique", "rehabilitation"]],
  [/pompe [àa] chaleur/i, "batiment-technique", ["chauffage", "pompe a chaleur", "genie climatique", "cvc"]],
  [/chauffe-?eau thermodynamique/i, "batiment-technique", ["eau chaude sanitaire", "plomberie", "chauffe eau"]],
  [/chaudi[eè]re bois/i, "batiment-technique", ["chauffage", "chaudiere", "chaufferie", "bois energie"]],
  [/chaudi[eè]re/i, "batiment-technique", ["chauffage", "chaudiere", "chaufferie", "genie climatique", "cvc"]],
  [/po[eê]le|insert/i, "batiment-technique", ["chauffage", "poele", "bois energie"]],
  [/radiateurs/i, "batiment-technique", ["chauffage electrique", "electricite"]],
  [/ventilation/i, "batiment-technique", ["ventilation", "vmc", "cvc", "traitement d air"]],
  [/photovolta/i, "energie", ["photovoltaique", "panneaux solaires", "centrale solaire"]],
  [/solaire/i, "energie", ["solaire thermique", "eau chaude sanitaire", "chauffage"]],
  [/forage g[ée]othermique/i, "energie", ["geothermie", "forage"]],
  [/^architecte$/i, "ingenierie-etudes", ["architecte", "architecture", "maitrise d oeuvre"]],
  [/^audit/i, "ingenierie-etudes", ["audit energetique", "diagnostic energetique"]],
  [/^etude|commision?nement/i, "ingenierie-etudes", ["bureau d etudes", "etude thermique", "maitrise d oeuvre"]],
];

export function rgeDomainProfile(domaine: string): { sector: string; keywords: string[] } | null {
  const hit = DOMAIN_PROFILES.find(([re]) => re.test(domaine));
  return hit ? { sector: hit[1], keywords: hit[2] } : null;
}

/**
 * Nouvelle entreprise à prospecter tirée des lignes RGE d'un même SIREN (une ligne par qualification) :
 * coordonnées publiées par l'entreprise, secteurs et mots de ses métiers. Rien n'est inventé : sans
 * adresse publiée, sans nom ou sans qualification reconnue, aucune entreprise n'est créée.
 */
export function rgeProspect(input: Row | Row[], regionOf: (dep: string) => string | null) {
  const rows = Array.isArray(input) ? input : [input];
  const first = rows[0];
  if (!first) return null;
  const c = rows.map(rgeContact).find((x) => x?.email) ?? null;
  const name = text(first, ["nom_entreprise", "raison_sociale", "nom"]);
  const domaines = [...new Set(rows.map((r) => text(r, ["domaine"])).filter((d): d is string => Boolean(d)))];
  const profiles = domaines.map(rgeDomainProfile).filter((x): x is NonNullable<typeof x> => x !== null);
  if (!c?.email || !name || !profiles.length) return null;
  const cp = text(first, ["code_postal"]);
  const dep = departmentFromPostal(cp);
  const siret = String(first.siret ?? "").replace(/\s/g, "");
  return {
    name,
    siren: c.siren,
    siret: /^\d{14}$/.test(siret) ? siret : null,
    sectors: [...new Set(profiles.map((x) => x.sector))],
    activity: `Qualification RGE : ${domaines.join(" ; ")}`.slice(0, 500),
    keywords: [...new Set([...profiles.flatMap((x) => x.keywords), ...domaines.map((d) => d.toLowerCase())])].slice(0, 30),
    city: text(first, ["commune"]),
    postal_code: cp,
    department_code: dep,
    region: dep ? regionOf(dep) : null,
    website: c.website,
    email: c.email,
    email_source: "Annuaire officiel des entreprises RGE (ADEME, données ouvertes) — coordonnées publiées par l'entreprise",
    source: "Annuaire officiel des entreprises RGE (ADEME, Licence Ouverte)",
    source_ref: siret || c.siren,
    enrichment_status: "FOUND",
    enriched_at: new Date().toISOString(),
  };
}

/**
 * Entreprises RGE (bâtiment, chauffage, énergies renouvelables, études) qui publient une adresse
 * de contact dans l'annuaire officiel : ajoutées comme entreprises à prospecter, une seule fois par
 * SIREN (les entreprises déjà connues ne sont pas modifiées ici, voir importRgeContacts). Leurs
 * adresses sont introuvables autrement (la recherche sur les sites ne trouve presque rien).
 * Lecture triée par SIRET : les qualifications d'une même entreprise arrivent ensemble. Relu chaque semaine.
 */
export async function importRgeCompanies(db: Db, { deadline = Date.now() + 60_000, fetchImpl = fetch }: { deadline?: number; fetchImpl?: typeof fetch } = {}) {
  const { data: state } = await db.from("platform_settings").select("value").eq("key", COMPANIES_KEY).maybeSingle();
  const prev = (state?.value ?? {}) as { finished_at?: string; next?: string | null };
  if (!prev.next && prev.finished_at && Date.now() - new Date(prev.finished_at).getTime() < REFRESH_DAYS * 86_400_000) return { skipped: "annuaire RGE déjà importé cette semaine" };
  const { data: deps } = await db.from("departments").select("code, region");
  const regions = new Map((deps ?? []).map((d) => [d.code, d.region]));
  const result = { lines: 0, added: 0, finished: false };
  let url: string | null = prev.next ?? `${DATASET}?size=5000&sort=siret&select=${encodeURIComponent("siret,email,site_internet,nom_entreprise,code_postal,commune,domaine")}`;
  while (url && Date.now() < deadline) {
    const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Annuaire RGE : HTTP ${res.status}`);
    const body = (await res.json()) as { results?: Row[]; next?: string };
    const rows = body.results ?? [];
    result.lines += rows.length;
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const siren = String(r.siret ?? "").replace(/\s/g, "").slice(0, 9);
      if (/^\d{9}$/.test(siren)) groups.set(siren, [...(groups.get(siren) ?? []), r]);
    }
    const list = [...groups.values()].map((g) => rgeProspect(g, (d) => regions.get(d) ?? null)).filter((p): p is NonNullable<typeof p> => p !== null);
    for (let i = 0; i < list.length; i += 500) {
      const { data, error } = await db.from("outreach_prospects").upsert(list.slice(i, i + 500), { onConflict: "siren", ignoreDuplicates: true }).select("id");
      if (error) logServerError("rge companies import", error);
      else result.added += data?.length ?? 0;
    }
    url = body.next ?? null;
  }
  result.finished = !url;
  await db.from("platform_settings").upsert({
    key: COMPANIES_KEY,
    value: { next: url, finished_at: result.finished ? new Date().toISOString() : (prev.finished_at ?? null), last: result },
    description: "Import des entreprises de l'annuaire RGE (ADEME) : reprise et dernière exécution",
  });
  return result;
}
