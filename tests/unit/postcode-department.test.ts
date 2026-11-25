import { describe, expect, it } from "vitest";
import { departmentFromPostcode } from "@/lib/geo";
import { mapTedNotice } from "@/lib/collect/connectors";

describe("département d'après le code postal", () => {
  it("métropole, Corse, outre-mer", () => {
    expect(departmentFromPostcode("08000")).toBe("08");
    expect(departmentFromPostcode("75019")).toBe("75");
    expect(departmentFromPostcode("20090")).toBe("2A");
    expect(departmentFromPostcode("20600")).toBe("2B");
    expect(departmentFromPostcode("97400")).toBe("974");
    expect(departmentFromPostcode("98000")).toBeNull();
    expect(departmentFromPostcode("ABC")).toBeNull();
    expect(departmentFromPostcode(null)).toBeNull();
  });

  it("TED : lieu d'exécution national → département de l'acheteur ; lieu connu → inchangé", () => {
    const base = { "publication-number": "1-2026", "notice-title": { fra: "France – Services – Nettoyage des locaux" }, "buyer-name": { fra: ["Ardenne Métropole"] } };
    const national = mapTedNotice({ ...base, "place-of-performance": ["FRZZZ"], "organisation-post-code-buyer": ["08000"] }, []);
    expect(national.ok && national.item.departmentCode).toBe("08");
    const located = mapTedNotice({ ...base, "place-of-performance": ["FR101"], "organisation-post-code-buyer": ["08000"] }, []);
    expect(located.ok && located.item.departmentCode).toBe("75");
  });
});
