import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/email/flush", () => ({ flushEmailsAfterResponse: () => {} }));

const { dueStep, founderEmail } = await import("@/lib/billing/founder-emails");
const { founderOpen, isFounder, FOUNDER_PRICE_HT } = await import("@/lib/billing/founder");

const DAY = 86_400_000;
const t0 = Date.parse("2026-12-01T09:00:00Z");
const offer = { enabled: true, launchedAt: new Date(t0).toISOString(), endsAt: new Date(t0 + 21 * DAY).toISOString() };

describe("offre membre fondateur", () => {
  it("moitié prix de Pro", () => expect(FOUNDER_PRICE_HT).toBe(14.5));

  it("inactive tant qu'elle n'est pas lancée, terminée après la date de fin", () => {
    expect(founderOpen({ enabled: false, launchedAt: null, endsAt: null })).toBe(false);
    expect(founderOpen(offer, t0 + DAY)).toBe(true);
    expect(founderOpen(offer, t0 + 22 * DAY)).toBe(false);
    expect(dueStep({ enabled: false, launchedAt: null, endsAt: null }, t0)).toBeNull();
  });

  it("réservée aux comptes créés avant le lancement", () => {
    expect(isFounder(offer, new Date(t0 - DAY).toISOString())).toBe(true);
    expect(isFounder(offer, new Date(t0 + DAY).toISOString())).toBe(false);
  });

  it("annonce, rappel à J+7, dernier rappel 2 jours avant la fin", () => {
    expect(dueStep(offer, t0 + 3_600_000)).toBe("ANNONCE");
    expect(dueStep(offer, t0 + 8 * DAY)).toBe("RAPPEL");
    expect(dueStep(offer, t0 + 20 * DAY)).toBe("DERNIER");
    expect(dueStep(offer, t0 + 22 * DAY)).toBeNull();
  });

  it("e-mails : prénom, prix, rien ne change sans souscription, aucune mention d'outil automatique", () => {
    const a = founderEmail("ANNONCE", "Camille", offer);
    expect(a.subject).toContain("Camille");
    const text = a.paragraphs.join(" ");
    expect(text).toContain("14,50 € HT par mois au lieu de 29 €");
    expect(text).toContain("rien ne change");
    expect(text).not.toMatch(/\bIA\b|intelligence artificielle|robot/i);
    expect(founderEmail("DERNIER", null, offer).subject).toContain("22 décembre");
  });
});
