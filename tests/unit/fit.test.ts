import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getSession: async () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
import { fitReasons } from "@/lib/fit";

const profile = { sectors: ["travaux-btp"], skills: ["couverture", "zinguerie", "ab"], department: "69", region: "Auvergne-Rhône-Alpes" };

describe("Pourquoi cette offre vous concerne", () => {
  it("métier, département et compétence citée (sans accents ni majuscules)", () => {
    expect(fitReasons({ sector_slug: "travaux-btp", department_code: "69", title: "Réfection de la COUVERTURE du gymnase" }, profile)).toEqual(["Votre métier", "Votre département", "« couverture »"]);
  });
  it("région quand le département diffère ; compétences trop courtes ignorées", () => {
    expect(fitReasons({ sector_slug: "nettoyage-proprete", department_code: "38", region: "Auvergne-Rhône-Alpes", title: "Lot ab nettoyage" }, profile)).toEqual(["Votre région"]);
  });
  it("aucune raison inventée", () => {
    expect(fitReasons({ sector_slug: null, department_code: "13", region: "Provence-Alpes-Côte d'Azur", title: "Fourniture de papier" }, profile)).toEqual([]);
  });
});
