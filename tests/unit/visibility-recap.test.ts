import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { nothingReason, renderVisibilityRecap } from "@/lib/visibility-report";

describe("bilan de campagne par e-mail (tous les 2 jours)", () => {
  it("dit ce qui a été fait, avec les noms, et renvoie vers le suivi", () => {
    const report = { presented: [{ at: "2026-11-23T10:00:00Z", name: "Garage Martin", city: "Rennes", channel: "PROSPECT" as const, state: "read" as const }], read: 1, clicked: 0, messages: 0 };
    const m = renderVisibilityRecap({ company: "RC Services", days: 2, report, nothing: null, daysLeft: 10, url: "https://www.linkprob2b.com/dashboard/visibilite/x" });
    expect(m.subject).toBe("Votre campagne : 1 entreprise a découvert RC Services");
    expect(m.html).toContain("Garage Martin (Rennes)");
    expect(m.html).toContain("/dashboard/visibilite/x");
    expect(m.text).toContain("Ont lu : 1");
  });

  it("rien n'est parti : on le dit et on explique pourquoi, sans rien inventer", () => {
    const none = renderVisibilityRecap({ company: "RC Services", days: 2, report: { presented: [], read: 0, clicked: 0, messages: 0 }, nothing: nothingReason({ ad_status: "REJECTED", ad_title: "x" }), daysLeft: 10, url: "u" });
    expect(none.text).toContain("aucune présentation n'est partie");
    expect(none.text).toContain("correction");
    expect(nothingReason({ ad_status: "APPROVED", ad_title: "x" })).toContain("ciblage");
  });
});
