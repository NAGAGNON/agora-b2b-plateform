import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { allowedNumbers, inventedNumbers, noteFactText, proposalFactText, type Proposal } from "@/lib/board-core";
import { boardDecisionToken, verifyBoardDecisionToken } from "@/lib/board-token";

const facts = { inscriptions: 27, precedentes: 18, visites: 1240, taux: 12.5 };
const proposal: Proposal = {
  probleme: "27 inscriptions contre 18 la semaine d'avant, mais 1 240 visites seulement.",
  decision: "Tester une page dédiée.",
  justification: "Le taux de 12,5 % peut progresser.",
  donnees: "27 / 18 / 1240",
  effet_attendu: "Plus d'inscriptions",
  budget_eur: 50,
  risques: "Faible",
  urgence: "moyenne",
  indicateur: "Inscriptions",
  cible: "+35 %",
  delai_jours: 14,
};

describe("Comité : contrôle anti-invention", () => {
  const allowed = allowedNumbers(facts);
  it("accepte les chiffres présents dans les données (milliers, décimales, petits nombres)", () => {
    expect(inventedNumbers(proposalFactText(proposal), allowed)).toEqual([]);
    expect(inventedNumbers("Proposition P3 : 2 actions sur 3 jours.", allowed)).toEqual([]);
  });
  it("repère un chiffre inventé, mais pas les cibles ni les budgets (ce sont des objectifs)", () => {
    expect(inventedNumbers(noteFactText({ constat: "Nous avons 342 clients payants.", points: ["27 inscriptions"] }), allowed)).toEqual(["342"]);
    expect(proposalFactText(proposal)).not.toContain("35");
  });
});

describe("Comité : lien de décision par e-mail", () => {
  const id = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  it("jeton authentique, lié à la décision et au choix", () => {
    const t = boardDecisionToken(id, "VALIDEE");
    expect(verifyBoardDecisionToken(t)).toEqual({ decisionId: id, verdict: "VALIDEE" });
  });
  it("refuse un jeton modifié (autre choix) ou expiré", () => {
    const t = boardDecisionToken(id, "REFUSEE");
    expect(verifyBoardDecisionToken(t.replace("REFUSEE", "VALIDEE"))).toBeNull();
    expect(verifyBoardDecisionToken(boardDecisionToken(id, "VALIDEE", Date.now() - 15 * 86_400_000))).toBeNull();
    expect(verifyBoardDecisionToken("n'importe quoi")).toBeNull();
  });
});

describe("Comité : bilan par e-mail", () => {
  it("contient les notes, les critiques, l'avis du CEO et les boutons de décision", async () => {
    const { renderBoardEmail } = await import("@/lib/board");
    const msg = renderBoardEmail(
      { kind: "SOIR", title: "Préparer le lancement", ceo_message: "La priorité est d'encaisser.", reason: null },
      [{ author: "DAF", content: { constat: "Aucun revenu encaissé.", points: ["Mode test"] } }],
      [{ id: "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", proposer: "DAF", decision: "Lancer le payant", problem: "Pas de revenus", urgency: "haute", ceo_verdict: "a_valider", ceo_reason: "À vous de décider.", critic: "CMO", critic_opinion: "favorable", critique: "Il faut une offre claire.", status: "A_VALIDER" }],
      2,
    );
    expect(msg.subject).toBe("Réunion du soir : Préparer le lancement · 1 à valider");
    expect(msg.html).toContain("Aucun revenu encaissé.");
    expect(msg.html).toContain("Contradicteur (CMO, favorable)");
    expect(msg.html).toContain("/comite/decision?t=");
    expect(msg.html).toContain("2 décisions d'une réunion précédente attendent");
    if (process.env.BOARD_EMAIL_OUT) (await import("node:fs")).writeFileSync(process.env.BOARD_EMAIL_OUT, msg.html);
  });
});
