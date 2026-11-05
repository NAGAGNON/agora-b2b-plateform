import { expect, test } from "@playwright/test";
import { newPage } from "./helpers";

test("rubrique indépendants : métiers, compteur, inscription et publication d'une mission", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/independants");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Missions freelance et offres pour indépendants");
  await expect(page.getByTestId("freelance-count")).toBeVisible();
  await expect(page.getByRole("link", { name: "Recevoir les missions de mon métier" }).first()).toHaveAttribute("href", /\/inscription\?suite=%2Findependants/);
  await page.getByRole("navigation", { name: "Métiers" }).getByRole("link", { name: "Traduction et interprétariat" }).click();
  await expect(page).toHaveURL(/\/independants\/traduction-et-interpretariat$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Missions freelance en traduction et interprétariat");
  await page.goto("/independants/metier-inconnu");
  await expect(page.getByText("Page introuvable").first()).toBeVisible();
});
