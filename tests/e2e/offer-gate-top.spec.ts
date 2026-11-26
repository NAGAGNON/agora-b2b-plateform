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

test("offre clôturée vue sans compte : jamais présentée comme ouverte", async ({ browser }) => {
  // Offre publiée dont la date limite vient de passer (avant même le passage de la tâche d'expiration)
  const { data: o } = await db.from("opportunities").select("id, response_deadline").eq("origin", "EXTERNAL").eq("status", "PUBLISHED").eq("visibility", "PUBLIC").order("id", { ascending: false }).range(3, 3).single();
  await db.from("opportunities").update({ response_deadline: new Date(Date.now() - 2 * 86_400_000).toISOString() }).eq("id", o!.id);
  try {
    const page = await browser.newPage();
    await page.goto(`/opportunites/${o!.id}`);
    await expect(page.getByTestId("gate-closed")).toContainText("Offre clôturée");
    await expect(page.getByText(/Clôturée le/)).toBeVisible();
    await expect(page.getByTestId("gate-top-signup")).toHaveText(/prochaines offres/);
  } finally {
    await db.from("opportunities").update({ response_deadline: o!.response_deadline }).eq("id", o!.id);
  }
});
