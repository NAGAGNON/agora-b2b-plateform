import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, newPage, expectNotFound } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const slug = `analyse-e2e-${RUN.toLowerCase()}`;

test.beforeAll(async () => {
  const { error } = await db.from("articles").insert({
    slug,
    topic_key: `e2e:${RUN}`,
    title: `Analyse E2E ${RUN} des marchés informatiques`,
    description: "Analyse de test : 6 opportunités ouvertes en Finistère, d'après BOAMP et TED.",
    body: {
      title: "x",
      description: "x",
      intro: "Au 7 octobre 2026, 6 opportunités sont ouvertes.",
      sections: [{ heading: "Vue d'ensemble", paragraphs: ["Données BOAMP et TED."] }],
      faq: [{ question: "D'où viennent les données ?", answer: "Des avis officiels BOAMP et TED." }],
    },
    facts: {
      theme: "Département : Finistère",
      periode: "octobre 2026",
      date_des_donnees: "7 octobre 2026",
      opportunites_ouvertes: 6,
      dont_marches_publics_externes: 6,
      date_limite_dans_les_30_jours: 4,
      par_secteur: [{ name: "Informatique", count: 4 }, { name: "Nettoyage", count: 2 }],
      principaux_acheteurs: [{ name: "REGION BRETAGNE", count: 2 }, { name: "Région Bretagne", count: 1 }, { name: "Ville de Brest", count: 1 }],
      prochaines_dates_limites: [],
      sources: "BOAMP et TED.",
    },
    status: "PUBLISHED",
    published_at: new Date().toISOString(),
  });
  if (error) throw error;
});
test.afterAll(async () => {
  await db.from("articles").delete().eq("slug", slug);
});

const jsonLd = async (page: import("@playwright/test").Page) =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((t) => {
    const d = JSON.parse(t);
    return Array.isArray(d) ? d : [d];
  }) as { "@type": string }[];

test("SEO : analyses publiées, données structurées, sitemap et clé IndexNow", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/analyses");
  await page.getByRole("link", { name: new RegExp(`Analyse E2E ${RUN}`) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Analyse E2E ${RUN}`);
  await expect(page.getByText("Rédigé par")).toBeVisible();
  await expect(page.getByText(/intelligence artificielle/)).toHaveCount(0);
  // Couverture générée et graphiques issus des données (libellés fusionnés : Région Bretagne = 3)
  const cover = await page.request.get(`/visuels/analyses/${slug}`);
  expect(cover.status()).toBe(200);
  expect(cover.headers()["content-type"]).toContain("image/png");
  await expect(page.getByRole("img", { name: /opportunités ouvertes/ })).toBeVisible();
  await expect(page.locator("figcaption", { hasText: "Opportunités par secteur" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Région Bretagne 3 consultations/ })).toBeAttached();
  const types = (await jsonLd(page)).map((d) => d["@type"]);
  expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "Article", "BreadcrumbList", "FAQPage"]));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Analyses des marchés" })).toBeVisible();
  await page.goto("/faq");
  expect((await jsonLd(page)).map((d) => d["@type"])).toContain("FAQPage");
  await page.goto("/opportunites");
  await page.locator("article h2 a").first().click();
  await page.waitForURL(/\/opportunites\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("navigation", { name: "Fil d'Ariane" })).toBeVisible();
  expect((await jsonLd(page)).map((d) => d["@type"])).toContain("BreadcrumbList");

  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/analyses</loc>"); // le sitemap est régénéré toutes les heures
  const key = await page.request.get("/indexnow.txt");
  expect(key.status()).toBe(200);
  expect((await key.text()).trim()).toMatch(/^[a-f0-9]{32}$/);
});

test("administration des articles : réglages et dépublication", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "admin@demo.linkprob2b.test");
  await page.goto("/admin/articles");
  await expect(page.getByRole("heading", { name: /Articles/ }).first()).toBeVisible();
  await expect(page.getByText("ANTHROPIC_API_KEY").first()).toBeVisible();
  const row = page.locator("li", { hasText: `Analyse E2E ${RUN}` });
  await row.getByRole("button", { name: "Dépublier" }).click();
  await expect(row.getByRole("button", { name: "Publier" })).toBeVisible();
  const anonPage = await newPage(browser);
  await expectNotFound(anonPage, await anonPage.goto(`/analyses/${slug}`));
});
