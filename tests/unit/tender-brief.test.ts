import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const { boampId, BriefSchema } = await import("@/lib/tender-brief");

describe("fiche synthèse", () => {
  it("identifiant de l'avis BOAMP tiré de l'adresse de la source", () => {
    expect(boampId("https://www.boamp.fr/pages/avis/?q=idweb:26-108110")).toBe("26-108110");
    expect(boampId("https://ted.europa.eu/fr/notice/-/detail/123456-2026")).toBeNull();
    expect(boampId(null)).toBeNull();
  });

  it("une information absente reste vide (rien n'est inventé)", () => {
    const r = BriefSchema.safeParse({ summary: "Réhabilitation d'un collège.", deadline: "lundi 7 décembre 2026 à 12 h", site_visit: null, duration: null, pricing: null, lots: [], documents: [], judging: "Critères détaillés dans le règlement de consultation.", todo: [], warnings: [] });
    expect(r.success).toBe(true);
    expect(BriefSchema.safeParse({ summary: "x" }).success).toBe(false);
  });
});

const { isFullBrief } = await import("@/lib/tender-brief");
const { certStatus } = await import("@/lib/certification-match");

describe("préparer sa réponse", () => {
  const base = { summary: "s", deadline: null, site_visit: null, duration: null, pricing: null, lots: [], documents: [], judging: "j", todo: [], warnings: [] };

  it("une fiche ancienne reste lisible mais est reconnue comme incomplète", () => {
    const old = BriefSchema.parse(base);
    expect(isFullBrief(old)).toBe(false);
    const full = BriefSchema.parse({ ...base, certifications: ["RGE"], capacity: [], submission: null, submission_url: null, criteria: [{ label: "Prix", weight: 40 }], tips: [] });
    expect(isFullBrief(full)).toBe(true);
  });

  it("certifications : présente, à vérifier ou absente (jamais « oui » par défaut)", () => {
    expect(certStatus("Qualibat 1311 ou équivalent", ["QUALIBAT 1311"])).toBe("ok");
    expect(certStatus("Qualibat 1311 ou équivalent", ["Qualibat 1552"])).toBe("check");
    expect(certStatus("Qualification RGE", ["Qualibat RGE"])).toBe("ok");
    expect(certStatus("ISO 9001", ["MASE"])).toBe("missing");
    expect(certStatus("ISO 9001", [])).toBe("missing");
    expect(certStatus("Habilitation électrique", ["habilitation electrique B2V"])).toBe("ok");
    expect(certStatus("Habilitation électrique BR", ["Habilitation électrique B2V"])).toBe("check");
  });
});

const { buildMemoirDraft } = await import("@/lib/memoir-draft");
describe("trame du mémoire technique", () => {
  it("suit les critères de l'avis et n'invente rien", () => {
    const brief = BriefSchema.parse({ summary: "Maintenance des grues.", deadline: null, site_visit: null, duration: null, pricing: null, lots: [], documents: ["DUME"], judging: "j", todo: [], warnings: [], certifications: ["ISO 9001"], capacity: [], submission: null, submission_url: null, criteria: [{ label: "Valeur technique", weight: 60 }, { label: "Prix", weight: 40 }], tips: ["La valeur technique compte pour 60 %."] });
    const d = buildMemoirDraft({ title: "Maintenance", buyer: "Port" }, brief, { name: "ACME", city: "Brest", description: null, references: null, certifications: [], employees: null, founded: null });
    expect(d).toContain("3. Valeur technique (60 % de la note)");
    expect(d).not.toContain("4. Prix");
    expect(d).toContain("[À compléter : activité");
    expect(d).toContain("- DUME");
  });
});
