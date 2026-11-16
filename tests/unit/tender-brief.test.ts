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

const { applicationPlan } = await import("@/lib/application-plan");
describe("planning de candidature", () => {
  it("répartit les étapes jusqu'à la veille de la date limite", () => {
    const now = new Date(2026, 10, 15, 10);
    const plan = applicationPlan(new Date(2026, 10, 25, 12).toISOString(), [0], now);
    expect(plan).toHaveLength(6);
    expect(plan[0].status).toBe("done");
    expect(plan[1].status).toBe("upcoming");
    expect(plan[5].date.getDate()).toBe(24);
    expect(applicationPlan(null, [], now)).toEqual([]);
  });
  it("étape non faite dont la date est passée : en retard", () => {
    const plan = applicationPlan(new Date(2026, 10, 30).toISOString(), [], new Date(2026, 10, 20), new Date(2026, 10, 1).toISOString());
    expect(plan[1].status).toBe("late");
  });
});

import { dayLabel, upcomingSteps, applicationPlan as plan2 } from "@/lib/application-plan";

describe("activité de la semaine", () => {
  it("garde les étapes des 7 prochains jours, les retards ramenés à aujourd'hui", () => {
    const now = new Date(2026, 10, 16, 10);
    const p = plan2(new Date(2026, 10, 30).toISOString(), [0], now, new Date(2026, 10, 10).toISOString());
    const week = upcomingSteps(p, now, 7);
    expect(week.every((w) => w.offset >= 0 && w.offset <= 7)).toBe(true);
    expect(week.some((w) => w.step === 0)).toBe(false);
    expect(week.filter((w) => w.status === "late").every((w) => w.offset === 0)).toBe(true);
  });
  it("libellés de jours", () => {
    expect(dayLabel(0)).toBe("Aujourd'hui");
    expect(dayLabel(1)).toBe("Demain");
    expect(dayLabel(3)).toBe("Dans 3 jours");
  });
});

const { rewriteBriefs, BRIEF_STYLE, isCurrentBrief } = await import("@/lib/tender-brief");

/** Base de données factice : fiches, sources, cases cochées par les membres, file de réécriture. */
function fakeDb(state: { briefs: Record<string, Record<string, unknown>>; sources: Record<string, string[]>; pipeline: Record<string, { brief_done: number[]; docs_done: number[] }[]>; queue: string[] }) {
  const writes = { upserts: [] as { opportunity_id: string; content: Record<string, unknown> }[], updates: [] as { id: string; content: Record<string, unknown> }[] };
  const db = {
    rpc: async () => ({ data: state.queue.map((id) => ({ opportunity_id: id })), error: null }),
    from(table: string) {
      const filters: Record<string, string> = {};
      let payload: { content: Record<string, unknown> } | null = null;
      const result = () => {
        const id = filters.opportunity_id;
        if (table === "tender_briefs") return { data: state.briefs[id] ? { content: state.briefs[id] } : null };
        if (table === "opportunity_sources") return { data: (state.sources[id] ?? []).map((u) => ({ original_url: u })) };
        if (table === "pipeline_items") return { data: state.pipeline[id] ?? [] };
        return { data: null };
      };
      const q = {
        select: () => q,
        eq: (k: string, v: string): unknown => {
          filters[k] = v;
          if (payload) {
            writes.updates.push({ id: v, content: payload.content });
            state.briefs[v] = payload.content;
            return Promise.resolve({ error: null });
          }
          return q;
        },
        maybeSingle: async () => result(),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej),
        upsert: async (row: { opportunity_id: string; content: Record<string, unknown> }) => {
          writes.upserts.push(row);
          state.briefs[row.opportunity_id] = row.content;
          return { error: null };
        },
        update: (p: { content: Record<string, unknown> }) => {
          payload = p;
          return q;
        },
      };
      return q;
    },
  };
  return { db: db as never, writes };
}

describe("réécriture des fiches en langage simple", () => {
  const old = { summary: "Prestations récurrentes et remises en état sur bons de commande.", deadline: null, site_visit: null, duration: null, pricing: null, lots: [], documents: ["DUME", "Kbis"], judging: "Pondération : prix 40 %.", todo: ["Retirer le DCE", "Remettre l'offre"], warnings: [], certifications: [], capacity: [], submission: null, submission_url: null, criteria: [], tips: [] };
  const simple = { ...old, summary: "L'acheteur cherche une entreprise pour l'entretien de ses bâtiments.", documents: ["DUME (formulaire de candidature en ligne)", "Kbis (extrait d'immatriculation)", "Attestation d'assurance"], judging: "Le prix compte pour 40 % de la note.", todo: ["Téléchargez le dossier", "Posez vos questions", "Déposez votre offre"] };
  const client = { beta: { messages: { parse: vi.fn(async () => ({ stop_reason: "end_turn", parsed_output: structuredClone(simple) })) } } } as never;
  const notice = async () => ({ ok: true, json: async () => ({ results: [{ objet: "Entretien", donnees: "{}" }] }) });

  it("réécrit une fiche ancienne dans le style actuel", async () => {
    vi.stubGlobal("fetch", vi.fn(notice));
    const { db, writes } = fakeDb({ briefs: { a: old }, sources: { a: ["https://www.boamp.fr/pages/avis/?q=idweb:26-1"] }, pipeline: {}, queue: ["a"] });
    const r = await rewriteBriefs(db, { client, deadline: Date.now() + 10_000 });
    expect(r).toMatchObject({ rewritten: 1, failed: 0 });
    expect(writes.upserts[0].content.style).toBe(BRIEF_STYLE);
    expect(writes.upserts[0].content.summary).toBe(simple.summary);
    expect(isCurrentBrief(BriefSchema.parse(writes.upserts[0].content))).toBe(true);
    expect(isCurrentBrief(BriefSchema.parse(old))).toBe(false);
  });

  it("les cases déjà cochées par un membre gardent leur sens (listes conservées)", async () => {
    vi.stubGlobal("fetch", vi.fn(notice));
    const { db, writes } = fakeDb({ briefs: { b: old }, sources: { b: ["https://www.boamp.fr/pages/avis/?q=idweb:26-2"] }, pipeline: { b: [{ brief_done: [0, 1], docs_done: [] }] }, queue: ["b"] });
    await rewriteBriefs(db, { client, deadline: Date.now() + 10_000 });
    expect(writes.upserts[0].content.todo).toEqual(old.todo);
    expect(writes.upserts[0].content.documents).toEqual(simple.documents);
  });

  it("avis introuvable : l'ancienne fiche reste, nouvel essai plus tard", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) })));
    const { db, writes } = fakeDb({ briefs: { c: old }, sources: { c: ["https://www.boamp.fr/pages/avis/?q=idweb:26-3"] }, pipeline: {}, queue: ["c"] });
    const r = await rewriteBriefs(db, { client, deadline: Date.now() + 10_000 });
    expect(r).toMatchObject({ rewritten: 0, failed: 1 });
    expect(writes.upserts).toHaveLength(0);
    expect(writes.updates[0].content.summary).toBe(old.summary);
    expect(typeof writes.updates[0].content.rewrite_failed_at).toBe("string");
  });

  it("temps écoulé : rien n'est lancé", async () => {
    const { db, writes } = fakeDb({ briefs: { d: old }, sources: { d: ["https://www.boamp.fr/pages/avis/?q=idweb:26-4"] }, pipeline: {}, queue: ["d"] });
    const r = await rewriteBriefs(db, { client, deadline: Date.now() - 1 });
    expect(r).toMatchObject({ rewritten: 0, remaining: 1 });
    expect(writes.upserts).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
