import { expect, test } from "@playwright/test";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { newPage, RUN } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const NAME = `E2E ${RUN} Express`;

test.afterAll(async () => {
  await db.from("companies").delete().eq("name", NAME);
});

test("profil express après l'inscription : 4 informations, entreprise et alerte créées, recommandations ouvertes", async ({ browser }) => {
  const page = await newPage(browser);
  const email = `e2e-${RUN}-express@test.linkprob2b.test`;
  await page.goto("/inscription");
  await page.getByLabel("Nom et prénom").fill(`E2E ${RUN} Express`);
  await page.getByLabel("Adresse e-mail professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill("E2e-Password-123");
  await page.getByText("J'ai lu et j'accepte les Conditions Générales d'Utilisation", { exact: false }).click();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/onboarding\/entreprise/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quelles offres vous intéressent ?");

  // Sans métier : message clair, rien n'est créé
  await page.getByLabel("Nom de l'entreprise").fill(NAME);
  await page.getByRole("button", { name: "Voir les offres pour mon entreprise" }).click();
  await expect(page.getByText("Choisissez votre métier").last()).toBeVisible();

  await page.getByLabel("Votre métier").selectOption({ label: "Maintenance industrielle" });
  await page.getByLabel("Vos compétences").fill("hydraulique, compresseurs");
  await page.getByLabel("Ville").fill("Brest");
  await page.getByRole("button", { name: "Voir les offres pour mon entreprise" }).click();
  await expect(page).toHaveURL(/\/dashboard\/recommandations/);

  const { data: co } = await db.from("companies").select("id, department_code, kind, profile:company_profiles(sectors, skills)").eq("name", NAME).single();
  expect(co?.kind).toBe("BOTH");
  expect(co?.department_code).toBe("29");
  const profile = (Array.isArray(co?.profile) ? co?.profile[0] : co?.profile) as { sectors: string[]; skills: string[] };
  expect(profile.sectors).toEqual(["maintenance-industrielle"]);
  expect(profile.skills).toEqual(["hydraulique", "compresseurs"]);
  const { data: u } = await db.from("users").select("id").eq("email", email).single();
  const { data: alerts } = await db.from("alerts").select("sector_slug, department_code").eq("user_id", u!.id);
  expect(alerts).toEqual([{ sector_slug: "maintenance-industrielle", department_code: "29" }]);
});
