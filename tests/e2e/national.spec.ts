import { expect, test } from "@playwright/test";
import { newPage } from "./helpers";

test("recherche nationale : France entière par défaut, filtre région, pages SEO régionales", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/opportunites");
  const region = page.locator("#d-region");
  await expect(region).toHaveValue("");
  await expect(region.locator("option:checked")).toHaveText("France entière");
  await expect(region.locator("option")).toHaveCount(19);
  await region.selectOption("bretagne");
  await page.locator("aside").getByRole("button", { name: "Appliquer" }).click();
  await expect(page).toHaveURL(/region=bretagne/);

  await page.goto("/opportunites/france");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Opportunités B2B partout en France");
  await page.goto("/opportunites/bretagne");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Opportunités B2B en Bretagne");
  await expect(page).toHaveTitle(/Opportunités B2B et appels d'offres en Bretagne/);
  await page.goto("/opportunites/bretagne/finistere");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Opportunités dans le département Finistère");
  // Canonique de l'ancienne adresse département
  await page.goto("/opportunites/finistere");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/opportunites\/bretagne\/finistere$/);
  await page.goto("/opportunites/ile-de-france/paris");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Opportunités dans le département Paris");
  // Département hors de la région : page introuvable
  const res = await page.goto("/opportunites/bretagne/paris");
  expect(res?.status()).toBe(404);
});

test("mobile : pages nationales sans défilement horizontal", async ({ browser }) => {
  const page = await newPage(browser, { width: 375, height: 800 });
  for (const path of ["/opportunites/france", "/opportunites/occitanie", "/opportunites/ile-de-france/paris"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} déborde`).toBeLessThanOrEqual(0);
  }
});

test("accueil : le nombre d'opportunités disponibles est celui de la page Opportunités", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/opportunites");
  const listed = (await page.locator('p[aria-live="polite"] strong').first().textContent())!.replace(/\s/g, "");
  await page.goto("/");
  const pill = await page.getByText(/disponibles? aujourd'hui partout en France/).textContent();
  expect(pill!.replace(/\s/g, "")).toContain(listed);
});
