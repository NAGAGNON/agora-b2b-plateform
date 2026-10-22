/**
 * Logo des entreprises inscrites, récupéré sur leur propre site quand elles n'en ont pas déposé.
 *
 * - Site : celui renseigné par l'entreprise ; à défaut, retrouvé à partir de son SIREN (domaine
 *   vérifié par le SIREN affiché sur le site, comme pour la prospection).
 * - Page d'accueil lue seulement si robots.txt l'autorise ; aucune protection contournée.
 * - Ordre des candidats : logo déclaré (données structurées), image « logo » de la page, icône
 *   haute définition (apple-touch-icon), grande icône. Jamais de photo de bannière.
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

/** Adresses d'images candidates, de la plus probable à la moins probable. */
export function logoCandidates(html: string, base: string): string[] {
  const out: string[] = [];
  const add = (u: string | null | undefined) => {
    if (!u) return;
    const v = decode(u);
    if (!v || v.startsWith("data:")) return;
    try {
      const abs = new URL(v, base).toString();
      if (/^https?:/.test(abs) && !out.includes(abs)) out.push(abs);
    } catch {
      // adresse invalide
    }
  };
  // 1. Logo déclaré dans les données structurées (schema.org Organization)
  for (const m of html.matchAll(/"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"url"\s*:\s*"([^"]+)")/g)) add((m[1] ?? m[2])?.replace(/\\\//g, "/"));
  // 2. Image dont l'adresse, le nom, la classe ou l'identifiant parle de logo (en-tête en premier)
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const isLogo = (t: string) => /logo/i.test([attr(t, "src"), attr(t, "alt"), attr(t, "class"), attr(t, "id"), attr(t, "data-src")].join(" "));
  for (const t of imgs.filter(isLogo).slice(0, 4)) add(attr(t, "src") ?? attr(t, "data-src"));
  // Logo en image dans un lien vers l'accueil (<a class="logo"><img …>)
  for (const m of html.matchAll(/<(?:a|div|span)\b[^>]*(?:class|id)\s*=\s*["'][^"']*logo[^"']*["'][^>]*>\s*(?:<[^>]+>\s*){0,3}?(<img\b[^>]*>)/gi)) add(attr(m[1], "src") ?? attr(m[1], "data-src"));
  // 3. Icônes haute définition
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const size = (t: string) => Math.max(0, ...(attr(t, "sizes") ?? "").split(/\s+/).map((s) => Number(s.split("x")[0]) || 0));
  for (const t of links.filter((l) => /apple-touch-icon/i.test(attr(l, "rel") ?? "")).sort((a, b) => size(b) - size(a))) add(attr(t, "href"));
  for (const t of links.filter((l) => /\bicon\b/i.test(attr(l, "rel") ?? "") && (size(l) >= 96 || /\.svg(\?|$)/i.test(attr(l, "href") ?? ""))).sort((a, b) => size(b) - size(a))) add(attr(t, "href"));
  return out.slice(0, 8);
}

const MAX_BYTES = 3 * 1024 * 1024;

/** Télécharge une image publique (taille limitée, réseau interne refusé). */
async function fetchImage(url: string, fetchImpl: typeof fetch): Promise<Buffer | null> {
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
      for (const url of logoCandidates(home.text, page)) {
        const raw = await fetchImage(url, fetchImpl).catch(() => null);
        const png = raw && (await normalizeLogo(raw));
        if (png) return { status: "FOUND", site, source: url, png, note: "Logo trouvé sur le site" };
      }
      return { status: "NOT_FOUND", site, note: "Aucun logo exploitable sur la page d'accueil" };
    }
    return { status: "BLOCKED", site, note: blocked };
  } catch (e) {
    return { status: "ERROR", site, note: e instanceof Error ? e.message.slice(0, 200) : "Erreur" };
  }
}

/** Recherche et enregistre le logo d'une entreprise (service) ; ne remplace jamais un logo existant. */
export async function autoLogoFor(db: DB, companyId: string, fetchImpl: typeof fetch = fetch): Promise<LogoResult | null> {
  const { data: c } = await db.from("companies").select("id, name, website, siren, city, logo_path, logo_auto_checked_at, logo_auto_site, is_demo").eq("id", companyId).maybeSingle();
  if (!c || c.is_demo || c.logo_path) return null;
  // Déjà cherché pour ce site (ou logo retiré par l'entreprise) : pas de nouvel essai
  if (c.logo_auto_checked_at && (c.logo_auto_site ?? "") === (c.website ?? "")) return null;
  const r = await findCompanyLogo(c, fetchImpl);
  const checked = { logo_auto_checked_at: new Date().toISOString(), logo_auto_site: c.website ?? "", logo_auto_note: r.source ? `${r.note} : ${r.source}`.slice(0, 500) : r.note };
  if (r.status !== "FOUND" || !r.png) {
    await db.from("companies").update(checked).eq("id", c.id);
    return r;
  }
  const path = `${c.id}/${randomUUID()}-logo-site.png`;
  const { error } = await db.storage.from("company-logos").upload(path, r.png, { contentType: "image/png" });
  if (error) {
    await db.from("companies").update({ ...checked, logo_auto_note: `Enregistrement impossible : ${error.message}`.slice(0, 500) }).eq("id", c.id);
    return { ...r, status: "ERROR", note: error.message };
  }
  // Mise à jour conditionnelle : si l'entreprise a déposé un logo entre-temps, le sien est gardé
  const { data: done } = await db.from("companies").update({ ...checked, logo_path: path, logo_source: "AUTO" }).eq("id", c.id).is("logo_path", null).select("id");
  if (!done?.length) await db.storage.from("company-logos").remove([path]);
  return r;
}

/** Traitement par lots (tâche planifiée, administration) : entreprises sans logo jamais cherchées. */
export async function processMissingLogos(db: DB, { limit = 25, deadline = Date.now() + 60_000, fetchImpl = fetch }: { limit?: number; deadline?: number; fetchImpl?: typeof fetch } = {}) {
  const { data } = await db
    .from("companies")
    .select("id")
    .is("logo_path", null)
    .is("logo_auto_checked_at", null)
    .eq("is_demo", false)
    .neq("status", "SUSPENDED")
    .order("created_at", { ascending: false })
    .limit(limit);
  const stats = { checked: 0, found: 0, noSite: 0, notFound: 0, blocked: 0, errors: 0 };
  for (const { id } of data ?? []) {
    if (Date.now() > deadline) break;
    const r = await autoLogoFor(db, id, fetchImpl);
    if (!r) continue;
    stats.checked++;
    if (r.status === "FOUND") stats.found++;
    else if (r.status === "NO_SITE") stats.noSite++;
    else if (r.status === "NOT_FOUND") stats.notFound++;
    else if (r.status === "BLOCKED") stats.blocked++;
    else stats.errors++;
  }
  const { count } = await db.from("companies").select("id", { count: "exact", head: true }).is("logo_path", null).is("logo_auto_checked_at", null).eq("is_demo", false).neq("status", "SUSPENDED");
  return { ...stats, remaining: count ?? 0 };
}
