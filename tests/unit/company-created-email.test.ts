import { describe, expect, it } from "vitest";
import { companyCreatedLayout, companyCreatedSubject } from "@/lib/email/auth-emails";
import { renderEmail } from "@/lib/email/templates";

describe("e-mail « entreprise créée »", () => {
  it("simple annonce : nomme l'entreprise, un seul bouton vers l'espace entreprise", () => {
    expect(companyCreatedSubject("Atelier Dupont")).toBe("Votre entreprise Atelier Dupont est créée sur LinkProB2B");
    const layout = companyCreatedLayout({ name: "Atelier Dupont" });
    expect(layout.cta?.label).toBe("Accéder à mon espace entreprise");
    expect(layout.cta?.url).toMatch(/\/dashboard\/entreprise$/);
    expect(layout.list).toBeUndefined();
    const { text } = renderEmail(layout);
    expect(text).toContain("Atelier Dupont");
    expect(text).toContain("Aucune action n'est nécessaire");
    expect(text).not.toContain("SIREN");
  });
});
