import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });

test("création d'entreprise : nombre d'inscrites de la semaine et défilement des seuls logos (caché s'il y en a trop peu)", async ({ browser }) => {
  // Entreprises publiques inscrites cette semaine, sans logo : on en équipe 5 le temps du test
  const { data: week } = await db
    .from("companies")
    .select("id, logo_path, profile:company_profiles!inner(is_public)")
    .eq("status", "ACTIVE")
    .eq("is_internal", false)
    .eq("is_demo", false)
    .eq("company_profiles.is_public", true)
    .gte("created_at", new Date(Date.now() - 6 * 86_400_000).toISOString())
    .is("logo_path", null)
    .limit(5);
  test.skip((week ?? []).length < 5, "pas assez d'entreprises de la semaine dans la base de test");
  const ids = week!.map((c) => c.id);
  const page = await newPage(browser, { width: 390, height: 844 });
  await login(page, "fournisseur@demo.linkprob2b.test");
  try {
    await page.goto("/onboarding/entreprise");
    // Sans logos : rien ne s'affiche (selon les données de test présentes)
    const before = (await db.rpc("public_week_companies", { p_limit: 30 })).data as { logos: unknown[] };
    if (before.logos.length < 5) await expect(page.getByTestId("week-companies")).toHaveCount(0);

    await db.from("companies").update({ logo_path: "e2e/logo.png" }).in("id", ids);
    await page.reload();
    const band = page.getByTestId("week-companies");
    await expect(band).toBeVisible();
    await expect(band).toContainText(/\d+ entreprises/);
    await expect(band).toContainText("se sont inscrites cette semaine");
  } finally {
    await db.from("companies").update({ logo_path: null }).in("id", ids);
  }
});
