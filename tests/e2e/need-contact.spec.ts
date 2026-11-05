import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const T = `E2E ${RUN} Réfection de toiture`;
let needId = "";
let ownerEmail = "";

test.beforeAll(async () => {
  const { data: owner } = await db.from("users").select("id, email").eq("email", "acheteur@demo.linkprob2b.test").single();
  const { data: m } = await db.from("company_members").select("company_id").eq("user_id", owner!.id).limit(1).single();
  ownerEmail = owner!.email;
  const { data: o, error } = await db
    .from("opportunities")
    .insert({
      type: "NEED",
      origin: "INTERNAL",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      is_demo: false,
      company_id: m!.company_id,
      created_by: owner!.id,
      title: T,
      summary: "Réfection complète d'une toiture de 750 m² avec désamiantage.",
      description: "Chantier de réfection de toiture : dépose, désamiantage et pose d'une nouvelle couverture.",
      sector_slug: "travaux-btp",
      department_code: "30",
      region: "Occitanie",
      response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  needId = o.id;
});

test.afterAll(async () => {
  if (needId) await db.from("opportunities").delete().eq("id", needId);
});

test("besoin d'une entreprise : un visiteur sans compte écrit directement à l'auteur", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto(`/opportunites/${needId}`);
  await expect(page.getByText("Une entreprise recherche un prestataire")).toBeVisible();
  await expect(page.getByText("Réfection complète d'une toiture de 750 m² avec désamiantage.")).toBeVisible();
  const form = page.getByTestId("need-contact");
  await form.getByLabel("Nom et prénom").fill("Jean Couvreur");
  await form.getByLabel("Entreprise", { exact: true }).fill(`Toitures ${RUN}`);
  await form.getByLabel("Adresse e-mail", { exact: true }).fill(`couvreur-${RUN}@example.test`);
  await form.getByLabel("Votre message").fill("Bonjour, nous pouvons intervenir dès décembre, devis sous 48 h.");
  // Accord de transmission jamais présumé : refusé sans la case, saisie conservée
  await form.getByRole("button", { name: "Envoyer mon message" }).click();
  await expect(form.getByText("Cochez la case pour que vos coordonnées soient transmises")).toBeVisible();
  await expect(form.getByLabel("Nom et prénom")).toHaveValue("Jean Couvreur");
  await form.getByRole("checkbox", { name: /transmis à l'entreprise/ }).check();
  await form.getByRole("button", { name: "Envoyer mon message" }).click();
  await expect(page.getByTestId("need-contact-sent")).toContainText("Votre message a été transmis à l'entreprise");

  await expect.poll(async () => (await db.from("need_contacts").select("id", { count: "exact", head: true }).eq("opportunity_id", needId)).count).toBe(1);
  const { data: mail } = await db.from("email_outbox").select("to_email, template").eq("template", "need_contact").ilike("subject", `%${RUN}%`).limit(1).single();
  expect(mail?.to_email).toBe(ownerEmail);
});
