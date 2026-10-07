import { describe, expect, it } from "vitest";
import { analyzeOpportunity, contentFingerprint, groupByProspect, relevanceLabel, scoreMatch, type ProspectInput } from "@/lib/outreach/matching";
import { recipientToken, verifyRecipientToken } from "@/lib/outreach/token";
import { fillTemplate, renderOutreachEmail } from "@/lib/outreach/email";
import { departmentFromPostal, mapProspectRows, parseCsv } from "@/lib/outreach/csv";
import { mapApiCompany } from "@/lib/outreach/discovery";

const opp = (over: Partial<Parameters<typeof analyzeOpportunity>[0]> = {}) => ({
  id: "00000000-0000-4000-8000-000000000001",
  title: "Travaux d'installation électrique — école primaire",
  summary: null,
  description: "Remplacement des tableaux électriques et de l'éclairage de l'école.",
  sector_slug: "electricite-automatisme",
  skills: [],
  keywords: [],
  department_code: "29",
  region: "Bretagne",
  response_deadline: null,
  ...over,
});

const prospect = (over: Partial<ProspectInput> = {}): ProspectInput => ({
  id: "p1",
  naf_code: "43.21A",
  naf_label: "Travaux d'installation électrique",
  sectors: [],
  activity: null,
  services: [],
  keywords: [],
  department_code: "29",
  region: "Bretagne",
  intervention_zone: "REGIONAL",
  contacts_count: 0,
  last_clicked_at: null,
  ...over,
});

describe("outreach — analyse des opportunités", () => {
  it("identifie les métiers concernés à partir du texte réel", () => {
    const a = analyzeOpportunity(opp());
    expect(a.profiles[0]).toMatch(/Électriciens/);
    expect(a.primaryNaf).toContain("43.21A");
    expect(a.sectorNaf).toContain("43.21A");
  });

  it("nettoyage → entreprises de nettoyage ; développement → ESN et agences web", () => {
    const n = analyzeOpportunity(opp({ title: "Nettoyage des locaux administratifs", description: "Entretien des locaux et vitrerie.", sector_slug: "nettoyage-proprete" }));
    expect(n.profiles.join(" ")).toMatch(/nettoyage/i);
    expect(n.primaryNaf).toContain("81.21Z");
    const d = analyzeOpportunity(opp({ title: "Développement d'une application de gestion", description: "Développement logiciel et maintenance applicative.", sector_slug: "informatique" }));
    expect(d.profiles.join(" ")).toMatch(/ESN/);
    expect(d.primaryNaf).toContain("62.01Z");
  });

  it("ne produit aucun métier quand rien ne correspond (pas d'invention)", () => {
    const a = analyzeOpportunity(opp({ title: "Objet sans rapport", description: "Texte neutre sans métier identifiable ici.", sector_slug: null }));
    expect(a.profiles).toEqual([]);
    expect(a.primaryNaf).toEqual([]);
  });
});

describe("outreach — score de pertinence", () => {
  const a = analyzeOpportunity(opp());

  it("activité + même département = pertinent, avec raisons", () => {
    const m = scoreMatch(a, prospect());
    expect(m.score).toBeGreaterThanOrEqual(70);
    expect(m.reasons.join(" ")).toMatch(/NAF 43\.21A/);
    expect(m.reasons.join(" ")).toMatch(/même département/);
  });

  it("sans activité correspondante : score nul, quelle que soit la localisation", () => {
    expect(scoreMatch(a, prospect({ naf_code: "56.10A", naf_label: "Restauration" })).score).toBe(0);
  });

  it("autre région sans intervention nationale : sous le seuil par défaut", () => {
    const m = scoreMatch(a, prospect({ department_code: "13", region: "Provence-Alpes-Côte d'Azur" }));
    expect(m.score).toBeLessThan(70);
  });

  it("sollicitations restées sans réponse : pénalité ; clic passé : bonus", () => {
    const base = scoreMatch(a, prospect()).score;
    expect(scoreMatch(a, prospect({ contacts_count: 3 })).score).toBeLessThan(base);
    expect(scoreMatch(a, prospect({ last_clicked_at: "2026-10-01T00:00:00Z" })).score).toBeGreaterThan(base);
  });

  it("libellés de pertinence", () => {
    expect(relevanceLabel(92)).toBe("Très pertinent");
    expect(relevanceLabel(72)).toBe("Pertinent");
    expect(relevanceLabel(40)).toBe("Peu pertinent");
  });
});

describe("outreach — regroupement", () => {
  it("une entreprise = un seul e-mail regroupant ses opportunités, plafonné et trié", () => {
    const matches = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ prospectId: "A", opportunityId: `o${i}`, score: 70 + i, reasons: [`r${i}`], deadline: null }));
    matches.push({ prospectId: "B", opportunityId: "o1", score: 60, reasons: [], deadline: null });
    matches.push({ prospectId: "A", opportunityId: "o7", score: 77, reasons: [], deadline: null }); // doublon
    const g = groupByProspect(matches, 70, 6);
    expect(g).toHaveLength(1);
    expect(g[0].prospectId).toBe("A");
    expect(g[0].opportunities).toHaveLength(6);
    expect(g[0].opportunities[0].id).toBe("o7");
    expect(g[0].score).toBe(77);
  });

  it("empreinte : détecte une modification du contenu", () => {
    const o = { title: "T", description: "D", response_deadline: null, department_code: "29", sector_slug: "s", status: "PUBLISHED" };
    expect(contentFingerprint(o)).toBe(contentFingerprint({ ...o }));
    expect(contentFingerprint(o)).not.toBe(contentFingerprint({ ...o, response_deadline: "2026-12-01" }));
  });
});

describe("outreach — jetons signés", () => {
  it("aller-retour et rejet des jetons falsifiés", () => {
    const id = "3f2b8c1e-9a4d-4e7f-8b1a-2c3d4e5f6a7b";
    const t = recipientToken(id);
    expect(verifyRecipientToken(t)).toBe(id);
    expect(verifyRecipientToken(t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(verifyRecipientToken(`${recipientToken("11111111-1111-4111-8111-111111111111").split(".")[0]}.${t.split(".")[1]}`)).toBeNull();
    expect(verifyRecipientToken("../../etc")).toBeNull();
    expect(verifyRecipientToken(null)).toBeNull();
  });
});

describe("outreach — e-mail", () => {
  it("modèles : variables et ponctuation", () => {
    expect(fillTemplate("{nombre_opportunites} pour {entreprise}{zone_phrase}.", { nombre_opportunites: "2 opportunités", entreprise: "ACME", zone_phrase: "" })).toBe("2 opportunités pour ACME.");
    expect(fillTemplate("{inconnu}", {})).toBe("{inconnu}");
  });

  it("cartes, CTA, désinscription, expéditeur et échappement", () => {
    const e = renderOutreachEmail({
      companyName: "ACME <script>",
      subject: "2 opportunités",
      intro: "Intro",
      opportunities: [
        { id: "1", title: "Opp & 1", sector: "Énergie", location: "Brest (29)", deadline: "12 nov. 2026", summary: "Résumé", source: "BOAMP", url: "https://x/1" },
        { id: "2", title: "Opp 2", sector: null, location: null, deadline: null, summary: null, source: null, url: "https://x/2" },
      ],
      landingUrl: "https://x/landing",
      signupUrl: "https://x/inscription?ref=o.t",
      unsubscribeUrl: "https://x/desinscription/t",
      siteUrl: "https://x",
      reason: "Raison",
      dataSource: "Source SIRENE.",
      sender: ["LinkProB2B"],
    });
    expect(e.html).toContain("Découvrir les opportunités");
    expect(e.html.match(/Voir l'opportunité/g)).toHaveLength(2);
    expect(e.html).toContain("https://x/desinscription/t");
    expect(e.html).toContain("ACME &lt;script&gt;");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("Opp &amp; 1");
    expect(e.text).toContain("Ne plus recevoir ces sélections : https://x/desinscription/t");
    expect(e.text).toContain("Source SIRENE.");
  });
});

describe("outreach — import CSV", () => {
  it("analyse et valide les lignes sans rien inventer", () => {
    const rows = parseCsv('nom;email;siren;naf;ville;code postal;zone;secteur\n"Élec; Ouest";contact@elec.fr;123456789;4321A;Brest;29200;national;electricite-automatisme\nSans email;;;;Rennes;35000;;\n;x@y.fr;;;;;;\nMauvais;pas-un-email;;;;;;\n');
    const { items, errors } = mapProspectRows(rows, ["electricite-automatisme"]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: "Élec; Ouest", email: "contact@elec.fr", siren: "123456789", naf_code: "43.21A", department_code: "29", intervention_zone: "NATIONAL", sectors: ["electricite-automatisme"] });
    expect(items[1]).toMatchObject({ name: "Sans email", email: null, department_code: "35" });
    expect(errors).toHaveLength(2);
  });

  it("département depuis le code postal", () => {
    expect(departmentFromPostal("97400")).toBe("974");
    expect(departmentFromPostal("20000")).toBeNull();
    expect(departmentFromPostal("75008")).toBe("75");
    expect(departmentFromPostal("abc")).toBeNull();
  });
});

describe("outreach — découverte (registre SIRENE)", () => {
  it("conserve uniquement des informations professionnelles", () => {
    const c = mapApiCompany({
      siren: "123456789",
      nom_complet: "ELEC OUEST",
      nom_raison_sociale: "ELEC OUEST",
      tranche_effectif_salarie: "12",
      nature_juridique: "5710",
      etat_administratif: "A",
      complements: { est_entrepreneur_individuel: false },
      siege: { siret: "12345678900012", code_postal: "29200", libelle_commune: "BREST", departement: "29", activite_principale: "43.21A", etat_administratif: "A" },
      // @ts-expect-error champ ignoré volontairement (données personnelles)
      dirigeants: [{ nom: "Dupont", prenoms: "Jean" }],
    });
    expect(c).toMatchObject({ name: "ELEC OUEST", siren: "123456789", naf_code: "43.21A", department_code: "29", size_range: "20 à 49 salariés", is_individual_entrepreneur: false });
    expect(JSON.stringify(c)).not.toContain("Dupont");
  });

  it("écarte les entreprises fermées et signale les entrepreneurs individuels", () => {
    expect(mapApiCompany({ siren: "123456789", nom_complet: "X", etat_administratif: "C" })).toBeNull();
    expect(mapApiCompany({ siren: "12", nom_complet: "X" })).toBeNull();
    expect(mapApiCompany({ siren: "123456789", nom_complet: "JEAN DUPONT", nature_juridique: "1000" })?.is_individual_entrepreneur).toBe(true);
  });
});
