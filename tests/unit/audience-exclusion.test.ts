import { afterEach, describe, expect, it } from "vitest";
import { excludedEmails, isInternalVisitor } from "@/lib/audience-exclusion";

const saved = { a: process.env.AUDIENCE_EXCLUDED_EMAILS, d: process.env.DAILY_REPORT_EMAIL };
afterEach(() => {
  for (const [k, v] of [["AUDIENCE_EXCLUDED_EMAILS", saved.a], ["DAILY_REPORT_EMAIL", saved.d]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("visites internes exclues de l'audience", () => {
  it("équipe (modération, administration) toujours exclue", () => {
    delete process.env.AUDIENCE_EXCLUDED_EMAILS;
    delete process.env.DAILY_REPORT_EMAIL;
    for (const role of ["MODERATOR", "ADMIN", "SUPER_ADMIN"]) expect(isInternalVisitor({ platform_role: role, email: "x@exemple.fr" })).toBe(true);
    expect(isInternalVisitor({ platform_role: "USER", email: "client@exemple.fr" })).toBe(false);
    expect(isInternalVisitor(null)).toBe(false);
  });
  it("adresses du propriétaire : AUDIENCE_EXCLUDED_EMAILS et DAILY_REPORT_EMAIL, sans tenir compte des majuscules", () => {
    process.env.AUDIENCE_EXCLUDED_EMAILS = " Moi@Exemple.fr ; autre@exemple.fr";
    process.env.DAILY_REPORT_EMAIL = "rapport@exemple.fr, pas-une-adresse";
    expect([...excludedEmails()].sort()).toEqual(["autre@exemple.fr", "moi@exemple.fr", "rapport@exemple.fr"]);
    expect(isInternalVisitor({ platform_role: "USER", email: "MOI@exemple.fr" })).toBe(true);
    expect(isInternalVisitor({ platform_role: "USER", email: "rapport@exemple.fr" })).toBe(true);
    expect(isInternalVisitor({ platform_role: "USER", email: "client@exemple.fr" })).toBe(false);
    expect(isInternalVisitor({ platform_role: "USER", email: null })).toBe(false);
  });
});
