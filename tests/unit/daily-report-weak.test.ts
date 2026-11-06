import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { weakAutomatique, automatiqueFromFacts, unknownReportNumbers } = await import("@/lib/daily-report");

const facts = {
  collecte: {
    opportunites_ajoutees_aujourdhui: 552,
    principaux_secteurs: [],
    principales_regions: [],
    sources: [
      { source: "BOAMP", statut: "SUCCESS", recues: 914, nouvelles: 106, mises_a_jour: 0, erreurs: 0 },
      { source: "TED", statut: "SUCCESS", recues: 1033, nouvelles: 0, mises_a_jour: 0, erreurs: 0 },
    ],
  },
  taches_automatiques: { derniere_execution_tache_quotidienne: null, etapes_en_echec: [], passages_du_jour: [{ heure: "05:02", passage: "matin", etapes_en_echec: [] }, { heure: "11:01", passage: "midi", etapes_en_echec: [] }] },
} as never;
const base = { titre: "t", resume: "r", points_forts: [], points_faibles: [], recommandations: [] };

describe("bilan des tâches automatiques", () => {
  it("repère une ligne vide comme « x »", () => {
    expect(weakAutomatique({ ...base, automatique: [{ domaine: "Collecte des opportunités", bilan: "x" }] })).toBe(true);
  });

  it("bilan de secours factuel, sans nombre inventé", () => {
    const auto = automatiqueFromFacts(facts);
    expect(auto[0].bilan).toBe("552 opportunités ajoutées depuis BOAMP et TED, tous les relevés réussis, sans erreur.");
    expect(auto[1].bilan).toBe("Passages de 05:02, 11:01, sans étape en échec.");
    expect(unknownReportNumbers({ ...base, automatique: auto }, facts)).toEqual([]);
  });
});
