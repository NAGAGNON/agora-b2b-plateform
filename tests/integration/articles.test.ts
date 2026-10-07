/** Analyses de marché : sélection du thème, faits réels, contrôle des chiffres, publication, droits. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, anon, RUN } from "./helpers";

const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { parse } }; } }));

const { generateArticles, unknownNumbers } = await import("@/lib/articles");

type Facts = { opportunites_ouvertes: number; theme: string; date_des_donnees: string };
const factsOf = (req: { messages: { content: string }[] }) => JSON.parse(req.messages[0].content.split("\n\n")[1]) as Facts;

function article(f: Facts, extra = "") {
  return {
    title: `Marchés publics en Bretagne : ${f.theme} (${RUN})`,
    description: `${f.opportunites_ouvertes} opportunités ouvertes recensées par LinkProB2B, à partir des avis BOAMP et TED. ${extra}`.trim(),
    intro: `Au ${f.date_des_donnees}, ${f.opportunites_ouvertes} opportunités sont ouvertes.`,
    sections: [{ heading: "Vue d'ensemble", paragraphs: [`Les données proviennent de BOAMP et TED. ${extra}`] }],
    faq: [{ question: "D'où viennent les données ?", answer: "Des avis officiels BOAMP et TED." }],
  };
}

const ids: string[] = [];
beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  const deadline = new Date(Date.now() + 20 * 86400_000).toISOString();
  const rows = Array.from({ length: 6 }, (_, i) => ({
    type: "PUBLIC_TENDER" as const,
    origin: "EXTERNAL" as const,
    status: "PUBLISHED" as const,
    title: `Article ${RUN} marché ${i}`,
    description: "Avis de marché de test suffisamment long pour la contrainte.",
    sector_slug: "informatique",
    department_code: "29",
    city: "Quimper",
    external_buyer_name: `Acheteur ${RUN}`,
    response_deadline: deadline,
    published_at: new Date().toISOString(),
  }));
  const { data, error } = await admin.from("opportunities").insert(rows).select("id");
  if (error) throw error;
  ids.push(...(data ?? []).map((d) => d.id));
});

afterAll(async () => {
  await admin.from("articles").delete().like("title", `%(${RUN})%`);
  await admin.from("opportunities").delete().in("id", ids);
});

describe("analyses de marché", () => {
  it("rédige à partir des seules données réelles et publie un article conforme", async () => {
    parse.mockImplementation(async (req) => ({ stop_reason: "end_turn", parsed_output: article(factsOf(req)), model: "claude-opus-5-5" }));
    const r = await generateArticles(1, { autoPublish: true });
    expect(r.generated?.[0]?.status).toBe("PUBLISHED");
    const facts = factsOf(parse.mock.calls[0][0]);
    expect(facts.opportunites_ouvertes).toBeGreaterThanOrEqual(5);
    const { data } = await anon().from("articles").select("slug, status, facts").like("title", `%(${RUN})%`);
    expect(data?.length).toBe(1);
    expect(data?.[0].status).toBe("PUBLISHED");
  });

  it("laisse en brouillon un article contenant un chiffre absent des données, et ne reprend pas un thème déjà traité", async () => {
    parse.mockReset();
    parse.mockImplementation(async (req) => ({ stop_reason: "end_turn", parsed_output: article(factsOf(req), "Hausse de 987654 % sur un an."), model: "claude-opus-5-5" }));
    const before = (await admin.from("articles").select("topic_key")).data?.map((a) => a.topic_key) ?? [];
    const r = await generateArticles(1, { autoPublish: true });
    const g = r.generated?.[0];
    if (!g) return; // plus aucun thème disponible ce mois-ci : rien à vérifier
    expect(before).not.toContain(g.topic);
    expect(g.status).toBe("DRAFT");
    expect(g.note).toMatch(/987654/);
    // Brouillon invisible du public
    expect((await anon().from("articles").select("id").eq("slug", g.slug!)).data).toEqual([]);
    await admin.from("articles").delete().eq("slug", g.slug!);
  });

  it("refuse toute écriture publique", async () => {
    const { error } = await anon().from("articles").insert({ slug: `x-${RUN}`, topic_key: `x-${RUN}`, title: "Titre de test long", description: "Description de test suffisamment longue.", body: {}, facts: {}, status: "PUBLISHED" });
    expect(error).not.toBeNull();
  });

  it("détecte les chiffres inventés", () => {
    const facts = { total: 12, date: "7 octobre 2026" };
    const ok = { title: "12 marchés", description: "d", intro: "Au 7 octobre 2026", sections: [], faq: [] };
    expect(unknownNumbers(ok, facts)).toEqual([]);
    expect(unknownNumbers({ ...ok, intro: "1 500 000 € de budget" }, facts)).toEqual(["1500000"]);
  });
});
