import { describe, expect, it } from "vitest";
import { needContactSchema, parseForm } from "@/lib/validation";

const form = (v: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, x] of Object.entries(v)) fd.set(k, x);
  return fd;
};
const ok = {
  opportunityId: "16a2dff6-a991-4677-ac22-9bdd27d50eec",
  name: "Jean Dupont",
  company: "Toitures du Gard",
  email: " Contact@Toitures-Gard.fr ",
  message: "Bonjour, nous pouvons intervenir sur ce chantier dès décembre.",
  consent: "on",
};

describe("réponse à un besoin sans compte", () => {
  it("accepte un message complet, adresse normalisée, téléphone facultatif", () => {
    const r = parseForm(needContactSchema, form(ok));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("contact@toitures-gard.fr");
      expect(r.data.phone).toBeUndefined();
    }
  });

  it("exige l'accord de transmission des coordonnées (jamais présumé)", () => {
    const { consent: _c, ...rest } = ok;
    const r = parseForm(needContactSchema, form(rest));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.result.fieldErrors.consent).toBeTruthy();
  });

  it("refuse un message trop court ou une entreprise manquante", () => {
    const r = parseForm(needContactSchema, form({ ...ok, message: "Bonjour", company: "" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.result.fieldErrors.message).toBeTruthy();
      expect(r.result.fieldErrors.company).toBeTruthy();
    }
  });

  it("champ piège rempli : signalé (traité comme un robot)", () => {
    const r = parseForm(needContactSchema, form({ ...ok, website: "http://spam.example" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.result.fieldErrors.website).toBeTruthy();
  });
});
