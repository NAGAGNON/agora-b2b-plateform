import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { RUN, login, newPage, expectNotFound } from "./helpers";
import { recipientToken } from "../../src/lib/outreach/token";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const T = `E2E ${RUN}`;
const DATE = `2091-${String(randomInt(1, 13)).padStart(2, "0")}-${String(randomInt(1, 29)).padStart(2, "0")}`;
let token = "";
let oppId = "";
let campaignId = "";
let manualId = "";

test.beforeAll(async () => {
  const { data: o, error } = await db
    .from("opportunities")
    .insert({ type: "PUBLIC_TENDER", origin: "EXTERNAL", status: "PUBLISHED", visibility: "PUBLIC", title: `${T} Travaux d'installation électrique`, description: "Remplacement des tableaux électriques de l'école communale.", sector_slug: "electricite-automatisme", department_code: "29", region: "Bretagne", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString(), external_buyer_name: `Commune ${T}` })
    .select("id")
    .single();
  if (error) throw error;
  oppId = o.id;
  const { data: p } = await db.from("outreach_prospects").insert({ name: `${T} Élec Ouest`, source: "Test E2E", naf_code: "43.21A", department_code: "29", region: "Bretagne", email: `e2e-${RUN}@example.test`, email_source: "Test" }).select("id").single();
  const { data: c } = await db.from("outreach_campaigns").insert({ campaign_date: DATE, status: "READY", min_score: 70, subject_template: "{nombre_opportunites} pour {entreprise}", intro_template: "Nous avons identifié {nombre_opportunites} correspondant à votre activité." }).select("id").single();
  campaignId = c!.id;
  const { data: r } = await db.from("outreach_recipients").insert({ campaign_id: campaignId, prospect_id: p!.id, email: `e2e-${RUN}@example.test`, score: 88, reasons: ["Activité correspondante (NAF 43.21A)", "Située dans le même département (29)"], status: "PENDING" }).select("id").single();
  await db.from("outreach_recipient_opportunities").insert({ recipient_id: r!.id, opportunity_id: oppId, score: 88, reasons: [] });
  token = recipientToken(r!.id);
});

test.afterAll(async () => {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users?.users ?? []) if (u.email === `e2e-${RUN}@example.test`) await db.auth.admin.deleteUser(u.id);
  await db.from("outreach_campaigns").delete().eq("id", campaignId);
  if (manualId) await db.from("outreach_campaigns").delete().eq("id", manualId);
  await db.from("outreach_prospects").delete().like("name", `${T}%`);
  await db.from("outreach_suppressions").delete().eq("value", `e2e-${RUN}@example.test`);
  await db.from("opportunities").delete().eq("id", oppId);
});

test("Outreach est réservé aux administrateurs", async ({ browser }) => {
  const anonymous = await newPage(browser);
  await anonymous.goto("/outreach");
  await expect(anonymous).toHaveURL(/\/connexion/);
  const moderator = await newPage(browser);
  await login(moderator, "moderateur@demo.linkprob2b.test");
  await moderator.goto("/outreach");
  await expect(moderator).toHaveURL(/\/admin\?refus=admin/);
});

test("tableau de bord, prévisualisation de campagne et paramètres", async ({ browser }) => {
  // Campagne supplémentaire du jour sans administrateur (complémentaire automatique) : comptée dans les chiffres de la journée
  const { data: manual } = await db
    .from("outreach_campaigns")
    .insert({ campaign_date: new Date().toISOString().slice(0, 10), kind: "MANUAL", status: "SENT", min_score: 70, subject_template: "s", intro_template: "i" })
    .select("id")
    .single();
  manualId = manual!.id;
  const page = await newPage(browser);
  await login(page, "admin@demo.linkprob2b.test");
  await page.goto("/outreach");
  await expect(page.getByRole("link", { name: /campagnes? complémentaires?/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vue d'ensemble", level: 1 })).toBeVisible();
  await expect(page.getByText(/Mode simulation|Envoi réel/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Lancer une campagne maintenant" })).toBeVisible();
  await page.goto(`/outreach/campagnes/${campaignId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Campagne du");
  await expect(page.getByRole("link", { name: `${T} Élec Ouest` })).toBeVisible();
  await expect(page.getByText("88/100 · Très pertinent")).toBeVisible();
  await page.getByRole("link", { name: "Aperçu" }).first().click();
  await expect(page.getByTitle("Aperçu de l'e-mail")).toBeVisible();
  // Aperçu : liens ouverts dans un nouvel onglet et non suivis (aucun clic compté pour le destinataire)
  const srcdoc = (await page.getByTitle("Aperçu de l'e-mail").getAttribute("srcdoc")) ?? "";
  expect(srcdoc).toContain('<base target="_blank">');
  expect(srcdoc).not.toContain("/api/outreach/c/");
  expect(srcdoc).toContain(`/opportunites/${oppId}`);
  await expect(page.getByText("1 opportunité pour")).toBeVisible();
  await page.goto("/outreach/parametres");
  await expect(page.getByLabel("Score minimum (/100)")).toHaveValue(/\d+/);
  await page.goto("/outreach/prospects");
  await expect(page.getByRole("heading", { name: "Entreprises", level: 1 })).toBeVisible();
});

const steps = async () => {
  const { data } = await db.from("outreach_events").select("type").eq("campaign_id", campaignId);
  return new Set((data ?? []).map((e) => e.type));
};

test("offre depuis l'e-mail : compte obligatoire (serveur), inscription puis accès direct à l'offre", async ({ browser }) => {
  const page = await newPage(browser);
  // Clic depuis l'e-mail → page d'accès, sans le détail de l'offre
  await page.goto(`/api/outreach/c/${token}?o=${oppId}`);
  await expect(page).toHaveURL(new RegExp(`/opportunites/${oppId}`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Créez votre compte pour accéder à cette offre");
  await expect(page.getByText("Cette offre vous a été recommandée personnellement. Créez votre compte gratuitement pour voir les détails et accéder à l'offre.")).toBeVisible();
  await expect(page.getByText(`${T} Travaux d'installation électrique`, { exact: true })).toBeVisible();
  await expect(page.getByText("Remplacement des tableaux électriques")).toHaveCount(0);
  // Contrôle côté serveur : le HTML ne contient pas le détail, même en tapant l'URL ; la source est bloquée aussi
  const html = await (await page.request.get(`/opportunites/${oppId}`)).text();
  expect(html).not.toContain("Remplacement des tableaux électriques");
  await page.goto(`/go/${oppId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Créez votre compte pour accéder à cette offre");

  // « Créer mon compte » → inscription rapide avec l'adresse qui a reçu l'e-mail → offre ouverte directement
  await page.getByRole("link", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/inscription\?/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Créez votre compte pour accéder à cette offre");
  await page.getByLabel("Nom et prénom").fill("Prospect E2E");
  await page.getByLabel("Adresse e-mail professionnelle").fill(`e2e-${RUN}@example.test`);
  await page.getByLabel("Mot de passe").fill("Prospect-E2E-2026");
  await page.getByRole("checkbox", { name: /Conditions Générales/ }).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(new RegExp(`/opportunites/${oppId}$`));
  await expect(page.getByText("Remplacement des tableaux électriques").first()).toBeVisible();
  await expect.poll(steps).toEqual(new Set(["CLICK", "GATE_VIEW", "GATE_SIGNUP_CLICK", "SIGNUP", "OFFER_ACCESS"]));

  // Déconnecté, même navigateur : l'URL directe reste protégée ; « Se connecter » ramène à l'offre
  await page.context().clearCookies({ name: /^sb-/ });
  await page.goto(`/opportunites/${oppId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Créez votre compte pour accéder à cette offre");
  await page.getByRole("link", { name: "Se connecter" }).click();
  await page.getByLabel("Adresse e-mail professionnelle").fill(`e2e-${RUN}@example.test`);
  await page.getByLabel("Mot de passe").fill("Prospect-E2E-2026");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(new RegExp(`/opportunites/${oppId}$`));
  await expect(page.getByText("Remplacement des tableaux électriques").first()).toBeVisible();
  await expect.poll(async () => (await steps()).has("LOGIN")).toBe(true);

  // Visiteur venu d'ailleurs (sans le parcours e-mail) : fiche publique inchangée (référencement)
  const other = await newPage(browser);
  await other.goto(`/opportunites/${oppId}`);
  await expect(other.getByText("Remplacement des tableaux électriques").first()).toBeVisible();
});

test("landing page personnalisée puis désinscription", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto(`/opportunites/selection/${token}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("1 opportunité correspondant à votre activité");
  await expect(page.getByRole("heading", { name: `${T} Travaux d'installation électrique` })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir l'opportunité" })).toHaveAttribute("href", new RegExp(`/api/outreach/c/.+\\?o=${oppId}`));
  await expect(page.getByRole("link", { name: "Créer mon compte gratuitement" })).toHaveAttribute("href", `/inscription?ref=o.${token}`);
  await expectNotFound(page, await page.goto("/opportunites/selection/jeton-invalide"));
  await page.goto(`/desinscription/${token}`);
  await page.getByRole("button", { name: "Confirmer la désinscription" }).click();
  await expect(page.getByRole("heading", { name: "Désinscription confirmée" })).toBeVisible();
  const { data } = await db.from("outreach_suppressions").select("reason").eq("value", `e2e-${RUN}@example.test`).single();
  expect(data?.reason).toBe("UNSUBSCRIBE");
});
