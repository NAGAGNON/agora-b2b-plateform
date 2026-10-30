import { describe, expect, it } from "vitest";
import { enrichCompany, osmSearch, rgeSearch } from "@/lib/outreach/enrich";
import { rgeContact, rgeDomainProfile, rgeProspect } from "@/lib/outreach/rge-import";

const json = (body: unknown, status = 200) => (() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }))) as unknown as typeof fetch;

describe("annuaire RGE (ADEME) : e-mail publié par l'entreprise, recherche par SIREN", () => {
  it("retient l'adresse générique et le site de la bonne entreprise", async () => {
    const fetchImpl = json({ results: [
      { siret: "99999999900011", nom_entreprise: "AUTRE", email: "contact@autre.fr", site_internet: "www.autre.fr" },
      { siret: "81080074800016", nom_entreprise: "FR ELECTRICITE", email: "Contact@fr-electricite.fr", site_internet: "www.fr-electricite.fr" },
    ] });
    const r = await rgeSearch(fetchImpl)({ name: "FR ELECTRICITE", city: "Tours", siren: "810800748" });
    expect(r).toMatchObject({ website: "https://www.fr-electricite.fr", email: "contact@fr-electricite.fr" });
  });

  it("adresse nominative publiée par l'entreprise : retenue ; boîte technique : refusée, site gardé", async () => {
    const named = json({ results: [{ siret: "81080074800016", nom_entreprise: "FR ELECTRICITE", email: "jean.martin@fr-electricite.fr", site_internet: "https://fr-electricite.fr/accueil" }] });
    expect(await rgeSearch(named)({ name: "FR ELECTRICITE", city: "Tours", siren: "810800748" })).toMatchObject({ website: "https://fr-electricite.fr", email: "jean.martin@fr-electricite.fr" });
    const noreply = json({ results: [{ siret: "81080074800016", nom_entreprise: "FR ELECTRICITE", email: "no-reply@fr-electricite.fr", site_internet: "https://fr-electricite.fr/accueil" }] });
    expect(await rgeSearch(noreply)({ name: "FR ELECTRICITE", city: "Tours", siren: "810800748" })).toMatchObject({ website: "https://fr-electricite.fr", email: null });
  });

  it("une adresse trouvée suffit, même sans site", async () => {
    const r = await enrichCompany({ name: "SAUS BTP", city: "Céret", siren: "832628226", website: null }, [async () => ({ website: null, email: "contact@saus-btp.fr", provider: "Annuaire RGE" })]);
    expect(r.status).toBe("FOUND");
    expect(r.email).toBe("contact@saus-btp.fr");
  });

  it("import en masse : ligne exploitable ou ignorée", () => {
    expect(rgeContact({ siret: "81080074800016", nom_entreprise: "FR ELECTRICITE", email: "devis@fr-electricite.fr" })).toEqual({ siren: "810800748", email: "devis@fr-electricite.fr", website: null });
    expect(rgeContact({ siret: "abc", email: "contact@x.fr" })).toBeNull();
    expect(rgeContact({ siret: "81080074800016", nom_entreprise: "FR ELECTRICITE", email: "paul.durand@gmail.com" })?.email).toBe("paul.durand@gmail.com");
    expect(rgeContact({ siret: "81080074800016", nom_entreprise: "FR ELECTRICITE", email: "pas-une-adresse" })).toBeNull();
  });
});

describe("OpenStreetMap : site et adresse publiés sur la fiche de l'entreprise", () => {
  it("retient la fiche au même nom dans la même commune", async () => {
    const fetchImpl = json([
      { name: "Star Déménagement", address: { city: "Lyon" }, extratags: { website: "https://star-lyon.fr" } },
      { name: "Star Déménagement", address: { city: "Chambéry" }, extratags: { website: "https://www.star-demenagement.fr/", email: "contact@star-demenagement.fr" } },
    ]);
    const r = await osmSearch(fetchImpl, { spacingMs: 0 })({ name: "STAR DEMENAGEMENT", city: "CHAMBERY", siren: "811243468" });
    expect(r).toMatchObject({ website: "https://www.star-demenagement.fr", email: "contact@star-demenagement.fr" });
  });

  it("nom différent : rien n'est retenu", async () => {
    const fetchImpl = json([{ name: "Boulangerie du centre", address: { city: "Chambéry" }, extratags: { website: "https://boulangerie.fr" } }]);
    expect(await osmSearch(fetchImpl, { spacingMs: 0 })({ name: "STAR DEMENAGEMENT", city: "CHAMBERY", siren: null })).toBeNull();
  });
});

describe("annuaire RGE : métiers d'études", () => {
  it("bureau d'études avec adresse générique : nouvelle entreprise à prospecter, données de l'annuaire uniquement", () => {
    const p = rgeProspect({ siret: "81080074800016", nom_entreprise: "THERMI ETUDES", email: "contact@thermi-etudes.fr", site_internet: "www.thermi-etudes.fr", code_postal: "29200", commune: "BREST", domaine: "Etude thermique reglementaire" }, () => "Bretagne");
    expect(p).toMatchObject({ name: "THERMI ETUDES", siren: "810800748", siret: "81080074800016", sectors: ["ingenierie-etudes"], department_code: "29", region: "Bretagne", email: "contact@thermi-etudes.fr", website: "https://www.thermi-etudes.fr", activity: "Qualification RGE : Etude thermique reglementaire" });
  });

  it("sans adresse, sans nom ou sans domaine : ignorée (rien n'est inventé)", () => {
    expect(rgeProspect({ siret: "81080074800016", nom_entreprise: "X", domaine: "Architecte" }, () => null)).toBeNull();
    expect(rgeProspect({ siret: "81080074800016", email: "contact@x.fr", domaine: "Architecte" }, () => null)).toBeNull();
    // Corse : département ambigu à partir du seul code postal → non renseigné
    expect(rgeProspect({ siret: "81080074800016", nom_entreprise: "ARCHI", email: "contact@archi.fr", code_postal: "20000", domaine: "Architecte" }, () => "Corse")?.department_code).toBeNull();
    // Qualification inconnue : aucun secteur sûr → ignorée
    expect(rgeProspect({ siret: "81080074800016", nom_entreprise: "X", email: "contact@x.fr", domaine: "Inconnu" }, () => null)).toBeNull();
  });

  it("artisan RGE : toutes ses qualifications donnent ses secteurs et les mots de ses métiers", () => {
    const rows = [
      { siret: "81080074800016", nom_entreprise: "THERMO PLUS", email: "devis@thermoplus.fr", code_postal: "35000", commune: "RENNES", domaine: "Pompe à chaleur : chauffage" },
      { siret: "81080074800016", nom_entreprise: "THERMO PLUS", email: "devis@thermoplus.fr", code_postal: "35000", commune: "RENNES", domaine: "Isolation des combles perdus" },
    ];
    const p = rgeProspect(rows, () => "Bretagne");
    expect(p?.sectors).toEqual(["batiment-technique", "travaux-btp"]);
    expect(p?.keywords).toEqual(expect.arrayContaining(["chauffage", "pompe a chaleur", "isolation"]));
    expect(p?.activity).toBe("Qualification RGE : Pompe à chaleur : chauffage ; Isolation des combles perdus");
    expect(rgeDomainProfile("Panneaux solaires photovoltaïques")?.sector).toBe("energie");
    expect(rgeDomainProfile("Chaudière bois")?.keywords).toContain("bois energie");
    expect(rgeDomainProfile("Fenêtres de toit")?.sector).toBe("travaux-btp");
  });
});

