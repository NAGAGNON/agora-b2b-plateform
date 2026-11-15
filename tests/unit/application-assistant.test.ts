import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { ASSISTANT_SYSTEM, askAssistant, buildAssistantContext, cleanAnswer } from "@/lib/application-assistant";

const base = {
  opportunity: { title: "Entretien des espaces verts", buyer: "Ville de Nîmes", deadline: "2026-12-01T11:00:00Z", place: "Nîmes (30)", description: "Tonte et taille.", criteria: null, constraints: null, budget: null },
  sources: [],
  brief: null,
  company: { name: "Verts Jardins", description: "Paysagiste", references: null, certifications: ["Qualipaysage"], employees: "6-10", founded: 2015 },
  stage: "INTERESTED",
};

describe("assistant de candidature", () => {
  it("impose de ne rien inventer et de renvoyer au règlement de consultation", () => {
    expect(ASSISTANT_SYSTEM).toMatch(/N'invente jamais/);
    expect(ASSISTANT_SYSTEM).toMatch(/règlement de consultation/);
  });

  it("construit le contexte avec l'offre, l'entreprise et l'avancement", async () => {
    const ctx = await buildAssistantContext(base);
    expect(ctx).toContain("Entretien des espaces verts");
    expect(ctx).toContain("Ville de Nîmes");
    expect(ctx).toContain("Qualipaysage");
    expect(ctx).toContain("gardée pour plus tard");
    expect(ctx).toContain("Avis officiel complet non disponible");
  });

  it("nettoie la mise en forme", () => {
    expect(cleanAnswer("## Titre\n**Oui**, vous pouvez.\n* point\n\n\n\nfin")).toBe("Titre\nOui, vous pouvez.\n- point\n\nfin");
  });

  it("envoie le contexte une seule fois et garde le fil des échanges", async () => {
    const create = vi.fn().mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "Réponse **claire**." }] });
    const answer = await askAssistant("CONTEXTE", [{ question: "Q1", answer: "R1" }], "Q2", { messages: { create } } as never);
    expect(answer).toBe("Réponse claire.");
    const args = create.mock.calls[0][0];
    expect(args.messages).toHaveLength(3);
    expect(JSON.stringify(args.messages[0])).toContain("CONTEXTE");
    expect(args.messages[2]).toEqual({ role: "user", content: "Q2" });
  });

  it("ne répond rien en cas de refus", async () => {
    const create = vi.fn().mockResolvedValue({ stop_reason: "refusal", content: [] });
    expect(await askAssistant("C", [], "Q", { messages: { create } } as never)).toBeNull();
  });
});
