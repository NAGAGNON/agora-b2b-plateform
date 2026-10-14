import { describe, expect, it } from "vitest";
import { cleanPool, criteriaFor, matchScore, selectOpportunities, type VeilleOpportunity } from "@/lib/veille/select";
import { renderVeilleEmail, veilleSubject } from "@/lib/veille/render";
import { editionsFor, weekday } from "@/lib/veille/engine";

const now = new Date("2026-10-14T08:00:00Z");
const opp = (p: Partial<VeilleOpportunity> & { id: string }): VeilleOpportunity => ({
  title: `Marché ${p.id} de maintenance`,
  summary: "Résumé",
  description: null,
  sector_slug: "informatique",
  region: "Bretagne",
  department_code: "29",
  city: "Brest",
  type: "PUBLIC_TENDER",
  published_at: "2026-10-13T08:00:00Z",
  response_deadline: "2026-11-10T12:00:00Z",
  origin: "EXTERNAL",
  external_buyer_name: "Mairie de Brest",
  source: "BOAMP",
  ...p,
});
const none = { sectors: [], regions: [], types: [], keywords: [], company_sectors: [], company_region: null };

describe("Critères de veille", () => {
  it("préférences explicites d'abord, puis données de l'entreprise, sinon sélection générale", () => {
    expect(criteriaFor({ ...none, keywords: ["cybersécurité"] }).basis).toBe("preferences");
    expect(criteriaFor({ ...none, company_sectors: ["informatique"], company_region: "Bretagne" })).toEqual({
      basis: "entreprise",
      criteria: { sectors: ["informatique"], regions: ["Bretagne"], types: [], keywords: [] },
    });
    expect(criteriaFor(none).basis).toBeNull();
  });

  it("une annonce hors secteur ou hors région ne correspond pas ; les mots-clés seuls doivent apparaître", () => {
    const c = { sectors: ["informatique"], regions: ["Bretagne"], types: [], keywords: [] };
    expect(matchScore(opp({ id: "a" }), c)).toBe(5);
    expect(matchScore(opp({ id: "b", sector_slug: "travaux-btp" }), c)).toBeNull();
    expect(matchScore(opp({ id: "c", region: "Normandie" }), c)).toBeNull();
    const kw = { sectors: [], regions: [], types: [], keywords: ["Cybersecurite"] };
    expect(matchScore(opp({ id: "d", title: "Audit de cybersécurité du SI" }), kw)).toBe(3);
    expect(matchScore(opp({ id: "e" }), kw)).toBeNull();
  });
});

describe("Sélection des annonces", () => {
  it("exclut les annonces qui expirent sous 2 jours, sans source, en doublon", () => {
    const pool = cleanPool(
      [
        opp({ id: "ok" }),
        opp({ id: "bientot", response_deadline: "2026-10-15T08:00:00Z" }),
        opp({ id: "sans-source", source: null }),
        opp({ id: "doublon", title: "Marché ok de maintenance" }),
      ],
      now,
    );
    expect(pool.map((o) => o.id)).toEqual(["ok"]);
  });

  it("jamais une annonce déjà envoyée ; au plus 10 ; générale : 2 au plus par secteur", () => {
    const pool = Array.from({ length: 15 }, (_, i) => opp({ id: `o${i}`, sector_slug: i < 12 ? "informatique" : `s${i}` }));
    const perso = selectOpportunities(pool, { sectors: ["informatique"], regions: [], types: [], keywords: [] }, "preferences", new Set(["o0", "o1"]));
    expect(perso).toHaveLength(10);
    expect(perso.map((o) => o.id)).not.toContain("o0");
    const general = selectOpportunities(pool, { sectors: [], regions: [], types: [], keywords: [] }, null, new Set());
    expect(general.filter((o) => o.sector_slug === "informatique")).toHaveLength(2);
    expect(general).toHaveLength(5);
  });
});

describe("Calendrier des éditions", () => {
  const s = { enabled: true, launch_date: "2026-10-15", daily_cap: 150 };
  it("lancement le jeudi 15 octobre, puis lundi / vendredi et l'alerte quotidienne", () => {
    expect(weekday("2026-10-15")).toBe(4);
    expect(editionsFor("2026-10-14", s, false)).toEqual([]);
    expect(editionsFor("2026-10-15", s, false)).toEqual(["LAUNCH"]);
    expect(editionsFor("2026-10-16", s, true)).toEqual(["FRIDAY", "DAILY"]);
    expect(editionsFor("2026-10-19", s, true)).toEqual(["MONDAY", "DAILY"]);
    expect(editionsFor("2026-10-20", s, true)).toEqual(["DAILY"]);
  });
});

describe("E-mail de veille", () => {
  const base = { base: "https://www.linkprob2b.com", token: "11111111-1111-4111-8111-111111111111", sectorLabel: (s: string) => s.toUpperCase(), typeLabel: () => "Marché public" };
  it("contenu réel, liens suivis vers la fiche, désinscription, bloc quotidien, version texte", () => {
    const e = renderVeilleEmail({ ...base, kind: "MONDAY", firstName: "Anne", items: [opp({ id: "22222222-2222-4222-8222-222222222222", title: "Audit <SI>" })], basis: null, frequency: "TWICE_WEEKLY" });
    expect(e.subject).toBe("Votre veille B2B — les nouvelles opportunités de la semaine");
    expect(e.html).toContain("Audit &lt;SI&gt;");
    expect(e.html).toContain("/api/veille/c?t=11111111-1111-4111-8111-111111111111&amp;o=22222222-2222-4222-8222-222222222222");
    expect(e.html).toContain("Source : BOAMP");
    expect(e.html).toContain("Recevoir mes opportunités chaque jour");
    expect(e.html).toContain("/veille/desabonnement?jeton=");
    expect(e.html).toContain("/brand/logo-white.png");
    expect(e.html).toContain("Vous n&#39;avez pas encore indiqué vos critères");
    expect(e.text).toContain("Se désabonner : https://www.linkprob2b.com/veille/desabonnement?jeton=");
    expect(e.text).toContain("• Audit <SI>");
    expect(e.html).not.toMatch(/Re:|URGENT/);
    const daily = renderVeilleEmail({ ...base, kind: "DAILY", firstName: null, items: [opp({ id: "x" })], basis: "preferences", frequency: "DAILY" });
    expect(daily.html).not.toContain("Recevoir mes opportunités chaque jour");
    expect(daily.subject).toBe("Votre opportunité du jour correspond à vos critères");
    expect(veilleSubject("DAILY", 4)).toBe("Vos opportunités du jour — 4 correspondent à vos critères");
  });
});
