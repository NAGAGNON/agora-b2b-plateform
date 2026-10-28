import { expect, test } from "@playwright/test";

/** Assistant guidé : trois questions, puis le nombre réel d'opportunités et l'alerte par e-mail. */
test("assistant guidé : objectif, métier, zone, puis opportunités correspondantes et alerte", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Besoin d'aide ?" }).click();
  const assistant = page.getByTestId("assistant");
  await expect(assistant).toBeVisible();
  await assistant.getByRole("button", { name: "Des marchés et des clients" }).click();
  await assistant.getByRole("button").filter({ hasText: /BTP/ }).first().click();
  await assistant.getByRole("button").filter({ hasText: /Travaux/ }).first().click();
  await assistant.getByRole("button", { name: "France entière" }).click();
  await expect(assistant.getByText(/opportunités? ouvertes? en/)).toBeVisible();
  await expect(assistant.getByRole("link", { name: /Voir toutes les opportunités/ })).toHaveAttribute("href", /\/opportunites\?secteur=/);
  await expect(assistant.getByTestId("alert-lead")).toBeVisible();
  // Échap ferme l'assistant
  await page.keyboard.press("Escape");
  await expect(assistant).toHaveCount(0);
});

test("assistant guidé absent des espaces de connexion", async ({ page }) => {
  await page.goto("/connexion");
  await expect(page.getByRole("button", { name: "Besoin d'aide ?" })).toHaveCount(0);
});
