import { expect, test } from "@playwright/test";
import { memberPage } from "./helpers";

test("opportunités : suggestions pendant la frappe, sans accents, choix d'un secteur", async ({ browser }) => {
  const page = await memberPage(browser);
  await page.goto("/opportunites");
  const box = page.getByRole("combobox", { name: "Rechercher une opportunité" });
  await expect(box).toBeVisible();
  await page.waitForLoadState("load");
  await box.click();
  await box.pressSequentially("elec", { delay: 60 });
  const list = page.getByRole("listbox", { name: "Suggestions" });
  await expect(list.getByRole("option").first()).toContainText("électricité");
  await list.getByRole("option", { name: /Électricité industrielle et automatisme/ }).click();
  await expect(page).toHaveURL(/secteur=electricite-automatisme/);
});
