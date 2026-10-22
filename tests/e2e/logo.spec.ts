import { expect, test } from "@playwright/test";
import { newPage, RUN, signUpWithCompany } from "./helpers";

test("logo de l'entreprise : rappel, ajout avec aperçu, affichage public, retrait", async ({ browser }) => {
  const page = await newPage(browser);
  const name = `E2E Logo ${RUN}`;
  await signUpWithCompany(page, "logo", name, "Fournisseur / prestataire");

  // Rappel dans « Pour bien démarrer »
  const start = page.getByTestId("getting-started");
  await expect(start).toContainText("Ajouter le logo de l'entreprise");
  await start.getByRole("link", { name: "Ajouter mon logo" }).click();
  await expect(page).toHaveURL(/\/dashboard\/entreprise/);

  const block = page.getByTestId("logo-form");
  await block.getByLabel("Fichier du logo").setInputFiles("public/brand/logo-mark.png");
  await expect(block.getByRole("img", { name: "Aperçu du nouveau logo" })).toBeVisible();
  await block.getByRole("button", { name: "Enregistrer le logo" }).click();
  await expect(block).toContainText("Logo enregistré");

  // Le logo est servi et visible sur la fiche publique
  await page.reload();
  const logo = page.getByTestId("logo-form").getByRole("img", { name: `Logo ${name}` });
  await expect(logo).toBeVisible();
  const src = await logo.getAttribute("src");
  expect(src).toMatch(/^\/api\/logos\//);
  expect((await page.request.get(src!)).status()).toBe(200);
  await page.getByRole("link", { name: "Voir la page publique" }).click();
  await expect(page.getByRole("img", { name: `Logo ${name}` }).first()).toBeVisible();

  // Retrait : les initiales reviennent
  await page.goto("/dashboard/entreprise");
  await page.getByTestId("logo-form").getByRole("button", { name: "Retirer le logo" }).click();
  await expect(page.getByTestId("logo-form")).toContainText("Logo retiré");
  await page.reload();
  await expect(page.getByTestId("logo-form").getByRole("img", { name: `Logo ${name}` })).toHaveCount(0);
});

test("fichier refusé : format non accepté", async ({ browser }) => {
  const page = await newPage(browser);
  await signUpWithCompany(page, "logo-ko", `E2E Logo KO ${RUN}`, "Fournisseur / prestataire");
  await page.goto("/dashboard/entreprise");
  const block = page.getByTestId("logo-form");
  await block.getByLabel("Fichier du logo").setInputFiles({ name: "logo.txt", mimeType: "text/plain", buffer: Buffer.from("pas une image") });
  await block.getByRole("button", { name: "Enregistrer le logo" }).click();
  await expect(block.locator('[role="alert"], .text-red-700, [data-tone="error"]').first()).toBeVisible();
});
