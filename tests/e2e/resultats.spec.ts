import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, expectNotFound, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const KEY = `entreprise-e2e-${RUN.toLowerCase()}`;
const NAME = `ENTREPRISE E2E ${RUN}`;
const today = new Date().toISOString().slice(0, 10);

test.beforeAll(async () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    idweb: `E2E${RUN}-${i}`,
    title: `Nettoyage des locaux, lot ${i + 1} (${RUN})`,
    buyer_name: `Ville E2E ${RUN}`,
    winners: [NAME],
    winner_keys: [KEY],
    published_on: today,
    department_code: "29",
    sector_slug: "nettoyage-proprete",
    url: "https://www.boamp.fr/",
  }));
  const { error } = await db.from("awards").insert(rows);
  if (error) throw error;
});
test.afterAll(async () => {
  await db.from("awards").delete().like("idweb", `E2E${RUN}-%`);
  await db.from("award_optouts").delete().eq("winner_key", KEY);
});

test("résultats des marchés : entreprise gagnante, classement, retrait sur demande", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto(`/titulaires/${KEY}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Marchés publics remportés par ${NAME}`);
  await expect(page).toHaveTitle(new RegExp(`${NAME}.*12 (contrats|marchés)`));
  await expect(page.getByTestId("alert-lead")).toBeVisible();
  await expect(page.getByRole("link", { name: "Demander le retrait" })).toBeVisible();

  await page.goto("/resultats/nettoyage-proprete/bretagne");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Qui gagne les marchés publics de nettoyage");
  await page.getByRole("link", { name: NAME }).first().click();
  await expect(page).toHaveURL(new RegExp(`/titulaires/${KEY}$`));

  // Entreprise qui demande le retrait : plus aucune page
  await db.from("award_optouts").insert({ winner_key: KEY });
  await expectNotFound(page, await page.goto(`/titulaires/${KEY}-inexistante`));
});
