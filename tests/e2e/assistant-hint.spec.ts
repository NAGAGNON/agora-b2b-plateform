import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });

// Fiche de candidature : bulle d'invitation à côté du bouton de l'assistant, une seule fois par candidature
test("assistant de candidature : bulle d'invitation, ouverture du panneau, pas de répétition", async ({ page }) => {
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/dashboard/candidatures");
  const first = page.locator('a[href^="/dashboard/candidatures/"]').first();
  await expect(first).toBeVisible();
  const href = await first.getAttribute("href");
  await page.goto(href!);
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("lp-assist-hint-")).forEach((k) => localStorage.removeItem(k)));
  await page.reload();
  await expect(page.getByTestId("assistant-fab")).toContainText("Une question ?");
  const hint = page.getByTestId("assistant-hint");
  await expect(hint).toBeVisible({ timeout: 10_000 });
  await expect(hint).toContainText("Une question sur cette offre ?");
  await hint.getByText("Demandez-moi directement", { exact: false }).click();
  await expect(page.getByTestId("assistant-panel")).toBeInViewport();
  await page.keyboard.press("Escape");
  // Déjà vue : plus de bulle au retour sur la même candidature
  await page.reload();
  await page.waitForTimeout(3500);
  await expect(page.getByTestId("assistant-hint")).toHaveCount(0);
});

// Après une réponse de l'assistant : bouton qui ramène à l'étape en cours de la candidature
test("assistant de candidature : retour à l'étape en cours après une réponse", async ({ page }) => {
  await login(page, "fournisseur@demo.linkprob2b.test");
  const { data: user } = await db.from("users").select("id").eq("email", "fournisseur@demo.linkprob2b.test").single();
  const { data: item } = await db
    .from("pipeline_items")
    .select("opportunity_id, company_id")
    .eq("stage", "RESPONSE_PREPARING")
    .in("company_id", (await db.from("company_members").select("company_id").eq("user_id", user!.id)).data!.map((m) => m.company_id))
    .limit(1)
    .single();
  const { data: q } = await db
    .from("application_questions")
    .insert({ company_id: item!.company_id, opportunity_id: item!.opportunity_id, user_id: user!.id, question: "Quelles pièces dois-je fournir ?", answer: "Le Kbis, l'attestation d'assurance et le mémoire technique." })
    .select("id")
    .single();
  try {
    await page.goto(`/dashboard/candidatures/${item!.opportunity_id}`);
    await page.getByTestId("assistant-fab").click();
    const back = page.getByTestId("assistant-back");
    await expect(back).toBeVisible();
    await expect(back).toContainText(/Étape \d : /);
    await back.getByRole("button", { name: "Retour à ma candidature" }).click();
    await expect(page.getByTestId("assistant-panel")).not.toBeInViewport();
    await expect(page.locator("section[id^='etape-'] button[aria-expanded='true']").first()).toBeInViewport();
  } finally {
    await db.from("application_questions").delete().eq("id", q!.id);
  }
});
