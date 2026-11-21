import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
let boostId = "";
let createdBoost = false;
let presentedTo = "";

test.beforeAll(async () => {
  const { data: u } = await db.from("users").select("id").eq("email", "fournisseur@demo.linkprob2b.test").single();
  const { data: m } = await db.from("company_members").select("company_id").eq("user_id", u!.id).limit(1).single();
  const { data: a } = await db.from("users").select("id").eq("email", "acheteur@demo.linkprob2b.test").single();
  const { data: am } = await db.from("company_members").select("company_id").eq("user_id", a!.id).limit(1).single();
  presentedTo = am!.company_id;
  // Une seule campagne en cours par entreprise : on reprend celle qui existe, sinon on en crée une
  const { data: live } = await db.from("visibility_boosts").select("id").eq("company_id", m!.company_id).is("opportunity_id", null).in("status", ["ACTIVE", "PENDING"]).maybeSingle();
  if (live) boostId = live.id;
  else {
    const { data: b, error } = await db
      .from("visibility_boosts")
      .insert({ company_id: m!.company_id, target: "COMPANY", daily_presentations: 10, duration_days: 14, featured_days: 0, status: "ACTIVE", starts_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), ends_at: new Date(Date.now() + 13 * 86_400_000).toISOString(), free_launch: true })
      .select("id")
      .single();
    if (error) throw error;
    boostId = b!.id;
    createdBoost = true;
  }
  await db.from("visibility_boosts").update({ status: "ACTIVE", starts_at: new Date(Date.now() - 2 * 3_600_000).toISOString() }).eq("id", boostId);
  await db.from("boost_presentations").delete().eq("boost_id", boostId).eq("presented_to", presentedTo);
  const { error: pe } = await db.from("boost_presentations").insert({ boost_id: boostId, presented_to: presentedTo, channel: "MEMBER" });
  if (pe) throw pe;
});

test.afterAll(async () => {
  await db.from("boost_presentations").delete().eq("boost_id", boostId).eq("presented_to", presentedTo);
  if (createdBoost) await db.from("visibility_boosts").delete().eq("id", boostId);
});

test("campagne : l'entreprise voit à qui elle a été présentée aujourd'hui, et ses retours, sur mobile", async ({ browser }) => {
  const page = await newPage(browser, { width: 390, height: 844 });
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/dashboard/visibilite");
  await page.locator(`a[href="/dashboard/visibilite/${boostId}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/visibilite/${boostId}`));
  await expect(page.getByTestId("my-campaign")).toContainText("Entreprises présentées");
  const { data: co } = await db.from("companies").select("name").eq("id", presentedTo).single();
  const list = page.getByTestId("day-list");
  await expect(list).toContainText(co!.name);
  await expect(list).toContainText("Vue dans son espace");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("campagne d'une autre entreprise : introuvable", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "acheteur@demo.linkprob2b.test");
  await page.goto(`/dashboard/visibilite/${boostId}`);
  await expect(page.getByTestId("my-campaign")).toHaveCount(0);
  await expect(page.getByText(/introuvable|n'existe pas/i).first()).toBeVisible();
});
