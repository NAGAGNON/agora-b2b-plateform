import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/actions/opportunities", () => ({ trackNeedShare: vi.fn() }));
import { taggedShareUrl } from "@/components/share-links";

describe("Liens partagés étiquetés (provenance des visiteurs)", () => {
  it("ajoute la source du canal de partage", () => {
    expect(taggedShareUrl("https://www.linkprob2b.com/opportunites/abc", "linkedin")).toBe("https://www.linkprob2b.com/opportunites/abc?utm_source=partage-linkedin&utm_medium=partage");
    expect(taggedShareUrl("https://www.linkprob2b.com/x?a=1", "lien")).toBe("https://www.linkprob2b.com/x?a=1&utm_source=partage-lien&utm_medium=partage");
  });
});
