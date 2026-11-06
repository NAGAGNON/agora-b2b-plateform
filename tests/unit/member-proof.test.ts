import { describe, expect, it } from "vitest";
import { recentGrowth } from "@/components/home/member-proof";
import { liveStats } from "@/lib/queries/platform";

describe("compteurs de membres", () => {
  it("met en avant la semaine seulement si elle est bonne, sinon le mois, sinon rien", () => {
    expect(recentGrowth({ members_7d: 31, members_30d: 53 })).toEqual({ value: 31, label: "cette semaine" });
    expect(recentGrowth({ members_7d: 1, members_30d: 12 })).toEqual({ value: 12, label: "ce mois-ci" });
    expect(recentGrowth({ members_7d: 1, members_30d: 3 })).toBeNull();
  });

  it("rien n'est affiché sans inscrit", () => {
    expect(liveStats(null)).toBeNull();
    expect(liveStats({ active: 10, new_24h: 0, new_7d: 0, regions: 0, departments: 0, last_sync_at: null, sources: [], companies: 0, members: 0 })).toBeNull();
    expect(liveStats({ active: 10, new_24h: 0, new_7d: 0, regions: 0, departments: 0, last_sync_at: null, sources: [], companies: 2, members: 53, members_7d: 31, members_30d: 53, registered_companies: 14 })).toEqual({ members: 53, members_7d: 31, members_30d: 53, companies: 14, active: 10 });
  });
});
