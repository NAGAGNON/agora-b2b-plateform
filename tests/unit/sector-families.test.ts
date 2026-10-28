import { describe, expect, it } from "vitest";
import { groupSectors, SECTOR_FAMILIES } from "@/lib/sector-families";

describe("familles de secteurs", () => {
  it("range chaque secteur une seule fois, les secteurs inconnus dans « Autres secteurs »", () => {
    const sectors = [{ slug: "travaux-btp" }, { slug: "informatique" }, { slug: "nouveau-secteur" }, { slug: "energie" }];
    const groups = groupSectors(sectors);
    expect(groups.map((g) => g.family.label)).toEqual(["BTP et ingénierie", "Énergie et environnement", "Numérique et télécoms", "Autres secteurs"]);
    expect(groups.flatMap((g) => g.sectors).map((s) => s.slug).sort()).toEqual(sectors.map((s) => s.slug).sort());
  });
  it("aucun secteur n'appartient à deux familles", () => {
    const all = SECTOR_FAMILIES.flatMap((f) => f.sectors);
    expect(new Set(all).size).toBe(all.length);
  });
});
