import { describe, expect, it } from "vitest";
import { duplicateKey, primaryByKey, primaryOf } from "@/lib/duplicates";

const o = (id: string, title: string, buyer: string | null, at: string | null) => ({ id, title, external_buyer_name: buyer, published_at: at });

describe("appels d'offres en double", () => {
  it("même intitulé et même acheteur (casse et espaces ignorés) : même groupe", () => {
    expect(duplicateKey(o("a", "Service de  déneigement", "DIR Est", null))).toBe(duplicateKey(o("b", "service de déneigement ", "dir est", null)));
    expect(duplicateKey(o("a", "Service", null, null))).toBeNull();
  });
  it("la page principale est la plus ancienne, puis l'identifiant", () => {
    const rows = [o("b", "Lot 1", "Ville", "2026-11-05"), o("a", "Lot 1", "Ville", "2026-11-03"), o("c", "Lot 1", "Ville", "2026-11-03")];
    expect(primaryByKey(rows).get(duplicateKey(rows[0])!)!.id).toBe("a");
    expect(primaryOf(rows[0], rows.slice(1))).toBe("a");
    expect(primaryOf(o("z", "Autre", "Ville", "2026-11-01"), rows)).toBe("z");
  });
});
