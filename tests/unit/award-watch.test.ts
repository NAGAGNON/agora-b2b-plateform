import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { fetchBoampAwards, isWinner, normalizeCompanyName, offersReceived } from "@/lib/award-watch";
import { offersLabel } from "@/lib/award-format";

describe("résultat d'un marché au BOAMP", () => {
  it("relie l'avis de résultat à l'avis de départ et donne l'entreprise retenue", async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      expect(new URL(String(url)).searchParams.get("where")).toContain('annonce_lie in ("26-72738","26-1")');
      return new Response(
        JSON.stringify({
          results: [
            { idweb: "26-107391", annonce_lie: ["26-72738"], titulaire: ["EDENRED FRANCE SAS"], nature: "ATTRIBUTION", dateparution: "2026-11-06", url_avis: "https://www.boamp.fr/pages/avis/?q=idweb:26-107391", donnees: '{"a":{"CompanyID": "21920033400015"},"b":{"CompanyID": "39336513500549"}}' },
            { idweb: "26-9", annonce_lie: ["26-1"], titulaire: null, nature: "ANNULATION", dateparution: "2026-11-07", url_avis: "javascript:alert(1)" },
          ],
        }),
        { status: 200 },
      );
    });
    const awards = await fetchBoampAwards(["26-72738", "26-1", "x y"], fetcher as unknown as typeof fetch);
    expect(awards.get("26-72738")).toEqual({ idweb: "26-107391", titulaires: ["EDENRED FRANCE SAS"], date: "2026-11-06", url: "https://www.boamp.fr/pages/avis/?q=idweb:26-107391", cancelled: false, sirens: ["219200334", "393365135"], offers: [] });
    expect(awards.get("26-1")).toMatchObject({ cancelled: true, titulaires: [], url: "https://www.boamp.fr/pages/avis/?q=idweb:26-9" });
  });

  it("ne fait aucun appel sans avis de départ", async () => {
    const fetcher = vi.fn();
    expect((await fetchBoampAwards([], fetcher as unknown as typeof fetch)).size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("gagnant d'un marché", () => {
  const award = { titulaires: ["EDENRED FRANCE SAS"], sirens: ["219200334", "393365135"] };
  it("SIREN de l'entreprise cité dans l'avis : gagné, sûr", () => {
    expect(isWinner(award, { siren: "393 365 135", name: "Autre nom" })).toEqual({ won: true, sure: true });
  });
  it("même nom sans SIREN : gagné, à confirmer", () => {
    expect(isWinner(award, { siren: null, name: "Edenred France" })).toEqual({ won: true, sure: false });
  });
  it("autre entreprise : pas gagné", () => {
    expect(isWinner(award, { siren: "123456789", name: "Nettoyage Martin" })).toEqual({ won: false, sure: false });
  });
  it("nom comparable sans forme juridique ni accents", () => {
    expect(normalizeCompanyName("SAS MC Maintenance Industrielle")).toBe("mc maintenance industrielle");
    expect(normalizeCompanyName("Société Générale d'Entretien")).toBe("generale d entretien");
  });
});

describe("nombre d'offres reçues (avis de résultat)", () => {
  const stat = (code: string, n: number) => ({ "efbc:StatisticsCode": { "@listName": "received-submission-type", "#text": code }, "efbc:StatisticsNumeric": String(n) });
  const notice = (lots: unknown[]) => JSON.stringify({ EFORMS: { ContractAwardNotice: { "efac:NoticeResult": { "efac:LotResult": lots } } } });

  it("lit le total par lot, « tenders » d'abord, sinon les offres déposées en ligne", () => {
    expect(offersReceived(notice([{ "efac:ReceivedSubmissionsStatistics": [stat("tenders", 8), stat("t-esubm", 8)] }]))).toEqual([8]);
    expect(offersReceived(notice([{ "efac:ReceivedSubmissionsStatistics": stat("t-esubm", 6) }, { "efac:ReceivedSubmissionsStatistics": [stat("t-sme", 1), stat("tenders", 3)] }]))).toEqual([6, 3]);
    expect(offersReceived("pas du json")).toEqual([]);
    expect(offersReceived(undefined)).toEqual([]);
  });

  it("phrase lisible : une valeur, un écart entre lots, rien si inconnu", () => {
    expect(offersLabel([8])).toBe("8 offres reçues");
    expect(offersLabel([1])).toBe("1 offre reçue");
    expect(offersLabel([6, 3, 0])).toBe("de 3 à 6 offres reçues selon les lots");
    expect(offersLabel([0])).toBeNull();
    expect(offersLabel(undefined)).toBeNull();
  });
});
