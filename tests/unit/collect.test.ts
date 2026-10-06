import { describe, expect, it } from "vitest";
import { classifySector } from "@/lib/collect/classify";
import { boampWhere, mapBoampRecord, mapTedNotice, tedQuery, tedText } from "@/lib/collect/connectors";
import { contentHash, dedupKey, isSameConsultation, normalizeText, titleSimilarity, toDate, toIsoDeadline } from "@/lib/collect/normalize";
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

describe("formats réels observés (API BOAMP et TED, octobre 2026)", () => {
  it("lit les dates TED « date + fuseau »", () => {
    expect(toIsoDeadline("2026-10-23+02:00")).toBe("2026-10-23T21:59:00.000Z");
    expect(toDate("2026-09-15+02:00")).toBe("2026-09-15");
  });

  it("mappe un avis TED réel : date limite, nature, CPV dédoublonnés", () => {
    const r = mapTedNotice(
      {
        "publication-number": "632989-2026",
        "notice-title": { fra: "France – Services de développement de logiciels – Maintenance applicative" },
        "buyer-name": { fra: ["RECT- 35"] },
        "publication-date": "2026-09-15+02:00",
        "deadline-receipt-tender-date-lot": ["2026-10-23+02:00", "2026-10-23+02:00"],
        "place-of-performance": ["FRH03", "FRA", "FRH03"],
        "classification-cpv": ["72200000", "72267000", "72200000"],
        "contract-nature": ["services", "services"],
      },
      ["FRH01", "FRH02", "FRH03", "FRH04"],
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.item.deadline).toBe("2026-10-23T21:59:00.000Z");
      expect(r.item.publishedAt).toBe("2026-09-15");
      expect(r.item.departmentCode).toBe("35");
      expect(r.item.cpv).toEqual(["72200000", "72267000"]);
      expect(r.item.summary).toContain("Marché de services");
      expect(r.item.sectorSlug).toBe("informatique");
    }
  });

  it("filtre TED côté serveur par lieu d'exécution", () => {
    expect(tedQuery({ nuts: ["FRH01", "FRH02"] }, new Date("2026-09-15T00:00:00Z"))).toBe("place-of-performance IN (FRH01 FRH02) AND PD>=20260915 SORT BY publication-date DESC");
    expect(tedQuery({ country: "FRA" }, new Date("2026-09-15T00:00:00Z"))).toContain("buyer-country=FRA");
  });

  it.each([
    ["Confortement de la digue de Léchiagat Digue Ouvrage d'infrastructure", "travaux-btp"],
    ["Travaux de réseaux humides Alimentation en eau potable", "travaux-btp"],
    ["Marché de services Assurances Assurance", "assurances-finance"],
    ["Prestations d'entretien des espaces verts Espaces verts", "espaces-verts"],
    ["Réalisation de reportages photographiques Publicité Communication", "communication-evenementiel"],
    ["Traitement des Ordures Ménagères Résiduelles", "nettoyage-proprete"],
    ["Voyages scolaires 2026-2027 Voyage", "transport-logistique"],
    ["TRAVAUX DE REMPLACEMENT DE 6 ASI TRIPHASEES Electricité (travaux)", "electricite-automatisme"],
    ["Travaux de restauration de la tour Vauban Maçonnerie", "travaux-btp"],
  ])("classe une annonce BOAMP réelle : %s", (text, sector) => {
    expect(classifySector([], text).sector).toBe(sector);
  });

  it("classe par CPV les nouveaux secteurs", () => {
    expect(classifySector(["77310000"], "").sector).toBe("espaces-verts");
    expect(classifySector(["45233140"], "").sector).toBe("travaux-btp");
    expect(classifySector(["45331000"], "").sector).toBe("batiment-technique");
    expect(classifySector(["66510000"], "").sector).toBe("assurances-finance");
  });
});

describe("déduplication entre sources (cas réels)", () => {
  it("rapproche des intitulés d'acheteur différents pour la même consultation", () => {
    expect(isSameConsultation({ title: "Travaux de modernisation du Planétarium de Bretagne", buyer: "SYNDICAT MIXTE DU PLANETARIUM" }, { title: "Modernisation du Planétarium de Bretagne", buyer: "SYNDICAT MIXTE DU PLANETARIUM DE BRETAGNE" })).toBe(true);
    expect(isSameConsultation({ title: "Nettoyage des locaux du SDIS 22", buyer: "Service Départemental d'Incendie et de Secours des Côtes d'Armor (SDIS 22)" }, { title: "Nettoyage des locaux du SDIS 22", buyer: "Service Départemental d'Incendie et de Secours des Côtes d'Armor (SDIS 22)" })).toBe(true);
  });

  it("ne confond pas deux consultations différentes d'un même acheteur", () => {
    expect(isSameConsultation({ title: "Maintenance et nettoyage des sanitaires automatiques publics", buyer: "Ville de Quimper" }, { title: "Acquisition d'équipements pour aires de jeux d'extérieur", buyer: "Ville de Quimper" })).toBe(false);
  });
});
