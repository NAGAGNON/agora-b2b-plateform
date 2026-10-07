/**
 * Référentiel géographique national (France métropolitaine et outre-mer).
 * Les noms de régions sont identiques à ceux de la table `departments.region`.
 * Codes NUTS 2021 (Eurostat) : utilisés par TED pour le lieu d'exécution.
 */

export type Region = { name: string; slug: string; nuts: string[] };

export const REGIONS: Region[] = [
  { name: "Auvergne-Rhône-Alpes", slug: "auvergne-rhone-alpes", nuts: ["FRK"] },
  { name: "Bourgogne-Franche-Comté", slug: "bourgogne-franche-comte", nuts: ["FRC"] },
  { name: "Bretagne", slug: "bretagne", nuts: ["FRH"] },
  { name: "Centre-Val de Loire", slug: "centre-val-de-loire", nuts: ["FRB"] },
  { name: "Corse", slug: "corse", nuts: ["FRM"] },
  { name: "Grand Est", slug: "grand-est", nuts: ["FRF"] },
  { name: "Hauts-de-France", slug: "hauts-de-france", nuts: ["FRE"] },
  { name: "Île-de-France", slug: "ile-de-france", nuts: ["FR1"] },
  { name: "Normandie", slug: "normandie", nuts: ["FRD"] },
  { name: "Nouvelle-Aquitaine", slug: "nouvelle-aquitaine", nuts: ["FRI"] },
  { name: "Occitanie", slug: "occitanie", nuts: ["FRJ"] },
  { name: "Pays de la Loire", slug: "pays-de-la-loire", nuts: ["FRG"] },
  { name: "Provence-Alpes-Côte d'Azur", slug: "provence-alpes-cote-d-azur", nuts: ["FRL"] },
  { name: "Guadeloupe", slug: "guadeloupe", nuts: ["FRY1"] },
  { name: "Martinique", slug: "martinique", nuts: ["FRY2"] },
  { name: "Guyane", slug: "guyane", nuts: ["FRY3"] },
  { name: "La Réunion", slug: "la-reunion", nuts: ["FRY4"] },
  { name: "Mayotte", slug: "mayotte", nuts: ["FRY5"] },
];

export const regionBySlug = (slug: string) => REGIONS.find((r) => r.slug === slug) ?? null;
export const regionByName = (name: string | null | undefined) => REGIONS.find((r) => r.name === name) ?? null;

/** NUTS 3 (2021) → code département INSEE. */
export const NUTS_TO_DEPARTMENT: Record<string, string> = {
  FR101: "75", FR102: "77", FR103: "78", FR104: "91", FR105: "92", FR106: "93", FR107: "94", FR108: "95",
  FRB01: "18", FRB02: "28", FRB03: "36", FRB04: "37", FRB05: "41", FRB06: "45",
  FRC11: "21", FRC12: "58", FRC13: "71", FRC14: "89", FRC21: "25", FRC22: "39", FRC23: "70", FRC24: "90",
  FRD11: "14", FRD12: "50", FRD13: "61", FRD21: "27", FRD22: "76",
  FRE11: "59", FRE12: "62", FRE21: "02", FRE22: "60", FRE23: "80",
  FRF11: "67", FRF12: "68", FRF21: "08", FRF22: "10", FRF23: "51", FRF24: "52", FRF31: "54", FRF32: "55", FRF33: "57", FRF34: "88",
  FRG01: "44", FRG02: "49", FRG03: "53", FRG04: "72", FRG05: "85",
  FRH01: "22", FRH02: "29", FRH03: "35", FRH04: "56",
  FRI11: "24", FRI12: "33", FRI13: "40", FRI14: "47", FRI15: "64", FRI21: "19", FRI22: "23", FRI23: "87", FRI31: "16", FRI32: "17", FRI33: "79", FRI34: "86",
  FRJ11: "11", FRJ12: "30", FRJ13: "34", FRJ14: "48", FRJ15: "66", FRJ21: "09", FRJ22: "12", FRJ23: "31", FRJ24: "32", FRJ25: "46", FRJ26: "65", FRJ27: "81", FRJ28: "82",
  FRK11: "03", FRK12: "15", FRK13: "43", FRK14: "63", FRK21: "01", FRK22: "07", FRK23: "26", FRK24: "38", FRK25: "42", FRK26: "69", FRK27: "73", FRK28: "74",
  FRL01: "04", FRL02: "05", FRL03: "06", FRL04: "13", FRL05: "83", FRL06: "84",
  FRM01: "2A", FRM02: "2B",
  FRY10: "971", FRY20: "972", FRY30: "973", FRY40: "974", FRY50: "976",
};

/** Région correspondant à un code NUTS (niveau 1, 2 ou 3), sinon null. */
export function regionForNuts(code: string): string | null {
  const c = code.toUpperCase();
  if (!c.startsWith("FR") || c.length < 3) return null;
  const match = REGIONS.filter((r) => r.nuts.some((n) => c.startsWith(n))).sort((a, b) => b.nuts[0].length - a.nuts[0].length)[0];
  return match?.name ?? null;
}

/** Localisation (département, région) à partir des codes NUTS d'une annonce TED. */
export function locateNuts(codes: string[]): { departmentCode: string | null; region: string | null } {
  const up = codes.map((c) => c.toUpperCase());
  const departmentCode = up.map((c) => NUTS_TO_DEPARTMENT[c]).find(Boolean) ?? null;
  const regions = [...new Set(up.map(regionForNuts).filter((r): r is string => Boolean(r)))];
  // Plusieurs régions (marché national) : pas de région unique
  return { departmentCode, region: regions.length === 1 ? regions[0] : null };
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Code département normalisé (« 6 » → « 06 », « 20B » → « 2B », « 971 » inchangé), sinon null. */
export function normalizeDepartment(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toUpperCase();
  if (/^\d$/.test(s)) return `0${s}`;
  if (/^\d{2,3}$/.test(s)) return s;
  const corse = s.match(/^20?([AB])$/);
  return corse ? `2${corse[1]}` : null;
}
