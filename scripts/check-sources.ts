/**
 * Test de contrat contre les API RÉELLES des sources (BOAMP, TED).
 * Aucune écriture en base : collecte, normalisation et rapport.
 *
 *   npm run sources:check
 *
 * Exécuté chaque jour par GitHub Actions (.github/workflows/sources.yml) pour
 * détecter au plus tôt un changement de format ou d'accès d'une source.
 * Code de sortie 1 si une source ne répond pas ou si aucune annonce n'est exploitable.
 */
import { collectBoamp, collectTed, type SourceConfig } from "../src/lib/collect/connectors";

const SOURCES: { name: string; run: typeof collectBoamp; config: SourceConfig }[] = [
  { name: "BOAMP", run: collectBoamp, config: { departments: ["22", "29", "35", "56"], lookbackDays: 21, maxRecords: 200 } },
  {
    name: "TED",
    run: collectTed,
    config: {
      country: "FRA",
      nuts: ["FRH01", "FRH02", "FRH03", "FRH04"],
      lookbackDays: 21,
      maxRecords: 200,
      fields: ["publication-number", "notice-title", "buyer-name", "publication-date", "deadline-receipt-tender-date-lot", "deadline-receipt-request-date-lot", "place-of-performance", "classification-cpv", "contract-nature"],
    },
  },
];

/** Diagnostic TED : format brut des champs et filtrage géographique côté serveur. */
async function exploreTed(since: string) {
  const fields = ["publication-number", "notice-title", "buyer-name", "publication-date", "deadline-receipt-tender-date-lot", "deadline-receipt-request-date-lot", "deadline", "place-of-performance", "classification-cpv", "contract-nature", "buyer-city", "notice-type"];
  const queries = [
    `buyer-country=FRA AND PD>=${since}`,
    `place-of-performance IN (FRH01 FRH02 FRH03 FRH04) AND PD>=${since}`,
    `place-of-performance=FRH0* AND PD>=${since}`,
    `buyer-country=FRA AND place-of-performance IN (FRH01 FRH02 FRH03 FRH04) AND PD>=${since}`,
  ];
  for (const query of queries) {
    const res = await fetch("https://api.ted.europa.eu/v3/notices/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, fields, limit: 3, page: 1, scope: "ACTIVE", paginationMode: "PAGE_NUMBER" }),
    });
    const body = (await res.json().catch(() => ({}))) as { totalNoticeCount?: number; notices?: unknown[]; message?: string };
    console.log(`\n[TED diagnostic] HTTP ${res.status} total=${body.totalNoticeCount ?? "?"} — ${query}${body.message ? ` — ${body.message}` : ""}`);
    if (query === queries[1] || query === queries[3]) console.log(JSON.stringify(body.notices?.slice(0, 2), null, 1)?.slice(0, 4000));
  }
}

/** Diagnostic : sources candidates (licence, champs, échantillon), sans écriture. */
async function exploreCandidates() {
  const get = async (url: string) => {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    return { status: r.status, body: (await r.json().catch(() => null)) as Record<string, unknown> | null };
  };
  const ods = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets";
  for (const q of ["approch", "projets d'achats", "decp", "donnees essentielles"]) {
    const { status, body } = await get(`${ods}?where=${encodeURIComponent(`search("${q}")`)}&limit=6&select=dataset_id,metas`);
    const rows = ((body?.results as Record<string, unknown>[]) ?? []).map((d) => {
      const m = ((d.metas as Record<string, Record<string, unknown>>)?.default ?? {}) as Record<string, unknown>;
      return `${d.dataset_id} | ${m.title} | licence: ${m.license} | maj: ${m.modified} | lignes: ${m.records_count}`;
    });
    console.log(`\n[candidat data.economie.gouv.fr] « ${q} » HTTP ${status}\n  ${rows.join("\n  ")}`);
  }
  for (const id of ["projets-dachats-publics"]) {
    const { status, body } = await get(`${ods}/${id}/records?limit=2&order_by=${encodeURIComponent("date_de_publication desc")}`);
    console.log(`\n[échantillon ${id}] HTTP ${status}`);
    console.log(JSON.stringify(body?.results ?? body, null, 1)?.slice(0, 3000));
    const any = await get(`${ods}/${id}/records?limit=2`);
    if (status !== 200) console.log(JSON.stringify(any.body?.results ?? any.body, null, 1)?.slice(0, 3000));
  }
  const dg = await get("https://www.data.gouv.fr/api/1/datasets/?q=avis%20de%20march%C3%A9s%20publics&page_size=8");
  const items = ((dg.body?.data as Record<string, unknown>[]) ?? []).map((d) => `${d.slug} | ${d.title} | licence: ${d.license} | org: ${(d.organization as Record<string, unknown> | null)?.name ?? "-"}`);
  console.log(`\n[candidat data.gouv.fr] HTTP ${dg.status}\n  ${items.join("\n  ")}`);
}

async function main() {
  const now = new Date();
  if (process.argv.includes("--candidates")) await exploreCandidates().catch((e) => console.error("candidats", e));
  if (process.argv.includes("--explore")) await exploreTed(new Date(now.getTime() - 21 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, "")).catch((e) => console.error("diagnostic", e));
  let failures = 0;
  for (const s of SOURCES) {
    const started = Date.now();
    try {
      const batch = await s.run({ config: s.config, since: new Date(now.getTime() - 21 * 86_400_000), fetchImpl: fetch, now });
      const ok = batch.mapped.filter((m) => m.ok);
      const reasons = new Map<string, number>();
      for (const m of batch.mapped) if (!m.ok) {
        const key = m.reason.replace(/\s*\(.*\)\s*$/, "").split(" :")[0];
        reasons.set(key, (reasons.get(key) ?? 0) + 1);
      }
      const sectors = new Map<string, number>();
      for (const m of ok) if (m.ok) sectors.set(m.item.sectorSlug ?? "(non classé)", (sectors.get(m.item.sectorSlug ?? "(non classé)") ?? 0) + 1);
      const withDeadline = ok.filter((m) => m.ok && m.item.deadline).length;
      console.log(`\n## ${s.name} — ${batch.records.length} enregistrement(s) lus, ${ok.length} exploitable(s) (${withDeadline} avec date limite) en ${Date.now() - started} ms`);
      if (reasons.size) console.log("Écartés :", Object.fromEntries(reasons));
      console.log("Secteurs :", Object.fromEntries(sectors));
      if (process.argv.includes("--explore")) {
        const unclassified = ok.filter((m) => m.ok && !m.item.sectorSlug).slice(0, 25);
        if (unclassified.length) console.log("Exemples non classés :\n" + unclassified.map((m) => (m.ok ? `  - ${m.item.title.slice(0, 110)} [cpv: ${m.item.cpv.join(",") || "—"}] [mots-clés: ${m.item.keywords.join(", ").slice(0, 80)}]` : "")).join("\n"));
      }
      for (const m of ok.slice(0, 3)) if (m.ok) console.log(`  • [${m.item.externalId}] ${m.item.title.slice(0, 90)} — ${m.item.buyer ?? "?"} — limite ${m.item.deadline ?? "?"} — ${m.item.originalUrl}`);
      if (process.argv.includes("--dump")) {
        // Échantillon brut (champs utiles uniquement), rejouable localement à travers le pipeline complet.
        const keep = s.name === "BOAMP"
          ? ["idweb", "objet", "nomacheteur", "code_departement", "descripteur_libelle", "type_marche", "nature_libelle", "datelimitereponse", "dateparution"]
          : ["publication-number", "notice-title", "buyer-name", "publication-date", "deadline-receipt-tender-date-lot", "deadline-receipt-request-date-lot", "place-of-performance", "classification-cpv", "contract-nature"];
        const fr = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? { fra: (v as Record<string, unknown>).fra ?? Object.values(v as object)[0] } : v);
        const uniq = (v: unknown) => (Array.isArray(v) ? [...new Set(v)] : v);
        for (const r of batch.records.slice(0, s.name === "BOAMP" ? 40 : 30)) {
          const o = r as Record<string, unknown>;
          const out = Object.fromEntries(keep.filter((k) => o[k] !== undefined && o[k] !== null).map((k) => [k, uniq(fr(o[k]))]));
          console.log(`DUMP:${s.name}:${JSON.stringify(out)}`);
        }
      }
      if (batch.records.length > 0 && ok.length === 0) {
        console.error(`✗ ${s.name} : aucune annonce exploitable — format modifié ?`);
        failures++;
      }
    } catch (e) {
      console.error(`✗ ${s.name} : ${e instanceof Error ? e.message : e}`);
      failures++;
    }
  }
  process.exit(failures ? 1 : 0);
}

void main();
