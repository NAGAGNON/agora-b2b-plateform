import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Fiche de candidature : bulle d'invitation à côté du bouton de l'assistant, une seule fois par candidature
test("assistant de candidature : bulle d'invitation, ouverture du panneau, pas de répétition", async ({ page }) => {
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/dashboard/candidatures");
  const first = page.locator('a[href^="/dashboard/candidatures/"]').first();
  await expect(first).toBeVisible();
  const href = await first.getAttribute("href");
  await page.goto(href!);
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("lp-assist-hint-")).forEach((k) => localStorage.removeItem(k)));
  await page.reload();
  await expect(page.getByTestId("assistant-fab")).toContainText("Une question ?");
  const hint = page.getByTestId("assistant-hint");
  await expect(hint).toBeVisible({ timeout: 10_000 });
  await expect(hint).toContainText("Une question sur cette offre ?");
  await hint.getByText("Demandez-moi directement", { exact: false }).click();
  await expect(page.getByTestId("assistant-panel")).toBeInViewport();
  await page.keyboard.press("Escape");
  // Déjà vue : plus de bulle au retour sur la même candidature
  await page.reload();
  await page.waitForTimeout(3500);
  await expect(page.getByTestId("assistant-hint")).toHaveCount(0);
});
