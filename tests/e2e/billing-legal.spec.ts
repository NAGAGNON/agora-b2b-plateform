import { expect, test } from "@playwright/test";
import { login, newPage } from "./helpers";

test("page Tarifs : trois offres, prix HT, comparatif et appels à l'action", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/tarifs");
  await expect(page.getByText("Pendant la phase de lancement, toutes les fonctionnalités de LinkProB2B sont gratuites pour les inscrits.")).toBeVisible();
  await expect(page.getByText("Offre prévue : pas encore proposée à l'achat.").first()).toBeVisible();
  for (const name of ["LinkProB2B Gratuit", "LinkProB2B Pro", "LinkProB2B Business"]) await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Recommandé", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Le plus populaire")).toHaveCount(0);
  await expect(page.getByText("29 € HT / mois").first()).toBeVisible();
  await expect(page.getByTestId("yearly-PRO")).toContainText("290 € HT / an");
  await expect(page.getByTestId("yearly-BUSINESS")).toContainText("590 € HT / an");
  await expect(page.getByRole("link", { name: "Créer mon compte gratuitement" })).toHaveAttribute("href", "/inscription");
  await expect(page.getByRole("link", { name: "Passer à Pro" })).toHaveAttribute("href", "/dashboard/abonnement?offre=PRO");
  await expect(page.getByRole("link", { name: "Passer à Business" })).toHaveAttribute("href", "/dashboard/abonnement?offre=BUSINESS");
  await expect(page.getByRole("heading", { name: "Comparer les offres" })).toBeVisible();
  // Sans compte : la souscription passe par la connexion
  await page.getByRole("link", { name: "Passer à Pro" }).click();
  await expect(page).toHaveURL(/\/connexion\?suite=/);
});

test("page d'accueil : message et appels à l'action", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Les bonnes opportunités commencent ici.");
  await expect(page.getByText("Trouvez des partenaires, découvrez des opportunités et développez votre activité.")).toBeVisible();
  await expect(page.getByText("Gratuit · Sans carte bancaire · Des opportunités partout en France", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trouvez les marchés de votre secteur" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ce que vous pouvez faire dès maintenant" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Découvrir les opportunités" }).first()).toHaveAttribute("href", "/opportunites");
  await expect(page.getByRole("link", { name: "Créer mon compte gratuit" }).first()).toHaveAttribute("href", "/inscription");
  await expect(page.getByRole("link", { name: /Parcourir l'annuaire/ })).toHaveAttribute("href", "/entreprises");
  await expect(page.getByRole("main").getByRole("link", { name: "Publier un besoin" }).first()).toHaveAttribute("href", "/publier");
  // Le spot de présentation démarre seul, sans le son
  await expect(page.getByRole("button", { name: "Activer le son" })).toBeVisible();
  // Clic mesuré puis navigation vers les opportunités, sans inscription
  await page.getByRole("link", { name: "Découvrir les opportunités" }).first().click();
  await expect(page).toHaveURL(/\/opportunites$/);
  await expect(page.getByRole("heading", { level: 1, name: "Explorer les opportunités" })).toBeVisible();
  await page.goto("/");
});

test("Mon abonnement : offre Gratuite, utilisation, souscription avec case non pré-cochée", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/dashboard/abonnement");
  await expect(page.getByRole("heading", { name: "Mon abonnement" })).toBeVisible();
  await expect(page.getByText("Offre actuelle : LinkProB2B Gratuit")).toBeVisible();
  await expect(page.getByText("Paiement en mode test")).toBeVisible();
  await expect(page.getByText("Besoins actifs", { exact: true })).toBeVisible();
  const box = page.getByLabel("J'accepte les conditions d'abonnement et confirme ma souscription au forfait sélectionné.").first();
  await expect(box).not.toBeChecked();
  await expect(page.getByRole("link", { name: "conditions d'abonnement" }).first()).toHaveAttribute("href", "/conditions-abonnement");
  // Sans la case cochée, le formulaire ne part pas (contrôle aussi côté serveur)
  await page.getByRole("button", { name: "Passer à Pro" }).click();
  await expect(page).toHaveURL(/\/dashboard\/abonnement/);
  await expect(page.getByRole("link", { name: "Mon abonnement" }).first()).toBeVisible();
});

test("phase de lancement : pipeline accessible en offre Gratuite, sans encart d'abonnement", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, "fournisseur@demo.linkprob2b.test");
  await page.goto("/dashboard/pipeline");
  await expect(page.getByRole("link", { name: "Découvrir LinkProB2B Pro" })).toHaveCount(0);
  await page.goto("/dashboard/abonnement");
  await expect(page.getByText("Phase de lancement : tout est gratuit")).toBeVisible();
  // Tableau de bord : actions concrètes à mener
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "À faire maintenant" })).toBeVisible();
});

const LEGAL = [
  { path: "/mentions-legales", title: "Mentions légales" },
  { path: "/cgu", title: "Conditions générales d'utilisation" },
  { path: "/confidentialite", title: "Politique de confidentialité" },
  { path: "/cookies", title: "Politique cookies" },
  { path: "/conditions-abonnement", title: "Conditions d'abonnement" },
];

test("espace juridique : pages, sommaire, ancres, titres SEO et pied de page", async ({ browser }) => {
  const page = await newPage(browser);
  for (const l of LEGAL) {
    await page.goto(l.path);
    await expect(page.getByRole("heading", { level: 1, name: l.title })).toBeVisible();
    await expect(page).toHaveTitle(`${l.title} | LinkProB2B`);
    await expect(page.getByRole("heading", { name: "Sommaire" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour en haut" })).toBeVisible();
    const first = page.locator("nav[aria-labelledby=sommaire] a").first();
    const anchor = await first.getAttribute("href");
    expect(anchor).toMatch(/^#/);
    await expect(page.locator(anchor!)).toHaveCount(1);
  }
  // Aucune information d'immatriculation inventée : champs à compléter signalés
  await page.goto("/mentions-legales");
  await expect(page.getByText("[À COMPLÉTER : numéro SIRET]")).toBeVisible();
  await expect(page.getByText("Vercel Inc.")).toBeVisible();
  const footer = page.getByRole("navigation", { name: "Informations légales" }).last();
  for (const name of ["Mentions légales", "Conditions générales d'utilisation", "Politique de confidentialité", "Politique cookies", "Conditions d'abonnement"])
    await expect(footer.getByRole("link", { name })).toBeVisible();
});

test("inscription : consentement explicite non pré-coché", async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto("/inscription");
  const terms = page.getByRole("checkbox", { name: /J'ai lu et j'accepte les Conditions Générales d'Utilisation/ });
  await expect(terms).not.toBeChecked();
  await expect(page.getByRole("link", { name: "Conditions Générales d'Utilisation" }).first()).toHaveAttribute("href", "/cgu");
  await expect(page.getByRole("link", { name: "Politique de confidentialité" }).first()).toHaveAttribute("href", "/confidentialite");
  await expect(page.getByRole("checkbox", { name: /actualités/ })).not.toBeChecked();
});
