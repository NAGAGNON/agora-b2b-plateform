import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });

test("mesure d'audience : visites et temps de lecture visibles dans l'administration", async ({ browser }) => {
  const since = new Date().toISOString();
  const visitor = await newPage(browser, { width: 390, height: 800 });
  const recorded = visitor.waitForResponse((r) => r.url().endsWith("/api/audience") && r.request().postData()?.includes('"t":"view"') === true);
  await visitor.goto("/ressources");
  expect((await recorded).status()).toBe(200);
  // Navigation interne : une deuxième page vue, puis envoi du temps de lecture de la première
  const timing = visitor.waitForRequest((r) => r.url().endsWith("/api/audience") && (r.postData() ?? "").includes('"t":"time"'));
  await visitor.waitForTimeout(1200);
  await visitor.getByRole("link", { name: "Explorer les opportunités" }).first().click();
  await timing;
  await visitor.close();
  // Page vue enregistrée, appareil mobile, temps de lecture reçu (≥ 1 s)
  await expect
    .poll(async () => (await db.from("page_views").select("device, duration_ms").eq("path", "/ressources").gte("created_at", since)).data?.[0])
    .toMatchObject({ device: "mobile" });
  await expect
    .poll(async () => (await db.from("page_views").select("duration_ms").eq("path", "/ressources").gte("created_at", since)).data?.[0]?.duration_ms ?? 0)
    .toBeGreaterThanOrEqual(1000);

  // Les robots ne sont pas comptés
  const bot = await browser.newContext({ userAgent: "Googlebot/2.1" });
  const r = await bot.request.post("/api/audience", { data: { t: "view", sid: crypto.randomUUID(), path: "/" } });
  expect(r.status()).toBe(204);
  await bot.close();

  const admin = await newPage(browser);
  await login(admin, "admin@demo.linkprob2b.test");
  await admin.goto("/admin?periode=7");
  const audience = admin.getByRole("region", { name: "Audience", exact: true });
  await expect(audience).toBeVisible();
  await expect(audience.getByRole("columnheader", { name: "Page" })).toBeVisible();
  await expect(audience.getByText("Durée moyenne")).toBeVisible();
  await expect(audience.getByText("Visite → inscription")).toBeVisible();
});

test("visites internes non comptées : équipe et adresse du propriétaire, même après déconnexion", async ({ browser }) => {
  const viewStatus = (page: import("@playwright/test").Page) =>
    page.waitForResponse((r) => r.url().endsWith("/api/audience") && r.request().postData()?.includes('"t":"view"') === true).then((r) => r.status());

  // Administrateur connecté : visite ignorée, appareil marqué
  const admin = await newPage(browser);
  await login(admin, "admin@demo.linkprob2b.test");
  let status = viewStatus(admin);
  await admin.goto("/faq");
  expect(await status).toBe(204);
  // Déconnexion (cookies de session supprimés) : l'appareil reste reconnu
  await admin.context().clearCookies({ name: /^sb-/ });
  status = viewStatus(admin);
  await admin.goto("/tarifs");
  expect(await status).toBe(204);
  expect((await admin.context().cookies()).find((c) => c.name === "lp_interne")).toMatchObject({ value: "1", httpOnly: true });

  // Compte utilisateur dont l'adresse est déclarée comme celle du propriétaire
  const owner = await newPage(browser);
  await login(owner, "acheteur2@demo.linkprob2b.test");
  status = viewStatus(owner);
  await owner.goto("/faq");
  expect(await status).toBe(204);

  // Utilisateur ordinaire : visite comptée
  const user = await newPage(browser);
  await login(user, "fournisseur@demo.linkprob2b.test");
  status = viewStatus(user);
  await user.goto("/faq");
  expect(await status).toBe(200);
});
