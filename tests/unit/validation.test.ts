import { describe, expect, it } from "vitest";
import { companySchema, contactSchema, formDataToObject, opportunitySchema, parseForm, signUpSchema } from "@/lib/validation";

const future = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
const past = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

function fd(obj: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) (Array.isArray(v) ? v : [v]).forEach((x) => f.append(k, x));
  return f;
}

const baseOpp = {
  type: "QUOTE_REQUEST",
  title: "Maintenance de compresseurs",
  description: "Description suffisamment longue du besoin.",
  sector: "maintenance-industrielle",
  city: "Brest",
  visibility: "PUBLIC",
};

describe("inscription", () => {
  it("exige un mot de passe robuste et l'acceptation des CGU", () => {
    const ok = signUpSchema.safeParse({ fullName: "Jean Test", email: " Jean@Exemple.FR ", password: "Motdepasse1A", terms: "on" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("jean@exemple.fr");
    expect(signUpSchema.safeParse({ fullName: "Jean", email: "a@b.fr", password: "court", terms: "on" }).success).toBe(false);
    expect(signUpSchema.safeParse({ fullName: "Jean", email: "a@b.fr", password: "sansmajuscule1", terms: "on" }).success).toBe(false);
    expect(signUpSchema.safeParse({ fullName: "Jean", email: "a@b.fr", password: "Motdepasse1A" }).success).toBe(false);
  });
});

describe("opportunité", () => {
  it("accepte un brouillon minimal", () => {
    const r = opportunitySchema.safeParse({ ...baseOpp, intent: "draft" });
    expect(r.success).toBe(true);
  });

  it("refuse un budget incohérent et une date limite passée", () => {
    const r = opportunitySchema.safeParse({ ...baseOpp, budgetMin: "5000", budgetMax: "1000", responseDeadline: past });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("budgetMax");
      expect(paths).toContain("responseDeadline");
    }
  });

  it("exige une date limite pour une consultation soumise et l'attestation", () => {
    const r = opportunitySchema.safeParse({ ...baseOpp, type: "PRIVATE_TENDER", intent: "submit" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("responseDeadline");
      expect(paths).toContain("attest");
    }
    const ok = opportunitySchema.safeParse({ ...baseOpp, type: "PRIVATE_TENDER", intent: "submit", responseDeadline: future, attest: "on" });
    expect(ok.success).toBe(true);
  });

  it("refuse les types externes pour une publication de membre", () => {
    expect(opportunitySchema.safeParse({ ...baseOpp, type: "PUBLIC_TENDER" }).success).toBe(false);
  });

  it("exige une localisation", () => {
    const r = opportunitySchema.safeParse({ ...baseOpp, city: "" });
    expect(r.success).toBe(false);
  });

  it("convertit les compétences en liste", () => {
    const r = opportunitySchema.safeParse({ ...baseOpp, skills: "soudure, usinage" });
    expect(r.success && r.data.skills).toEqual(["soudure", "usinage"]);
  });
});

describe("entreprise", () => {
  it("normalise le SIREN et le site web", () => {
    const r = companySchema.safeParse({ name: "ACME", kind: "SUPPLIER", siren: "123 456 789", website: "acme.fr", sectors: ["informatique"] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.siren).toBe("123456789");
      expect(r.data.website).toBe("https://acme.fr");
    }
    expect(companySchema.safeParse({ name: "ACME", kind: "SUPPLIER", siren: "12345" }).success).toBe(false);
    expect(companySchema.safeParse({ name: "ACME", kind: "SUPPLIER", sectors: ["inconnu"] }).success).toBe(false);
  });
});

describe("formulaires", () => {
  it("regroupe les champs répétés", () => {
    expect(formDataToObject(fd({ sectors: ["a", "b"], name: "x" }))).toEqual({ sectors: ["a", "b"], name: "x" });
  });

  it("renvoie des erreurs par champ", () => {
    const r = parseForm(contactSchema, fd({ name: "A", email: "pas-un-email", subject: "", message: "court" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(r.result.fieldErrors)).toEqual(expect.arrayContaining(["name", "email", "subject", "message"]));
  });

  it("détecte le champ piège anti-robot", () => {
    const r = contactSchema.safeParse({ name: "Robot", email: "r@b.fr", subject: "Spam", message: "Message de robot assez long", website: "http://spam" });
    expect(r.success).toBe(false);
  });
});
