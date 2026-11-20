import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { founderWave } from "@/lib/billing/founder-list";

describe("vagues du tarif fondateur", () => {
  it("vague 1 jusqu'au vendredi 27 novembre 23h59", () => {
    expect(founderWave(Date.parse("2026-11-20T12:00:00Z"))).toEqual({ number: 1, endsAt: "2026-11-27T22:59:59.000Z" });
  });
  it("la vague suivante est numérotée et finit une semaine plus tard", () => {
    expect(founderWave(Date.parse("2026-11-27T23:00:00Z"))).toEqual({ number: 2, endsAt: "2026-12-04T22:59:59.000Z" });
    expect(founderWave(Date.parse("2026-12-04T22:59:59Z")).number).toBe(2);
    expect(founderWave(Date.parse("2026-12-10T10:00:00Z"))).toEqual({ number: 3, endsAt: "2026-12-11T22:59:59.000Z" });
  });
});
