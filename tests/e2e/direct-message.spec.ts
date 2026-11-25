import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { RUN, login, newPage } from "./helpers";

config({ path: ".env.local" });
const db = createClient(process.env.SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const BODY = `Bonjour, nous aimerions échanger avec vous sur une sous-traitance (E2E ${RUN}).`;

async function companyOf(email: string) {
  const { data: u } = await db.from("users").select("id").eq("email", email).single();
  const { data: m } = await db.from("company_members").select("company:companies(id, slug, name)").eq("user_id", u!.id).limit(1).single();
  return m!.company as unknown as { id: string; slug: string; name: string };
}

let ids: string[] = [];
test.afterAll(async () => {
  if (ids.length === 2) {
    await db.from("conversations").delete().eq("direct", true).in("buyer_company_id", ids).in("supplier_company_id", ids);
  }
});

test("annuaire : écrire à une entreprise, la conversation s'ouvre dans la messagerie", async ({ browser }) => {
  const target = await companyOf("fournisseur2@demo.linkprob2b.test");
  const me = await companyOf("fournisseur@demo.linkprob2b.test");
  ids = [target.id, me.id];
  await db.from("conversations").delete().eq("direct", true).in("buyer_company_id", ids).in("supplier_company_id", ids);

  // Visiteur sans compte : le bouton mène à l'inscription, puis revient sur la fiche
  const visitor = await newPage(browser);
  await visitor.goto(`/entreprises/${target.slug}`);
  await expect(visitor.getByTestId("message-company")).toHaveAttribute("href", new RegExp(`/inscription\\?suite=.*${target.slug}`));

  // Les cartes de l'annuaire ont un bouton « Écrire »
  const page = await newPage(browser, { width: 390, height: 844 });
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/entreprises");
  await expect(page.getByRole("link", { name: "Écrire", exact: true }).first()).toHaveAttribute("href", /\?message=1$/);

  // Arrivée depuis « Écrire » : la fenêtre est ouverte, le message part dans la messagerie
  await page.goto(`/entreprises/${target.slug}?message=1`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Votre message").fill(BODY);
  await page.getByRole("button", { name: "Envoyer mon message" }).click();
  await expect(page).toHaveURL(/\/dashboard\/messages\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Échange direct entre entreprises")).toBeVisible();
  await expect(page.getByText(BODY)).toBeVisible();

  // Ensuite, la fiche propose de reprendre la même conversation
  await page.goto(`/entreprises/${target.slug}`);
  await expect(page.getByTestId("message-company")).toHaveText(/Reprendre la conversation/);

  // L'entreprise contactée la voit dans ses messages
  const other = await newPage(browser);
  await login(other, "fournisseur2@demo.linkprob2b.test");
  await other.goto("/dashboard/messages");
  await expect(other.getByText(me.name).first()).toBeVisible();
});
