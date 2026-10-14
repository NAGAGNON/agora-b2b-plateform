import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, newPage, signUpWithCompany } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });

test("veille : passage aux alertes quotidiennes confirmé explicitement, puis désinscription en un clic", async ({ browser }) => {
  const page = await newPage(browser, { width: 390, height: 844 });
  const email = await signUpWithCompany(page, "veille", `Veille ${RUN}`, "Fournisseur / prestataire");
  const { data: u } = await db.from("users").select("id").eq("email", email).single();

  // Lien « Recevoir mes opportunités chaque jour » de l'e-mail : rien n'est activé sans confirmation
  await page.goto("/dashboard/veille?frequence=quotidienne");
  await expect(page.getByText("Rien n'est activé tant que vous n'avez pas enregistré")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Alertes quotidiennes/ })).toBeChecked();
  expect((await db.from("veille_preferences").select("user_id").eq("user_id", u!.id)).data).toEqual([]);
  const consent = page.getByRole("checkbox", { name: /J'accepte de recevoir la veille LinkProB2B/ });
  await expect(consent).not.toBeChecked();

  // Sans critère ni accord : refusé
  await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
  await expect(page.getByText(/Cochez la case d'accord|au moins un critère/)).toBeVisible();

  await page.getByRole("checkbox", { name: "Bretagne" }).check();
  await page.getByLabel("Mots-clés").fill("maintenance, cybersécurité");
  await consent.check();
  await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
  await expect(page.getByText(/^Alertes quotidiennes activées :/)).toBeVisible();
  const { data: pref } = await db.from("veille_preferences").select("frequency, regions, keywords, consent_at").eq("user_id", u!.id).single();
  expect(pref).toMatchObject({ frequency: "DAILY", regions: ["Bretagne"], keywords: ["maintenance", "cybersécurité"] });
  expect(pref!.consent_at).toBeTruthy();

  // Désinscription depuis le lien d'un e-mail (jeton d'un envoi)
  const { data: c } = await db.from("veille_campaigns").insert({ kind: "DAILY", edition_date: `2093-01-${String((parseInt(RUN.slice(0, 2), 16) % 28) + 1).padStart(2, "0")}`, status: "SENT" }).select("id").single();
  const { data: s } = await db.from("veille_sends").insert({ campaign_id: c!.id, user_id: u!.id, email, status: "SENT" }).select("token").single();
  await page.goto(`/veille/desabonnement?jeton=${s!.token}`);
  await page.getByRole("button", { name: "Confirmer la désinscription" }).click();
  await expect(page.getByRole("heading", { name: "Désinscription confirmée" })).toBeVisible();
  expect((await db.from("veille_preferences").select("frequency").eq("user_id", u!.id).single()).data?.frequency).toBe("NONE");
  expect((await db.from("veille_suppressions").select("reason").eq("email", email.toLowerCase()).single()).data?.reason).toBe("UNSUBSCRIBE");

  // Lien d'une annonce : clic enregistré puis redirection vers la page annoncée
  const res = await page.request.get(`/api/veille/c?t=${s!.token}&p=opportunites`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()["location"]).toMatch(/\/opportunites\?utm_source=veille/);
  expect((await db.from("veille_sends").select("clicked_at").eq("token", s!.token).single()).data?.clicked_at).toBeTruthy();
  await db.from("veille_campaigns").delete().eq("id", c!.id);
  await db.from("veille_suppressions").delete().eq("email", email.toLowerCase());
});

test("administration : configuration, aperçu réel, destinataires et envoi test honnête", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "admin@demo.linkprob2b.test");
  await page.goto("/admin/veille");
  await expect(page.getByRole("heading", { level: 1, name: "Veille par e-mail" })).toBeVisible();
  await expect(page.getByText("Désactivés (aucun e-mail réel ne part)")).toBeVisible();
  await expect(page.getByText(/Destinataires éligibles/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Historique des éditions" })).toBeVisible();
  await page.getByRole("link", { name: "Lundi", exact: true }).click();
  await expect(page.getByText(/objet : Votre veille B2B — les nouvelles opportunités de la semaine/)).toBeVisible();
  // Sans service d'envoi configuré, l'envoi test le dit clairement au lieu de faire semblant
  await page.getByRole("button", { name: "Envoyer un e-mail test" }).click();
  await expect(page.getByText(/Aucun service d'envoi configuré|E-mail test envoyé/)).toBeVisible();
  await page.getByRole("button", { name: "Activer les envois automatiques" }).click();
  await expect(page.getByText(/Impossible d'activer|Faites d'abord un envoi test|Envois automatiques activés/)).toBeVisible();
});
