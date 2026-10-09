import "server-only";
import { env } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/seo";
import { LEGAL } from "@/lib/legal";
import { clip, formatDate } from "@/lib/format";
import { fillTemplate, renderOutreachEmail, type EmailOpportunity } from "@/lib/outreach/email";
import { recipientToken } from "@/lib/outreach/token";

export type Db = SupabaseClient<Database>;

/**
 * Lecture complète d'une liste, page par page : l'API de la base renvoie au plus 1000 lignes
 * par requête (au-delà, la liste serait tronquée sans erreur).
 */
export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}

/** Liste d'opposition complète (adresses, domaines, SIREN), en minuscules. */
export async function loadSuppressions(db: Db, kinds: ("EMAIL" | "DOMAIN" | "SIREN")[] = ["EMAIL", "DOMAIN", "SIREN"]) {
  const rows = await selectAll((from, to) => db.from("outreach_suppressions").select("kind, value").in("kind", kinds).order("id").range(from, to));
  const supp = { EMAIL: new Set<string>(), DOMAIN: new Set<string>(), SIREN: new Set<string>() };
  for (const s of rows) supp[s.kind as keyof typeof supp]?.add(s.value.toLowerCase());
  return supp;
}
export type OutreachSettings = Database["public"]["Tables"]["outreach_settings"]["Row"];

export async function loadSettings(db: Db): Promise<OutreachSettings> {
  const { data, error } = await db.from("outreach_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: e2 } = await db.from("outreach_settings").insert({ id: true }).select("*").single();
  if (e2) throw e2;
  return created;
}

/** Libellés des secteurs et des départements (référentiels publics). */
export async function loadReferentials(db: Db) {
  const [{ data: sectors }, { data: departments }] = await Promise.all([
    db.from("sectors").select("slug, label"),
    db.from("departments").select("code, name, region"),
  ]);
  const sectorLabels = new Map((sectors ?? []).map((s) => [s.slug, s.label]));
  const deps = new Map((departments ?? []).map((d) => [d.code, d]));
  return {
    sectorLabel: (slug: string | null) => (slug ? (sectorLabels.get(slug) ?? slug) : null),
    sectorSlugs: [...sectorLabels.keys()],
    department: (code: string | null) => (code ? (deps.get(code) ?? null) : null),
    location: (city: string | null, dept: string | null, region?: string | null) => {
      const d = dept ? deps.get(dept) : null;
      if (city && d) return `${city} (${d.code})`;
      if (d) return `${d.name} (${d.code})`;
      return city ?? region ?? null;
    },
  };
}
export type Referentials = Awaited<ReturnType<typeof loadReferentials>>;

/** Adresses utilisées dans les e-mails et la landing page. */
export function outreachUrls(recipientId: string) {
  const base = siteUrl();
  const t = recipientToken(recipientId);
  return {
    token: t,
    landing: `${base}/opportunites/selection/${t}`,
    landingTracked: `${base}/api/outreach/c/${t}`,
    signup: `${base}/inscription?ref=o.${t}`,
    opportunity: (id: string) => `${base}/api/outreach/c/${t}?o=${id}`,
    pixel: `${base}/api/outreach/o/${t}`,
    unsubscribePage: `${base}/desinscription/${t}`,
    unsubscribeOneClick: `${base}/api/outreach/unsubscribe/${t}`,
  };
}

/** Identification de l'expéditeur (pied de page) — uniquement des informations réelles. */
export function senderLines(): string[] {
  const lines = [
    [LEGAL.companyName ?? LEGAL.brand, LEGAL.legalForm, LEGAL.siret ? `SIRET ${LEGAL.siret}` : null].filter(Boolean).join(" — "),
    LEGAL.address,
    `${LEGAL.website.replace("https://", "")} · contact : ${LEGAL.contactEmail ?? `${LEGAL.website.replace("https://", "")}/contact`}`,
  ];
  return lines.filter((l): l is string => Boolean(l && l.trim()));
}

/** Raisons pour lesquelles l'envoi réel est bloqué (vide si tout est prêt). */
export function realSendBlockers(settings: OutreachSettings): string[] {
  const out: string[] = [];
  if (settings.dry_run) out.push("Le mode simulation est activé (Paramètres).");
  // Interrupteur d'urgence côté serveur : OUTREACH_SEND_ENABLED=false coupe tout envoi réel.
  if (process.env.OUTREACH_SEND_ENABLED === "false") out.push("L'envoi réel est coupé sur le serveur (variable OUTREACH_SEND_ENABLED=false).");
  if (!env.emailTransport || env.emailTransport === "mailpit")
    out.push("Aucun serveur d'envoi configuré : renseignez le SMTP du domaine (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) dans Vercel.");
  return out;
}

export type RecipientBundle = {
  recipient: Database["public"]["Tables"]["outreach_recipients"]["Row"];
  prospect: Database["public"]["Tables"]["outreach_prospects"]["Row"];
  campaign: Pick<Database["public"]["Tables"]["outreach_campaigns"]["Row"], "id" | "subject_template" | "intro_template" | "campaign_date">;
  opportunities: {
    id: string;
    title: string;
    summary: string | null;
    description: string;
    sector_slug: string | null;
    city: string | null;
    department_code: string | null;
    region: string | null;
    response_deadline: string | null;
    external_buyer_name: string | null;
    status: string;
    source: { name: string | null; reference: string | null; url: string | null } | null;
    score: number;
    reasons: string[];
    excluded: boolean;
  }[];
};

type SourceRow = { is_primary: boolean; external_id: string | null; original_url: string | null; external_source: { name: string } | null };

/** Destinataires d'une campagne avec leurs opportunités (lecture groupée). */
export async function loadRecipientBundles(db: Db, recipientIds: string[]): Promise<RecipientBundle[]> {
  if (recipientIds.length === 0) return [];
  const out: RecipientBundle[] = [];
  for (let i = 0; i < recipientIds.length; i += 100) {
    const ids = recipientIds.slice(i, i + 100);
    const { data, error } = await db
      .from("outreach_recipients")
      .select(
        "*, prospect:outreach_prospects(*), campaign:outreach_campaigns(id, subject_template, intro_template, campaign_date), items:outreach_recipient_opportunities(score, reasons, excluded, position, opportunity:opportunities(id, title, summary, description, sector_slug, city, department_code, region, response_deadline, external_buyer_name, status, origin, source:opportunity_sources(is_primary, external_id, original_url, external_source:external_sources(name))))",
      )
      .in("id", ids);
    if (error) throw error;
    for (const r of data ?? []) {
      const { prospect, campaign, items, ...recipient } = r as unknown as RecipientBundle["recipient"] & {
        prospect: RecipientBundle["prospect"];
        campaign: RecipientBundle["campaign"];
        items: {
          score: number;
          reasons: string[];
          excluded: boolean;
          position: number;
          opportunity: (Omit<RecipientBundle["opportunities"][number], "source" | "score" | "reasons" | "excluded"> & {
            origin: string;
            source: SourceRow | SourceRow[] | null;
          }) | null;
        }[];
      };
      out.push({
        recipient,
        prospect,
        campaign,
        opportunities: (items ?? [])
          .filter((it) => it.opportunity)
          .sort((a, b) => a.position - b.position)
          .map((it) => {
            const { source: raw, origin, ...o } = it.opportunity!;
            const source = (Array.isArray(raw) ? raw : raw ? [raw] : []).sort((x, y) => Number(y.is_primary) - Number(x.is_primary))[0];
            return {
              ...o,
              source:
                origin !== "EXTERNAL"
                  ? { name: "Entreprise inscrite sur LinkProB2B", reference: null, url: null }
                  : source
                    ? { name: source.external_source?.name ?? null, reference: source.external_id, url: source.original_url }
                    : null,
              score: it.score,
              reasons: it.reasons,
              excluded: it.excluded,
            };
          }),
      });
    }
  }
  return out;
}

/** Variables des modèles d'objet et d'introduction. */
export function templateVars(b: RecipientBundle, ref: Referentials, opps: RecipientBundle["opportunities"]): Record<string, string> {
  const n = opps.length;
  const counts = new Map<string, number>();
  for (const o of opps) if (o.sector_slug) counts.set(o.sector_slug, (counts.get(o.sector_slug) ?? 0) + 1);
  const topSector = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const sector = ref.sectorLabel(topSector) ?? "votre secteur";
  const depts = new Set(opps.map((o) => o.department_code).filter(Boolean));
  const regions = new Set(opps.map((o) => o.region).filter(Boolean));
  const d = depts.size === 1 ? ref.department([...depts][0]!) : null;
  const zone = d ? `${d.name} (${d.code})` : regions.size === 1 ? [...regions][0]! : "France";
  return {
    entreprise: b.prospect.name,
    nombre: String(n),
    nombre_opportunites: `${n} opportunité${n > 1 ? "s" : ""}`,
    s: n > 1 ? "s" : "",
    ent: n > 1 ? "ent" : "",
    secteur: sector,
    secteur_phrase: topSector ? ` dans le secteur ${sector.toLowerCase()}` : "",
    zone,
    zone_phrase: d ? ` dans le département ${d.name} (${d.code})` : regions.size === 1 ? ` en ${[...regions][0]}` : "",
  };
}

/** E-mail complet d'un destinataire (aperçu ou envoi). */
export function buildEmail(b: RecipientBundle, ref: Referentials, { withPixel = true }: { withPixel?: boolean } = {}) {
  const urls = outreachUrls(b.recipient.id);
  const opps = b.opportunities.filter((o) => !o.excluded);
  const vars = templateVars(b, ref, opps);
  const subject = fillTemplate(b.recipient.subject ?? b.campaign.subject_template, vars);
  const intro = fillTemplate(b.recipient.intro ?? b.campaign.intro_template, vars);
  const items: EmailOpportunity[] = opps.map((o) => ({
    id: o.id,
    title: o.title,
    sector: ref.sectorLabel(o.sector_slug),
    location: ref.location(o.city, o.department_code, o.region),
    deadline: o.response_deadline ? formatDate(o.response_deadline) : null,
    summary: clip((o.summary ?? o.description).replace(/\s+/g, " "), 180),
    source: o.source?.name ?? null,
    url: urls.opportunity(o.id),
  }));
  const activity = b.prospect.naf_label ?? (b.prospect.naf_code ? `code NAF ${b.prospect.naf_code}` : vars.secteur.toLowerCase());
  const email = renderOutreachEmail({
    companyName: b.prospect.name,
    subject,
    intro,
    opportunities: items,
    landingUrl: urls.landingTracked,
    signupUrl: urls.signup,
    unsubscribeUrl: urls.unsubscribePage,
    pixelUrl: withPixel ? urls.pixel : undefined,
    siteUrl: siteUrl(),
    reason: `Vous recevez ce message car l'activité de ${b.prospect.name} (${activity})${b.prospect.department_code ? ` et sa localisation (${b.prospect.department_code})` : ""} correspondent aux opportunités ci-dessus. Il s'agit d'une sélection ponctuelle : nous limitons volontairement la fréquence de ces envois.`,
    dataSource: `Coordonnées professionnelles de votre entreprise : ${b.prospect.source}${b.prospect.email_source ? ` ; adresse e-mail : ${b.prospect.email_source}` : ""}.`,
    sender: senderLines(),
  });
  return { ...email, urls, opportunities: items };
}

/** Opportunité encore ouverte (publiée, échéance non dépassée). */
export function isStillOpen(o: { status: string; response_deadline: string | null }): boolean {
  return o.status === "PUBLISHED" && (!o.response_deadline || new Date(o.response_deadline).getTime() > Date.now());
}

/** Début (00:00 UTC) de la fenêtre des `days` derniers jours, aujourd'hui inclus. */
export function windowStart(days: number): Date {
  const d = new Date(Date.now() - (days - 1) * 86_400_000);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
