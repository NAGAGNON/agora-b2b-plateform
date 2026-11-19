import { describe, expect, it } from "vitest";
import { companyCreatedLayout, companyCreatedSubject } from "@/lib/email/auth-emails";
import { renderEmail } from "@/lib/email/templates";

describe("e-mail « entreprise créée »", () => {
  it("nomme l'entreprise, mène aux offres et demande le SIREN seulement s'il manque", () => {
    expect(companyCreatedSubject("Atelier Dupont")).toBe("Votre entreprise Atelier Dupont est créée sur LinkProB2B");
    const without = renderEmail(companyCreatedLayout({ name: "Atelier Dupont", slug: "atelier-dupont", hasSiren: false }));
    expect(without.text).toContain("Atelier Dupont");
    expect(without.text).toContain("/dashboard/recommandations");
    expect(without.text).toContain("/entreprises/atelier-dupont");
    expect(without.text).toContain("SIREN");
    const withSiren = renderEmail(companyCreatedLayout({ name: "Atelier Dupont", slug: null, hasSiren: true }));
    expect(withSiren.text).not.toContain("SIREN");
    expect(withSiren.text).not.toContain("/entreprises/");
  });
});
