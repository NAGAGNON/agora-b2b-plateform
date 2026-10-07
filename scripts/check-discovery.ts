/**
 * Test de contrat de l'API publique « Recherche d'entreprises » (SIRENE) utilisée
 * par LinkProB2B Outreach : la réponse réelle est-elle toujours lisible ?
 * Lecture seule, aucune écriture en base.  npx tsx scripts/check-discovery.ts
 */
import { discoverCompanies } from "../src/lib/outreach/discovery";

const cases: [string, string][] = [
  ["43.21A", "29"],
  ["81.21Z", "35"],
  ["62.01Z", "69"],
];
let failed = 0;
for (const [naf, dept] of cases) {
  try {
    const { companies, totalPages } = await discoverCompanies(naf, dept, { perPage: 10 });
    const bad = companies.filter((c) => !/^\d{9}$/.test(c.siren) || !c.name || c.department_code !== dept);
    console.log(`NAF ${naf} · ${dept} : ${companies.length} entreprise(s), ${totalPages} page(s)${bad.length ? `, ${bad.length} incohérente(s)` : ""}`);
    if (companies[0]) console.log(`  ex. ${companies[0].name} — ${companies[0].naf_code} — ${companies[0].city} — ${companies[0].size_range ?? "effectif inconnu"}`);
    if (companies.length === 0 || bad.length) failed++;
  } catch (e) {
    console.error(`NAF ${naf} · ${dept} : ERREUR ${e instanceof Error ? e.message : e}`);
    failed++;
  }
  await new Promise((r) => setTimeout(r, 300));
}
process.exit(failed ? 1 : 0);
