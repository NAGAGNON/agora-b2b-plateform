import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const TITLE = `Audit de cybersécurité disponible E2E ${RUN}`;

test.afterAll(async () => {
  await db.from("conversations").delete().eq("subject", TITLE);
  await db.from("service_offers").delete().eq("title", TITLE);
});

test("disponibilité : publier, apparaître dans la liste, être contacté par une autre entreprise", async ({ browser }) => {
  const seller = await newPage(browser);
  await login(seller, "fournisseur2@demo.linkprob2b.test");
  // Depuis « Publier un besoin » : vous proposez plutôt vos services ?
  await seller.goto("/publier");
  await seller.getByTestId("offer-instead").click();
  await expect(seller).toHaveURL(/\/disponibilites\/publier$/);
  await seller.getByLabel(/Ce que vous proposez/).fill(TITLE);
  // Coordonnées dans le texte : refusé (les échanges passent par la messagerie), saisie conservée
  await seller.getByLabel(/Ce que vous pouvez faire/).fill("Audit de sécurité informatique, appelez le 06 12 34 56 78 pour un devis.");
  await seller.getByLabel("Département").selectOption("29");
  await seller.getByRole("button", { name: "Publier ma disponibilité" }).click();
  await expect(seller.getByText(/Retirez le numéro de téléphone/)).toBeVisible();
  await expect(seller.getByLabel(/Ce que vous proposez/)).toHaveValue(TITLE);
  await seller.getByLabel(/Ce que vous pouvez faire/).fill("Audit de sécurité informatique et tests d'intrusion, sur site ou à distance.");
  await seller.getByRole("button", { name: "Publier ma disponibilité" }).click();
  await expect(seller).toHaveURL(/\/disponibilites\/[0-9a-f-]{36}\?publiee=1$/);
  const path = new URL(seller.url()).pathname;

  // Une autre entreprise la trouve dans la liste (département 29) et écrit
  const buyer = await newPage(browser, { width: 390, height: 844 });
  await login(buyer, "fournisseur@demo.linkprob2b.test");
  await buyer.goto("/disponibilites?departement=29");
  await buyer.getByRole("link", { name: TITLE }).click();
  await expect(buyer).toHaveURL(new RegExp(`${path}$`));
  await buyer.getByLabel(/Votre message à/).fill("Bonjour, pouvez-vous auditer notre réseau en décembre ?");
  await buyer.getByRole("button", { name: "Envoyer mon message" }).click();
  await expect(buyer).toHaveURL(/\/dashboard\/messages\/[0-9a-f-]{36}$/);
  await expect(buyer.getByText("À propos de la disponibilité")).toBeVisible();

  // L'entreprise disponible voit le contact dans « Mes disponibilités »
  await seller.goto("/dashboard/disponibilites");
  await expect(seller.getByTestId("my-offer").filter({ hasText: TITLE })).toContainText("1 contact");
});
