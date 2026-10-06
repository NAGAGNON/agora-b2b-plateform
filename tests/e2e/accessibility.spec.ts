import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login, newPage } from "./helpers";

/** Audit automatique (axe-core, WCAG 2.1 A/AA) : aucune violation grave ou critique. */
const PUBLIC = ["/", "/opportunites", "/entreprises", "/publier", "/connexion", "/inscription", "/contact", "/comment-ca-marche", "/tarifs", "/faq"];
const PRIVATE = ["/dashboard", "/dashboard/alertes", "/dashboard/recommandations", "/dashboard/messages", "/dashboard/pipeline"];

async function audit(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  // Le logotype (texte de marque) est exempté des exigences de contraste (WCAG 1.4.3).
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude('a[aria-label="LinkProB2B — accueil"]').analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${path} — ${v.id} : ${v.help} (${v.nodes.length} élément(s) : ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")})`)).toEqual([]);
}

test("pages publiques accessibles", async ({ browser }) => {
  const page = await newPage(browser);
  for (const p of PUBLIC) await audit(page, p);
});

test("espace connecté accessible", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "fournisseur@demo.linkprob2b.test");
  for (const p of PRIVATE) await audit(page, p);
});

test("administration accessible", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "admin@demo.linkprob2b.test");
  for (const p of ["/admin", "/admin/moderation", "/admin/sources", "/admin/synchronisations", "/admin/referentiels", "/admin/reponses", "/admin/parametres"]) await audit(page, p);
});
