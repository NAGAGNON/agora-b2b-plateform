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
  await db.from("application_followers").delete().eq("opportunity_id", id);
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

test("une note dans chaque étape (retrouvée dans le journal) et l'équipe sur le dossier", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newPage(browser, { width: 390, height: 844 });
  await login(page, "acheteur@demo.linkprob2b.test");
  await page.goto(`/dashboard/candidatures/${id}`);
  // Ouvre une étape (une seule ouverte à la fois ; la prochaine à faire l'est déjà à l'arrivée)
  const open = async (title: string) => {
    const b = page.getByTestId("steps").getByRole("button", { name: new RegExp(title) });
    if ((await b.getAttribute("aria-expanded")) !== "true") await b.click();
  };

  // Étape 1 : une note, gardée après rechargement
  await open("Vérifier votre éligibilité");
  const n1 = page.getByTestId("step-notes-1");
  await n1.getByLabel("Note pour l'étape 1").fill(`Kbis demandé au comptable ${RUN}`);
  await n1.getByRole("button", { name: "Ajouter la note" }).click();
  await expect(n1).toContainText(`Kbis demandé au comptable ${RUN}`);

  // Étape 2 : sa propre note, distincte de l'étape 1
  await open("Comprendre le besoin de l'acheteur");
  const n2 = page.getByTestId("step-notes-2");
  await n2.getByLabel("Note pour l'étape 2").fill(`Question posée sur les quantités ${RUN}`);
  await n2.getByRole("button", { name: "Ajouter la note" }).click();
  await expect(n2).toContainText(`Question posée sur les quantités ${RUN}`);
  await expect(n2).not.toContainText("Kbis");

  await page.reload();
  await open("Vérifier votre éligibilité");
  await expect(page.getByTestId("step-notes-1")).toContainText(`Kbis demandé au comptable ${RUN}`);

  // Le journal de suivi reprend les notes, avec leur étape
  await page.getByRole("button", { name: /Journal de suivi/ }).click();
  await expect(page.locator("#journal")).toContainText(`Étape 2 · Question posée sur les quantités ${RUN}`);

  // Équipe sur ce dossier : ajout au suivi
  const team = page.getByTestId("team-follow");
  await expect(team).toContainText("Équipe sur ce dossier");
  await team.getByLabel("Membre de l'équipe à ajouter").selectOption({ index: 1 });
  await team.getByRole("button", { name: "Ajouter au suivi" }).click();
  await expect(team).toContainText("Vous suivez ce dossier.");
  await expect(team.getByRole("button", { name: /Retirer .* du suivi/ })).toBeVisible();
  const { count } = await db.from("application_followers").select("user_id", { count: "exact", head: true }).eq("opportunity_id", id);
  expect(count).toBe(1);
});

test("téléphone : ouvrir une étape garde l'étape à l'écran (la page ne saute pas en bas)", async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await newPage(browser, { width: 390, height: 844 });
  await login(page, "acheteur@demo.linkprob2b.test");
  await page.goto(`/dashboard/candidatures/${id}`);
  const steps = page.getByTestId("steps");
  for (const title of ["Vérifier votre éligibilité", "Rassembler les documents", "Comprendre le besoin de l'acheteur", "Préparer votre offre"]) {
    const b = steps.getByRole("button", { name: new RegExp(title) });
    await b.scrollIntoViewIfNeeded();
    if ((await b.getAttribute("aria-expanded")) !== "true") await b.click();
    await expect(b).toHaveAttribute("aria-expanded", "true");
    await page.waitForTimeout(700);
    await expect(b).toBeInViewport();
  }
});

test("« Oui, je prépare ma candidature » : la page remonte à l'étape 1, ouverte", async ({ browser }) => {
  test.setTimeout(90_000);
  await db.from("pipeline_items").update({ stage: "DETECTED", guide_done: [] }).eq("opportunity_id", id);
  const page = await newPage(browser, { width: 390, height: 844 });
  await login(page, "acheteur@demo.linkprob2b.test");
  await page.goto(`/dashboard/candidatures/${id}`);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const yes = page.getByRole("button", { name: /Oui, je prépare ma candidature/ });
  await yes.scrollIntoViewIfNeeded();
  await yes.click();
  const step1 = page.getByTestId("steps").getByRole("button", { name: /Vérifier votre éligibilité/ });
  await expect(step1).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(900);
  await expect(step1).toBeInViewport();
});
