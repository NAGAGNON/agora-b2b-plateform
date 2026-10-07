/** Analyses de marché : sélection du thème, faits réels, contrôle des chiffres, publication, droits. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, anon, RUN } from "./helpers";

const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { parse } }; } }));

const { generateArticles, runDailyArticles, unknownNumbers } = await import("@/lib/articles");

type Facts = { opportunites_ouvertes: number; theme: string; date_des_donnees: string };
// Étiquette sans chiffre : un chiffre du titre serait (à raison) refusé par le contrôle
const TAG = RUN.replace(/\d/g, (d) => "abcdefghij"[Number(d)]);
const factsOf = (req: { messages: { content: string }[] }) => JSON.parse(req.messages[0].content.split("\n\n")[1]) as Facts;

function article(f: Facts, extra = "") {
  return {
    title: `Marchés publics en Bretagne : ${f.theme} (${TAG})`,
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
  await admin.from("articles").delete().like("title", `%(${TAG})%`);
  await admin.from("opportunities").delete().in("id", ids);
});

describe("analyses de marché", () => {
  it("rédige à partir des seules données réelles et publie un article conforme", async () => {
    parse.mockImplementation(async (req) => ({ stop_reason: "end_turn", parsed_output: article(factsOf(req)), model: "claude-opus-5-5" }));
    const r = await generateArticles(1, { autoPublish: true });
    expect(r.generated?.[0]?.status).toBe("PUBLISHED");
    const facts = factsOf(parse.mock.calls[0][0]);
    expect(facts.opportunites_ouvertes).toBeGreaterThanOrEqual(5);
    const { data } = await anon().from("articles").select("slug, status, facts").like("title", `%(${TAG})%`);
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

  it("réécrit l'article quand un chiffre est bloqué, puis le publie s'il devient conforme", async () => {
    parse.mockReset();
    let call = 0;
    parse.mockImplementation(async (req) => {
      call++;
      const f = factsOf(req);
      // 1re rédaction : chiffre inventé ; 2e : la consigne de correction est reçue et l'article est conforme
      if (call === 1) return { stop_reason: "end_turn", parsed_output: article(f, "Hausse de 424242 %."), model: "claude-opus-5-5" };
      expect(req.messages[0].content).toMatch(/424242/);
      return { stop_reason: "end_turn", parsed_output: article(f), model: "claude-opus-5-5" };
    });
    const r = await generateArticles(1, { autoPublish: true });
    expect(call).toBe(2);
    expect(r.generated?.[0]?.status).toBe("PUBLISHED");
  });

  it("garantit au moins un article publié par jour : thème de secours et quota calculé sur les articles publiés", async () => {
    parse.mockReset();
    parse.mockImplementation(async (req) => ({ stop_reason: "end_turn", parsed_output: article(factsOf(req)), model: "claude-opus-5-5" }));
    // Tous les thèmes mensuels déjà traités : seule reste la synthèse bretonne du jour
    const month = new Date().toISOString().slice(0, 7);
    const { candidateTopics } = await import("@/lib/articles");
    const topics = candidateTopics({ opps: [], sectors: new Map(), departments: new Map(), types: new Map(), used: new Set() } as never);
    expect(topics).toEqual([]); // aucune donnée : aucun thème, rien n'est inventé
    const day = new Date().toISOString().slice(0, 10);
    const fake = Array.from({ length: 6 }, (_, i) => ({ id: String(i), title: "t", type: "PUBLIC_TENDER", origin: "EXTERNAL", external_buyer_name: null, city: null, department_code: null, sector_slug: null, response_deadline: null, published_at: null }));
    const only = candidateTopics({ opps: fake, sectors: new Map(), departments: new Map(), types: new Map(), used: new Set([`secteur:x:${month}`]) } as never);
    expect(only.map((t) => t.key)).toEqual([`bretagne:${day}`]);

    // Un brouillon créé aujourd'hui ne remplit pas le quota : la tâche quotidienne publie quand même un article
    await admin.from("platform_settings").upsert({ key: "seo", value: { articles_enabled: true, articles_auto_publish: true, articles_per_day: 1 } });
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    await admin.from("articles").update({ published_at: new Date(since.getTime() - 3600_000).toISOString() }).gte("published_at", since.toISOString());
    const r = await runDailyArticles();
    expect(r.generated?.filter((g) => g.status === "PUBLISHED").length).toBe(1);
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
