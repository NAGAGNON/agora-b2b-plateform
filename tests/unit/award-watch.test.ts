import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { fetchBoampAwards } from "@/lib/award-watch";

describe("résultat d'un marché au BOAMP", () => {
  it("relie l'avis de résultat à l'avis de départ et donne l'entreprise retenue", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      expect(new URL(String(url)).searchParams.get("where")).toContain('annonce_lie in ("26-72738","26-1")');
      return new Response(
        JSON.stringify({
          results: [
            { idweb: "26-107391", annonce_lie: ["26-72738"], titulaire: ["EDENRED FRANCE SAS"], nature: "ATTRIBUTION", dateparution: "2026-11-06", url_avis: "https://www.boamp.fr/pages/avis/?q=idweb:26-107391" },
            { idweb: "26-9", annonce_lie: ["26-1"], titulaire: null, nature: "ANNULATION", dateparution: "2026-11-07", url_avis: "javascript:alert(1)" },
          ],
        }),
        { status: 200 },
      );
    });
    const awards = await fetchBoampAwards(["26-72738", "26-1", "x y"], fetcher as unknown as typeof fetch);
    expect(awards.get("26-72738")).toEqual({ idweb: "26-107391", titulaires: ["EDENRED FRANCE SAS"], date: "2026-11-06", url: "https://www.boamp.fr/pages/avis/?q=idweb:26-107391", cancelled: false });
    expect(awards.get("26-1")).toMatchObject({ cancelled: true, titulaires: [], url: "https://www.boamp.fr/pages/avis/?q=idweb:26-9" });
  });

  it("ne fait aucun appel sans avis de départ", async () => {
    const fetcher = vi.fn();
    expect((await fetchBoampAwards([], fetcher as unknown as typeof fetch)).size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
