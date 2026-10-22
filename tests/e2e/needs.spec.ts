import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, newPage, signUpWithCompany } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const title = `Maintenance ${RUN} de compresseurs d'air`;
let needId = "";

test.afterAll(async () => {
  if (needId) await db.from("opportunities").delete().eq("id", needId);
});

/**
 * Besoin publié → mise en relation automatique : entreprise inscrite correspondante prévenue,
 * « Envoyer un message » (connecté ou non), suivi côté demandeur et administration, mise en avant.
 */
test("un besoin validé déclenche la mise en relation, le message et le suivi", async ({ browser }) => {
  test.setTimeout(240_000);
  const buyer = await newPage(browser);
  await signUpWithCompany(buyer, "besoin-acheteur", `E2E Besoin Acheteur ${RUN}`, "Entreprise demandeuse");
  const supplier = await newPage(browser);
  await signUpWithCompany(supplier, "besoin-fournisseur", `E2E Besoin Fournisseur ${RUN}`, "Fournisseur / prestataire");

  const { data: company } = await db.from("companies").select("id").eq("name", `E2E Besoin Acheteur ${RUN}`).single();
  const { data: supplierCo } = await db.from("companies").select("id").eq("name", `E2E Besoin Fournisseur ${RUN}`).single();
  const { data: o, error } = await db
    .from("opportunities")
    .insert({
      type: "QUOTE_REQUEST",
      origin: "INTERNAL",
      status: "PENDING_REVIEW",
      visibility: "PUBLIC",
      company_id: company!.id,
      title,
      summary: "Entretien préventif de trois compresseurs d'air.",
      description: "Nous recherchons une entreprise de maintenance industrielle pour l'entretien préventif de trois compresseurs et du réseau hydraulique.",
      sector_slug: "maintenance-industrielle",
      skills: ["hydraulique", "compresseurs"],
      city: "Brest",
      department_code: "29",
      region: "Bretagne",
      response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  needId = o.id;

  // Validation par la modération → mise en relation lancée automatiquement après la réponse
  const moderator = await newPage(browser);
  await login(moderator, "moderateur@demo.linkprob2b.test");
  await moderator.goto("/admin/moderation");
  const card = moderator.locator("li", { hasText: title });
  await card.getByRole("button", { name: "Approuver et publier" }).click();
  await moderator.getByRole("button", { name: "Confirmer" }).click();
  await expect(moderator.getByText("Opportunité publiée.")).toBeVisible();
  await expect
    .poll(async () => (await db.from("need_matches").select("status").eq("opportunity_id", needId).eq("company_id", supplierCo!.id).maybeSingle()).data?.status ?? null, { timeout: 90_000 })
    .toBe("NOTIFIED");

  // Visiteur non connecté : « Envoyer un message » mène à l'inscription, retour sur le formulaire de message
  const visitor = await newPage(browser);
  await visitor.goto(`/opportunites/${needId}`);
  await visitor.getByTestId("need-message").click();
  await expect(visitor).toHaveURL(/\/inscription\?suite=.*message%3D1/);

  // Fournisseur prévenu : la notification ouvre la fiche sur le formulaire de message
  await supplier.goto("/dashboard/notifications");
  await expect(supplier.getByText(`Un besoin correspond à votre activité : ${title}`)).toBeVisible();
  await supplier.goto(`/opportunites/${needId}?message=1`);
  const dialog = supplier.getByRole("dialog", { name: "Envoyer un message au demandeur" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Votre message").fill("Nous intervenons sur ce type de compresseurs, sous 24 h sur Brest.");
  await dialog.getByRole("button", { name: "Envoyer" }).click();
  await expect(supplier.getByText("Votre message a été envoyé à l'entreprise.", { exact: false })).toBeVisible();

  // Demandeur : suivi de la visibilité (chiffres réels) et partage
  await buyer.goto(`/dashboard/opportunites/${needId}`);
  const panel = buyer.getByTestId("need-visibility");
  await expect(panel).toContainText("Visibilité et mise en relation");
  await expect(panel).toContainText("Entreprises inscrites prévenues");
  await expect(panel.getByRole("button", { name: "Copier le lien" })).toBeVisible();

  // Administration : suivi du besoin
  const admin = await newPage(browser);
  await login(admin, "admin@demo.linkprob2b.test");
  await admin.goto("/admin/besoins");
  const row = admin.getByTestId("need-row").filter({ hasText: title });
  await expect(row).toContainText("Inscrites prévenues");
  await expect(row).toContainText("Intérêts · réponses");
  await expect(row.getByRole("button", { name: "Relancer" })).toBeVisible();

  // Mise en avant au-dessus des annonces du secteur
  await visitor.goto("/opportunites?secteur=maintenance-industrielle");
  await expect(visitor.getByTestId("featured-needs")).toContainText(title);
});

test("administration : un besoin en brouillon ou en attente apparaît avec la raison", async ({ browser }) => {
  const { data: co } = await db.from("companies").select("id").eq("is_demo", true).limit(1).single();
  const draftTitle = `Brouillon ${RUN} de besoin`;
  const { data: o, error } = await db
    .from("opportunities")
    .insert({ type: "QUOTE_REQUEST", origin: "INTERNAL", status: "DRAFT", visibility: "PUBLIC", company_id: co!.id, title: draftTitle, description: "Besoin enregistré en brouillon, pas encore soumis à validation par l'entreprise.", is_demo: false })
    .select("id")
    .single();
  if (error) throw error;
  try {
    const admin = await newPage(browser);
    await login(admin, "admin@demo.linkprob2b.test");
    await admin.goto("/admin/besoins");
    await expect(admin.getByTestId("need-row").filter({ hasText: draftTitle }).getByTestId("need-blocker")).toContainText("Brouillon : pas encore soumis");
    await db.from("opportunities").update({ status: "PENDING_REVIEW" }).eq("id", o.id);
    await admin.reload();
    await expect(admin.getByTestId("need-row").filter({ hasText: draftTitle }).getByTestId("need-blocker")).toContainText("En attente de validation");
  } finally {
    await db.from("opportunities").delete().eq("id", o.id);
  }
});

test("besoin réservé aux membres : un visiteur sans compte est invité à s'inscrire, puis retrouve la fiche", async ({ browser }) => {
  const { data: co } = await db.from("companies").select("id").eq("is_demo", true).limit(1).single();
  const t = `Réservé ${RUN} aux membres`;
  const { data: o, error } = await db
    .from("opportunities")
    .insert({ type: "QUOTE_REQUEST", origin: "INTERNAL", status: "PUBLISHED", visibility: "MEMBERS_ONLY", company_id: co!.id, title: t, description: "Besoin réservé aux membres de la plateforme, ouvert après inscription.", is_demo: false, published_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  try {
    const visitor = await newPage(browser);
    await visitor.goto(`/opportunites/${o.id}`);
    await expect(visitor).toHaveURL(new RegExp(`/inscription\\?suite=%2Fopportunites%2F${o.id}`));
    const member = await newPage(browser);
    await login(member, "fournisseur@demo.linkprob2b.test");
    await member.goto(`/opportunites/${o.id}`);
    await expect(member.getByRole("heading", { name: t })).toBeVisible();
  } finally {
    await db.from("opportunities").delete().eq("id", o.id);
  }
});
