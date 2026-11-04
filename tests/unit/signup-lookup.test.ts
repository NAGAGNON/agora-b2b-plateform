import { describe, expect, it } from "vitest";
import { professionalDomain, signupLookupLinks } from "@/lib/signup-lookup";

describe("liens de recherche d'un inscrit", () => {
  it("ignore les messageries grand public", () => {
    expect(professionalDomain("jean@gmail.com")).toBeNull();
    expect(professionalDomain("jean@orange.fr")).toBeNull();
    expect(professionalDomain("jean@dupont-plomberie.fr")).toBe("dupont-plomberie.fr");
  });

  it("propose LinkedIn (personne et entreprise), l'annuaire et le site, sans rien deviner", () => {
    const links = signupLookupLinks({ name: "Jean Dupont", email: "jean@dupont-plomberie.fr" });
    expect(links.map((l) => l.label)).toEqual(["LinkedIn : chercher la personne", "LinkedIn : chercher l'entreprise", "Annuaire des entreprises (État)", "Site internet (dupont-plomberie.fr)"]);
    expect(links[0].url).toBe("https://www.linkedin.com/search/results/people/?keywords=Jean%20Dupont%20dupont-plomberie");
  });

  it("messagerie personnelle sans entreprise : seulement la recherche de la personne", () => {
    expect(signupLookupLinks({ name: "Jean Dupont", email: "jean@gmail.com" }).map((l) => l.label)).toEqual(["LinkedIn : chercher la personne"]);
    expect(signupLookupLinks({ name: "Jean Dupont", email: "jean@gmail.com", company: "Dupont SARL" })).toHaveLength(3);
  });
});
