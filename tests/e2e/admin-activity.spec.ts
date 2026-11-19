import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });

test("administration : tout ce qu'un inscrit a fait, action par action", async ({ page }) => {
  const { data: u } = await db.from("users").select("id").eq("email", "fournisseur@demo.linkprob2b.test").single();
  const { data: opp } = await db.from("opportunities").select("id, title").eq("status", "PUBLISHED").limit(1).single();
  await db.from("analytics_events").insert([
    { event_name: "view_opportunity", user_id: u!.id, properties: { opportunity_id: opp!.id } },
    { event_name: "search_opportunities", user_id: u!.id, properties: { has_query: true, results: 4 } },
  ]);
  await login(page, "admin@demo.linkprob2b.test");
  await page.goto(`/admin/activite/${u!.id}?periode=auj`);
  await expect(page.getByTestId("activity-summary")).toContainText("consultation");
  await expect(page.getByTestId("activity-summary")).toContainText("recherche");
  await expect(page.getByText("A consulté une offre").first()).toBeVisible();
  await expect(page.getByRole("link", { name: opp!.title }).first()).toBeVisible();
  await expect(page.getByText("avec mots-clés → 4 résultats").first()).toBeVisible();
});
