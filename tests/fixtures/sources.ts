/**
 * Réponses d'API simulées, au format documenté des sources officielles
 * (champs BOAMP Opendatasoft et TED v3). Contenu FICTIF utilisé uniquement en test.
 */
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function boampRecords(run: string) {
  return [
    {
      idweb: `TEST-${run}-001`,
      objet: `Maintenance préventive des pompes de relevage ${run}`,
      nomacheteur: `Commune de Test ${run}`,
      dateparution: inDays(-2),
      datelimitereponse: inDays(20),
      code_departement: ["29"],
      type_marche: ["SERVICES"],
      descripteur_libelle: ["Maintenance", "Pompes"],
      nature_libelle: "Avis de marché",
      procedure_libelle: "Procédure adaptée",
      url_avis: `https://www.boamp.fr/pages/avis/?q=idweb:TEST-${run}-001`,
    },
    {
      idweb: `TEST-${run}-002`,
      objet: `Infogérance du système d'information ${run}`,
      nomacheteur: `Syndicat Mixte Test ${run}`,
      dateparution: inDays(-1),
      datelimitereponse: inDays(30),
      code_departement: "56",
      type_marche: ["SERVICES"],
      descripteur_libelle: ["Informatique"],
      nature_libelle: "Avis de marché",
    },
    { idweb: `TEST-${run}-003`, objet: "", nomacheteur: "Sans objet", dateparution: inDays(-1), datelimitereponse: inDays(10), code_departement: ["22"] },
  ];
}

export function tedNotices(run: string) {
  return [
    {
      // Même consultation que TEST-001 publiée aussi au JOUE → doublon
      "publication-number": `${run}-2026`,
      "notice-title": { fra: `France – Services de réparation et d'entretien de pompes – Maintenance préventive des pompes de relevage ${run}` },
      "buyer-name": { fra: [`Commune de Test ${run}`] },
      "publication-date": `${inDays(-1)}+01:00`,
      "deadline-receipt-tender-date-lot": [`${inDays(20)}T12:00:00+01:00`],
      "place-of-performance": ["FRH02"],
      "classification-cpv": ["50511000"],
      "contract-nature": "services",
    },
    {
      "publication-number": `${run}-2027`,
      "notice-title": { eng: `France – Software package – Fourniture de licences logicielles ${run}` },
      "buyer-name": { fra: [`Région Test ${run}`] },
      "publication-date": `${inDays(-1)}+01:00`,
      "deadline-receipt-tender-date-lot": [`${inDays(40)}T12:00:00+01:00`],
      "place-of-performance": ["FRH04"],
      "classification-cpv": ["48000000"],
    },
    {
      "publication-number": `${run}-2028`,
      "notice-title": { fra: `France – Travaux – Hors Bretagne ${run}` },
      "buyer-name": { fra: ["Ville hors zone"] },
      "place-of-performance": ["FR101"],
      "classification-cpv": ["45000000"],
    },
  ];
}

export function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return async (url: string, init?: RequestInit) => new Response(JSON.stringify(handler(url, init)), { status: 200, headers: { "Content-Type": "application/json" } });
}
