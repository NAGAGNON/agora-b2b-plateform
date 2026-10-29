import { expect, test } from "@playwright/test";
import { expectNotFound, memberPage, newPage } from "./helpers";
import { GUIDES } from "../../src/content/guides";

test("formulaire de contact : la saisie est conservée quand l'envoi est refusé", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/contact");
  await page.getByLabel("Nom").fill("Jeanne Martin");
  await page.getByLabel("E-mail").fill("jeanne.martin@example.test");
  await page.getByLabel("Entreprise").fill("Atelier Martin");
  await page.getByLabel("Objet").selectOption("Question sur la plateforme");
  await page.getByLabel("Message").fill("Court");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("Le message : 10 caractères minimum").first()).toBeVisible();
  await expect(page.getByLabel("Nom")).toHaveValue("Jeanne Martin");
  await expect(page.getByLabel("E-mail")).toHaveValue("jeanne.martin@example.test");
  await expect(page.getByLabel("Entreprise")).toHaveValue("Atelier Martin");
  await expect(page.getByLabel("Objet")).toHaveValue("Question sur la plateforme");
  await expect(page.getByLabel("Message")).toHaveValue("Court");
});

test("page régionale : un autre choix de région n'est plus ignoré", async ({ browser }) => {
  const page = await memberPage(browser);
  await page.goto("/opportunites/bretagne?region=normandie");
  await expect(page).toHaveURL(/\/opportunites\?region=normandie$/);
});

test("pagination au-delà des résultats : page introuvable (jamais une page vide indexée)", async ({ browser }) => {
  const page = await memberPage(browser);
  await expectNotFound(page, await page.goto("/opportunites?page=999"));
  await expectNotFound(page, await page.goto("/analyses?page=500"));
});

test("guides signés par l'auteur", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto(`/ressources/${GUIDES[0].slug}`);
  await expect(page.getByText("YEO NAGAGNON GUY ROLAND")).toBeVisible();
  expect(await page.locator('script[type="application/ld+json"]').allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining("YEO NAGAGNON GUY ROLAND")]));
});
