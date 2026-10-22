/**
 * Logo des entreprises inscrites, récupéré sur leur propre site quand elles n'en ont pas déposé.
 *
 * - Site : celui renseigné par l'entreprise ; à défaut, retrouvé à partir de son SIREN (domaine
 *   vérifié par le SIREN affiché sur le site, comme pour la prospection).
 * - Page d'accueil lue seulement si robots.txt l'autorise ; aucune protection contournée.
 * - Ordre des candidats : logo de l'en-tête (lien vers l'accueil), logo déclaré par l'organisation
 *   (données structurées), image « logo » de la page, icône haute définition. Jamais de bannière,
 *   de visuel de campagne ni de logo de partenaire, ni l'image de partage (og:image).
 * - Image vérifiée (format réel, 64 px minimum, proportions raisonnables), convertie en PNG
 *   512 px maximum (le SVG est converti : aucun code du site n'est conservé).
 * - Une seule recherche par adresse de site ; jamais de nouvel essai après un retrait du logo.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchText, freeWebsiteSearch, hostOf, isPublicHost, robotsAllows, USER_AGENT } from "@/lib/outreach/enrich";

type DB = SupabaseClient<Database>;

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined) ?? null;
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&quot;/g, '"').trim();

/** Version de la méthode de repérage : les logos trouvés par une version antérieure sont recherchés à nouveau. */
export const LOGO_METHOD_VERSION = 2;

// Visuels de campagne, d'événement ou de contenu : jamais retenus comme logo de l'entreprise
const CAMPAIGN = /(campagne|campaign|promo|banni[eè]re|banner|slider|carousel|hero|octobre[-_ ]?rose|movember|no[eë]l|christmas|xmas|black[-_ ]?friday|soldes|[ée]v[ée]nement|event|anniversaire|jubil|webinar|salon|affiche|poster|edition[-_ ]?20\d\d|20\d\d[-_ ]?edition)/i;
// Logos de tiers (partenaires, clients, labels, certifications, réseaux sociaux)
const THIRD_PARTY = /(partenaire|partner|client|sponsor|certif|label|qualibat|qualifelec|rge|iso[-_ ]?\d|award|troph|prix[-_]|linkedin|facebook|twitter|instagram|youtube|tiktok|google|apple|play[-_ ]?store|app[-_ ]?store|trustpilot|avis[-_]verifies|payment|paiement|visa|mastercard|paypal)/i;
const LOGO_WORD = /(logo|brand|marque|site[-_ ]?title|navbar-brand|custom-logo)/i;
const ORG_TYPES = /^(Organization|Corporation|LocalBusiness|Store|ProfessionalService|HomeAndConstructionBusiness|GeneralContractor|ConstructionBusiness|Restaurant|Brand|NGO|EducationalOrganization|GovernmentOrganization|MedicalOrganization|SportsOrganization|AutomotiveBusiness)$/;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const fileName = (u: string) => {
  try {
    return decodeURIComponent(new URL(u, "https://x.invalid").pathname.split("/").pop() ?? "");
  } catch {
    return u;
  }
};

/** Zone d'en-tête de la page : <header>, sinon tout ce qui précède le contenu principal. */
function headerZone(html: string): string {
  const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0];
  if (header) return header;
  const body = html.slice(Math.max(0, html.search(/<body\b/i)));
  const cut = body.search(/<main\b|<h1\b|<section\b/i);
  return body.slice(0, cut > 0 ? cut : 4000);
}

/** Logos déclarés dans les données structurées d'une organisation (schema.org, JSON-LD). */
function structuredLogos(html: string): string[] {
  const out: string[] = [];
  const visit = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(visit);
    const o = n as Record<string, unknown>;
    const types = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
    if (types.some((t) => ORG_TYPES.test(t)) && o.logo) {
      const l = o.logo as unknown;
      const url = typeof l === "string" ? l : Array.isArray(l) ? (l[0] as Record<string, unknown>)?.url : (l as Record<string, unknown>).url ?? (l as Record<string, unknown>).contentUrl;
      if (typeof url === "string") out.push(url);
    }
    if (o["@graph"]) visit(o["@graph"]);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {
      // données structurées invalides : ignorées
    }
  }
  return out;
}

/** Logo dessiné directement dans la page (SVG dans le lien d'accueil de l'en-tête), converti en image. */
function inlineSvgLogo(zone: string): string | null {
  const m = zone.match(/<a\b[^>]*>(?:(?!<\/a>)[\s\S]){0,400}?(<svg\b[\s\S]*?<\/svg>)/i);
  if (!m) return null;
  const anchor = m[0].slice(0, m[0].indexOf(">") + 1);
  const href = attr(anchor, "href") ?? "";
  if (!LOGO_WORD.test(m[0].slice(0, m[0].indexOf(m[1]))) && !/^(\/|\.\/|#|https?:\/\/[^/]+\/?$)/.test(href)) return null;
  let svg = m[1];
  if (svg.length > 200_000) return null;
  if (!/xmlns=/.test(svg)) svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Adresses d'images candidates, de la plus probable à la moins probable. Le logo de l'en-tête (lien
 * vers l'accueil) passe en premier ; visuels de campagne, logos de partenaires et image de partage
 * (og:image, souvent une campagne) sont écartés.
 */
export function logoCandidates(html: string, base: string, companyName?: string | null): string[] {
  const scored: { url: string; score: number; order: number }[] = [];
  const name = companyName ? norm(companyName).replace(/\b(sas|sarl|sa|eurl|sasu|groupe|group|ste|societe)\b/g, "").trim() : "";
  const add = (u: string | null | undefined, score: number, context = "", icon = false) => {
    if (!u) return;
    const v = decode(u);
    if (!v || (v.startsWith("data:") && !v.startsWith("data:image/svg+xml;base64,"))) return;
    let abs: string;
    try {
      abs = v.startsWith("data:") ? v : new URL(v, base).toString();
    } catch {
      return;
    }
    if (!/^(https?:|data:)/.test(abs)) return;
    const hint = `${v.startsWith("data:") ? "" : fileName(abs)} ${context}`;
    if (CAMPAIGN.test(hint)) score -= 80;
    if (!icon && THIRD_PARTY.test(hint) && !(name && norm(hint).includes(name))) score -= 60;
    if (name && name.length >= 3 && norm(hint).includes(name)) score += 10;
    if (score <= 0) return;
    const prev = scored.find((c) => c.url === abs);
    if (prev) prev.score = Math.max(prev.score, score);
    else scored.push({ url: abs, score, order: scored.length });
  };
  const imgAttrs = (t: string) => [attr(t, "alt"), attr(t, "class"), attr(t, "id"), attr(t, "title")].join(" ");
  const src = (t: string) => attr(t, "src") ?? attr(t, "data-src") ?? attr(t, "data-lazy-src") ?? attr(t, "srcset")?.split(/[\s,]+/)[0];

  // 1. En-tête : image (ou SVG) du lien d'accueil / de la zone « logo »
  const zone = headerZone(html);
  for (const m of zone.matchAll(/<a\b[^>]*>(?:(?!<\/a>)[\s\S]){0,600}?<\/a>/gi)) {
    const a = m[0];
    const open = a.slice(0, a.indexOf(">") + 1);
    const href = attr(open, "href") ?? "";
    const home = /^(\/|\.\/|https?:\/\/[^/]+\/?)$/.test(href) || (() => {
      try {
        return new URL(href, base).pathname === "/" && new URL(href, base).host === new URL(base).host;
      } catch {
        return false;
      }
    })();
    const img = a.match(/<img\b[^>]*>/i)?.[0];
    if (img && (home || LOGO_WORD.test(open) || LOGO_WORD.test(imgAttrs(img)))) add(src(img), home && LOGO_WORD.test(open + imgAttrs(img) + (src(img) ?? "")) ? 100 : 90, imgAttrs(img));
  }
  for (const t of [...zone.matchAll(/<img\b[^>]*>/gi)].map((x) => x[0])) if (LOGO_WORD.test(imgAttrs(t) + " " + fileName(src(t) ?? ""))) add(src(t), 85, imgAttrs(t));
  const svg = inlineSvgLogo(zone);
  if (svg) add(svg, 70);
  // 2. Données structurées de l'organisation
  for (const u of structuredLogos(html)) add(u.replace(/\\\//g, "/"), 80);
  // 3. Ailleurs dans la page : image « logo » (le pied de page porte souvent des logos de partenaires)
  const footerAt = html.search(/<footer\b/i);
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0];
    if (!LOGO_WORD.test(imgAttrs(t) + " " + fileName(src(t) ?? ""))) continue;
    add(src(t), footerAt >= 0 && (m.index ?? 0) > footerAt ? 30 : 55, imgAttrs(t));
  }
  // 4. Icônes haute définition
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const size = (t: string) => Math.max(0, ...(attr(t, "sizes") ?? "").split(/\s+/).map((s) => Number(s.split("x")[0]) || 0));
  for (const t of links.filter((l) => /apple-touch-icon/i.test(attr(l, "rel") ?? "")).sort((a, b) => size(b) - size(a))) add(attr(t, "href"), 40, "", true);
  for (const t of links.filter((l) => /\bicon\b/i.test(attr(l, "rel") ?? "") && (size(l) >= 96 || /\.svg(\?|$)/i.test(attr(l, "href") ?? ""))).sort((a, b) => size(b) - size(a))) add(attr(t, "href"), 30, "", true);
  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((c) => c.url)
    .slice(0, 8);
}

const MAX_BYTES = 3 * 1024 * 1024;

/** Télécharge une image publique (taille limitée, réseau interne refusé). */
async function fetchImage(url: string, fetchImpl: typeof fetch): Promise<Buffer | null> {
  // SVG de la page (lu dans le code de la page d'accueil, jamais exécuté : converti en PNG)
  if (url.startsWith("data:image/svg+xml;base64,")) return Buffer.from(url.slice(26), "base64");
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || !(await isPublicHost(u.hostname))) return null;
  const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, Accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  if (res.url && hostOf(res.url) && !(await isPublicHost(new URL(res.url).hostname))) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!/^image\//i.test(type) && !/\.(png|jpe?g|webp|svg|gif)(\?|$)/i.test(url)) return null;
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length && buf.length <= MAX_BYTES ? buf : null;
}

/** Vérifie et convertit une image en PNG (512 px max) ; null si elle ne ressemble pas à un logo exploitable. */
export async function normalizeLogo(input: Buffer): Promise<Buffer | null> {
  try {
    const isSvg = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(input.subarray(0, 2048).toString("utf8"));
    const img = sharp(input, { density: isSvg ? 300 : undefined, limitInputPixels: 40_000_000, animated: false });
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return null;
    if (!isSvg && !["png", "jpeg", "webp", "gif"].includes(meta.format ?? "")) return null;
    if (!isSvg && Math.min(meta.width, meta.height) < 64 && Math.max(meta.width, meta.height) < 160) return null;
    const ratio = meta.width / meta.height;
    if (ratio > 8 || ratio < 1 / 4) return null;
    const out = await img.resize(512, 512, { fit: "inside", withoutEnlargement: !isSvg }).png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
    // Image vide (entièrement transparente ou d'une seule couleur) : écartée
    const stats = await sharp(out.data).stats();
    const visible = stats.channels.length < 4 || stats.channels[3].max > 0;
    const uniform = stats.channels.slice(0, 3).every((c) => c.max - c.min < 8);
    if (!visible || uniform) return null;
    return out.data;
  } catch {
    return null;
  }
}

export type LogoResult = { status: "FOUND" | "NO_SITE" | "BLOCKED" | "NOT_FOUND" | "ERROR"; site: string | null; source?: string; png?: Buffer; note: string };

/** Cherche le logo d'une entreprise sur son site officiel. */
export async function findCompanyLogo(c: { name: string; website: string | null; siren: string | null; city: string | null }, fetchImpl: typeof fetch = fetch): Promise<LogoResult> {
  let site = c.website?.trim() || null;
  if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
  if (!site && c.siren && /^\d{9}$/.test(c.siren)) site = (await freeWebsiteSearch(fetchImpl)({ name: c.name, city: c.city, siren: c.siren }).catch(() => null))?.website ?? null;
  if (!site) return { status: "NO_SITE", site: null, note: "Aucun site connu" };
  try {
    // Adresse telle que donnée, puis avec ou sans « www. » (redirection fréquente d'un nom vers l'autre)
    const u = new URL(site);
    const alt = new URL(site);
    alt.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
    let blocked = "Site injoignable";
    for (const page of [u.toString(), alt.toString()]) {
      const robots = await fetchText(`${new URL(page).origin}/robots.txt`, fetchImpl, 100_000).catch(() => null);
      if (!robots || robots.status >= 500) continue;
      if (robots.status < 400 && !robotsAllows(robots.text, new URL(page).pathname || "/")) {
        blocked = "Exploration non autorisée par le site (robots.txt)";
        break;
      }
      const home = await fetchText(page, fetchImpl, 1_500_000).catch(() => null);
      if (!home?.text) continue;
      for (const url of logoCandidates(home.text, page, c.name)) {
        const raw = await fetchImage(url, fetchImpl).catch(() => null);
        const png = raw && (await normalizeLogo(raw));
        if (png) return { status: "FOUND", site, source: url.startsWith("data:") ? `${page} (logo de l'en-tête)` : url, png, note: "Logo trouvé sur le site" };
      }
      return { status: "NOT_FOUND", site, note: "Aucun logo exploitable sur la page d'accueil" };
    }
    return { status: "BLOCKED", site, note: blocked };
  } catch (e) {
    return { status: "ERROR", site, note: e instanceof Error ? e.message.slice(0, 200) : "Erreur" };
  }
}

/**
 * Recherche et enregistre le logo d'une entreprise (service). Ne remplace jamais un logo déposé par
 * l'entreprise ; un logo automatique trouvé par une méthode antérieure est recherché à nouveau.
 */
export async function autoLogoFor(db: DB, companyId: string, fetchImpl: typeof fetch = fetch): Promise<LogoResult | null> {
  const { data: c } = await db.from("companies").select("id, name, website, siren, city, logo_path, logo_source, logo_auto_checked_at, logo_auto_site, logo_auto_version, is_demo").eq("id", companyId).maybeSingle();
  if (!c || c.is_demo) return null;
  const refresh = Boolean(c.logo_path) && c.logo_source === "AUTO" && c.logo_auto_version < LOGO_METHOD_VERSION;
  if (c.logo_path && !refresh) return null;
  // Déjà cherché pour ce site avec la méthode actuelle (ou logo retiré par l'entreprise) : pas de nouvel essai
  if (!refresh && c.logo_auto_checked_at && (c.logo_auto_site ?? "") === (c.website ?? "")) return null;
  const r = await findCompanyLogo(c, fetchImpl);
  const checked = { logo_auto_checked_at: new Date().toISOString(), logo_auto_site: c.website ?? "", logo_auto_version: LOGO_METHOD_VERSION, logo_auto_note: r.source ? `${r.note} : ${r.source}`.slice(0, 500) : r.note };
  if (r.status !== "FOUND" || !r.png) {
    // Nouvelle recherche sans résultat : l'ancien logo automatique est conservé
    await db.from("companies").update(refresh ? { ...checked, logo_auto_note: `Nouvelle recherche sans résultat (${r.note}) : logo précédent conservé`.slice(0, 500) } : checked).eq("id", c.id);
    return r;
  }
  const path = `${c.id}/${randomUUID()}-logo-site.png`;
  const { error } = await db.storage.from("company-logos").upload(path, r.png, { contentType: "image/png" });
  if (error) {
    await db.from("companies").update({ ...checked, logo_auto_note: `Enregistrement impossible : ${error.message}`.slice(0, 500) }).eq("id", c.id);
    return { ...r, status: "ERROR", note: error.message };
  }
  // Mise à jour conditionnelle : un logo déposé par l'entreprise entre-temps est toujours gardé
  const q = db.from("companies").update({ ...checked, logo_path: path, logo_source: "AUTO" }).eq("id", c.id);
  const { data: done } = await (refresh ? q.eq("logo_source", "AUTO").eq("logo_path", c.logo_path!) : q.is("logo_path", null)).select("id");
  if (!done?.length) await db.storage.from("company-logos").remove([path]);
  else if (refresh && c.logo_path) await db.storage.from("company-logos").remove([c.logo_path]);
  return r;
}

/**
 * Traitement par lots (tâche planifiée, administration) : entreprises sans logo jamais cherchées,
 * puis logos automatiques trouvés par une méthode antérieure.
 */
export async function processMissingLogos(db: DB, { limit = 25, deadline = Date.now() + 60_000, fetchImpl = fetch }: { limit?: number; deadline?: number; fetchImpl?: typeof fetch } = {}) {
  const base = () => db.from("companies").select("id").eq("is_demo", false).neq("status", "SUSPENDED");
  const { data: missing } = await base().is("logo_path", null).is("logo_auto_checked_at", null).order("created_at", { ascending: false }).limit(limit);
  const left = limit - (missing?.length ?? 0);
  const { data: outdated } = left > 0 ? await base().eq("logo_source", "AUTO").lt("logo_auto_version", LOGO_METHOD_VERSION).order("created_at", { ascending: false }).limit(left) : { data: [] };
  const stats = { checked: 0, found: 0, noSite: 0, notFound: 0, blocked: 0, errors: 0, refreshed: 0 };
  for (const { id } of [...(missing ?? []), ...(outdated ?? [])]) {
    if (Date.now() > deadline) break;
    const r = await autoLogoFor(db, id, fetchImpl);
    if (!r) continue;
    stats.checked++;
    if (r.status === "FOUND") stats.found++;
    else if (r.status === "NO_SITE") stats.noSite++;
    else if (r.status === "NOT_FOUND") stats.notFound++;
    else if (r.status === "BLOCKED") stats.blocked++;
    else stats.errors++;
    if (r.status === "FOUND" && (outdated ?? []).some((o) => o.id === id)) stats.refreshed++;
  }
  const [{ count: m }, { count: o }] = await Promise.all([
    db.from("companies").select("id", { count: "exact", head: true }).is("logo_path", null).is("logo_auto_checked_at", null).eq("is_demo", false).neq("status", "SUSPENDED"),
    db.from("companies").select("id", { count: "exact", head: true }).eq("logo_source", "AUTO").lt("logo_auto_version", LOGO_METHOD_VERSION).eq("is_demo", false).neq("status", "SUSPENDED"),
  ]);
  return { ...stats, remaining: (m ?? 0) + (o ?? 0) };
}
