import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const T = `E2E ${RUN} Maintenance des compresseurs du port de Brest`;
let id = "";

test.beforeAll(async () => {
  const { data: o, error } = await db
    .from("opportunities")
    .insert({
      type: "EXTERNAL_OPPORTUNITY",
      origin: "EXTERNAL",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      is_demo: false,
      title: T,
      summary: "Maintenance préventive et curative des compresseurs d'air du port.",
      description: "Marché de maintenance préventive et curative des compresseurs d'air.",
      sector_slug: "maintenance-industrielle",
      department_code: "29",
      region: "Bretagne",
      city: "Brest",
      external_buyer_name: "Port de Brest (test)",
      response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  id = o.id;
});

test.afterAll(async () => {
  if (!id) return;
  await db.from("favorites").delete().eq("opportunity_id", id);
  await db.from("application_prompts").delete().eq("opportunity_id", id);
  await db.from("pipeline_items").delete().eq("opportunity_id", id);
  await db.from("opportunities").delete().eq("id", id);
});

test("offre : « En savoir plus », garder pour plus tard, pas pour moi, barre fixe sur téléphone", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newPage(browser);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto(`/opportunites/${id}`);
  await expect(page.getByTestId("offer-interested")).toContainText("En savoir plus");
  await page.getByTestId("offer-later").click();
  await expect(page.getByTestId("offer-later")).toContainText("Gardée");
  await page.getByTestId("offer-not-for-me").click();
  await expect(page.getByRole("status").filter({ hasText: "C'est noté" })).toBeVisible();
  // En faisant défiler, le bouton principal reste accessible en bas de l'écran
  await expect(page.getByTestId("offer-sticky")).toHaveAttribute("aria-hidden", "true");
  await page.mouse.wheel(0, 1600);
  await expect(page.getByTestId("offer-sticky")).toHaveAttribute("aria-hidden", "false");
  await page.getByTestId("offer-sticky").getByRole("link").click({ timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(`/dashboard/candidatures/${id}`));
});

test("recherche dans toute la France : les offres de la zone de l'entreprise d'abord", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/opportunites?q=compresseurs");
  const block = page.getByTestId("for-you");
  await expect(block).toContainText("Finistère");
  await expect(block.getByRole("link", { name: T })).toBeVisible();
  await block.getByRole("link", { name: /du département Finistère/ }).click();
  await expect(page).toHaveURL(/departement=29/);
  await expect(page.getByTestId("for-you")).toHaveCount(0);
});
