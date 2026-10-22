import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, newPage, expectNotFound } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
let oppId = "";

// Une opportunité ouverte en Finistère, pour ne pas dépendre des données déjà présentes
test.beforeAll(async () => {
  const { data, error } = await db
    .from("opportunities")
    .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `E2E ${RUN} Maintenance des installations de la station`, description: "Maintenance préventive des équipements industriels.", sector_slug: "maintenance-industrielle", department_code: "29", region: "Bretagne", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString(), external_buyer_name: `Commune E2E ${RUN}` })
    .select("id")
    .single();
  if (error) throw error;
  oppId = data.id;
});

test.afterAll(async () => {
  await db.from("opportunities").delete().eq("id", oppId);
  await db.from("alert_leads").delete().like("email", "e2e-lead-%@example.test");
});

test("pages métier × département : titre, fil d'Ariane, liens, alerte par e-mail sans compte", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/opportunites/bretagne/finistere/maintenance-industrielle");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maintenance industrielle — Finistère (29)");
  await expect(page).toHaveTitle(/Appels d'offres maintenance industrielle — Finistère \(29\)/);
  const crumbs = page.getByRole("navigation", { name: "Fil d'Ariane" });
  await expect(crumbs.getByRole("link", { name: "Bretagne" })).toHaveAttribute("href", "/opportunites/bretagne");
  await expect(crumbs.getByRole("link", { name: "Finistère" })).toHaveAttribute("href", "/opportunites/bretagne/finistere");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/opportunites\/bretagne\/finistere\/maintenance-industrielle$/);

  // Alerte par e-mail : case de consentement non pré-cochée et obligatoire, confirmation demandée
  const lead = page.getByTestId("alert-lead");
  await expect(lead).toContainText("Recevoir ces marchés par e-mail");
  const consent = lead.getByRole("checkbox");
  await expect(consent).not.toBeChecked();
  await lead.getByRole("textbox").fill(`e2e-lead-${Date.now()}@example.test`);
  await consent.check();
  await lead.getByRole("button", { name: "Recevoir les marchés" }).click();
  await expect(lead).toContainText("cliquez sur le lien que nous venons de vous envoyer");

  // Métier inconnu ou département hors région : page introuvable
  await expectNotFound(page, await page.goto("/opportunites/bretagne/finistere/metier-inconnu"));
  await expectNotFound(page, await page.goto("/opportunites/bretagne/paris/maintenance-industrielle"));
});

test("page département : liens vers les métiers", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/opportunites/bretagne/finistere");
  await expect(page.getByText("Par métier")).toBeVisible();
  await page.getByText("Par métier").click();
  await expect(page.getByRole("link", { name: "Maintenance industrielle" }).first()).toHaveAttribute("href", "/opportunites/bretagne/finistere/maintenance-industrielle");
});

test("confirmation et désinscription d'une alerte : lien invalide signalé", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/alertes/confirmer?jeton=00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lien invalide");
  await page.goto("/alertes/arreter?jeton=00000000-0000-0000-0000-000000000000");
  await page.getByRole("button", { name: "Confirmer la désinscription" }).click();
  await expect(page.getByText("Ce lien de désinscription n'est plus valide.")).toBeVisible();
});
