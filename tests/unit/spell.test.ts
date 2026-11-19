import { describe, expect, it } from "vitest";
import { correctTypos } from "@/lib/spell";
import { companySchema } from "@/lib/validation";

describe("correction des fautes de frappe saisies par les membres", () => {
  it("corrige les mots du métier mal écrits", () => {
    expect(correctTypos("Eau potalbe")).toBe("Eau potable");
    expect(correctTypos("nétoyage de locaux")).toBe("nettoyage de locaux");
    expect(correctTypos("Maçonerie")).toBe("Maçonnerie");
  });
  it("laisse intacts les mots justes, courts ou inconnus (noms propres)", () => {
    expect(correctTypos("Maîtrise d'œuvre")).toBe("Maîtrise d'œuvre");
    expect(correctTypos("VRD, AMO")).toBe("VRD, AMO");
    expect(correctTypos("Verdi Kubernetes")).toBe("Verdi Kubernetes");
    expect(correctTypos("plomberie et chauffage")).toBe("plomberie et chauffage");
  });
  it("s'applique aux compétences de la fiche entreprise", () => {
    const r = companySchema.safeParse({ name: "Test", kind: "BOTH", sectors: ["ingenierie-etudes"], skills: "Maîtrise d'œuvre, Eau potalbe" });
    expect(r.success && r.data.skills).toEqual(["Maîtrise d'œuvre", "Eau potable"]);
  });
});
