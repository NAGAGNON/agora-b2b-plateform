/** Import des résultats de marchés : avis BOAMP simulés, stockage, personnes écartées, retrait sur demande. */
import { afterAll, describe, expect, it } from "vitest";
import { admin, RUN } from "./helpers";
import { importAwards } from "@/lib/awards-import";

const idA = `IT${RUN}-1`;
const idB = `IT${RUN}-2`;
const company = `ENTREPRISE TEST ${RUN} SAS`;
afterAll(async () => {
  await admin.from("awards").delete().in("idweb", [idA, idB]);
  await admin.from("award_optouts").delete().like("winner_key", `entreprise-test-${RUN.toLowerCase()}%`);
  await admin.from("platform_settings").delete().eq("key", "awards.backfill");
});

describe("résultats des marchés", () => {
  it("importe les avis d'attribution, sans les personnes, et le classement suit", async () => {
    const day = "2026-11-20";
    const fetcher = async (url: string) => {
      const d = new URL(url).searchParams.get("where") ?? "";
      const results = d.includes(day)
        ? [
            { idweb: idA, objet: "Nettoyage des locaux communaux", nomacheteur: "Ville de Brest", titulaire: [company, "Jean Dupont"], dateparution: day, code_departement: ["29"] },
            { idweb: idB, objet: "Entretien des espaces verts", nomacheteur: "Ville de Quimper", titulaire: [company], dateparution: day, code_departement: ["29"] },
          ]
        : [];
      return new Response(JSON.stringify({ results }));
    };
    await admin.from("platform_settings").upsert({ key: "awards.backfill", value: { next: "2026-11-21", stop: "2026-11-19" } });
    const r = await importAwards(admin, { fetcher, now: new Date("2026-11-25T10:00:00Z") });
    expect(r.stored).toBeGreaterThanOrEqual(2);
    const { data } = await admin.from("awards").select("idweb, winners, region").eq("idweb", idA).single();
    expect(data?.winners).toEqual([company]);
    expect(data?.region).toBe("Bretagne");
    const key = `entreprise-test-${RUN.toLowerCase()}`;
    const { data: won } = await admin.rpc("winner_awards", { p_key: key });
    expect(won).toHaveLength(2);
    const { data: top } = await admin.rpc("top_winners", { p_region: "Bretagne", p_limit: 100 });
    expect(top?.find((t) => t.winner_key === key)?.awards).toBe(2);
    // Retrait demandé par l'entreprise : plus aucune page publique
    await admin.from("award_optouts").insert({ winner_key: key });
    expect((await admin.rpc("winner_awards", { p_key: key })).data).toHaveLength(0);
  });
});
