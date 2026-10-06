import { expect, test } from "@playwright/test";
import { login, newPage, RUN, signUpWithCompany } from "./helpers";

/**
 * Parcours complet : inscription → entreprise → publication → validation →
 * recherche → intérêt → réponse → traitement par le demandeur → clôture.
 */
test("parcours complet demandeur / modération / fournisseur", async ({ browser }) => {
  const title = `Maintenance ${RUN} des pompes de relevage`;

  // 1-2. Inscription du demandeur et création de l'entreprise
  const buyer = await newPage(browser);
  await signUpWithCompany(buyer, "acheteur", `E2E Acheteur ${RUN}`, "Entreprise demandeuse");
  await expect(buyer.getByText("Bienvenue sur LinkProB2B")).toBeVisible();

  // 3. Publication via le formulaire en 6 étapes
  await buyer.goto("/publier");
  await buyer.getByText("Demande de devis", { exact: true }).click();
  await buyer.getByRole("button", { name: "Suivant" }).click();
  await buyer.getByLabel("Titre").fill(title);
  await buyer.getByLabel("Description détaillée").fill("Contrat de maintenance préventive pour deux pompes de relevage sur site industriel.");
  await buyer.getByLabel("Secteur").selectOption("maintenance-industrielle");
  await buyer.getByLabel("Ville").fill("Quimper");
  await buyer.getByLabel("Budget maximum (€ HT)").fill("8000");
  await buyer.getByRole("button", { name: "Suivant" }).click();
  await buyer.getByLabel("Compétences recherchées").fill("pompes, hydraulique");
  await buyer.locator('input[type="file"]').setInputFiles({ name: "cahier-des-charges.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% Cahier des charges de test\n") });
  await expect(buyer.getByText("cahier-des-charges.pdf")).toBeVisible();
  await buyer.getByRole("button", { name: "Suivant" }).click();
  const deadline = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await buyer.getByLabel("Date limite de réponse").fill(deadline);
  await buyer.getByRole("button", { name: "Suivant" }).click();
  await expect(buyer.getByRole("heading", { name: "Aperçu de votre publication" })).toBeVisible();
  await expect(buyer.getByText(title)).toBeVisible();
  await buyer.getByRole("button", { name: "Suivant" }).click();
  await buyer.getByText("Je certifie être autorisé(e)").click();
  await buyer.getByRole("button", { name: "Soumettre à validation" }).click();
  await expect(buyer).toHaveURL(/\/dashboard\/opportunites\/[0-9a-f-]{36}\?cree=submit/);
  await expect(buyer.getByText("En attente de validation").first()).toBeVisible();
  await buyer.goto(buyer.url().replace(/\?.*$/, "") + "?onglet=documents");
  await expect(buyer.getByRole("link", { name: "cahier-des-charges.pdf" })).toBeVisible();
  const oppId = buyer.url().match(/opportunites\/([0-9a-f-]{36})/)![1];

  // Non publiée : invisible du public
  const visitor = await newPage(browser);
  const res = await visitor.goto(`/opportunites/${oppId}`);
  expect(res?.status()).toBe(404);

  // 4. Validation par la modération
  const moderator = await newPage(browser);
  await login(moderator, "moderateur@demo.linkprob2b.test");
  await moderator.goto("/admin/moderation");
  const card = moderator.locator("li", { hasText: title });
  await card.getByRole("button", { name: "Approuver et publier" }).click();
  await moderator.getByRole("button", { name: "Confirmer" }).click();
  await expect(moderator.getByText("Opportunité publiée.")).toBeVisible();

  // 5. Recherche par un fournisseur
  const supplier = await newPage(browser);
  await signUpWithCompany(supplier, "fournisseur", `E2E Fournisseur ${RUN}`, "Fournisseur / prestataire");
  await supplier.goto(`/opportunites?q=${encodeURIComponent(`pompes ${RUN}`)}`);
  await expect(supplier.getByText("1 opportunité")).toBeVisible();
  await supplier.getByRole("link", { name: title }).click();
  await expect(supplier.getByText("Besoin publié sur LinkProB2B").first()).toBeVisible();
  // Document de la consultation téléchargeable par un membre connecté
  const doc = supplier.getByRole("link", { name: /cahier-des-charges\.pdf/ });
  const download = await supplier.request.get((await doc.getAttribute("href"))!);
  expect(download.status()).toBe(200);
  expect((await download.body()).subarray(0, 4).toString()).toBe("%PDF");

  // 6. Manifestation d'intérêt
  await supplier.getByRole("button", { name: "Je suis intéressé" }).click();
  await supplier.getByLabel("Message au demandeur (facultatif)").fill("Nous intervenons sur ce type de pompes.");
  await supplier.getByRole("button", { name: "Envoyer" }).click();
  await expect(supplier.getByText("Votre intérêt a été transmis au demandeur.")).toBeVisible();

  // 7. Réponse à la consultation
  await supplier.getByRole("link", { name: "Répondre à la consultation" }).click();
  await supplier.getByLabel("Message d'accompagnement").fill("Proposition de contrat annuel avec deux visites préventives.");
  await supplier.getByLabel("Prix (€ HT)").fill("7200");
  await supplier.getByLabel("Délai").fill("Démarrage sous 2 semaines");
  await supplier.locator('input[type="file"]').setInputFiles({ name: "devis.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% Devis de test\n") });
  await supplier.getByRole("button", { name: "Envoyer ma réponse" }).click();
  await expect(supplier).toHaveURL(/reponse=envoyee/);
  await expect(supplier.getByText("Réponse envoyée")).toBeVisible();

  // 8. Traitement par le demandeur
  await buyer.goto(`/dashboard/opportunites/${oppId}`);
  await expect(buyer.getByText(`E2E Fournisseur ${RUN}`).first()).toBeVisible();
  await expect(buyer.getByText(/7\s?200\s?€ HT/)).toBeVisible();
  await expect(buyer.getByRole("link", { name: /devis\.pdf/ })).toBeVisible();
  await buyer.getByRole("button", { name: "Présélectionner" }).first().click();
  await buyer.getByRole("button", { name: "Confirmer" }).click();
  await expect(buyer.getByText("Décision enregistrée. Le fournisseur a été notifié.")).toBeVisible();
  await buyer.goto(`/dashboard/opportunites/${oppId}?onglet=comparer`);
  await expect(buyer.getByRole("table", { name: "Comparaison des réponses" })).toBeVisible();

  // 9. Clôture
  await buyer.getByRole("button", { name: "Clôturer" }).click();
  await buyer.getByLabel("Réponse retenue").selectOption({ index: 1 });
  await buyer.getByRole("dialog").getByRole("button", { name: "Clôturer" }).click();
  await expect(buyer.getByText("Clôturée").first()).toBeVisible();

  // Le fournisseur voit le résultat
  await supplier.goto("/dashboard/opportunites?onglet=reponses");
  await expect(supplier.getByText("Retenue").first()).toBeVisible();
  await supplier.goto("/dashboard/pipeline");
  await expect(supplier.getByRole("link", { name: title })).toBeVisible();
});
