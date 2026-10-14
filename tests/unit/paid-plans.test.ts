import { afterEach, describe, expect, it } from "vitest";
import { paidPlansOpen } from "@/lib/billing/stripe";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("offres payantes et mode Stripe", () => {
  const set = (key: string, appEnv: string) => Object.assign(process.env, { STRIPE_SECRET_KEY: key, STRIPE_PRO_PRICE_ID: "price_pro", STRIPE_BUSINESS_PRICE_ID: "price_business", APP_ENV: appEnv });

  it("site de production avec une clé de TEST : fermées au public, ouvertes à l'équipe seulement", () => {
    set("sk_test_abc", "production");
    expect(paidPlansOpen(false)).toBe(false);
    expect(paidPlansOpen(true)).toBe(true);
  });

  it("clé LIVE en production, ou prévisualisation : ouvertes ; sans Stripe : fermées", () => {
    set("sk_live_abc", "production");
    expect(paidPlansOpen(false)).toBe(true);
    set("sk_test_abc", "staging");
    expect(paidPlansOpen(false)).toBe(true);
    delete process.env.STRIPE_SECRET_KEY;
    expect(paidPlansOpen(true)).toBe(false);
  });
});
