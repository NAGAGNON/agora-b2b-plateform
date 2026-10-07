import { expect, test } from "@playwright/test";
import { login, newPage } from "./helpers";

const WIDTHS = [375, 390, 768, 1024, 1440];
const PUBLIC_PAGES = ["/", "/opportunites", "/entreprises", "/publier", "/connexion", "/comment-ca-marche", "/tarifs", "/confidentialite", "/cookies"];

for (const width of WIDTHS) {
  test(`aucun défilement horizontal à ${width}px`, async ({ browser }) => {
    const page = await newPage(browser, { width, height: 900 });
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} déborde de ${overflow}px`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `screenshots/responsive/${width}${path.replace(/\//g, "_") || "_accueil"}.png`, fullPage: true });
    }
    // Fiche opportunité
    await page.goto("/opportunites");
    await page.locator("article h2 a").first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `screenshots/responsive/${width}_fiche.png`, fullPage: true });

    // Espace connecté
    await login(page, "fournisseur@demo.linkprob2b.test");
    for (const path of ["/dashboard", "/dashboard/pipeline", "/dashboard/opportunites"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} déborde de ${overflow}px`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `screenshots/responsive/${width}${path.replace(/\//g, "_")}.png`, fullPage: true });
    }
  });
}

test("administration sans défilement horizontal sur mobile", async ({ browser }) => {
  const page = await newPage(browser, { width: 375, height: 800 });
  await login(page, "admin@demo.linkprob2b.test");
  for (const path of ["/admin", "/admin/opportunites", "/admin/emails"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} déborde de ${overflow}px`).toBeLessThanOrEqual(0);
  }
});

test("menu burger et filtres en tiroir sur mobile", async ({ browser }) => {
  const page = await newPage(browser, { width: 375, height: 800 });
  await page.goto("/opportunites");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Annuaire" })).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).click();
  await page.getByRole("button", { name: /^Filtres/ }).click();
  await expect(page.getByRole("dialog", { name: "Filtrer les opportunités" })).toBeVisible();
  await page.getByRole("dialog").getByLabel("Secteur").selectOption("cybersecurite");
  await page.getByRole("button", { name: "Voir les résultats" }).click();
  await expect(page).toHaveURL(/secteur=cybersecurite/);
});
