import { expect, test } from "@playwright/test";
import { login, newPage } from "./helpers";

test("les espaces privés exigent une connexion", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fdashboard/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/connexion/);
  await page.goto("/dashboard/pipeline");
  await expect(page).toHaveURL(/\/connexion/);
});

test("un utilisateur standard n'accède pas à l'administration", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard\?refus=admin/);
  await expect(page.getByText("Accès refusé")).toBeVisible();
});

test("un modérateur n'accède pas aux pages réservées aux administrateurs", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "moderateur@demo.linkprob2b.test");
  await page.goto("/admin/moderation");
  await expect(page.getByRole("heading", { name: "Modération" })).toBeVisible();
  await page.goto("/admin/utilisateurs");
  await expect(page).toHaveURL(/\/admin\?refus=admin/);
});

test("une entreprise ne peut pas gérer la consultation d'une autre", async ({ browser }) => {
  const buyer = await newPage(browser);
  await login(buyer, "acheteur@demo.linkprob2b.test");
  await buyer.goto("/dashboard/opportunites");
  await buyer.getByRole("link", { name: /compresseurs/ }).first().click();
  await buyer.waitForURL(/\/dashboard\/opportunites\/[0-9a-f-]{36}/);
  const manageUrl = buyer.url();

  const other = await newPage(browser);
  await login(other, "fournisseur2@demo.linkprob2b.test");
  await other.goto(manageUrl.replace(/^https?:\/\/[^/]+/, ""));
  await expect(other.getByText("Page introuvable")).toBeVisible();
  await expect(other.getByText("Gérer une consultation")).toHaveCount(0);
});

test("une opportunité externe est identifiée et renvoie vers la source", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/opportunites?origine=EXTERNAL");
  await page.getByRole("link", { name: /marché public fictif/ }).first().click();
  await expect(page.getByText("Opportunité externe", { exact: true })).toBeVisible();
  await expect(page.getByText("Référencée depuis une source externe")).toBeVisible();
  await expect(page.getByRole("link", { name: /Consulter l'annonce sur le site source/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Je suis intéressé" })).toHaveCount(0);
});

test("les données de démonstration sont signalées", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await expect(page.getByText("Données de démonstration — aucune entreprise ou opportunité réelle.").first()).toBeVisible();
});
