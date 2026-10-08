/**
 * Tableau de bord détaillé et bilan du jour : calculs sur données réelles, accès réservé,
 * bilan enregistré sans clé de rédaction (chiffres seuls, raison indiquée).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, RUN, user } from "./helpers";
import { buildDailyFacts, generateDailyReport, parisToday } from "@/lib/daily-report";

const S1 = "00000000-0000-4000-9000-" + RUN.padStart(12, "0");
const S2 = "00000000-0000-4000-9001-" + RUN.padStart(12, "0");
const S3 = "00000000-0000-4000-9002-" + RUN.padStart(12, "0");
let savedReport: unknown = null;

beforeAll(async () => {
  savedReport = (await admin.from("daily_reports").select("*").eq("day", parisToday()).maybeSingle()).data;
  // Toutes les colonnes renseignées : une insertion multiple complète les colonnes absentes par NULL
  const { error } = await admin.from("page_views").insert([
    { session_id: S1, path: "/analyses", referrer_host: "google.fr", duration_ms: 40_000 },
    { session_id: S1, path: "/opportunites", referrer_host: null, duration_ms: 20_000 },
    { session_id: S2, path: "/opportunites/selection/jeton-test", referrer_host: null, duration_ms: 10_000 },
    { session_id: S3, path: "/tarifs", referrer_host: "linkedin.com", duration_ms: 0 },
  ]);
  if (error) throw error;
});

afterAll(async () => {
  await admin.from("page_views").delete().in("session_id", [S1, S2, S3]);
  if (savedReport) await admin.from("daily_reports").upsert(savedReport as never);
  else await admin.from("daily_reports").delete().eq("day", parisToday());
  await cleanup();
});

describe("Tableau de bord détaillé", () => {
  it("canaux (référencement naturel, Outreach, réseaux sociaux), rubriques et pages d'entrée", async () => {
    const mod = await user("dash-mod", "MODERATOR");
    const { data, error } = await mod.client.rpc("admin_audience_detail", { p_days: 1 });
    expect(error).toBeNull();
    const d = data as {
      channels: { channel: string; visits: number }[];
      sections: { section: string; views: number }[];
      landing: { path: string }[];
      daily: { day: string; seo: number; outreach: number }[];
      hourly: unknown[];
    };
    const ch = (p: string) => d.channels.find((c) => c.channel.startsWith(p))?.visits ?? 0;
    expect(ch("Moteurs")).toBeGreaterThanOrEqual(1);
    expect(ch("Outreach")).toBeGreaterThanOrEqual(1);
    expect(ch("Réseaux")).toBeGreaterThanOrEqual(1);
    expect(d.sections.some((s) => s.section.startsWith("Analyses"))).toBe(true);
    expect(d.sections.some((s) => s.section === "Sélections Outreach")).toBe(true);
    // Pages d'entrée : 10 premières seulement (d'autres tests écrivent aussi des visites)
    expect(d.landing.length).toBeGreaterThan(0);
    expect(d.hourly).toHaveLength(24);
    expect(d.daily.at(-1)?.day).toBe(parisToday());
  });

  it("accès réservé : ni le public ni un membre ne lisent l'audience détaillée ou les bilans", async () => {
    const u = await user("dash-user");
    expect((await u.client.rpc("admin_audience_detail", { p_days: 7 })).error).not.toBeNull();
    expect((await anon().rpc("admin_audience_detail", { p_days: 7 })).error).not.toBeNull();
    expect((await u.client.rpc("audience_window", { p_from: new Date(0).toISOString(), p_to: new Date().toISOString() })).error).not.toBeNull();
    await admin.from("daily_reports").upsert({ day: "2000-01-01", facts: { test: true } });
    expect((await u.client.from("daily_reports").select("day")).data ?? []).toEqual([]);
    const mod = await user("dash-mod2", "MODERATOR");
    expect((await mod.client.from("daily_reports").select("day")).data ?? []).toEqual([]);
    const adm = await user("dash-admin", "ADMIN");
    expect((await adm.client.from("daily_reports").select("day").eq("day", "2000-01-01")).data).toHaveLength(1);
    expect((await u.client.from("daily_reports").insert({ day: "2000-01-02", facts: {} })).error).not.toBeNull();
    await admin.from("daily_reports").delete().eq("day", "2000-01-01");
  });
});

describe("Bilan du jour", () => {
  it("faits calculés sur les données réelles du jour", async () => {
    const f = await buildDailyFacts();
    expect(f.date).toBe(parisToday());
    expect(f.audience.aujourdhui.visites).toBeGreaterThanOrEqual(3);
    expect(f.referencement_naturel.visites_depuis_les_moteurs_aujourdhui).toBeGreaterThanOrEqual(1);
    expect(f.audience.aujourdhui.canaux.some((c) => c.canal.startsWith("Outreach"))).toBe(true);
    expect(typeof f.outreach.emails_envoyes_aujourdhui).toBe("number");
    expect(Array.isArray(f.collecte.sources)).toBe(true);
  });

  it("sans clé de rédaction : chiffres enregistrés, raison affichée, aucun texte inventé", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const r = await generateDailyReport();
      expect(r.summary).toBeNull();
      expect(r.error).toContain("ANTHROPIC_API_KEY");
      const { data } = await admin.from("daily_reports").select("facts, summary").eq("day", parisToday()).single();
      expect((data?.facts as { date: string }).date).toBe(parisToday());
      expect(data?.summary).toBeNull();
    } finally {
      if (saved) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});
