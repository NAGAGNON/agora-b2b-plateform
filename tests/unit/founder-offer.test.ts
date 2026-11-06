import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/email/flush", () => ({ flushEmailsAfterResponse: () => {} }));

const { dueStep, founderEmail } = await import("@/lib/billing/founder-emails");
const { founderOpen, isFounder, seatsLeft, daysLeft, FOUNDER_PRICE_HT } = await import("@/lib/billing/founder");

const DAY = 86_400_000;
const t0 = Date.parse("2026-12-01T09:00:00Z");
const offer = { enabled: true, launchedAt: new Date(t0).toISOString(), endsAt: new Date(t0 + 37 * DAY).toISOString(), seats: 30 };
const off = { enabled: false, launchedAt: null, endsAt: null, seats: 30 };
const ctx = (over: Partial<Parameters<typeof founderEmail>[1]> = {}) => ({ firstName: "Camille", hasCompany: true, seatsLeft: 12, offer, ...over });

describe("offre de lancement", () => {
  it("moitié prix de Pro", () => expect(FOUNDER_PRICE_HT).toBe(14.5));

  it("inactive tant qu'elle n'est pas lancée, terminée après la date de fin", () => {
    expect(founderOpen(off)).toBe(false);
    expect(founderOpen(offer, t0 + DAY)).toBe(true);
    expect(founderOpen(offer, t0 + 38 * DAY)).toBe(false);
    expect(dueStep(off, t0)).toBeNull();
  });

  it("membres fondateurs : comptes créés avant le lancement", () => {
    expect(isFounder(offer, new Date(t0 - DAY).toISOString())).toBe(true);
    expect(isFounder(offer, new Date(t0 + DAY).toISOString())).toBe(false);
  });

  it("places restantes et jours d'essai restants", () => {
    expect(seatsLeft(offer, 7)).toBe(23);
    expect(seatsLeft(offer, 40)).toBe(0);
    expect(daysLeft(new Date(t0 + 2.5 * DAY).toISOString(), t0)).toBe(3);
    expect(daysLeft(null, t0)).toBe(0);
  });

  it("annonce, rappel 7 jours avant la fin de l'essai, fin d'essai, dernier rappel", () => {
    expect(dueStep(offer, t0 + 3_600_000)).toBe("ANNONCE");
    expect(dueStep(offer, t0 + 24 * DAY)).toBe("RAPPEL");
    expect(dueStep(offer, t0 + 31 * DAY)).toBe("FIN_ESSAI");
    expect(dueStep(offer, t0 + 36 * DAY)).toBe("DERNIER");
    expect(dueStep(offer, t0 + 38 * DAY)).toBeNull();
  });

  it("e-mails courts : essai offert, prix fondateur, places, garantie, aucune mention d'outil automatique", () => {
    const a = founderEmail("ANNONCE", ctx());
    expect(a.subject).toBe("Camille, Pro vous est offert pendant 30 jours");
    expect(a.price).toEqual({ now: "14,50 € HT/mois", before: "29 €", detail: "à vie · 12 places restantes" });
    expect(a.benefits).toHaveLength(4);
    expect(a.foot).toBe("Sans engagement · arrêt en un clic · remboursé sous 30 jours si besoin");
    expect(a.intro).toContain("déjà activé");
    expect(a.intro.length).toBeLessThan(120);
    const all = JSON.stringify([a, founderEmail("RAPPEL", ctx()), founderEmail("FIN_ESSAI", ctx()), founderEmail("DERNIER", ctx())]);
    expect(all).not.toMatch(/\bIA\b|intelligence artificielle|robot/i);
    expect(founderEmail("ANNONCE", ctx({ hasCompany: false })).intro).toContain("Créez votre profil");
    expect(founderEmail("DERNIER", ctx()).subject).toContain("7 janvier");
    expect(founderEmail("FIN_ESSAI", ctx({ seatsLeft: 1 })).price.detail).toBe("à vie · 1 place restante");
  });
});
