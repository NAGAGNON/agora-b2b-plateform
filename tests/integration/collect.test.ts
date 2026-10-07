/** Collecte de bout en bout sur la base locale, avec réponses d'API simulées. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, RUN, user } from "./helpers";
import { runSource } from "@/lib/collect/run";
import { boampRecords, mockFetch, tedNotices } from "../fixtures/sources";

type Source = NonNullable<Awaited<ReturnType<typeof loadSource>>>;
async function loadSource(code: string) {
  const { data } = await admin.from("external_sources").select("*").eq("code", code).single();
  return data;
}

let boamp: Source, ted: Source;
const tag = `C${RUN}`;
let watcher: Awaited<ReturnType<typeof user>>;

beforeAll(async () => {
  boamp = (await loadSource("boamp"))!;
  ted = (await loadSource("ted"))!;
  // Alerte immédiate créée AVANT la collecte : elle doit se déclencher sur l'annonce collectée.
  watcher = await user("veille");
  const { error } = await watcher.client.from("alerts").insert({
    user_id: watcher.id, name: `IT ${RUN} veille pompes`, frequency: "IMMEDIATE", keywords: `pompes relevage ${tag}`, department_code: "29", include_external: true,
  });
  if (error) throw error;
});

afterAll(async () => {
  await cleanup();
  await admin.from("opportunities").delete().like("title", `%${tag}%`);
  await admin.from("external_sources").update({ last_success_at: null, last_sync_at: null, next_sync_at: null, last_error: null }).in("code", ["boamp", "ted"]);
});

describe("collecte des sources externes", () => {
  it("collecte BOAMP : création, rejet des avis incomplets, journal", async () => {
    let calledUrl = "";
    const r = await runSource(boamp, { trigger: "manual", fetchImpl: mockFetch((url) => ((calledUrl = url), { total_count: 3, results: boampRecords(tag) })) });
    expect(calledUrl).toContain("boamp-datadila.opendatasoft.com");
    // Couverture nationale : aucun filtre départemental
    expect(decodeURIComponent(calledUrl)).not.toContain("code_departement=");
    expect(r).toMatchObject({ status: "PARTIAL", fetched: 3, created: 2, skipped: 1 });
    const { data: run } = await admin.from("source_sync_runs").select("status, created").eq("id", r.runId!).single();
    expect(run).toMatchObject({ status: "PARTIAL", created: 2 });
    const { data: src } = await admin.from("external_sources").select("last_success_at, next_sync_at").eq("id", boamp.id).single();
    expect(src?.last_success_at).not.toBeNull();
  });

  it("déclenche l'alerte immédiate correspondante (notification + e-mail en file)", async () => {
    const { data: notifs } = await watcher.client.from("notifications").select("type, title, link").eq("type", "alert_match");
    expect(notifs?.length).toBe(1);
    expect(notifs?.[0].link).toMatch(/^\/opportunites\/[0-9a-f-]{36}$/);
    const { data: mails } = await admin.from("email_outbox").select("subject").eq("user_id", watcher.id);
    expect(mails?.length).toBeGreaterThan(0);
  });

  it("publie les opportunités comme externes, attribuées à leur source", async () => {
    const { data } = await anon()
      .from("opportunities")
      .select("origin, type, status, company_id, sector_slug, department_code, lat, source:opportunity_sources(original_url, external_source:external_sources(name))")
      .like("title", `%pompes de relevage ${tag}%`)
      .single();
    expect(data).toMatchObject({ origin: "EXTERNAL", type: "PUBLIC_TENDER", status: "PUBLISHED", company_id: null, sector_slug: "maintenance-industrielle", department_code: "29" });
    expect(data?.lat).not.toBeNull();
    const src = (data?.source as unknown as { original_url: string; external_source: { name: string } }[])[0];
    expect(src.external_source.name).toBe("BOAMP");
    expect(src.original_url).toMatch(/^https:\/\/www\.boamp\.fr/);
  });

  it("rattache un doublon TED à l'opportunité BOAMP existante et collecte toute la France", async () => {
    const r = await runSource(ted, { trigger: "manual", fetchImpl: mockFetch(() => ({ totalNoticeCount: 3, notices: tedNotices(tag) })) });
    expect(r).toMatchObject({ created: 2, duplicates: 1, skipped: 0 });
    // Lieu d'exécution FR101 (Paris) : département et région déduits du code NUTS
    const { data: paris } = await admin.from("opportunities").select("department_code, region").eq("external_reference", `${tag}-2028`).single();
    expect(paris).toEqual({ department_code: "75", region: "Île-de-France" });
    const { data } = await admin.from("opportunities").select("id, opportunity_sources(source_id, is_primary)").like("title", `%pompes de relevage ${tag}%`);
    expect(data).toHaveLength(1);
    expect(data![0].opportunity_sources).toHaveLength(2);
    const { data: rows } = await anon().rpc("search_opportunities", { p_q: `relevage ${tag}`, p_limit: 50 });
    expect(rows?.filter((x) => x.title.includes(tag))).toHaveLength(1);
  });

  it("détecte les modifications et ne recrée pas les annonces connues", async () => {
    const records = boampRecords(tag);
    records[1].objet = `Infogérance et support du système d'information ${tag}`;
    const r = await runSource(boamp, { trigger: "manual", fetchImpl: mockFetch(() => ({ total_count: 3, results: records })) });
    expect(r).toMatchObject({ created: 0, updated: 1, unchanged: 1 });
    const { data } = await admin.from("opportunities").select("title").eq("external_reference", `TEST-${tag}-002`).single();
    expect(data?.title).toContain("et support");
  });

  it("archive une annonce annulée à la source", async () => {
    const records = boampRecords(tag);
    records[0].nature_libelle = "Avis d'annulation";
    await runSource(boamp, { trigger: "manual", fetchImpl: mockFetch(() => ({ total_count: 3, results: records })) });
    const { data } = await admin.from("opportunities").select("status").eq("external_reference", `TEST-${tag}-001`).single();
    expect(data?.status).toBe("ARCHIVED");
  });

  it("journalise une erreur de source sans interrompre la plateforme", async () => {
    const failing = async () => new Response("indisponible", { status: 503 });
    const r = await runSource(ted, { trigger: "manual", fetchImpl: failing, retryDelays: [0, 0] });
    expect(r.status).toBe("FAILED");
    const { data } = await admin.from("external_sources").select("last_error").eq("id", ted.id).single();
    expect(data?.last_error).toMatch(/HTTP 503/);
  });

  it("refuse de collecter une source non approuvée", async () => {
    const { data: approch } = await admin.from("external_sources").select("*").eq("code", "approch").single();
    const r = await runSource(approch!, { trigger: "manual", fetchImpl: mockFetch(() => ({ results: [] })) });
    expect(r.status).toBe("FAILED");
    expect(r.errors[0]).toMatch(/non approuvée/);
  });
});
