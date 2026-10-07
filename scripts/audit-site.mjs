/**
 * Audit automatique d'un site LinkProB2B (local ou production) :
 * parcours des liens internes, statut HTTP, title / meta description / H1 /
 * canonical, liens cassés, textes suspects, débordement horizontal sur mobile.
 *
 *   node scripts/audit-site.mjs https://www.linkprob2b.com [maxPages]
 * Sortie : rapport JSON (stdout) — lecture seule, aucune donnée modifiée.
 */
import { chromium } from "@playwright/test";

const BASE = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
const MAX = Number(process.argv[3] ?? 160);
const SUSPECT = [/lorem/i, /\bTODO\b/, /\bpilote\b/i, /version de test/i, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /coming soon/i, /bient[ôo]t disponible/i, /\bdémo\b/i];

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
const mobile = await browser.newContext({ viewport: { width: 375, height: 800 }, locale: "fr-FR" });
const page = await ctx.newPage();
const mpage = await mobile.newPage();

const queue = ["/", "/opportunites", "/opportunites/france", "/opportunites/bretagne", "/opportunites/ile-de-france", "/entreprises", "/analyses", "/tarifs", "/faq", "/publier", "/inscription", "/connexion", "/ressources", "/comment-ca-marche", "/fournisseurs", "/demandeurs", "/a-propos", "/contact", "/mentions-legales", "/cgu", "/confidentialite", "/cookies", "/conditions-abonnement", "/sitemap.xml", "/robots.txt"];
const seen = new Set();
const pages = [];
const broken = [];
const titles = new Map();
let oppSamples = 0;

const norm = (href) => {
  try {
    const u = new URL(href, BASE);
    if (u.origin !== new URL(BASE).origin) return null;
    if (/^\/(api|_next|visuels|auth|admin|dashboard)/.test(u.pathname)) return null;
    // Limiter les variantes : on ignore les paramètres de recherche
    return u.pathname;
  } catch {
    return null;
  }
};

while (queue.length && pages.length < MAX) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  // Échantillon de fiches d'opportunités et d'entreprises (pas toutes)
  if (/^\/opportunites\/[0-9a-f-]{36}$/.test(path) && ++oppSamples > 12) continue;
  const t0 = Date.now();
  let res;
  try {
    res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45_000 });
  } catch (e) {
    broken.push({ path, error: String(e).slice(0, 200) });
    continue;
  }
  const ms = Date.now() - t0;
  const status = res?.status() ?? 0;
  if (status >= 400) {
    broken.push({ path, status });
    continue;
  }
  if (!res?.headers()["content-type"]?.includes("text/html")) {
    pages.push({ path, status, ms, type: res?.headers()["content-type"] });
    continue;
  }
  const info = await page.evaluate(() => {
    const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.getAttribute("content") ?? null;
    const text = document.querySelector("main")?.innerText ?? document.body.innerText;
    return {
      title: document.title,
      description: meta("description"),
      robots: meta("robots"),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null,
      h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()),
      words: text.split(/\s+/).filter(Boolean).length,
      links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
      text: text.slice(0, 20000),
      imgsNoAlt: [...document.querySelectorAll("img:not([alt])")].length,
    };
  });
  const suspects = SUSPECT.filter((r) => r.test(info.text)).map((r) => {
    const m = info.text.match(r);
    const i = m?.index ?? 0;
    return `${r} « ${info.text.slice(Math.max(0, i - 60), i + 60).replace(/\s+/g, " ")} »`;
  });
  const issues = [];
  if (!info.title) issues.push("title manquant");
  else if (info.title.length > 70) issues.push(`title long (${info.title.length})`);
  if (!info.description) issues.push("meta description manquante");
  else if (info.description.length < 70 || info.description.length > 170) issues.push(`description ${info.description.length} car.`);
  if (info.h1.length !== 1) issues.push(`${info.h1.length} H1`);
  if (!info.canonical && !info.robots?.includes("noindex")) issues.push("canonical manquant");
  if (info.words < 120 && !info.robots?.includes("noindex")) issues.push(`contenu court (${info.words} mots)`);
  if (info.imgsNoAlt) issues.push(`${info.imgsNoAlt} image(s) sans alt`);
  if (ms > 4000) issues.push(`lent (${ms} ms)`);
  // Mobile : débordement horizontal
  try {
    await mpage.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) issues.push(`débordement mobile ${overflow}px`);
  } catch {}
  if (titles.has(info.title)) issues.push(`title dupliqué avec ${titles.get(info.title)}`);
  else titles.set(info.title, path);
  pages.push({ path, status, ms, title: info.title, description: info.description, h1: info.h1, robots: info.robots, words: info.words, issues, suspects });
  for (const l of info.links) {
    const p = norm(l);
    if (p && !seen.has(p) && !queue.includes(p)) queue.push(p);
  }
}
await browser.close();

if (process.env.SUMMARY) {
  console.log(`AUDIT ${BASE} — ${pages.length} pages, ${broken.length} en erreur`);
  for (const b of broken) console.log(`BROKEN ${b.path} ${b.status ?? b.error}`);
  for (const p of pages) console.log(`PAGE ${p.path} | ${p.status} | ${p.ms}ms | ${p.words ?? "-"} mots | ${JSON.stringify(p.h1 ?? [])} | ${p.title ?? ""} | ${(p.issues ?? []).join("; ")}${p.suspects?.length ? " | SUSPECT " + p.suspects.join(" || ") : ""}`);
} else console.log(JSON.stringify({ base: BASE, crawled: pages.length, broken, pages }, null, 1));
