import { describe, expect, it } from "vitest";
import { isReferenceTitle } from "@/lib/email/outbox";
import { renderEmail } from "@/lib/email/templates";

describe("cartes des e-mails d'alerte", () => {
  it("reconnaît un intitulé réduit à une référence", () => {
    expect(isReferenceTitle("UMSDIPA202602")).toBe(true);
    expect(isReferenceTitle("26SF08")).toBe(true);
    expect(isReferenceTitle("26SF08 – Marché d'exploitation du Port de Cergy")).toBe(false);
  });

  it("affiche acheteur, lieu, résumé et date limite", () => {
    const { html, text } = renderEmail({
      title: "Votre alerte",
      paragraphs: ["2 opportunités"],
      list: [{ label: "Marché d'exploitation du Port de Cergy", url: "https://x/opportunites/1", subtitle: "Ville de Cergy", summary: "Exploitation et entretien du port.", meta: ["Cergy (95)"], deadline: "30 novembre 2026", kicker: "Transport et logistique" }],
    });
    expect(html).toContain("Ville de Cergy");
    expect(html).toContain("Réponse avant le 30 novembre 2026");
    expect(html).toContain("Cergy (95)");
    expect(html).toContain("Voir l&#39;offre");
    expect(text).toContain("réponse avant le 30 novembre 2026");
  });
});
