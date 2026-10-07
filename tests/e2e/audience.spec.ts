import { expect, test } from "@playwright/test";
import { login, newPage } from "./helpers";

test("mesure d'audience : visites et temps de lecture visibles dans l'administration", async ({ browser }) => {
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

  // Les robots ne sont pas comptés
  const bot = await browser.newContext({ userAgent: "Googlebot/2.1" });
  const r = await bot.request.post("/api/audience", { data: { t: "view", sid: crypto.randomUUID(), path: "/" } });
  expect(r.status()).toBe(204);
  await bot.close();

  const admin = await newPage(browser);
  await login(admin, "admin@demo.linkprob2b.test");
  await admin.goto("/admin?periode=7");
  const audience = admin.getByRole("region", { name: "Audience" });
  await expect(audience).toBeVisible();
  await expect(audience.getByRole("cell", { name: "/ressources" })).toBeVisible();
  await expect(audience.getByText("Durée moyenne")).toBeVisible();
  await expect(audience.getByText("Visite → inscription")).toBeVisible();
});
