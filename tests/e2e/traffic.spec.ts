import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, memberPage, newPage, expectNotFound } from "./helpers";
import { buyerSlug } from "../../src/lib/buyer-slug";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const BUYER = `Mairie de Saint-Étienne E2E ${RUN}`;
const TITLE = `Rénovation de l'éclairage public E2E ${RUN}`;
let id = "";

test.beforeAll(async () => {
  const { data, error } = await db
    .from("opportunities")
    .insert({
      title: TITLE,
      description: "Avis de marché de test suffisamment long pour la page acheteur.",
      type: "PUBLIC_TENDER",
      origin: "EXTERNAL",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      external_buyer_name: BUYER,
      city: "Saint-Étienne",
      department_code: "42",
      region: "Auvergne-Rhône-Alpes",
      sector_slug: "electricite-automatisme",
      response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  id = data.id;
  // Offre externe : sa source est citée (sans source, elle n'est ni indexée ni diffusée dans le flux)
  const { data: boamp } = await db.from("external_sources").select("id").eq("code", "boamp").single();
  const { error: e2 } = await db.from("opportunity_sources").insert({ opportunity_id: id, source_id: boamp!.id, external_id: `e2e-${RUN}`, original_url: "https://www.boamp.fr/avis/detail/e2e", is_primary: true });
  if (e2) throw e2;
});

test.afterAll(async () => {
  await db.from("opportunities").delete().eq("id", id);
});

test("acheteur public : lien depuis l'offre, page dédiée, liste des acheteurs", async ({ browser }) => {
  const page = await memberPage(browser);
  await page.goto(`/opportunites/${id}`);
  await page.getByRole("link", { name: BUYER }).first().click();
  await expect(page).toHaveURL(new RegExp(`/acheteurs/${buyerSlug(BUYER)}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(BUYER);
  await expect(page.getByRole("link", { name: TITLE })).toBeVisible();
  // Données structurées : fil d'Ariane
  expect(await page.locator('script[type="application/ld+json"]').allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining("BreadcrumbList")]));

  // Acheteur inconnu : 404
  await expectNotFound(page, await page.goto(`/acheteurs/acheteur-inconnu-${RUN.toLowerCase()}`));

  await page.goto("/acheteurs");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Pied de page : lien vers la liste des acheteurs
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Acheteurs publics" })).toBeVisible();
});

test("boutons de partage d'une offre ouverte", async ({ browser }) => {
  const page = await memberPage(browser);
  await page.goto(`/opportunites/${id}`);
  const offer = encodeURIComponent(`/opportunites/${id}`);
  await expect(page.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", new RegExp(`linkedin\\.com/sharing/share-offsite/\\?url=.*${offer}`));
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", new RegExp(`^https://wa\\.me/\\?text=.*${offer}`));
  await expect(page.getByRole("link", { name: "E-mail", exact: true })).toHaveAttribute("href", /^mailto:\?subject=/);
});

test("flux RSS des offres et lien dans les pages", async ({ browser, request }) => {
  const res = await request.get("/flux/opportunites.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/rss+xml");
  expect(await res.text()).toContain(`/opportunites/${id}</guid>`);
  const page = await newPage(browser);
  await page.goto("/");
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute("href", "/flux/opportunites.xml");
});

test("tableau de bord : message LinkedIn du jour prêt à copier", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "admin@demo.linkprob2b.test");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Message prêt à publier sur LinkedIn" })).toBeVisible();
  await expect(page.getByTestId("social-post")).toContainText("aujourd'hui en France sur LinkProB2B");
  await expect(page.getByRole("button", { name: "Copier le message" })).toBeVisible();
});

test("navigation : réponse immédiate au clic (squelette de chargement) puis contenu", async ({ browser }) => {
  const page = await memberPage(browser);
  // Le lien visible est préchargé (squelette compris) : on attend ce préchargement avant le clic
  const prefetched = page.waitForResponse((r) => /\/opportunites\?_rsc=/.test(r.url()) && Boolean(r.request().headers()["next-router-prefetch"]));
  await page.goto("/");
  await prefetched;
  // Serveur volontairement ralenti : le squelette s'affiche avant la page demandée
  // (le préchargement, lui, n'est pas ralenti : il apporte le squelette à l'avance)
  await page.route(/\/opportunites\?_rsc=/, async (route) => {
    if (!route.request().headers()["next-router-prefetch"]) await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.getByRole("banner").getByRole("link", { name: "Explorer les opportunités" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Chargement" })).toBeAttached({ timeout: 1000 });
  await expect(page).toHaveURL(/\/opportunites$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("ingénieurs d'affaires : bouton d'accueil, page dédiée et échéance dans l'agenda", async ({ browser }) => {
  const page = await newPage(browser, { width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("engineer-cta").click();
  await expect(page).toHaveURL(/\/ingenieurs-affaires$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vous êtes ingénieur d'affaires ?");
  await expect(page.getByTestId("engineer-tools").getByRole("listitem")).toHaveCount(8);
  await page.getByRole("link", { name: "Échéances les plus proches" }).click();
  // Recherche réservée aux membres : inscription, puis retour sur la liste triée
  await expect(page).toHaveURL(/\/inscription\?suite=%2Fopportunites%3Ftri%3Ddeadline/);

  // Fiche d'une offre ouverte (membre) : l'échéance s'ajoute à l'agenda (.ics avec rappels)
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto(`/opportunites/${id}`);
  const link = page.getByTestId("deadline-calendar");
  await expect(link).toHaveAttribute("href", `/api/opportunites/${id}/agenda`);
  const res = await page.request.get(`/api/opportunites/${id}/agenda`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const ics = await res.text();
  expect(ics).toContain("BEGIN:VEVENT");
  expect(ics).toContain("TRIGGER:-P7D");
  expect(ics).toContain(`/opportunites/${id}`);
  expect((await page.request.get("/api/opportunites/00000000-0000-0000-0000-000000000000/agenda")).status()).toBe(404);
});
