import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("e-mail de bienvenue", () => {
  it("offres du domaine et alerte créée : listées, avec l'arrêt en un clic expliqué", async () => {
    const { welcomeLayout } = await import("@/lib/email/auth-emails");
    const l = welcomeLayout({ offers: [{ label: "Réfection de toiture — mairie", url: "https://www.linkprob2b.com/opportunites/x" }], alertName: "Travaux publics et bâtiment — Gironde" });
    expect(l.list).toHaveLength(1);
    expect(l.paragraphs.join(" ")).toContain("« Travaux publics et bâtiment — Gironde »");
    expect(l.paragraphs.join(" ")).toMatch(/modifier ou l'arrêter en un clic/);
    expect(l.cta?.label).toBe("Voir toutes les opportunités");
  });

  it("sans information sur la personne : invitation à créer une alerte, aucune offre inventée", async () => {
    const { welcomeLayout } = await import("@/lib/email/auth-emails");
    const l = welcomeLayout();
    expect(l.list).toBeUndefined();
    expect(l.cta?.label).toBe("Créer mon alerte");
  });
});
