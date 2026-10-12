import { describe, expect, it } from "vitest";
import { factNumbersText, unknownReportNumbers } from "@/lib/daily-report";
import { referralStillTrusted } from "@/lib/outreach/tracking";
import { listingIndexing } from "@/lib/seo";

describe("Contrôle des chiffres inventés", () => {
  it("les identifiants et liens des faits ne servent pas de caution", () => {
    const facts = { opportunites: [{ id: "3f2a9c41-0d5e-4b7a-9c3e-12ab34cd56ef", lien: "https://www.linkprob2b.com/opportunites/3f2a9c41-0d5e-4b7a-9c3e-12ab34cd56ef", chemin: "/opportunites/42" }], visites: 7 };
    const text = factNumbersText(facts);
    expect(text).not.toMatch(/3f2a9c41|linkprob2b|\/opportunites\/42/);
    expect(text).toContain("7");
    const summary = { titre: "Bilan", resume: "7 visites, en hausse de 41 %.", points_forts: [], points_faibles: [], automatique: [], recommandations: [] };
    expect(unknownReportNumbers(summary, facts)).toEqual(["41"]);
  });
});

describe("Inscription depuis un e-mail de prospection", () => {
  it("le lien vaut preuve de l'adresse 30 jours, pas au-delà", () => {
    const now = Date.parse("2026-10-12T10:00:00Z");
    expect(referralStillTrusted({ sent_at: "2026-10-01T10:00:00Z", created_at: "2026-10-01T09:00:00Z" }, now)).toBe(true);
    expect(referralStillTrusted({ sent_at: "2026-09-01T10:00:00Z", created_at: "2026-09-01T09:00:00Z" }, now)).toBe(false);
    expect(referralStillTrusted({ sent_at: null, created_at: "2026-10-10T09:00:00Z" }, now)).toBe(true);
    expect(referralStillTrusted(null, now)).toBe(false);
  });
});

describe("Pagination au-delà de la limite de recherche", () => {
  it("au-delà de la page 500 : non indexée", () => {
    expect(listingIndexing("/opportunites", { page: "500" })).toEqual({ path: "/opportunites?page=500", filtered: false });
    expect(listingIndexing("/opportunites", { page: "600" }).filtered).toBe(true);
  });
});
