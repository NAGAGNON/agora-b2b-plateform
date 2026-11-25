/** Métier des offres non classées : tri automatique (client simulé), une seule fois par offre, jamais inventé. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, RUN } from "./helpers";
import { classifyMissingSectors } from "@/lib/collect/ai-sectors";

const ids: string[] = [];
beforeAll(async () => {
  for (const title of [`IT ${RUN} Location d'autocars avec chauffeur`, `IT ${RUN} Médicaments organes sensoriels`]) {
    const { data, error } = await admin
      .from("opportunities")
      .insert({ title, description: "Avis de test publié pour vérifier le classement automatique des offres sans métier.", origin: "EXTERNAL", type: "PUBLIC_TENDER", status: "PUBLISHED", visibility: "PUBLIC", published_at: new Date(Date.now() + 86_400_000).toISOString(), sector_slug: null })
      .select("id")
      .single();
    if (error) throw error;
    ids.push(data.id);
  }
});
afterAll(async () => {
  await admin.from("opportunities").delete().in("id", ids);
});

describe("métier des offres non classées", () => {
  it("range ce qui convient, laisse le reste sans métier, ne retraite jamais", async () => {
    let calls = 0;
    const client = {
      beta: {
        messages: {
          parse: async ({ messages }: { messages: { content: string }[] }) => {
            calls++;
            const lines = messages[0].content.split("\n");
            const items = lines.map((l, n) => ({ n, metier: /autocars/.test(l) ? "transport-logistique" : /Médicaments/.test(l) ? "aucun" : "aucun" }));
            return { parsed_output: { items } };
          },
        },
      },
    } as never;
    const r = await classifyMissingSectors(admin, { limit: 500, batch: 500, client });
    expect(r.classified).toBeGreaterThanOrEqual(1);
    const { data } = await admin.from("opportunities").select("id, sector_slug, sector_checked_at").in("id", ids);
    const bus = data!.find((o) => o.id === ids[0])!;
    const med = data!.find((o) => o.id === ids[1])!;
    expect(bus.sector_slug).toBe("transport-logistique");
    expect(med.sector_slug).toBeNull();
    expect(med.sector_checked_at).not.toBeNull();
    const before = calls;
    const again = await classifyMissingSectors(admin, { limit: 500, batch: 500, client });
    expect(calls - before).toBeLessThanOrEqual(1);
    expect(again.classified ?? 0).toBe(0);
  });
});
