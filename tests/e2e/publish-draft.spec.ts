import { expect, test } from "@playwright/test";
import { newPage, RUN, signUpWithCompany } from "./helpers";

/** Besoin rédigé avant l'inscription : repris automatiquement dans l'assistant de publication. */
test("publier : décrire son besoin avant de créer son compte, puis le retrouver rempli", async ({ browser }) => {
  const page = await newPage(browser);
  const title = `Entretien de 3 chaudières ${RUN}`;
  await page.goto("/publier");
  const draft = page.getByTestId("need-draft");
  await draft.getByLabel("Que recherchez-vous ?").fill(title);
  await draft.getByLabel("Décrivez votre besoin").fill("Entretien annuel de trois chaudières gaz dans nos bureaux de Brest.");
  await draft.getByLabel("Ville").fill("Brest");
  await draft.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/inscription\?suite=(%2F|\/)publier/);
  await signUpWithCompany(page, "brouillon", `E2E Brouillon ${RUN}`, "Entreprise demandeuse");
  await page.goto("/publier");
  await expect(page.getByText("Votre besoin a été repris")).toBeVisible();
  await expect(page.getByLabel("Titre")).toHaveValue(title);
  await expect(page.getByLabel("Ville")).toHaveValue("Brest");
});
