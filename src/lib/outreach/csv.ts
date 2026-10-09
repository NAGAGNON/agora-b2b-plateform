import { normalizeText } from "@/lib/collect/normalize";
import { normalizeDepartment } from "@/lib/geo";
import { isGenericLocalPart } from "@/lib/outreach/enrich";

/** Analyse CSV (séparateur « ; » ou « , », guillemets, retours à la ligne entre guillemets). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const COLUMNS: Record<string, string[]> = {
  name: ["nom", "entreprise", "raison sociale", "denomination", "societe", "name", "company"],
  email: ["email", "e mail", "mail", "courriel", "adresse email"],
  siren: ["siren"],
  siret: ["siret"],
  naf_code: ["naf", "code naf", "ape", "code ape"],
  activity: ["activite", "description", "metier"],
  services: ["services", "prestations"],
  keywords: ["mots cles", "competences", "keywords"],
  sectors: ["secteur", "secteurs"],
  city: ["ville", "commune", "city"],
  postal_code: ["code postal", "cp"],
  department_code: ["departement", "dept"],
  region: ["region"],
  intervention_zone: ["zone", "zone d intervention"],
  website: ["site", "site web", "site internet", "website"],
  contact_name: ["contact", "nom du contact"],
  email_source: ["source email", "origine email", "source de l email"],
};

export type ImportedProspect = {
  name: string;
  email: string | null;
  siren: string | null;
  siret: string | null;
  naf_code: string | null;
  activity: string | null;
  services: string[];
  keywords: string[];
  sectors: string[];
  city: string | null;
  postal_code: string | null;
  department_code: string | null;
  region: string | null;
  intervention_zone: "LOCAL" | "REGIONAL" | "NATIONAL";
  website: string | null;
  contact_name: string | null;
  email_source: string | null;
};

/** Département déduit du code postal (outre-mer sur 3 chiffres ; Corse ambiguë → null). */
export function departmentFromPostal(cp: string | null): string | null {
  if (!cp || !/^\d{5}$/.test(cp)) return null;
  if (cp.startsWith("97")) return cp.slice(0, 3);
  if (cp.startsWith("20")) return null;
  return cp.slice(0, 2);
}

const list = (v: string) => v.split(/[|,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
const clean = (v: string | undefined) => (v ?? "").trim() || null;

/** Lignes CSV → prospects valides + erreurs ligne par ligne (rien n'est inventé ni complété). */
export function mapProspectRows(rows: string[][], sectorSlugs: string[]): { items: ImportedProspect[]; errors: string[] } {
  const errors: string[] = [];
  if (rows.length < 2) return { items: [], errors: ["Fichier vide ou sans ligne de données."] };
  const header = rows[0].map((h) => normalizeText(h));
  const idx = (key: string) => header.findIndex((h) => COLUMNS[key].includes(h));
  const col: Record<string, number> = Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, idx(k)]));
  if (col.name < 0) return { items: [], errors: ["Colonne « nom » (ou « entreprise ») introuvable."] };
  const items: ImportedProspect[] = [];
  rows.slice(1).forEach((r, i) => {
    const get = (k: string) => (col[k] >= 0 ? r[col[k]] : undefined);
    const line = i + 2;
    const name = clean(get("name"));
    if (!name) return void errors.push(`Ligne ${line} : nom manquant.`);
    const email = clean(get("email"))?.toLowerCase() ?? null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return void errors.push(`Ligne ${line} : e-mail invalide (${email}).`);
    // Adresses génériques uniquement (contact@, info@…) : jamais une adresse nominative
    if (email && !isGenericLocalPart(email.split("@")[0])) return void errors.push(`Ligne ${line} : adresse nominative refusée (${email}) — uniquement des adresses génériques (contact@, info@…).`);
    const siren = clean(get("siren"))?.replace(/\s/g, "") ?? null;
    if (siren && !/^\d{9}$/.test(siren)) return void errors.push(`Ligne ${line} : SIREN invalide.`);
    const siret = clean(get("siret"))?.replace(/\s/g, "") ?? null;
    if (siret && !/^\d{14}$/.test(siret)) return void errors.push(`Ligne ${line} : SIRET invalide.`);
    const naf = clean(get("naf_code"))?.toUpperCase().replace(/^(\d{2})\.?(\d{2})([A-Z])$/, "$1.$2$3") ?? null;
    const zoneRaw = normalizeText(get("intervention_zone") ?? "");
    const zone = /national|france/.test(zoneRaw) ? "NATIONAL" : /local|departement/.test(zoneRaw) ? "LOCAL" : "REGIONAL";
    const sectors = list(get("sectors") ?? "").map((s) => normalizeText(s).replace(/ /g, "-")).filter((s) => sectorSlugs.includes(s));
    items.push({
      name: name.slice(0, 200),
      email,
      siren: siren ?? (siret ? siret.slice(0, 9) : null),
      siret,
      naf_code: naf && /^\d{2}\.\d{2}[A-Z]$/.test(naf) ? naf : null,
      activity: clean(get("activity"))?.slice(0, 2000) ?? null,
      services: list(get("services") ?? ""),
      keywords: list(get("keywords") ?? ""),
      sectors,
      city: clean(get("city")),
      postal_code: clean(get("postal_code")),
      department_code: normalizeDepartment(clean(get("department_code")) ?? departmentFromPostal(clean(get("postal_code")))),
      region: clean(get("region")),
      intervention_zone: zone,
      website: clean(get("website")),
      contact_name: clean(get("contact_name")),
      email_source: clean(get("email_source")),
    });
  });
  return { items, errors };
}
