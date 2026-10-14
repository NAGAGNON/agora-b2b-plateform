/**
 * Recherche d'adresses : une erreur n'est plus retentée à chaque passage (attente de 12 h),
 * un service de recherche saturé reporte la recherche sans la compter en erreur, et l'objectif
 * quotidien d'envois déclenche de nouvelles recherches tant qu'il n'est pas atteint.
 */
import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, RUN } from "./helpers";
import { enrichProspects, topUpToTarget } from "@/lib/outreach/pipeline";
import { loadSettings, type OutreachSettings } from "@/lib/outreach/data";

const T = `IT ${RUN} CIBLE`;
const siren = () => String(randomInt(100_000_000, 999_999_999));
let original: OutreachSettings;
const env = { ...process.env };

beforeAll(async () => {
  original = await loadSettings(admin);
  await admin.from("outreach_settings").update({ enrichment_enabled: true, enrichment_daily_limit: 50000 }).eq("id", true);
  process.env.OUTREACH_FREE_WEBSITE_SEARCH = "false";
  process.env.BRAVE_SEARCH_API_KEY = "cle-de-test";
});

afterAll(async () => {
  process.env = env;
  vi.unstubAllGlobals();
  await admin.from("outreach_prospects").delete().like("name", `${T}%`);
  const restore: Partial<OutreachSettings> = { ...original };
  delete restore.id;
  delete restore.updated_at;
  delete restore.updated_by;
  await admin.from("outreach_settings").update(restore).eq("id", true);
});

describe("Recherche d'adresses e-mail", () => {
  it("service saturé (429) : recherche reportée, pas d'erreur ; erreur récente : pas de nouvel essai avant 12 h", async () => {
    const insert = async (key: string, extra: Record<string, unknown>) =>
      (await admin.from("outreach_prospects").insert({ name: `${T} ${key}`, siren: siren(), source: "Test", naf_code: "43.21A", department_code: "29", region: "Bretagne", ...extra }).select("id").single()).data!.id;
    const recentError = await insert("erreur-recente", { enrichment_status: "ERROR", enriched_at: new Date(Date.now() - 3_600_000).toISOString(), enrichment_note: "Délai dépassé" });
    const pending = await insert("a-rechercher", { enrichment_status: "PENDING" });
    const calls: string[] = [];
    // Seul le service de recherche est simulé (saturé) ; la base reste réelle
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
      if (!String(url).includes("api.search.brave.com")) return realFetch(url, init);
      calls.push(String(url));
      return new Response("{}", { status: 429 });
    });
    const r = await enrichProspects(admin, { deadline: Date.now() + 15_000 });
    vi.unstubAllGlobals();
    const status = async (id: string) => (await admin.from("outreach_prospects").select("enrichment_status, enrichment_note, enriched_at").eq("id", id).single()).data;
    expect(await status(pending)).toMatchObject({ enrichment_status: "PENDING", enriched_at: null });
    expect((await status(pending))?.enrichment_note).toMatch(/limite de requêtes/);
    expect(await status(recentError)).toMatchObject({ enrichment_status: "ERROR", enrichment_note: "Délai dépassé" });
    expect(r.errors).toBe(0);
    expect(r.deferred).toBeGreaterThanOrEqual(1);
    // Après le premier refus, le service n'est plus sollicité pendant ce passage
    expect(calls.filter((u) => u.includes("api.search.brave.com")).length).toBe(1);
  });
});

describe("Objectif quotidien d'envois", () => {
  it("objectif atteint (ou nul) : aucune recherche supplémentaire", async () => {
    await admin.from("outreach_settings").update({ daily_send_target: 0 }).eq("id", true);
    expect(await topUpToTarget(admin, Date.now() + 200_000)).toMatchObject({ ran: false, reason: "Objectif du jour atteint" });
  });

  it("objectif non atteint mais passage presque terminé : rien n'est lancé à moitié", async () => {
    await admin.from("outreach_settings").update({ daily_send_target: 100, total_daily_send_cap: 100 }).eq("id", true);
    expect(await topUpToTarget(admin, Date.now() + 30_000)).toMatchObject({ ran: false, target: 100, reason: "Temps insuffisant dans ce passage" });
  });

  it("valeurs par défaut : au moins 100 e-mails par jour visés, plafond relevé en conséquence", async () => {
    const s = await loadSettings(admin);
    expect(original.daily_send_target).toBe(100);
    expect(original.total_daily_send_cap).toBeGreaterThanOrEqual(100);
    expect(s.daily_send_target).toBe(100);
  });
});
