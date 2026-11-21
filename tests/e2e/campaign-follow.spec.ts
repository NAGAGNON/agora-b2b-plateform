import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
let boostId = "";
let companyId = "";

test.beforeAll(async () => {
  const { data: u } = await db.from("users").select("id").eq("email", "fournisseur@demo.linkprob2b.test").single();
  // Entreprise dédiée au test : une seule campagne en cours par entreprise
  const { data: co, error: ce } = await db.from("companies").insert({ name: `E2E ${RUN} Campagne`, slug: `e2e-${RUN.toLowerCase()}-campagne` }).select("id").single();
  if (ce) throw ce;
  companyId = co!.id;
  await db.from("company_members").insert({ company_id: companyId, user_id: u!.id, role: "COMPANY_ADMIN" });
  const start = new Date(Date.now() - 3_600_000).toISOString();
  const { data: b, error } = await db
    .from("visibility_boosts")
    .insert({ company_id: companyId, target: "COMPANY", daily_presentations: 10, duration_days: 14, featured_days: 0, status: "ACTIVE", starts_at: start, ends_at: new Date(Date.now() + 13 * 86_400_000).toISOString(), free_launch: true, ad_title: "Maintenance industrielle à Brest", ad_points: ["Interventions sous 24 h"], ad_text: "Présentation de test.", ad_status: "REJECTED", ad_review_note: "Texte trop court : présentez vos prestations principales." })
    .select("id")
    .single();
  if (error) throw error;
  boostId = b!.id;
  await db.from("audit_logs").insert({ action: "visibility.ad_rejected", entity_type: "visibility_boost", entity_id: boostId, metadata: { note: "Texte trop court : présentez vos prestations principales.", auto: true } });
  await db.from("notifications").insert({ user_id: u!.id, type: "visibility_ad_rejected", title: "Votre annonce est à corriger", body: "Maintenance industrielle à Brest", link: "/dashboard/visibilite" });
});

test.afterAll(async () => {
  await db.from("audit_logs").delete().eq("entity_id", boostId);
  await db.from("visibility_boosts").delete().eq("id", boostId);
  await db.from("notifications").delete().eq("type", "visibility_ad_rejected").eq("body", "Maintenance industrielle à Brest");
  await db.from("company_members").delete().eq("company_id", companyId);
  await db.from("companies").delete().eq("id", companyId);
});

test("administration : suivi d'une campagne étape par étape (relecture, message, notification, prochaine étape)", async ({ browser }) => {
  const page = await newPage(browser, { width: 390, height: 844 });
  await login(page, "admin@demo.linkprob2b.test");
  await page.goto("/admin/visibilite");
  await page.locator(`a[href="/admin/visibilite/${boostId}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/admin/visibilite/${boostId}`));
  await expect(page.getByTestId("campaign-next")).toContainText("correction de l'annonce");
  const timeline = page.getByTestId("campaign-timeline");
  await expect(timeline).toContainText("Campagne créée par l'entreprise");
  await expect(timeline).toContainText("Annonce à corriger : message envoyé à l'entreprise");
  await expect(timeline).toContainText("Texte trop court");
  await expect(timeline).toContainText("Notification « annonce à corriger » envoyée sur le site");
  await expect(timeline).toContainText("Pas encore lue");
  await expect(page.getByText("Message envoyé à l'entreprise :")).toBeVisible();
  // Ce que le site a fait pour eux : liste du jour (vide ici) et bilan e-mail dans les étapes
  await expect(page.getByTestId("admin-presented")).toContainText("Aucune présentation aujourd'hui");
  // Mobile : pas de défilement horizontal
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
