import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
let id = "";

test.beforeAll(async () => {
  const { data: u } = await db.from("users").select("id").eq("email", "acheteur@demo.linkprob2b.test").single();
  const { data: m } = await db.from("company_members").select("company_id").eq("user_id", u!.id).limit(1).single();
  const { data: o, error } = await db
    .from("opportunities")
    .insert({
      type: "EXTERNAL_OPPORTUNITY", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", is_demo: false,
      title: `E2E ${RUN} Entretien des espaces verts`, summary: "Entretien des espaces verts.", description: "Marché d'entretien des espaces verts de la commune.",
      sector_slug: "espaces-verts", department_code: "29", region: "Bretagne", city: "Brest", external_buyer_name: "Ville de test",
      response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  id = o.id;
  await db.from("pipeline_items").insert({ company_id: m!.company_id, opportunity_id: id, stage: "RESPONSE_PREPARING" });
});

test.afterAll(async () => {
  if (!id) return;
  await db.from("application_journal").delete().eq("opportunity_id", id);
  await db.from("pipeline_items").delete().eq("opportunity_id", id);
  await db.from("opportunities").delete().eq("id", id);
});

test("parcours en 7 étapes : capacités enregistrées, dépôt détaillé, suivi du résultat avec historique", async ({ browser }) => {
  test.setTimeout(150_000);
  const page = await newPage(browser);
  await login(page, "acheteur@demo.linkprob2b.test");
  await page.goto(`/dashboard/candidatures/${id}`);
  const steps = page.getByTestId("steps");
  for (const t of ["Vérifier votre éligibilité", "Comprendre le besoin de l'acheteur", "Évaluer vos capacités", "Rassembler les documents", "Préparer votre offre", "Organiser et déposer votre candidature", "Suivre le résultat"])
    await expect(steps.getByText(t, { exact: true })).toBeVisible();

  // Étape 3 : capacités, enregistrées automatiquement et retrouvées après rechargement
  await steps.getByText("Évaluer vos capacités", { exact: true }).click();
  const caps = page.getByTestId("checks-capacities");
  await caps.getByRole("radiogroup", { name: "Équipe disponible pour ce travail" }).getByRole("radio", { name: "Je l'ai" }).click();
  await caps.getByRole("radiogroup", { name: "Trésorerie pour avancer les frais" }).getByRole("radio", { name: "Il me manque" }).click();
  await expect(caps).toContainText("Enregistré");
  await expect(caps).toContainText("1 manquant");
  await page.reload();
  await page.getByTestId("steps").getByText("Évaluer vos capacités", { exact: true }).click();
  await expect(page.getByTestId("checks-capacities").getByRole("radiogroup", { name: "Équipe disponible pour ce travail" }).getByRole("radio", { name: "Je l'ai" })).toHaveAttribute("aria-checked", "true");

  // Étape 6 : dépôt avec plateforme et référence
  await page.getByTestId("steps").getByText("Organiser et déposer votre candidature", { exact: true }).click();
  const form = page.getByTestId("submission-form");
  await form.getByRole("button", { name: "Candidature déposée" }).click();
  await form.getByPlaceholder(/PLACE, AWS/).fill("PLACE");
  await form.getByPlaceholder("Accusé de réception").fill("ACC-123");
  await form.getByRole("button", { name: /Enregistrer où j'en suis/ }).click();
  await expect(form).toContainText("Le dépôt est enregistré");

  // Étape 7 : résultat, conservé dans l'historique
  await page.getByTestId("steps").getByText("Suivre le résultat", { exact: true }).click();
  const tracker = page.getByTestId("result-tracker");
  await tracker.getByLabel("Où en est votre candidature").selectOption("more_info");
  await tracker.getByPlaceholder("Commentaire (facultatif)").fill("L'acheteur demande une attestation");
  await tracker.getByRole("button", { name: "Enregistrer" }).click();
  await expect(tracker).toContainText("Demande de complément");
  await expect(tracker).toContainText("L'acheteur demande une attestation");

  const { data } = await db.from("pipeline_items").select("stage, journey").eq("opportunity_id", id).single();
  expect(data?.stage).toBe("RESPONSE_SENT");
  expect(data?.journey).toMatchObject({ submission: { status: "submitted", platform: "PLACE", reference: "ACC-123" }, capacities: { team: { s: "yes" }, cash: { s: "no" } } });
});
