/**
 * Couverture nationale : import par lots (nouvelle, existante, mise à jour, expirée),
 * idempotence, déduplication, sources indisponibles et isolées, recherche France /
 * région / département / ville / code postal / secteur / mots-clés / source, volume
 * (plusieurs milliers d'opportunités) et référentiel des villes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, RUN } from "./helpers";
import { runDueSources, runSource } from "@/lib/collect/run";
import { importPlaces } from "@/lib/collect/places";
import { mockFetch } from "../fixtures/sources";

const T = `N${RUN}`;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
type Source = NonNullable<Awaited<ReturnType<typeof load>>>;
const load = async (code: string) => (await admin.from("external_sources").select("*").eq("code", code).single()).data;

function boamp(i: number, over: Record<string, unknown> = {}) {
  return {
    idweb: `${T}-${i}`,
    objet: `Prestation numéro ${i} ${T} développement logiciel`,
    nomacheteur: `Acheteur ${T} ${i % 7}`,
    dateparution: inDays(-1),
    datelimitereponse: inDays(15 + (i % 30)),
    code_departement: [["69", "31", "75", "13", "59", "29", "974"][i % 7]],
    type_marche: ["SERVICES"],
    descripteur_libelle: ["Informatique"],
    nature_libelle: "Avis de marché",
    ...over,
  };
}

let bo: Source, ted: Source;
beforeAll(async () => {
  bo = (await load("boamp"))!;
  ted = (await load("ted"))!;
});
afterAll(async () => {
  await admin.from("opportunities").delete().like("title", `%${T}%`);
  await admin.from("opportunities").delete().like("title", `Volume ${T}%`);
  await admin.from("places").delete().like("insee_code", "99%");
});

describe("synchronisation nationale", () => {
  it("importe une nouvelle opportunité, ignore les annonces expirées et localise toute la France", async () => {
    const records = [boamp(1), boamp(2), boamp(3, { datelimitereponse: inDays(-3) })];
    const r = await runSource(bo, { trigger: "manual", fetchImpl: mockFetch(() => ({ total_count: 3, results: records })) });
    expect(r).toMatchObject({ created: 2, expired: 1, status: "SUCCESS" });
    const { data } = await admin.from("opportunities").select("department_code, region").eq("external_reference", `${T}-1`).single();
    expect(data).toEqual({ department_code: "31", region: "Occitanie" });
  });

  it("une même opportunité récupérée deux fois n'est pas dupliquée (relance idempotente)", async () => {
    const records = [boamp(1), boamp(2)];
    const r = await runSource(bo, { trigger: "manual", fetchImpl: mockFetch(() => ({ total_count: 2, results: records })) });
    expect(r).toMatchObject({ created: 0, unchanged: 2 });
    const { count } = await admin.from("opportunities").select("id", { count: "exact", head: true }).like("title", `%${T}%`);
    expect(count).toBe(2);
  });

  it("met à jour le même enregistrement quand l'annonce change à la source", async () => {
    const { data: before } = await admin.from("opportunities").select("id").eq("external_reference", `${T}-2`).single();
    const r = await runSource(bo, { trigger: "manual", fetchImpl: mockFetch(() => ({ total_count: 1, results: [boamp(2, { objet: `Prestation numéro 2 ${T} modifiée` })] })) });
    expect(r).toMatchObject({ updated: 1, created: 0 });
    const { data: after } = await admin.from("opportunities").select("id, title").eq("external_reference", `${T}-2`).single();
    expect(after?.id).toBe(before?.id);
    expect(after?.title).toContain("modifiée");
  });

  it("la même opportunité publiée par deux sources reste une seule annonce, avec deux sources", async () => {
    const notice = {
      "publication-number": `${T}-77`,
      "notice-title": { fra: `France – Services informatiques – Prestation numéro 1 ${T} développement logiciel` },
      "buyer-name": { fra: [`Acheteur ${T} 1`] },
      "publication-date": `${inDays(-1)}+01:00`,
      "deadline-receipt-tender-date-lot": [`${inDays(16)}T12:00:00+01:00`],
      "place-of-performance": ["FRJ23"],
      "classification-cpv": ["72000000"],
    };
    const r = await runSource(ted, { trigger: "manual", fetchImpl: mockFetch(() => ({ totalNoticeCount: 1, notices: [notice] })) });
    expect(r).toMatchObject({ created: 0, duplicates: 1 });
    const { data } = await admin.from("opportunities").select("opportunity_sources(source_id)").eq("external_reference", `${T}-1`).single();
    expect((data?.opportunity_sources as unknown[]).length).toBe(2);
  });

  it("réessaie automatiquement une source momentanément indisponible", async () => {
    let calls = 0;
    const flaky = async (url: string, init?: RequestInit) => {
      calls++;
      if (calls < 3) return new Response("indisponible", { status: 503 });
      return mockFetch(() => ({ total_count: 1, results: [boamp(1)] }))(url, init);
    };
    const r = await runSource(bo, { trigger: "manual", fetchImpl: flaky, retryDelays: [0, 0] });
    expect(calls).toBe(3);
    expect(r.status).toBe("SUCCESS");
  });

  it("une source en erreur n'empêche pas les autres et ne supprime aucune donnée", async () => {
    const { count: before } = await admin.from("opportunities").select("id", { count: "exact", head: true }).like("title", `%${T}%`);
    const fetchImpl = async (url: string, init?: RequestInit) =>
      url.includes("boamp") ? new Response("panne", { status: 500 }) : mockFetch(() => ({ totalNoticeCount: 0, notices: [] }))(url, init);
    const results = await runDueSources({ force: true, codes: ["boamp", "ted"], fetchImpl, retryDelays: [0, 0] });
    expect(results.find((x) => x.source === "boamp")?.status).toBe("FAILED");
    expect(results.find((x) => x.source === "ted")?.status).toBe("SUCCESS");
    const { count: after } = await admin.from("opportunities").select("id", { count: "exact", head: true }).like("title", `%${T}%`);
    expect(after).toBe(before);
    const { data } = await admin.from("external_sources").select("last_error").eq("code", "boamp").single();
    expect(data?.last_error).toMatch(/HTTP 500/);
  });

  it("une synchronisation interrompue ne reste pas « En cours »", async () => {
    const { data: run } = await admin.from("source_sync_runs").insert({ source_id: bo.id, trigger: "cron", started_at: new Date(Date.now() - 2 * 3600_000).toISOString() }).select("id").single();
    await runDueSources({ codes: [] });
    const { data } = await admin.from("source_sync_runs").select("status, errors").eq("id", run!.id).single();
    expect(data?.status).toBe("FAILED");
    expect(JSON.stringify(data?.errors)).toMatch(/interrompue/);
  });

  it("une opportunité dont la date limite est dépassée passe en « Expirée » et sort des résultats actifs", async () => {
    const { data: o } = await admin.from("opportunities").select("id").eq("external_reference", `${T}-1`).single();
    await admin.from("opportunities").update({ response_deadline: new Date(Date.now() - 3600_000).toISOString() }).eq("id", o!.id);
    await admin.rpc("expire_opportunities");
    const { data: row } = await admin.from("opportunities").select("status").eq("id", o!.id).single();
    expect(row?.status).toBe("EXPIRED");
    const { data: open } = await anon().rpc("search_opportunities", { p_q: T, p_limit: 50 });
    expect(open?.map((x) => x.id)).not.toContain(o!.id);
    const { data: closed } = await anon().rpc("search_opportunities", { p_q: T, p_status: "CLOSED", p_limit: 50 });
    expect(closed?.map((x) => x.id)).toContain(o!.id);
  });
});

describe("recherche nationale", () => {
  const ids: string[] = [];
  beforeAll(async () => {
    const rows = [
      { title: `Construction d'un gymnase ${T}`, city: "Lyon", postal_code: "69003", department_code: "69", sector_slug: "travaux-btp" },
      { title: `Maintenance informatique ${T}`, city: "Paris", postal_code: "75011", department_code: "75", sector_slug: "informatique" },
      { title: `Transport de marchandises ${T}`, city: "Brest", postal_code: "29200", department_code: "29", sector_slug: "transport-logistique" },
      { title: `Industrie mécanique ${T}`, city: "Toulouse", postal_code: "31000", department_code: "31", sector_slug: "sous-traitance-industrielle" },
    ].map((r) => ({
      ...r, type: "PUBLIC_TENDER" as const, origin: "EXTERNAL" as const, status: "PUBLISHED" as const,
      description: "Avis de marché de test suffisamment long.", response_deadline: new Date(Date.now() + 20 * 86_400_000).toISOString(), published_at: new Date().toISOString(),
    }));
    const { data, error } = await admin.from("opportunities").insert(rows).select("id, title");
    if (error) throw error;
    ids.push(...data.map((d) => d.id));
  });
  // Les annonces importées plus haut (« Prestation … ») sont exclues des comparaisons
  const titles = async (args: Record<string, unknown>, all = false) =>
    ((await anon().rpc("search_opportunities", { p_limit: 50, ...args })).data ?? [])
      .filter((r) => r.title.includes(T) && (all || !r.title.startsWith("Prestation")))
      .map((r) => r.title);

  it("France entière par défaut", async () => {
    expect((await titles({ p_q: T })).length).toBeGreaterThanOrEqual(4);
  });
  it("par région, département, ville et code postal", async () => {
    expect(await titles({ p_q: T, p_region: "Auvergne-Rhône-Alpes" })).toEqual([`Construction d'un gymnase ${T}`]);
    expect(await titles({ p_q: T, p_department: "75" })).toEqual([`Maintenance informatique ${T}`]);
    expect(await titles({ p_q: T, p_city: "brest" })).toEqual([`Transport de marchandises ${T}`]);
    expect(await titles({ p_q: T, p_city: "310" })).toEqual([`Industrie mécanique ${T}`]);
  });
  it("par secteur, mots-clés et source", async () => {
    expect(await titles({ p_q: T, p_sector: "informatique" })).toContain(`Maintenance informatique ${T}`);
    expect(await titles({ p_q: `transport ${T}` })).toEqual([`Transport de marchandises ${T}`]);
    const boampOnly = await titles({ p_q: T, p_source: "boamp", p_status: "ALL" }, true);
    expect(boampOnly.every((t) => t.startsWith("Prestation"))).toBe(true);
    expect(boampOnly.length).toBeGreaterThan(0);
  });
  it("les alertes par région ne retiennent que la région choisie", async () => {
    const { data: u } = await admin.auth.admin.createUser({ email: `nat-${RUN}@test.linkprob2b.test`, password: `Pw-${RUN}-Aa1`, email_confirm: true });
    const { data: alert } = await admin.from("alerts").insert({ user_id: u.user!.id, name: `Alerte ${T}`, frequency: "DAILY", region: "Île-de-France" }).select("id").single();
    const match = async (id: string) => (await admin.rpc("opportunity_matches_alert", { p_opportunity_id: id, p_alert_id: alert!.id })).data;
    expect(await match(ids[1])).toBe(true);
    expect(await match(ids[0])).toBe(false);
    await admin.auth.admin.deleteUser(u.user!.id);
  });
  it("compte les opportunités ouvertes par région pour les pages SEO", async () => {
    const { data } = await anon().rpc("open_opportunity_counts");
    expect(data?.find((c) => c.dimension === "region" && c.key === "Auvergne-Rhône-Alpes")?.n).toBeGreaterThanOrEqual(1);
  });
});

describe("volume : plusieurs milliers d'opportunités", () => {
  it("importe 3 000 annonces par lots et reste rapide en recherche", async () => {
    const records = Array.from({ length: 3000 }, (_, i) => boamp(1000 + i, { objet: `Volume ${T} lot ${i} prestations ${["informatique", "nettoyage", "transport"][i % 3]}` }));
    const t0 = Date.now();
    const r = await runSource(bo, { trigger: "manual", fetchImpl: mockFetch(() => ({ total_count: 3000, results: records })) });
    const importMs = Date.now() - t0;
    expect(r.created).toBe(3000);
    expect(importMs).toBeLessThan(120_000);
    // Second passage : rien n'est recréé
    const r2 = await runSource(bo, { trigger: "manual", fetchImpl: mockFetch(() => ({ total_count: 3000, results: records })) });
    expect(r2).toMatchObject({ created: 0, unchanged: 3000 });

    for (const args of [{}, { p_q: "informatique" }, { p_region: "Occitanie" }, { p_department: "974" }, { p_city: "Lyon" }, { p_sort: "deadline" }, { p_offset: 2000 }]) {
      const t = Date.now();
      const { data, error } = await anon().rpc("search_opportunities", { p_limit: 20, ...args });
      expect(error).toBeNull();
      expect((data ?? []).length).toBeLessThanOrEqual(20);
      expect(Date.now() - t).toBeLessThan(2000);
    }
    const { data: total } = await anon().rpc("search_opportunities", { p_limit: 1 });
    expect(Number(total?.[0]?.total_count)).toBeGreaterThanOrEqual(3000);
  }, 300_000);
});

describe("référentiel des villes de France", () => {
  it("importe les communes officielles sans toucher aux villes existantes", async () => {
    const { count: before } = await admin.from("places").select("id", { count: "exact", head: true }).eq("slug", "brest");
    const communes = [
      { nom: "Villetest Nord", code: "99001", codesPostaux: ["59999"], centre: { type: "Point", coordinates: [3.06, 50.63] }, population: 150000, codeDepartement: "59" },
      { nom: "Brest", code: "29019", codesPostaux: ["29200"], centre: { type: "Point", coordinates: [-4.48, 48.39] }, population: 140000, codeDepartement: "29" },
      { nom: "Petit Village", code: "99002", codesPostaux: ["59998"], centre: { type: "Point", coordinates: [3, 50] }, population: 300, codeDepartement: "59" },
    ];
    const r = await importPlaces({ force: true, fetchImpl: mockFetch(() => communes) });
    expect(r).toMatchObject({ inserted: 1 });
    const { data } = await admin.from("places").select("name, department_code, region, lat, insee_code").eq("insee_code", "99001").single();
    expect(data).toMatchObject({ name: "Villetest Nord", department_code: "59", region: "Hauts-de-France", lat: 50.63 });
    const { count: after } = await admin.from("places").select("id", { count: "exact", head: true }).eq("slug", "brest");
    expect(after).toBe(before);
    expect((await admin.from("places").select("insee_code").eq("slug", "brest").single()).data?.insee_code).toBe("29019");
    await admin.from("places").update({ insee_code: null, population: null }).eq("slug", "brest");
  });
});
