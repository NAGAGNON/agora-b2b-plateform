import { expect, test } from "@playwright/test";
import { login, newPage, RUN } from "./helpers";

/** Messagerie en temps réel : le destinataire voit le message sans recharger la page. */
test("un message apparaît chez le destinataire sans rechargement", async ({ browser }) => {
  const supplier = await newPage(browser);
  await login(supplier, "fournisseur@demo.linkprob2b.test");
  await supplier.goto("/dashboard/messages");
  await supplier.getByRole("link", { name: /Conserverie/ }).first().click();
  await expect(supplier).toHaveURL(/\/dashboard\/messages\/[0-9a-f-]{36}/);
  const conversationUrl = supplier.url();
  await expect(supplier.locator('[data-realtime-channel="conversation"][data-realtime="live"]')).toBeVisible({ timeout: 20_000 });

  // Marqueur : disparaîtrait si la page du fournisseur était rechargée.
  await supplier.evaluate(() => ((window as unknown as { __sansRechargement: boolean }).__sansRechargement = true));

  const buyer = await newPage(browser);
  await login(buyer, "acheteur@demo.linkprob2b.test");
  await buyer.goto(conversationUrl);
  const text = `Message temps réel ${RUN}`;
  await buyer.getByLabel("Votre message").fill(text);
  await buyer.getByRole("button", { name: /Envoyer/ }).click();
  await expect(buyer.getByText(text)).toBeVisible();

  // Côté fournisseur : pas de rechargement (le marqueur posé sur window survit), le message arrive par le temps réel.
  await expect(supplier.getByText(text)).toBeVisible({ timeout: 15_000 });
  expect(await supplier.evaluate(() => (window as unknown as { __sansRechargement?: boolean }).__sansRechargement)).toBe(true);

  // Accusé de lecture côté expéditeur, également en temps réel.
  await expect(buyer.locator("li", { hasText: text }).getByText("· Lu")).toBeVisible({ timeout: 15_000 });
});

test("une notification apparaît dans la cloche sans rechargement", async ({ browser }) => {
  const supplier = await newPage(browser);
  await login(supplier, "fournisseur@demo.linkprob2b.test");
  await supplier.goto("/dashboard");
  const bell = supplier.getByRole("button", { name: /^Notifications/ });
  const before = (await bell.getAttribute("aria-label")) ?? "";
  await expect(supplier.locator('[data-realtime-channel="user"]')).toHaveAttribute("data-realtime", "live", { timeout: 20_000 });

  const buyer = await newPage(browser);
  await login(buyer, "acheteur@demo.linkprob2b.test");
  await buyer.goto("/dashboard/messages");
  await buyer.getByRole("link", { name: /Iroise/ }).first().click();
  await buyer.getByLabel("Votre message").fill(`Notification temps réel ${RUN}`);
  await buyer.getByRole("button", { name: /Envoyer/ }).click();

  await expect(bell).not.toHaveAttribute("aria-label", before, { timeout: 15_000 });
  await bell.click();
  await expect(supplier.getByText(/Nouveau message/).first()).toBeVisible();
});
