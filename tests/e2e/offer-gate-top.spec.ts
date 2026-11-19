import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });

test("offre vue sans compte sur téléphone : bouton d'inscription dès le premier écran", async ({ browser }) => {
  const { data: o } = await db.from("opportunities").select("id").eq("origin", "EXTERNAL").eq("status", "PUBLISHED").limit(1).single();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`/opportunites/${o!.id}`);
  const top = page.getByTestId("gate-top-signup");
  await expect(top).toBeInViewport();
  await expect(top).toHaveAttribute("href", new RegExp(`^/inscription\\?suite=.*${o!.id}`));
});
