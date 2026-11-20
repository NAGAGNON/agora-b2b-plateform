import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
let id = "";
let companyId = "";

test.beforeAll(async () => {
  const { data: u } = await db.from("users").select("id").eq("email", "acheteur@demo.linkprob2b.test").single();
  const { data: m } = await db.from("company_members").select("company_id").eq("user_id", u!.id).limit(1).single();
  companyId = m!.company_id;
  const { data: o, error } = await db
    .from("opportunities")
    .insert({
      type: "EXTERNAL_OPPORTUNITY",
      origin: "EXTERNAL",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      is_demo: false,
      title: `E2E ${RUN} Nettoyage des locaux de la mairie`,
      summary: "Nettoyage des locaux administratifs.",
      description: "Marché de nettoyage des locaux administratifs.",
      sector_slug: "nettoyage-proprete",
      department_code: "29",
      region: "Bretagne",
      city: "Brest",
      external_buyer_name: "Ville de test",
      response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  id = o.id;
  await db.from("pipeline_items").insert({ company_id: companyId, opportunity_id: id, stage: "RESPONSE_SENT", submitted_at: new Date().toISOString().slice(0, 10) });
});

test.afterAll(async () => {
  if (!id) return;
  await db.from("application_journal").delete().eq("opportunity_id", id);
  await db.from("pipeline_items").delete().eq("opportunity_id", id);
  await db.from("opportunities").delete().eq("id", id);
});

test("après le dépôt : liste à cocher, rappel à une date choisie, modèle de relance", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newPage(browser);
  await login(page, "acheteur@demo.linkprob2b.test");
  await page.goto(`/dashboard/candidatures/${id}`);
  const block = page.getByTestId("after-deposit");
  await expect(block).toContainText("En attendant le résultat");
  await block.getByRole("button", { name: /accusé de réception/ }).click();
  await expect(block.getByRole("button", { name: /accusé de réception/ })).toHaveAttribute("aria-pressed", "true");
  const day = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  await page.getByTestId("reminder-date").fill(day);
  await page.getByTestId("reminder-save").click();
  await expect(page.getByRole("status").filter({ hasText: "Rappel enregistré." })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("after-deposit-reminder")).toContainText("Rappel prévu le");
  await expect(page.getByTestId("after-deposit").getByRole("button", { name: /accusé de réception/ })).toHaveAttribute("aria-pressed", "true");
  const { data: item } = await db.from("pipeline_items").select("next_action, next_action_at").eq("opportunity_id", id).eq("company_id", companyId).single();
  expect(item).toMatchObject({ next_action: "Relancer l'acheteur", next_action_at: day });
  await expect(page.getByText("Modèle de relance de l'acheteur")).toBeVisible();
});
