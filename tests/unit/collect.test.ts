import { describe, expect, it } from "vitest";
import { classifySector } from "@/lib/collect/classify";
import { boampWhere, mapBoampRecord, mapTedNotice, tedText } from "@/lib/collect/connectors";
import { contentHash, dedupKey, normalizeText, titleSimilarity, toIsoDeadline } from "@/lib/collect/normalize";
import { boampRecords, tedNotices } from "../fixtures/sources";

describe("normalisation", () => {
  it("normalise le texte et compare les titres", () => {
    expect(normalizeText("  Maintenance PRÉVENTIVE — pompes ")).toBe("maintenance preventive pompes");
    expect(titleSimilarity("Maintenance préventive des pompes de relevage", "Maintenance preventive pompes relevage")).toBeGreaterThan(0.7);
    expect(titleSimilarity("Infogérance", "Nettoyage des locaux")).toBe(0);
  });

  it("construit une clé de déduplication acheteur + date limite", () => {
    expect(dedupKey("Commune de Brest", "2026-11-20T11:00:00.000Z")).toBe("commune brest|2026-11-20");
    expect(dedupKey(null, "2026-11-20")).toBeNull();
    expect(dedupKey("Commune", null)).toBeNull();
  });

  it("convertit les dates des sources", () => {
    expect(toIsoDeadline("2026-11-20")).toMatch(/^2026-11-20T22:59/);
    expect(toIsoDeadline("2026-11-20T12:00:00+01:00")).toBe("2026-11-20T11:00:00.000Z");
    expect(toIsoDeadline("pas une date")).toBeNull();
  });
});

describe("classification sectorielle", () => {
  it("utilise le CPV en priorité puis les mots-clés", () => {
    expect(classifySector(["50511000"], "").sector).toBe("maintenance-industrielle");
    expect(classifySector(["72222300"], "").sector).toBe("informatique");
    expect(classifySector(["90910000"], "").sector).toBe("nettoyage-proprete");
    expect(classifySector([], "Audit de sécurité des systèmes d'information").sector).toBe("cybersecurite");
    expect(classifySector([], "Prestations de gardiennage du site").sector).toBe("securite-surete");
    expect(classifySector([], "Achat de fleurs").sector).toBeNull();
  });
});

describe("connecteur BOAMP", () => {
  it("construit le filtre départemental", () => {
    const w = boampWhere({ departments: ["29", "56", "x;drop"] }, new Date("2026-10-01"), new Date("2026-10-07"));
    expect(w).toBe(`dateparution >= date'2026-10-01' AND datelimitereponse >= date'2026-10-07' AND (code_departement="29" OR code_departement="56")`);
  });

  it("normalise un avis et rejette un avis incomplet", () => {
    const [a, b, c] = boampRecords("U").map((r) => mapBoampRecord(r));
    expect(a.ok && a.item).toMatchObject({ type: "PUBLIC_TENDER", departmentCode: "29", sectorSlug: "maintenance-industrielle", buyer: "Commune de Test U" });
    expect(a.ok && a.item.originalUrl).toMatch(/^https:\/\/www\.boamp\.fr/);
    expect(b.ok && b.item.departmentCode).toBe("56");
    expect(b.ok && b.item.originalUrl).toContain("TEST-U-002");
    expect(c.ok).toBe(false);
  });
});

describe("connecteur TED", () => {
  it("lit les champs multilingues", () => {
    expect(tedText({ fra: ["Bonjour"], eng: "Hello" })).toBe("Bonjour");
    expect(tedText({ deu: "Hallo" })).toBe("Hallo");
  });

  it("extrait le titre de l'acheteur, la zone et le secteur", () => {
    const [dup, soft, out] = tedNotices("U").map((n) => mapTedNotice(n, ["FRH0"]));
    expect(dup.ok && dup.item).toMatchObject({ title: "Maintenance préventive des pompes de relevage U", departmentCode: "29", sectorSlug: "maintenance-industrielle" });
    expect(soft.ok && soft.item).toMatchObject({ departmentCode: "56", sectorSlug: "informatique" });
    expect(out.ok).toBe(false);
  });

  it("rapproche un même avis publié au BOAMP et au JOUE", () => {
    const b = mapBoampRecord(boampRecords("U")[0]);
    const t = mapTedNotice(tedNotices("U")[0], []);
    if (!b.ok || !t.ok) throw new Error("mapping");
    expect(dedupKey(b.item.buyer, b.item.deadline)).toBe(dedupKey(t.item.buyer, t.item.deadline));
    expect(titleSimilarity(b.item.title, t.item.title)).toBeGreaterThanOrEqual(0.5);
    expect(contentHash(b.item)).not.toBe(contentHash(t.item));
  });
});
