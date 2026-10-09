import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { normalizeText } from "@/lib/collect/normalize";

/**
 * Recherche des coordonnées professionnelles d'une entreprise, en trois temps :
 *  1. site officiel : d'abord la méthode GRATUITE (domaines déduits du nom, retenus seulement si
 *     le SIREN de l'entreprise figure sur le site — mentions légales obligatoires), puis, si des
 *     clés sont configurées, l'API Brave Search (BRAVE_SEARCH_API_KEY) ou Dropcontact
 *     (DROPCONTACT_API_KEY) — services payants dont les conditions autorisent cet usage ;
 *  2. page d'accueil, page Contact et mentions légales de CE site uniquement,
 *     en respectant robots.txt, avec un agent identifié ;
 *  3. seule une adresse GÉNÉRIQUE de l'entreprise est retenue (contact@, info@…),
 *     jamais une adresse nominative (prenom.nom@…).
 * Aucun moteur de recherche n'est interrogé sans API autorisée, aucune protection
 * (CAPTCHA, authentification, anti-robot) n'est contournée : une page refusée est abandonnée.
 */

export const USER_AGENT = "LinkProB2B-Outreach/1.0 (+https://www.linkprob2b.com/contact)";

/** Annuaires, réseaux sociaux et registres : jamais pris pour le site officiel. */
const NOT_OFFICIAL = [
  "societe.com", "pappers.fr", "pagesjaunes.fr", "infogreffe.fr", "verif.com", "manageo.fr", "linkedin.com", "facebook.com", "instagram.com",
  "twitter.com", "x.com", "youtube.com", "annuaire-entreprises.data.gouv.fr", "data.gouv.fr", "entreprises.lefigaro.fr", "kompass.com",
  "europages.fr", "mappy.com", "google.com", "bing.com", "wikipedia.org", "indeed.com", "indeed.fr", "welcometothejungle.com", "lefigaro.fr",
  "dnb.com", "corporama.com", "societeinfo.com", "score3.fr", "infonet.fr", "annuaire.com", "118712.fr", "118000.fr", "yelp.fr", "tripadvisor.fr",
  "doctrine.fr", "bodacc.fr", "boamp.fr", "francemarches.com", "marchesonline.com", "ted.europa.eu", "lagazettedescommunes.com", "pole-emploi.fr",
  "francetravail.fr", "leboncoin.fr", "trustpilot.com", "habitatpresto.com", "travaux.com", "starofservice.com", "houzz.fr", "ouest-france.fr",
];

/** Partie locale d'adresses génériques d'entreprise. */
const GENERIC = new Set([
  "contact", "contacts", "info", "infos", "information", "informations", "accueil", "bonjour", "hello", "commercial", "commerciale",
  "commerce", "vente", "ventes", "devis", "secretariat", "administration", "direction", "agence", "entreprise", "societe", "office",
  "bureau", "mail", "courrier", "sav", "serviceclient", "service-client", "service.client", "clients", "client", "atelier", "travaux",
  "chantier", "chantiers", "etudes", "be", "technique", "exploitation", "gestion", "planning", "standard", "reception", "boutique",
]);
const REJECT = /^(no-?reply|ne-?pas-?repondre|webmaster|postmaster|abuse|privacy|rgpd|dpo|cnil|jobs?|recrutement|emploi|candidature|rh|presse|example|test|wordpress|admin)$/;
const FREE_MAIL = new Set(["orange.fr", "wanadoo.fr", "gmail.com", "free.fr", "sfr.fr", "laposte.net", "outlook.fr", "outlook.com", "hotmail.fr", "hotmail.com", "neuf.fr", "bbox.fr", "yahoo.fr", "icloud.com"]);

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};
const isDirectory = (host: string) => NOT_OFFICIAL.some((d) => host === d || host.endsWith(`.${d}`));

/** Mots distinctifs du nom de l'entreprise (sans formes juridiques). */
export function nameTokens(name: string): string[] {
  const stop = new Set(["sarl", "sas", "sasu", "eurl", "sa", "sci", "snc", "scop", "ets", "etablissements", "societe", "entreprise", "groupe", "france", "et", "de", "des", "du", "la", "le", "les"]);
  return normalizeText(name).split(" ").filter((w) => w.length >= 3 && !stop.has(w));
}

/** Choix du site officiel parmi des résultats de recherche (ou null si aucun n'est crédible). */
export function pickWebsite(results: { url: string; title?: string }[], companyName: string): string | null {
  const tokens = nameTokens(companyName);
  const scored = results
    .map((r) => {
      const host = hostOf(r.url);
      if (!host || isDirectory(host) || !/^https?:/i.test(r.url)) return null;
      const compactHost = host.replace(/[^a-z0-9]/g, "");
      const inHost = tokens.filter((t) => compactHost.includes(t)).length;
      const inTitle = tokens.filter((t) => normalizeText(r.title ?? "").includes(t)).length;
      return { url: `https://${new URL(r.url).hostname}`, score: inHost * 3 + inTitle };
    })
    .filter((r): r is { url: string; score: number } => r !== null && r.score > 0)
    .sort((a, b) => b.score - a.score);
  // Exige au moins un mot du nom dans le domaine ou deux dans le titre : pas de site « au hasard ».
  return scored[0] && scored[0].score >= 2 ? scored[0].url : null;
}

/** Partie avant « @ » générique (fonction, service), jamais nominative. */
export function isGenericLocalPart(local: string): boolean {
  const l = local.trim().toLowerCase();
  if (REJECT.test(l)) return false;
  const base = l.replace(/[0-9]+$/, "");
  if (GENERIC.has(base)) return true;
  // Un seul qualificatif après le mot générique (« contact.brest », « devis-pro ») ; un prénom et
  // un nom (« commercial.jean.dupont ») sont refusés.
  const m = /^([a-z]+)[._-]([a-z0-9]+)$/.exec(base);
  return Boolean(m && GENERIC.has(m[1]));
}

/** Adresse générique d'entreprise (jamais nominative) rattachée au site, ou null. */
export function isGenericCompanyEmail(email: string, siteHost: string | null): boolean {
  const m = /^([a-z0-9._+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(email.trim().toLowerCase());
  if (!m) return false;
  const [, local, domain] = m;
  if (!isGenericLocalPart(local)) return false;
  if (siteHost && (domain === siteHost || domain.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${domain}`))) return true;
  return FREE_MAIL.has(domain);
}

/** Adresses présentes dans une page HTML (liens mailto et texte, y compris « [at] »). */
export function extractEmails(html: string): string[] {
  const text = html
    .replace(/&#64;|&#x40;/gi, "@")
    .replace(/\s*[[(]\s*(at|arobase)\s*[\])]\s*/gi, "@")
    .replace(/\s*[[(]\s*(dot|point)\s*[\])]\s*/gi, ".");
  const found = new Set<string>();
  for (const m of text.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of text.matchAll(/[a-z0-9._+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi)) found.add(m[0].toLowerCase());
  return [...found].filter((e) => !/\.(png|jpe?g|gif|svg|webp)$/.test(e));
}

/** Liens internes vers les pages Contact / mentions légales. */
export function contactLinks(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = normalizeText(m[2].replace(/<[^>]+>/g, " "));
    const href = m[1];
    if (!/contact|mentions?[- ]legales|nous[- ]joindre|coordonnees|a[- ]propos/.test(`${normalizeText(href)} ${label}`)) continue;
    try {
      const u = new URL(href, base);
      if (hostOf(u.href) === hostOf(base) && /^https?:$/.test(u.protocol) && !out.includes(u.href)) out.push(u.href);
    } catch {}
  }
  return out.slice(0, 3);
}

/**
 * robots.txt : le chemin est-il autorisé pour notre agent ? Les règles du groupe qui nomme
 * notre agent s'appliquent seules ; à défaut, celles du groupe « * » (RFC 9309).
 */
export function robotsAllows(robots: string, path: string): boolean {
  type Group = { agents: string[]; allow: string[]; disallow: string[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [k, ...rest] = line.split(":");
    const key = k?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], allow: [], disallow: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current && (key === "allow" || key === "disallow") && value) current[key].push(value);
  }
  const ours = groups.filter((g) => g.agents.some((a) => a.includes("linkprob2b")));
  const chosen = ours.length ? ours : groups.filter((g) => g.agents.includes("*"));
  if (!chosen.length) return true;
  const allow = chosen.flatMap((g) => g.allow);
  const disallow = chosen.flatMap((g) => g.disallow);
  const longest = (rules: string[]) => Math.max(-1, ...rules.filter((r) => path.startsWith(r.replace(/\*.*$/, ""))).map((r) => r.length));
  return longest(allow) >= longest(disallow);
}

// ---------------------------------------------------------------- Réseau

/** Refuse les adresses internes (protection contre les requêtes vers le réseau privé). */
async function isPublicHost(host: string): Promise<boolean> {
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) return false;
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) return false;
  return addrs.every(({ address }) => !/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd]|fe80)/i.test(address));
}

async function fetchText(url: string, fetchImpl: typeof fetch, maxBytes = 800_000): Promise<{ status: number; text: string } | null> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || !(await isPublicHost(u.hostname))) return null;
  const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
  // Redirection vers un autre site : page ignorée (son robots.txt n'a pas été consulté)
  if (res.url && hostOf(res.url) && hostOf(res.url) !== hostOf(url)) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || (!type.includes("html") && !type.includes("text"))) return { status: res.status, text: "" };
  const text = (await res.text()).slice(0, maxBytes);
  return { status: res.status, text };
}

export type WebsiteSearch = (company: { name: string; city: string | null; siren: string | null }) => Promise<{ website: string | null; email?: string | null; provider: string } | null>;

/** Site officiel via l'API Brave Search (abonnement, conditions d'utilisation respectées). */
export function braveSearch(key: string, fetchImpl: typeof fetch = fetch): WebsiteSearch {
  return async (c) => {
    const q = `${c.name} ${c.city ?? ""} site officiel`.trim();
    const res = await fetchImpl(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=fr&search_lang=fr&count=10`, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 429) throw new Error("Brave Search : limite de requêtes atteinte (429)");
    if (!res.ok) throw new Error(`Brave Search : HTTP ${res.status}`);
    const body = (await res.json()) as { web?: { results?: { url: string; title?: string }[] } };
    return { website: pickWebsite(body.web?.results ?? [], c.name), provider: "Brave Search" };
  };
}

/** Site (et éventuelle adresse générique) via Dropcontact — service français conforme au RGPD. */
export function dropcontactSearch(key: string, fetchImpl: typeof fetch = fetch): WebsiteSearch {
  return async (c) => {
    const post = await fetchImpl("https://api.dropcontact.io/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Access-Token": key },
      body: JSON.stringify({ data: [{ company: c.name, ...(c.siren ? { siren: c.siren } : {}), ...(c.city ? { city: c.city } : {}) }], siren: true, language: "fr" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!post.ok) throw new Error(`Dropcontact : HTTP ${post.status}`);
    const { request_id } = (await post.json()) as { request_id?: string };
    if (!request_id) return null;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetchImpl(`https://api.dropcontact.io/batch/${request_id}`, { headers: { "X-Access-Token": key }, signal: AbortSignal.timeout(15_000) });
      const body = (await res.json()) as { success?: boolean; data?: { website?: string; email?: { email: string; qualification?: string }[] }[] };
      if (body.success && body.data) {
        const d = body.data[0] ?? {};
        const website = d.website ? (/^https?:/i.test(d.website) ? d.website : `https://${d.website}`) : null;
        const host = website ? hostOf(website) : null;
        const email = (d.email ?? []).map((e) => e.email).find((e) => isGenericCompanyEmail(e, host)) ?? null;
        return { website, email, provider: "Dropcontact" };
      }
    }
    return null;
  };
}

/**
 * Domaines plausibles d'une entreprise, déduits de son nom (ex. « OCR RHONE ALPES » →
 * ocr-rhone-alpes.fr, ocrrhonealpes.fr, …). Simple hypothèse : un domaine n'est retenu
 * qu'après vérification du SIREN sur le site (voir freeWebsiteSearch).
 */
export function domainCandidates(name: string): string[] {
  const words = normalizeText(name)
    .replace(/\b(sarl|sas|sasu|eurl|sa|sci|snc|scop|ets|etablissements|societe|entreprise)\b/g, " ")
    .split(" ")
    .filter((w) => /^[a-z0-9]+$/.test(w));
  if (!words.length) return [];
  const labels = new Set<string>();
  const joined = words.join("");
  const dashed = words.join("-");
  if (joined.length >= 3 && joined.length <= 40) labels.add(dashed).add(joined);
  // Nom long : les deux premiers mots (ex. « Dupont Electricite Services » → dupont-electricite)
  if (words.length > 2) labels.add(words.slice(0, 2).join("-")).add(words.slice(0, 2).join(""));
  const out: string[] = [];
  for (const l of labels) for (const tld of ["fr", "com"]) out.push(`${l}.${tld}`);
  return out.slice(0, 8);
}

/** Le SIREN (9 chiffres, éventuellement espacés « 123 456 789 ») figure-t-il dans la page ? */
export function sirenOnPage(html: string, siren: string): boolean {
  if (!/^\d{9}$/.test(siren)) return false;
  const text = html.replace(/<[^>]+>/g, " ").replace(/(\d)[\s\u00a0.]+(?=\d)/g, "$1");
  return new RegExp(`(^|\\D)${siren}`).test(text);
}

/**
 * Méthode GRATUITE (aucune API payante) : essaie les domaines déduits du nom et ne retient un site
 * que si le SIREN de l'entreprise y figure (page d'accueil ou mentions légales). robots.txt respecté,
 * aucune page protégée n'est contournée. Ne lève jamais d'erreur : en cas de doute, aucun site.
 */
export function freeWebsiteSearch(fetchImpl: typeof fetch = fetch): WebsiteSearch {
  return async (c) => {
    if (!c.siren) return null;
    for (const domain of domainCandidates(c.name)) {
      try {
        if (!(await isPublicHost(domain))) continue; // le domaine n'existe pas (résolution DNS)
        const origin = `https://${domain}`;
        const robots = await fetchText(`${origin}/robots.txt`, fetchImpl, 100_000).catch(() => null);
        // robots.txt absent (4xx) : tout est permis ; injoignable ou en erreur serveur (5xx) : rien n'est exploré
    const allowed = (path: string) => robots !== null && robots.status < 500 && (robots.status >= 400 || robotsAllows(robots.text, path));
        if (!allowed("/")) continue;
        const home = await fetchText(origin, fetchImpl).catch(() => null);
        if (!home?.text) continue;
        if (sirenOnPage(home.text, c.siren)) return { website: origin, provider: "domaine vérifié par le SIREN (gratuit)" };
        for (const link of contactLinks(home.text, origin)) {
          if (!allowed(new URL(link).pathname)) continue;
          const page = await fetchText(link, fetchImpl).catch(() => null);
          if (page?.text && sirenOnPage(page.text, c.siren)) return { website: origin, provider: "domaine vérifié par le SIREN (gratuit)" };
        }
      } catch {
        // domaine suivant
      }
    }
    return null;
  };
}

export type EnrichResult = { status: "FOUND" | "NO_WEBSITE" | "NO_EMAIL" | "BLOCKED" | "ERROR"; website: string | null; email: string | null; source: string | null; note: string };

/** Recherche complète pour une entreprise. */
export async function enrichCompany(
  c: { name: string; city: string | null; siren: string | null; website: string | null },
  searchers: WebsiteSearch[],
  fetchImpl: typeof fetch = fetch,
): Promise<EnrichResult> {
  let website = c.website;
  let provider = website ? "fiche existante" : "";
  let lastError: string | null = null;
  for (const search of website ? [] : searchers) {
    try {
      const r = await search(c);
      if (r?.email && r.website) return { status: "FOUND", website: r.website, email: r.email, source: `${r.provider} (adresse générique de l'entreprise)`, note: "" };
      if (r?.website) {
        website = r.website;
        provider = r.provider;
        break;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Erreur";
    }
  }
  // Un service en erreur (ex. limite de requêtes) : nouvelle tentative au prochain passage, pas « sans site »
  if (!website && lastError) return { status: "ERROR", website: null, email: null, source: null, note: lastError };
  if (!website) return { status: "NO_WEBSITE", website: null, email: null, source: null, note: "Aucun site officiel identifié" };
  const host = hostOf(website);
  try {
    const robots = await fetchText(`${new URL(website).origin}/robots.txt`, fetchImpl, 100_000).catch(() => null);
    // robots.txt absent (4xx) : tout est permis ; injoignable ou en erreur serveur (5xx) : rien n'est exploré
    const allowed = (path: string) => robots !== null && robots.status < 500 && (robots.status >= 400 || robotsAllows(robots.text, path));
    const pages = [website];
    if (!allowed("/")) return { status: "BLOCKED", website, email: null, source: null, note: "Exploration refusée par robots.txt" };
    const home = await fetchText(website, fetchImpl);
    if (!home || home.status >= 400) return { status: home && [401, 403, 429].includes(home.status) ? "BLOCKED" : "ERROR", website, email: null, source: null, note: `Site inaccessible (${home?.status ?? "adresse non publique"})` };
    const candidates = [home.text];
    for (const link of contactLinks(home.text, website)) {
      if (!allowed(new URL(link).pathname)) continue;
      const page = await fetchText(link, fetchImpl).catch(() => null);
      if (page?.text) {
        candidates.push(page.text);
        pages.push(link);
      }
    }
    for (const [i, html] of candidates.entries()) {
      const email = extractEmails(html).find((e) => isGenericCompanyEmail(e, host));
      if (email) {
        return { status: "FOUND", website, email, source: `Site officiel de l'entreprise (${pages[i] ?? website}), consulté le ${new Date().toLocaleDateString("fr-FR")} — site trouvé via ${provider}`, note: "" };
      }
    }
    return { status: "NO_EMAIL", website, email: null, source: null, note: "Aucune adresse générique publiée sur le site" };
  } catch (e) {
    return { status: "ERROR", website, email: null, source: null, note: e instanceof Error ? e.message.slice(0, 200) : "Erreur" };
  }
}

/** Services de recherche configurés (clés en variables d'environnement, jamais exposées). */
export function configuredSearchers(): WebsiteSearch[] {
  const out: WebsiteSearch[] = [];
  // Méthode gratuite d'abord (économise le forfait des services payants) ; désactivable (tests).
  if (process.env.OUTREACH_FREE_WEBSITE_SEARCH !== "false") out.push(freeWebsiteSearch());
  if (process.env.BRAVE_SEARCH_API_KEY) out.push(braveSearch(process.env.BRAVE_SEARCH_API_KEY));
  if (process.env.DROPCONTACT_API_KEY) out.push(dropcontactSearch(process.env.DROPCONTACT_API_KEY));
  return out;
}
